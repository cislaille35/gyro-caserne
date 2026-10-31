import { and, asc, count, desc, eq, inArray, isNull, lt, ne, sql, type SQL } from 'drizzle-orm';
import type { Base } from './base.ts';
import { ajouterJours, exigerDate, exigerDateHeure } from './dates.ts';
import { accorde, droitsDe, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { NOMS_ICONES, type NomIcone } from './icones.ts';
import { ligneJournal } from './journal.ts';
import { STATUTS_AVEC_ACCES, type EtatReservation, type FormeRessource } from './listes.ts';
import { chevauche, jourCourt, restantParJour, tientUnePlace } from './reservations-calcul.ts';
import { comite, personne, profil, reservation, ressource } from './schema.ts';

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
	const [lignes, comites] = await base.batch([base.select(champsRessource(acteur, aujourdhui)).from(ressource).where(isNull(ressource.retireeLe)), mesComites(base, acteur, aujourdhui)]);
	const ressources = lignes.map(versRessource).filter((r) => voit(qui, r)).sort(parRang);
	return {
		ressources,
		peutReserver: accorde(qui.droits, 'RESERVER', { type: 'centre' }),
		reserveCitoyenne: qui.reserveCitoyenne,
		aValider: lignes.filter((l) => l.jeGere === 1).reduce((n, l) => n + l.attente, 0),
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
export async function calendrier(base: Base, acteur: Acteur, id: number, du: string, au: string, aujourdhui: string): Promise<{ ressource: Ressource; reservations: VueReservation[] }> {
	exigerDate(du);
	exigerDate(au);
	const qui = await quiEst(base, acteur, aujourdhui);
	const r = await lireRessource(base, acteur, id, aujourdhui);
	if (!voit(qui, r)) throw new RefusDroit('RESERVER', { type: 'ressource', id }, 'Ressource non accessible');
	const lignes = await lignesReservations(base)
		.where(and(eq(reservation.ressourceId, id), enCoursDeDemande, dansLaPeriode(du, au)))
		.orderBy(asc(reservation.debut), asc(reservation.id));
	return { ressource: r, reservations: lignes.map((l) => vue(l, moiDe(acteur), r.jeGere, `${aujourdhui}T00:00`)) };
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

	const prises = await base
		.select({ debut: reservation.debut, fin: reservation.fin, quantite: reservation.quantite, etat: reservation.etat })
		.from(reservation)
		.where(and(eq(reservation.ressourceId, id), enCoursDeDemande, dansLaPeriode(p.debut.slice(0, 10), p.fin.slice(0, 10))));
	let etat: 'attente' | 'acceptee' = 'attente';
	if (r.forme === 'jours') {
		const m = manque(r, prises, p, quantite);
		if (m) throw new DonneeInvalide(m.restant === 0 ? `${r.nom} : il n’en reste plus le ${jourCourt(m.jour)}` : `${r.nom} : il en reste ${m.restant} le ${jourCourt(m.jour)}`);
	} else if (!prises.some((x) => chevauche(x, p, 'creneau'))) etat = 'acceptee';

	const [[cree]] = await base.batch([
		base
			.insert(reservation)
			.values({ ressourceId: id, personneId: acteur.id, nomDemandeur, telephone, debut: p.debut, fin: p.fin, quantite, mot, etat, creeLe: maintenant })
			.returning({ id: reservation.id }),
		ligneJournal(base, { acteur: auteurDe(acteur), action: 'reserver', cibleType: 'reservation', cibleId: sql`last_insert_rowid()`, details: { ressourceId: id, etat } }, maintenant)
	]);
	return { id: cree!.id, etat };
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
		.select({ id: reservation.id, debut: reservation.debut, fin: reservation.fin, quantite: reservation.quantite, etat: reservation.etat })
		.from(reservation)
		.where(and(eq(reservation.ressourceId, l.ressourceId), eq(reservation.etat, 'acceptee'), ne(reservation.id, id), dansLaPeriode(l.debut.slice(0, 10), l.fin.slice(0, 10))));
	const enConflit = l.forme === 'creneau' ? autres.filter((a) => chevauche(a, l, 'creneau')).map((a) => a.id) : [];
	if (l.forme === 'jours') {
		const m = manque({ nom: l.ressourceNom, stock: l.stock }, autres, l, l.quantite);
		if (m) throw new DonneeInvalide(`${l.ressourceNom} : il n’en reste que ${m.restant} le ${jourCourt(m.jour)}`);
	}
	const qui = tranchee(acteur, maintenant);
	await base.batch([
		base.update(reservation).set({ etat: 'acceptee', ...qui }).where(and(eq(reservation.id, id), eq(reservation.etat, 'attente'))),
		base
			.update(reservation)
			.set({ etat: 'annulee', motif: MOTIF_CONFLIT, ...qui })
			.where(and(inArray(reservation.id, enConflit.length > 0 ? enConflit : [0]), eq(reservation.etat, 'acceptee'))),
		ligneJournal(base, { acteur: qui.trancheePar, action: 'accepter_reservation', cibleType: 'reservation', cibleId: id, details: { annulees: enConflit } }, maintenant)
	]);
}

export async function refuser(base: Base, acteur: Acteur, id: number, motif: string | null, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const l = await lireReservation(base, acteur, id, aujourdhui);
	if (l.jeGere !== 1) throw refusGestion(l.ressourceId);
	if (l.etat !== 'attente') throw new DonneeInvalide('Cette demande a déjà été traitée');
	const qui = tranchee(acteur, maintenant);
	await base.batch([
		base.update(reservation).set({ etat: 'refusee', motif: texteFacultatif(motif, 'Motif', 200), ...qui }).where(and(eq(reservation.id, id), eq(reservation.etat, 'attente'))),
		ligneJournal(base, { acteur: qui.trancheePar, action: 'refuser_reservation', cibleType: 'reservation', cibleId: id }, maintenant)
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
	await base.batch([
		base
			.update(reservation)
			.set({ etat: 'annulee', motif: parLeDemandeur ? null : texteFacultatif(mot, 'Mot', 200), ...qui })
			.where(and(eq(reservation.id, id), enCoursDeDemande)),
		ligneJournal(base, { acteur: qui.trancheePar, action: 'annuler_reservation', cibleType: 'reservation', cibleId: id, details: { parLeDemandeur } }, maintenant)
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
			.limit(PASSEES_MAX)
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

// Nom, icône et, pour une ressource prise par jours, le stock.
export async function modifierRessource(base: Base, acteur: Acteur, id: number, d: { nom: string; stock?: number; icone: string }, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const r = await lireRessource(base, acteur, id, aujourdhui);
	if (!r.jeGere) throw refusGestion(id);
	const nom = exigerNom(d.nom);
	const icone = exigerIcone(d.icone);
	const stock = r.forme === 'jours' ? exigerStock(d.stock) : null;
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
	await base.batch([
		base
			.update(reservation)
			.set({ etat: 'annulee', motif: MOTIF_RETRAIT, ...tranchee(acteur, maintenant) })
			.where(and(eq(reservation.ressourceId, id), enCoursDeDemande, sql`${reservation.fin} >= ${aujourdhui}`)),
		base.update(ressource).set({ retireeLe: aujourdhui }).where(eq(ressource.id, id)),
		ligneJournal(base, { acteur: auteurDe(acteur), action: 'retirer_ressource', cibleType: 'ressource', cibleId: id }, maintenant)
	]);
}

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
