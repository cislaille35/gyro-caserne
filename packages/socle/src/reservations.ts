import { and, asc, count, desc, eq, inArray, isNull, lt, ne, sql, type SQL } from 'drizzle-orm';
import type { Base } from './base.ts';
import { ajouterJours, exigerDate, exigerDateHeure } from './dates.ts';
import { accorde, droitsDe, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { NOMS_ICONES, type NomIcone } from './icones.ts';
import { ligneJournal } from './journal.ts';
import { STATUTS_AVEC_ACCES, type EtatReservation, type FormeRessource } from './listes.ts';
import { marquerAvisLus, mettreEnFile } from './notifications.ts';
import { chevauche, jourCourt, periodeCourte, restantParJour, tientUnePlace } from './reservations-calcul.ts';
import { avisReservation, comite, personne, profil, reservation, ressource } from './schema.ts';

// Réservations : la VL, le matériel de l'amicale, et toute autre ressource. La ressource dit qui la gère (un rôle ou un comité) ;
// sa forme dit la règle : par créneau, acceptée d'office si libre ; par jours, toujours à valider, dans la limite du stock.

export type Ressource = {
	id: number;
	nom: string;
	forme: FormeRessource;
	stock: number | null;
	icone: NomIcone;
	ouverteReserve: boolean;
	gestionnaire: { type: 'role' | 'comite'; id: number; nom: string };
	jeGere: boolean;
};

export type VueReservation = {
	id: number;
	ressourceId: number;
	ressource: string;
	forme: FormeRessource;
	debut: string;
	fin: string;
	quantite: number;
	mot: string | null;
	etat: EtatReservation;
	demandeur: string;
	// Le nom saisi par le compte de la réserve citoyenne ; nul pour un agent.
	nomDemandeur: string | null;
	telephone: string | null;
	motif: string | null;
	creeLe: string;
	mienne: boolean;
	annulable: boolean;
};

const DUREE_MAX_JOURS = 14;
const STOCK_MAX = 999;
const MOTIF_RETRAIT = 'Ressource retirée';
const MOTIF_CONFLIT = 'Créneau donné à une autre demande';
const STATUTS = sql.raw(STATUTS_AVEC_ACCES.map((s) => `'${s}'`).join(', '));

const auteurDe = (acteur: Acteur) => (acteur.type === 'super' ? `super:${acteur.email}` : `personne:${acteur.id}`);
const refusGestion = (id: number) => new RefusDroit('GERER_RESERVATIONS', { type: 'ressource', id }, 'Réservé à qui gère cette ressource');

// La personne gère la ressource de la ligne courante (table `ressource`) : elle a accès et tient aujourd'hui le rôle gestionnaire,
// ou un rôle dans le comité gestionnaire (non dissous). Rôle archivé ou hors de son type de périmètre : rien.
function gere(personneId: SQL | number, aujourdhui: string): SQL {
	return sql`exists (select 1 from attribution a
		join responsabilite x on x.id = a.responsabilite_id
		join personne p on p.id = a.personne_id
		where a.personne_id = ${personneId} and p.statut in (${STATUTS}) and x.archivee_le is null and a.perimetre_type = x.type_perimetre
			and a.debut <= ${aujourdhui} and (a.fin is null or a.fin >= ${aujourdhui})
			and (a.responsabilite_id = "ressource"."geree_par_responsabilite_id"
				or (a.perimetre_type = 'comite' and a.perimetre_id = "ressource"."geree_par_comite_id"
					and exists (select 1 from comite c where c.id = a.perimetre_id and c.dissous_le is null))))`;
}

const jeGereSql = (acteur: Acteur, aujourdhui: string): SQL => (acteur.type === 'super' ? sql`1` : gere(acteur.id, aujourdhui));

// Les personnes qui gèrent une ressource : sous-requête d'identifiants, à passer aux notifications.
export const gestionnairesDe = (base: Base, ressourceId: number, aujourdhui: string) =>
	base
		.select({ id: personne.id })
		.from(personne)
		.where(sql`exists (select 1 from ressource where ressource.id = ${ressourceId} and ${gere(sql`"personne"."id"`, aujourdhui)})`);

const champsRessource = (acteur: Acteur, aujourdhui: string) => ({
	id: ressource.id,
	nom: ressource.nom,
	forme: ressource.forme,
	stock: ressource.stock,
	icone: ressource.icone,
	ouverteReserve: ressource.ouverteReserve,
	roleId: ressource.gereeParResponsabiliteId,
	comiteId: ressource.gereeParComiteId,
	retireeLe: ressource.retireeLe,
	nomGestionnaire: sql<string>`coalesce((select r.nom from responsabilite r where r.id = "ressource"."geree_par_responsabilite_id"), (select c.nom from comite c where c.id = "ressource"."geree_par_comite_id"), '')`.as('nom_gestionnaire'),
	jeGere: sql<number>`${jeGereSql(acteur, aujourdhui)}`.as('je_gere'),
	attente: sql<number>`(select count(*) from reservation v where v.ressource_id = "ressource"."id" and v.etat = 'attente' and substr(v.fin, 1, 10) >= ${aujourdhui})`.as('attente')
});

type LigneRessource = { id: number; nom: string; forme: FormeRessource; stock: number | null; icone: string; ouverteReserve: number; roleId: number | null; comiteId: number | null; retireeLe: string | null; nomGestionnaire: string; jeGere: number; attente: number };

const versRessource = (r: LigneRessource): Ressource => ({
	id: r.id,
	nom: r.nom,
	forme: r.forme,
	stock: r.stock,
	icone: ((NOMS_ICONES as readonly string[]).includes(r.icone) ? r.icone : 'outil') as NomIcone,
	ouverteReserve: r.ouverteReserve === 1,
	gestionnaire: r.roleId !== null ? { type: 'role', id: r.roleId, nom: r.nomGestionnaire } : { type: 'comite', id: r.comiteId!, nom: r.nomGestionnaire },
	jeGere: r.jeGere === 1
});

// Les comités où l'acteur tient un rôle aujourd'hui (tous les comités pour le super administrateur) : ceux pour lesquels il peut ajouter du matériel.
function mesComites(base: Base, acteur: Acteur, aujourdhui: string) {
	const existants = isNull(comite.dissousLe);
	if (acteur.type === 'super') return base.select({ id: comite.id, nom: comite.nom }).from(comite).where(existants).orderBy(asc(comite.nom));
	return base
		.select({ id: comite.id, nom: comite.nom })
		.from(comite)
		.where(
			and(
				existants,
				sql`exists (select 1 from attribution a join responsabilite x on x.id = a.responsabilite_id join personne p on p.id = a.personne_id
					where a.personne_id = ${acteur.id} and p.statut in (${STATUTS}) and a.perimetre_type = 'comite' and x.type_perimetre = 'comite' and a.perimetre_id = "comite"."id"
						and x.archivee_le is null and a.debut <= ${aujourdhui} and (a.fin is null or a.fin >= ${aujourdhui}))`
			)
		)
		.orderBy(asc(comite.nom));
}

// Qui est l'acteur pour les réservations : ses droits, et s'il est le compte de la réserve citoyenne (profil extérieur).
async function quiEst(base: Base, acteur: Acteur, aujourdhui: string) {
	const droits = await droitsDe(base, acteur, aujourdhui);
	if (acteur.type === 'super') return { droits, reserveCitoyenne: false };
	const [fiche] = await base.select({ type: profil.typePersonne }).from(personne).leftJoin(profil, eq(profil.id, personne.profilId)).where(eq(personne.id, acteur.id));
	return { droits, reserveCitoyenne: fiche?.type === 'exterieur' };
}

type Qui = Awaited<ReturnType<typeof quiEst>>;
const peutReserver = (qui: Qui, r: Ressource) => accorde(qui.droits, 'RESERVER', { type: 'ressource', id: r.id }) && (!qui.reserveCitoyenne || r.ouverteReserve);
const voit = (qui: Qui, r: Ressource) => r.jeGere || peutReserver(qui, r);
const parRang = (a: Ressource, b: Ressource) => (a.forme === b.forme ? a.nom.localeCompare(b.nom, 'fr') : a.forme === 'creneau' ? -1 : 1);

// Caserne → Réservations : les ressources visibles (créneaux d'abord, puis par nom), ce qui attend chez qui gère.
export async function ressourcesDe(base: Base, acteur: Acteur, aujourdhui: string) {
	exigerDate(aujourdhui);
	const qui = await quiEst(base, acteur, aujourdhui);
	const [lignes, comites, [miennes]] = await base.batch([
		base.select(champsRessource(acteur, aujourdhui)).from(ressource).where(isNull(ressource.retireeLe)),
		mesComites(base, acteur, aujourdhui),
		base
			.select({ n: count() })
			.from(reservation)
			.where(and(eq(reservation.personneId, moiDe(acteur) ?? 0), enCoursDeDemande, sql`substr(${reservation.fin}, 1, 10) >= ${aujourdhui}`))
	]);
	const ressources = lignes.map(versRessource).filter((r) => voit(qui, r)).sort(parRang);
	return {
		ressources,
		peutReserver: accorde(qui.droits, 'RESERVER', { type: 'centre' }),
		reserveCitoyenne: qui.reserveCitoyenne,
		aValider: lignes.filter((l) => l.jeGere === 1).reduce((n, l) => n + l.attente, 0),
		mesAVenir: miennes?.n ?? 0,
		peutGererMateriel: comites.length > 0 || ressources.some((r) => r.jeGere && r.forme === 'jours')
	};
}

async function lireRessource(base: Base, acteur: Acteur, id: number, aujourdhui: string) {
	if (!Number.isInteger(id) || id < 1) throw new DonneeInvalide('Ressource introuvable');
	const [ligne] = await base.select(champsRessource(acteur, aujourdhui)).from(ressource).where(eq(ressource.id, id));
	if (!ligne || ligne.retireeLe !== null) throw new DonneeInvalide('Ressource introuvable');
	return versRessource(ligne);
}

const champsReservation = {
	id: reservation.id,
	ressourceId: reservation.ressourceId,
	ressourceNom: sql<string>`${ressource.nom}`.as('ressource_nom'),
	forme: ressource.forme,
	personneId: reservation.personneId,
	prenom: personne.prenom,
	nomPersonne: sql<string>`${personne.nom}`.as('nom_personne'),
	nomDemandeur: reservation.nomDemandeur,
	telephone: reservation.telephone,
	debut: reservation.debut,
	fin: reservation.fin,
	quantite: reservation.quantite,
	mot: reservation.mot,
	etat: reservation.etat,
	motif: reservation.motif,
	creeLe: reservation.creeLe
};

type LigneReservation = { id: number; ressourceId: number; ressourceNom: string; forme: FormeRessource; personneId: number; prenom: string; nomPersonne: string; nomDemandeur: string | null; telephone: string | null; debut: string; fin: string; quantite: number; mot: string | null; etat: EtatReservation; motif: string | null; creeLe: string };

const lignesReservations = (base: Base) => base.select(champsReservation).from(reservation).innerJoin(ressource, eq(ressource.id, reservation.ressourceId)).innerJoin(personne, eq(personne.id, reservation.personneId));

// Commencée : pour des jours, dès le premier jour ; pour un créneau, dès l'heure de début.
const commencee = (debut: string, maintenant: string) => debut <= maintenant.slice(0, debut.length);
const active = (etat: string) => tientUnePlace(etat);

function vue(l: LigneReservation, moi: number | null, gestionnaire: boolean, maintenant: string): VueReservation {
	const mienne = l.personneId === moi;
	return {
		id: l.id,
		ressourceId: l.ressourceId,
		ressource: l.ressourceNom,
		forme: l.forme,
		debut: l.debut,
		fin: l.fin,
		quantite: l.quantite,
		mot: l.mot,
		etat: l.etat,
		demandeur: l.nomDemandeur ?? `${l.prenom} ${l.nomPersonne}`.trim(),
		nomDemandeur: l.nomDemandeur,
		telephone: mienne || gestionnaire ? l.telephone : null,
		motif: l.motif,
		creeLe: l.creeLe,
		mienne,
		annulable: mienne && active(l.etat) && !commencee(l.debut, maintenant)
	};
}

const moiDe = (acteur: Acteur) => (acteur.type === 'personne' ? acteur.id : null);
const dansLaPeriode = (du: string, au: string) => and(sql`substr(${reservation.debut}, 1, 10) <= ${au}`, sql`substr(${reservation.fin}, 1, 10) >= ${du}`);
const enCoursDeDemande = inArray(reservation.etat, ['attente', 'acceptee']);

// Le calendrier d'une ressource : les demandes en attente et réservations acceptées qui touchent [du, au].
export async function calendrier(base: Base, acteur: Acteur, id: number, du: string, au: string, aujourdhui: string): Promise<{ ressource: Ressource; reservations: VueReservation[]; peutReserver: boolean; reserveCitoyenne: boolean }> {
	exigerDate(du);
	exigerDate(au);
	const qui = await quiEst(base, acteur, aujourdhui);
	const r = await lireRessource(base, acteur, id, aujourdhui);
	if (!voit(qui, r)) throw new RefusDroit('RESERVER', { type: 'ressource', id }, 'Ressource non accessible');
	const lignes = await lignesReservations(base)
		.where(and(eq(reservation.ressourceId, id), enCoursDeDemande, dansLaPeriode(du, au)))
		.orderBy(asc(reservation.debut), asc(reservation.id));
	return { ressource: r, reservations: lignes.map((l) => vue(l, moiDe(acteur), r.jeGere, `${aujourdhui}T00:00`)), peutReserver: acteur.type === 'personne' && peutReserver(qui, r), reserveCitoyenne: qui.reserveCitoyenne };
}

function texteFacultatif(valeur: unknown, libelle: string, max: number): string | null {
	const propre = typeof valeur === 'string' ? valeur.trim() : '';
	if (propre.length > max) throw new DonneeInvalide(`${libelle} trop long`);
	return propre || null;
}

function nomObligatoire(valeur: unknown, libelle: string, max: number): string {
	const propre = texteFacultatif(valeur, libelle, max);
	if (!propre) throw new DonneeInvalide(`${libelle} obligatoire`);
	return propre;
}

// Une période valide pour la forme : bornes au bon format, fin après le début, à venir, à moins d'un an, 14 jours au plus.
function periode(forme: FormeRessource, debut: string, fin: string, maintenant: string): { debut: string; fin: string } {
	const aujourdhui = maintenant.slice(0, 10);
	if (forme === 'jours') {
		exigerDate(debut);
		exigerDate(fin);
		if (fin < debut) throw new DonneeInvalide('La fin précède le début');
		if (debut < aujourdhui) throw new DonneeInvalide('Début déjà passé');
	} else {
		exigerDateHeure(debut, 'Début');
		exigerDateHeure(fin, 'Fin');
		debut = debut.slice(0, 16);
		fin = fin.slice(0, 16);
		if (fin <= debut) throw new DonneeInvalide('La fin précède le début');
		if (debut < maintenant.slice(0, 16)) throw new DonneeInvalide('Début déjà passé');
	}
	if (debut.slice(0, 10) >= ajouterJours(aujourdhui, 365)) throw new DonneeInvalide('Réservation à moins d’un an');
	const derniereFin = forme === 'jours' ? ajouterJours(debut, DUREE_MAX_JOURS - 1) : `${ajouterJours(debut.slice(0, 10), DUREE_MAX_JOURS)}${debut.slice(10)}`;
	if (fin > derniereFin) throw new DonneeInvalide(`${DUREE_MAX_JOURS} jours au plus`);
	return { debut, fin };
}

// Ce qui reste au jour le plus pris, ou rien si la quantité tient.
function manque(r: { nom: string; stock: number | null }, prises: { debut: string; fin: string; quantite: number; etat: string }[], p: { debut: string; fin: string }, quantite: number): { jour: string; restant: number } | null {
	const plusPris = restantParJour(r.stock ?? 0, prises, p.debut, p.fin).reduce((a, b) => (b.restant < a.restant ? b : a));
	return quantite > plusPris.restant ? { jour: plusPris.jour, restant: Math.max(0, plusPris.restant) } : null;
}

export type DemandeReservation = { debut: string; fin: string; quantite?: number; mot?: string; nomDemandeur?: string; telephone?: string };

export async function reserver(base: Base, acteur: Acteur, id: number, d: DemandeReservation, maintenant: string): Promise<{ id: number; etat: 'attente' | 'acceptee' }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux personnes ayant une fiche');
	const qui = await quiEst(base, acteur, aujourdhui);
	const r = await lireRessource(base, acteur, id, aujourdhui);
	if (!peutReserver(qui, r)) throw new RefusDroit('RESERVER', { type: 'ressource', id }, 'Vous ne pouvez pas réserver cette ressource');
	const p = periode(r.forme, d.debut, d.fin, maintenant);
	const quantite = r.forme === 'jours' ? (d.quantite ?? 0) : 1;
	if (!Number.isInteger(quantite) || quantite < 1) throw new DonneeInvalide('Quantité invalide');
	const mot = texteFacultatif(d.mot, 'Mot', 200);
	const nomDemandeur = qui.reserveCitoyenne ? nomObligatoire(d.nomDemandeur, 'Nom du demandeur', 60) : null;
	const telephone = qui.reserveCitoyenne ? texteFacultatif(d.telephone, 'Téléphone', 20) : null;

	if (r.forme === 'jours') {
		const prises = await base
			.select({ debut: reservation.debut, fin: reservation.fin, quantite: reservation.quantite, etat: reservation.etat })
			.from(reservation)
			.where(and(eq(reservation.ressourceId, id), enCoursDeDemande, dansLaPeriode(p.debut, p.fin)));
		const m = manque(r, prises, p, quantite);
		if (m) throw new DonneeInvalide(m.restant === 0 ? `${r.nom} : il n’en reste plus le ${jourCourt(m.jour)}` : `${r.nom} : il en reste ${m.restant} le ${jourCourt(m.jour)}`);
	}
	// Créneau : libre ou pris se décide à l'écriture même, pour que deux demandes simultanées ne soient pas toutes deux acceptées.
	const chevauchement = sql`exists (select 1 from reservation x where x.ressource_id = ${id} and x.etat in ('attente', 'acceptee') and x.debut < ${p.fin} and ${p.debut} < x.fin)`;
	const etat = r.forme === 'creneau' ? sql<EtatReservation>`case when ${chevauchement} then 'attente' else 'acceptee' end` : 'attente';
	const derniere = sql`(select max(id) from reservation)`;
	const demandeur = nomDemandeur ?? (await nomDe(base, acteur.id));

	const [[cree]] = await base.batch([
		base
			.insert(reservation)
			.values({ ressourceId: id, personneId: acteur.id, nomDemandeur, telephone, debut: p.debut, fin: p.fin, quantite, mot, etat, creeLe: maintenant })
			.returning({ id: reservation.id, etat: reservation.etat }),
		ligneJournal(base, { acteur: auteurDe(acteur), action: 'reserver', cibleType: 'reservation', cibleId: derniere, details: { ressourceId: id } }, maintenant),
		// Une demande à trancher sonne chez qui gère ; elle reste ensuite comptée dans leur cloche (nombreAValider).
		demandeAuxGestionnaires(base, acteur.id, r, { demandeur, quantite, ...p }, sql`exists (select 1 from reservation where id = ${derniere} and etat = 'attente')`, aujourdhui, maintenant)
	]);
	return { id: cree!.id, etat: cree!.etat as 'attente' | 'acceptee' };
}

async function nomDe(base: Base, id: number): Promise<string> {
	const [p] = await base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.id, id));
	return `${p?.prenom ?? ''} ${p?.nom ?? ''}`.trim();
}

function demandeAuxGestionnaires(base: Base, demandeurId: number, r: Ressource, d: { demandeur: string; quantite: number; debut: string; fin: string }, si: SQL, aujourdhui: string, maintenant: string) {
	const texte = [d.demandeur, ...(r.forme === 'jours' ? [String(d.quantite)] : []), periodeCourte(r.forme, d.debut, d.fin)].join(', ');
	const qui = base.select({ id: personne.id }).from(personne).where(and(inArray(personne.id, gestionnairesDe(base, r.id, aujourdhui)), ne(personne.id, demandeurId)));
	return mettreEnFile(base, qui, 'reservations', { titre: `Demande de réservation · ${r.nom}`, texte, url: '/reservations/a-valider', tag: 'reservations-a-valider' }, maintenant, si);
}

const TITRES_AVIS = { acceptee: 'demande acceptée', refusee: 'demande refusée', annulee: 'réservation annulée' } as const;

// Ce qu'apprend le demandeur d'une décision de qui gère : un avis dans sa cloche et un envoi au téléphone. Rien s'il a tranché lui-même,
// ni si la décision n'a pas été écrite (un autre gestionnaire a tranché juste avant) : la réservation doit porter cette décision-ci.
function prevenir(base: Base, acteur: Acteur, l: { id: number; personneId: number; ressourceNom: string; forme: FormeRessource; debut: string; fin: string }, quoi: keyof typeof TITRES_AVIS, motif: string | null, maintenant: string) {
	if (l.personneId === moiDe(acteur)) return [];
	const texte = [periodeCourte(l.forme, l.debut, l.fin), ...(motif ? [motif] : [])].join(' · ');
	const decidee = and(eq(reservation.id, l.id), eq(reservation.etat, quoi), eq(reservation.trancheePar, auteurDe(acteur)), eq(reservation.trancheeLe, maintenant));
	return [
		base.insert(avisReservation).select(
			base
				.select({
					id: sql<number | null>`null`.as('id'),
					personneId: reservation.personneId,
					reservationId: reservation.id,
					quoi: sql<string>`${quoi}`.as('quoi'),
					creeLe: sql<string>`${maintenant}`.as('cree_le'),
					lueLe: sql<string | null>`null`.as('lue_le')
				})
				.from(reservation)
				.where(decidee)
		),
		mettreEnFile(base, [l.personneId], 'reservations', { titre: `${l.ressourceNom} : ${TITRES_AVIS[quoi]}`, texte, url: '/reservations/miennes', tag: `reservation:${l.id}` }, maintenant, sql`exists ${base.select({ un: sql`1` }).from(reservation).where(decidee)}`)
	];
}

// Une réservation et sa ressource, vue par l'acteur.
async function lireReservation(base: Base, acteur: Acteur, id: number, aujourdhui: string) {
	if (!Number.isInteger(id) || id < 1) throw new DonneeInvalide('Réservation introuvable');
	const [ligne] = await base
		.select({ ...champsReservation, stock: ressource.stock, jeGere: sql<number>`${jeGereSql(acteur, aujourdhui)}`.as('je_gere') })
		.from(reservation)
		.innerJoin(ressource, eq(ressource.id, reservation.ressourceId))
		.innerJoin(personne, eq(personne.id, reservation.personneId))
		.where(eq(reservation.id, id));
	if (!ligne) throw new DonneeInvalide('Réservation introuvable');
	return ligne;
}

const tranchee = (acteur: Acteur, maintenant: string) => ({ trancheePar: auteurDe(acteur), trancheeLe: maintenant });

export async function accepter(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const l = await lireReservation(base, acteur, id, aujourdhui);
	if (l.jeGere !== 1) throw refusGestion(l.ressourceId);
	if (l.etat !== 'attente') throw new DonneeInvalide('Cette demande a déjà été traitée');
	const autres = await base
		.select({ id: reservation.id, personneId: reservation.personneId, debut: reservation.debut, fin: reservation.fin, quantite: reservation.quantite, etat: reservation.etat })
		.from(reservation)
		.where(and(eq(reservation.ressourceId, l.ressourceId), eq(reservation.etat, 'acceptee'), ne(reservation.id, id), dansLaPeriode(l.debut.slice(0, 10), l.fin.slice(0, 10))));
	const ecartees = l.forme === 'creneau' ? autres.filter((a) => chevauche(a, l, 'creneau')) : [];
	const enConflit = ecartees.map((a) => a.id);
	if (l.forme === 'jours') {
		const m = manque({ nom: l.ressourceNom, stock: l.stock }, autres, l, l.quantite);
		if (m) throw new DonneeInvalide(m.restant === 0 ? `${l.ressourceNom} : il n’en reste plus le ${jourCourt(m.jour)}` : `${l.ressourceNom} : il n’en reste que ${m.restant} le ${jourCourt(m.jour)}`);
	}
	const qui = tranchee(acteur, maintenant);
	await base.batch([
		base.update(reservation).set({ etat: 'acceptee', ...qui }).where(and(eq(reservation.id, id), eq(reservation.etat, 'attente'))),
		base
			.update(reservation)
			.set({ etat: 'annulee', motif: MOTIF_CONFLIT, ...qui })
			.where(and(inArray(reservation.id, enConflit.length > 0 ? enConflit : [0]), eq(reservation.etat, 'acceptee'))),
		ligneJournal(base, { acteur: qui.trancheePar, action: 'accepter_reservation', cibleType: 'reservation', cibleId: id, details: { annulees: enConflit } }, maintenant),
		...prevenir(base, acteur, l, 'acceptee', null, maintenant),
		...ecartees.flatMap((a) => prevenir(base, acteur, { ...l, ...a }, 'annulee', MOTIF_CONFLIT, maintenant))
	]);
}

export async function refuser(base: Base, acteur: Acteur, id: number, motif: string | null, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const l = await lireReservation(base, acteur, id, aujourdhui);
	if (l.jeGere !== 1) throw refusGestion(l.ressourceId);
	if (l.etat !== 'attente') throw new DonneeInvalide('Cette demande a déjà été traitée');
	const qui = tranchee(acteur, maintenant);
	const propre = texteFacultatif(motif, 'Motif', 200);
	await base.batch([
		base.update(reservation).set({ etat: 'refusee', motif: propre, ...qui }).where(and(eq(reservation.id, id), eq(reservation.etat, 'attente'))),
		ligneJournal(base, { acteur: qui.trancheePar, action: 'refuser_reservation', cibleType: 'reservation', cibleId: id }, maintenant),
		...prevenir(base, acteur, l, 'refusee', propre, maintenant)
	]);
}

// Le demandeur annule la sienne tant qu'elle n'a pas commencé ; qui gère annule une réservation en cours de validité, avec un mot.
export async function annuler(base: Base, acteur: Acteur, id: number, mot: string | null, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const l = await lireReservation(base, acteur, id, aujourdhui);
	const mienne = l.personneId === moiDe(acteur);
	if (!mienne && l.jeGere !== 1) throw new RefusDroit('RESERVER', { type: 'ressource', id: l.ressourceId }, 'Ce n’est pas votre réservation');
	if (!active(l.etat) || l.fin < maintenant.slice(0, l.fin.length)) throw new DonneeInvalide('Cette réservation est déjà terminée ou annulée');
	const parLeDemandeur = mienne && !commencee(l.debut, maintenant);
	if (!parLeDemandeur && l.jeGere !== 1) throw new DonneeInvalide('Déjà commencée : demandez à qui gère la ressource');
	const qui = tranchee(acteur, maintenant);
	const motif = parLeDemandeur ? null : texteFacultatif(mot, 'Mot', 200);
	await base.batch([
		base.update(reservation).set({ etat: 'annulee', motif, ...qui }).where(and(eq(reservation.id, id), enCoursDeDemande)),
		ligneJournal(base, { acteur: qui.trancheePar, action: 'annuler_reservation', cibleType: 'reservation', cibleId: id, details: { parLeDemandeur } }, maintenant),
		...(parLeDemandeur ? [] : prevenir(base, acteur, l, 'annulee', motif, maintenant))
	]);
}

const PASSEES_MAX = 30;

// Mes réservations : à venir (par date) et les 30 dernières passées.
export async function mesReservations(base: Base, acteur: Acteur, maintenant: string): Promise<{ aVenir: VueReservation[]; passees: VueReservation[] }> {
	exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	if (moi === null) return { aVenir: [], passees: [] };
	const fini = sql`${reservation.fin} < substr(${maintenant}, 1, length(${reservation.fin}))`;
	const [aVenir, passees] = await base.batch([
		lignesReservations(base)
			.where(and(eq(reservation.personneId, moi), sql`not (${fini})`))
			.orderBy(asc(reservation.debut), asc(reservation.id)),
		lignesReservations(base)
			.where(and(eq(reservation.personneId, moi), fini))
			.orderBy(desc(reservation.debut), desc(reservation.id))
			.limit(PASSEES_MAX),
		marquerAvisLus(base, moi, maintenant)
	]);
	return { aVenir: aVenir.map((l) => vue(l, moi, false, maintenant)), passees: passees.map((l) => vue(l, moi, false, maintenant)) };
}

const aTrancher = (acteur: Acteur, aujourdhui: string) => and(eq(reservation.etat, 'attente'), isNull(ressource.retireeLe), sql`substr(${reservation.fin}, 1, 10) >= ${aujourdhui}`, jeGereSql(acteur, aujourdhui));

// À valider : les demandes en attente des ressources que l'acteur gère, chacune avec les réservations acceptées qui la chevauchent (créneaux).
export async function aValider(base: Base, acteur: Acteur, aujourdhui: string): Promise<{ demande: VueReservation; conflits: VueReservation[] }[]> {
	exigerDate(aujourdhui);
	const demandes = base.select({ id: reservation.id }).from(reservation).innerJoin(ressource, eq(ressource.id, reservation.ressourceId)).where(aTrancher(acteur, aujourdhui));
	const ressourcesVisees = base.select({ id: reservation.ressourceId }).from(reservation).innerJoin(ressource, eq(ressource.id, reservation.ressourceId)).where(aTrancher(acteur, aujourdhui));
	const [lignes, acceptees] = await base.batch([
		lignesReservations(base).where(inArray(reservation.id, demandes)).orderBy(asc(reservation.debut), asc(reservation.id)),
		lignesReservations(base).where(and(inArray(reservation.ressourceId, ressourcesVisees), eq(reservation.etat, 'acceptee'), eq(ressource.forme, 'creneau'), sql`substr(${reservation.fin}, 1, 10) >= ${aujourdhui}`))
	]);
	const moi = moiDe(acteur);
	const maintenant = `${aujourdhui}T00:00`;
	return lignes.map((l) => ({
		demande: vue(l, moi, true, maintenant),
		conflits: acceptees.filter((a) => a.ressourceId === l.ressourceId && chevauche(a, l, 'creneau')).map((a) => vue(a, moi, true, maintenant))
	}));
}

const ACCEPTEES_MAX = 50;

// Les réservations acceptées, pas encore finies, des ressources que l'acteur gère : il peut les annuler.
export async function acceptees(base: Base, acteur: Acteur, aujourdhui: string): Promise<VueReservation[]> {
	exigerDate(aujourdhui);
	const lignes = await lignesReservations(base)
		.where(and(eq(reservation.etat, 'acceptee'), isNull(ressource.retireeLe), sql`substr(${reservation.fin}, 1, 10) >= ${aujourdhui}`, jeGereSql(acteur, aujourdhui)))
		.orderBy(asc(reservation.debut), asc(reservation.id))
		.limit(ACCEPTEES_MAX);
	return lignes.map((l) => vue(l, moiDe(acteur), true, `${aujourdhui}T00:00`));
}

// Le nombre de demandes à trancher par l'acteur : une requête (la cloche).
export async function nombreAValider(base: Base, acteur: Acteur, aujourdhui: string): Promise<number> {
	exigerDate(aujourdhui);
	const [ligne] = await base.select({ n: count() }).from(reservation).innerJoin(ressource, eq(ressource.id, reservation.ressourceId)).where(aTrancher(acteur, aujourdhui));
	return ligne?.n ?? 0;
}

// Gérer le matériel : les ressources que l'acteur gère, et les comités pour lesquels il peut en ajouter.
export async function ressourcesAGerer(base: Base, acteur: Acteur, aujourdhui: string): Promise<{ ressources: Ressource[]; comites: { id: number; nom: string }[] }> {
	exigerDate(aujourdhui);
	const [lignes, comites] = await base.batch([
		base.select(champsRessource(acteur, aujourdhui)).from(ressource).where(and(isNull(ressource.retireeLe), jeGereSql(acteur, aujourdhui))),
		mesComites(base, acteur, aujourdhui)
	]);
	return { ressources: lignes.map(versRessource).sort(parRang), comites };
}

function exigerIcone(icone: unknown): NomIcone {
	if (typeof icone !== 'string' || !(NOMS_ICONES as readonly string[]).includes(icone)) throw new DonneeInvalide('Icône inconnue');
	return icone as NomIcone;
}

function exigerStock(stock: unknown): number {
	if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 1 || stock > STOCK_MAX) throw new DonneeInvalide('Stock invalide');
	return stock;
}

function exigerNom(nom: unknown): string {
	const propre = typeof nom === 'string' ? nom.trim() : '';
	if (!propre) throw new DonneeInvalide('Nom vide');
	if (propre.length > 60) throw new DonneeInvalide('Nom trop long');
	return propre;
}

// Nom unique parmi les ressources qui servent, sans casse ni espaces de bord.
async function exigerNomLibre(base: Base, nom: string, sauf: number | null) {
	const memes = await base
		.select({ id: ressource.id })
		.from(ressource)
		.where(and(isNull(ressource.retireeLe), sql`lower(${ressource.nom}) = lower(${nom})`, sauf === null ? undefined : ne(ressource.id, sauf)));
	if (memes.length > 0) throw new DonneeInvalide('Nom déjà utilisé');
}

export async function ajouterRessource(base: Base, acteur: Acteur, d: { nom: string; stock: number; icone: string; comiteId: number }, maintenant: string): Promise<number> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const comites = await mesComites(base, acteur, aujourdhui);
	if (!comites.some((c) => c.id === d.comiteId)) throw new RefusDroit('GERER_RESERVATIONS', { type: 'comite', id: Number(d.comiteId) || 0 }, 'Réservé aux membres du comité');
	const nom = exigerNom(d.nom);
	const stock = exigerStock(d.stock);
	const icone = exigerIcone(d.icone);
	await exigerNomLibre(base, nom, null);
	const [[cree]] = await base.batch([
		base.insert(ressource).values({ nom, forme: 'jours', stock, icone, ouverteReserve: 0, gereeParComiteId: d.comiteId, creeLe: maintenant }).returning({ id: ressource.id }),
		ligneJournal(base, { acteur: auteurDe(acteur), action: 'ajouter_ressource', cibleType: 'ressource', cibleId: sql`last_insert_rowid()`, details: { nom, stock } }, maintenant)
	]);
	return cree!.id;
}

// Le stock ne descend pas sous ce qui est déjà accepté, un jour à venir.
async function exigerStockSuffisant(base: Base, id: number, stock: number, aujourdhui: string) {
	const acceptees = await base
		.select({ debut: reservation.debut, fin: reservation.fin, quantite: reservation.quantite, etat: reservation.etat })
		.from(reservation)
		.where(and(eq(reservation.ressourceId, id), eq(reservation.etat, 'acceptee'), sql`${reservation.fin} >= ${aujourdhui}`));
	if (acceptees.length === 0) return;
	const dernier = acceptees.reduce((a, b) => (b.fin > a ? b.fin : a), aujourdhui);
	const plusPris = restantParJour(0, acceptees, aujourdhui, dernier).reduce((a, b) => (b.restant < a.restant ? b : a));
	if (-plusPris.restant > stock) throw new DonneeInvalide(`Déjà ${-plusPris.restant} promis le ${jourCourt(plusPris.jour)} : annulez d’abord des réservations`);
}

// Nom, icône et, pour une ressource prise par jours, le stock.
export async function modifierRessource(base: Base, acteur: Acteur, id: number, d: { nom: string; stock?: number; icone: string }, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const r = await lireRessource(base, acteur, id, aujourdhui);
	if (!r.jeGere) throw refusGestion(id);
	const nom = exigerNom(d.nom);
	const icone = exigerIcone(d.icone);
	const stock = r.forme === 'jours' ? exigerStock(d.stock) : null;
	if (stock !== null) await exigerStockSuffisant(base, id, stock, aujourdhui);
	await exigerNomLibre(base, nom, id);
	await base.batch([
		base.update(ressource).set({ nom, icone, stock }).where(eq(ressource.id, id)),
		ligneJournal(base, { acteur: auteurDe(acteur), action: 'modifier_ressource', cibleType: 'ressource', cibleId: id, details: { nom, stock } }, maintenant)
	]);
}

// Retirer du matériel : plus aucune demande ; ses réservations à venir sont annulées.
export async function retirerRessource(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const r = await lireRessource(base, acteur, id, aujourdhui);
	if (!r.jeGere) throw refusGestion(id);
	if (r.forme !== 'jours') throw new DonneeInvalide('Cette ressource ne se retire pas');
	const aVenir = and(eq(reservation.ressourceId, id), enCoursDeDemande, sql`${reservation.fin} >= ${aujourdhui}`);
	const touchees = await base.select({ id: reservation.id, personneId: reservation.personneId, debut: reservation.debut, fin: reservation.fin }).from(reservation).where(aVenir);
	await base.batch([
		base
			.update(reservation)
			.set({ etat: 'annulee', motif: MOTIF_RETRAIT, ...tranchee(acteur, maintenant) })
			.where(aVenir),
		...touchees.flatMap((t) => prevenir(base, acteur, { ...t, ressourceNom: r.nom, forme: r.forme }, 'annulee', MOTIF_RETRAIT, maintenant)),
		base.update(ressource).set({ retireeLe: aujourdhui }).where(eq(ressource.id, id)),
		ligneJournal(base, { acteur: auteurDe(acteur), action: 'retirer_ressource', cibleType: 'ressource', cibleId: id }, maintenant)
	]);
}

// Au départ d'une personne : ses réservations à venir sont annulées (elles ne bloquent plus la VL ni le stock). Écriture à placer dans un batch.
export const annulerAuDepart = (base: Base, personneId: number, maintenant: string) =>
	base
		.update(reservation)
		.set({ etat: 'annulee', motif: 'Départ du demandeur', trancheeLe: maintenant })
		.where(and(eq(reservation.personneId, personneId), enCoursDeDemande, sql`${reservation.fin} >= substr(${maintenant}, 1, length(${reservation.fin}))`));

// Ménage de nuit : réservations finies avant `avant` (AAAA-MM-JJ).
export async function effacerVieillesReservations(base: Base, avant: string): Promise<void> {
	exigerDate(avant);
	await base.delete(reservation).where(lt(sql`substr(${reservation.fin}, 1, 10)`, avant));
}

// Données fictives (préprod et développement local) : du matériel de l'amicale. Relançable, sans doublon.
export async function chargerMaterielFictif(base: Base, maintenant: string): Promise<void> {
	const [amicale] = await base.select({ id: comite.id }).from(comite).where(and(eq(comite.nom, 'Amicale'), isNull(comite.dissousLe)));
	if (!amicale) return;
	const existants = (await base.select({ nom: ressource.nom }).from(ressource)).map((r) => r.nom);
	const objets = [
		{ nom: 'Bancs', stock: 12, icone: 'groupe' },
		{ nom: 'Tables', stock: 6, icone: 'outil' },
		{ nom: 'Barnum', stock: 1, icone: 'etoile' }
	].filter((o) => !existants.includes(o.nom));
	if (objets.length === 0) return;
	await base.insert(ressource).values(objets.map((o) => ({ ...o, forme: 'jours' as const, ouverteReserve: 0, gereeParComiteId: amicale.id, creeLe: maintenant })));
}
