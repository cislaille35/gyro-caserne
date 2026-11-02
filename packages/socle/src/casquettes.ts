import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import type { Base } from './base.ts';
import type { Acteur } from './droits.ts';
import { RefusDroit } from './erreurs.ts';
import { iconeDuRole, type NomIcone } from './icones.ts';
import type { Droit } from './listes.ts';
import type { Reglage } from './planning/calendrier.ts';
import { vueEte } from './planning/ete.ts';
import { plagesARevoir } from './planning/repartition.ts';
import { anomaliesADecider, traiteLesAnomalies } from './anomalies.ts';
import { prisesEnRetard } from './prises.ts';
import { periodeCourte } from './reservations-calcul.ts';
import { remplacementsAValider } from './remplacements/lectures.ts';
import { anneePlanning, attribution, comite, equipe, ete, personne, plageEte, profil, reservation, responsabilite, responsabiliteDroit, ressource } from './schema.ts';

// id : 'centre', 'astreinte', 'equipe:<id>', 'role:<id>' ou 'comite:<id>'.
export type Casquette = { id: string; nom: string; icone: NomIcone; compte: number };
export type ADecider = { texte: string; lien: string };
export type ContenuCasquette =
	| { type: 'centre'; aDecider: ADecider[] }
	| { type: 'astreinte' }
	| { type: 'equipe'; aDecider: ADecider[] }
	| { type: 'role'; permet: string[]; aDecider: ADecider[] }
	| { type: 'comite'; membres: { personneId: number; prenom: string; nom: string; role: string }[]; aDecider: ADecider[] };
export type Accueil = { casquettes: Casquette[]; choisie: string; contenu: ContenuCasquette };

const enCoursLe = (aujourdhui: string) => and(lte(attribution.debut, aujourdhui), or(isNull(attribution.fin), gte(attribution.fin, aujourdhui)));
// Un agent parti ne tient plus rien.
const present = ne(personne.statut, 'parti');

const parNom = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom, 'fr');

// Rôles tenus aujourd'hui par une personne (non archivés), à passer à un batch.
// `nomme` : le rôle donne ATTRIBUER_RESPONSABILITE ; tout rôle de comité qui le porte fait de son titulaire le modérateur du mur du comité (rapporteur).
// Partagé avec les murs (murs.ts) ; sans personne (null) : les rôles de tout le monde, pour le suivi des publications.
export function requeteTenues(base: Base, personneId: number | null, aujourdhui: string) {
	return base
		.select({ personneId: attribution.personneId, responsabiliteId: attribution.responsabiliteId, type: attribution.perimetreType, perimetreId: attribution.perimetreId, portee: responsabilite.typePerimetre, nom: responsabilite.nom, systeme: responsabilite.systeme, icone: responsabilite.icone, modele: responsabilite.modele, nomme: responsabiliteDroit.droit })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.leftJoin(responsabiliteDroit, and(eq(responsabiliteDroit.responsabiliteId, attribution.responsabiliteId), eq(responsabiliteDroit.droit, 'ATTRIBUER_RESPONSABILITE')))
		.where(and(personneId === null ? undefined : eq(attribution.personneId, personneId), isNull(responsabilite.archiveeLe), enCoursLe(aujourdhui)));
}

// Une attribution hors du type de périmètre de sa responsabilité ne compte pas (comme pour les droits).
export function tenuesValides<L extends { type: string; portee: string }>(lignes: L[]): L[] {
	return lignes.filter((l) => l.type === l.portee);
}

// Les casquettes tenues, sans leur compte : une seule requête.
async function tenues(base: Base, acteur: Acteur, aujourdhui: string): Promise<Omit<Casquette, 'compte'>[]> {
	const centre = { id: 'centre', nom: 'Le centre', icone: 'etoile' as const };
	if (acteur.type === 'super') return [centre];

	const [lignes, equipes, comites] = await base.batch([
		requeteTenues(base, acteur.id, aujourdhui),
		base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation)),
		base.select({ id: comite.id, nom: comite.nom }).from(comite).where(isNull(comite.dissousLe)).orderBy(asc(comite.nom))
	]);
	const valides = tenuesValides(lignes);
	const tient = (garde: (l: (typeof valides)[number]) => boolean) => valides.some(garde);

	const referents = new Map<number, { nom: string; icone: NomIcone }>();
	for (const l of valides) if (l.type === 'centre' && l.systeme === null) referents.set(l.responsabiliteId, { nom: l.nom, icone: iconeDuRole(l) });

	return [
		...(tient((l) => l.systeme === 'chef_centre' || l.systeme === 'chef_centre_adjoint') ? [centre] : []),
		...equipes
			.filter((e) => tient((l) => l.systeme === 'chef_equipe' && l.perimetreId === e.id))
			.map((e) => ({ id: `equipe:${e.id}`, nom: `Chef de garde · ${e.nom}`, icone: 'casque' as const })),
		{ id: 'astreinte', nom: 'Mon astreinte', icone: 'casque' },
		...[...referents].map(([id, r]) => ({ id: `role:${id}`, ...r })).sort(parNom),
		...comites.filter((c) => tient((l) => l.type === 'comite' && l.perimetreId === c.id)).map((c) => ({ id: `comite:${c.id}`, nom: c.nom, icone: 'groupe' as const }))
	];
}

// Les casquettes et ce qui est à décider : pour « Le centre », l'organisation ; pour un rôle ou un comité qui gère une ressource,
// les demandes de réservation en attente. Chaque lecture une seule fois.
// Les remplacements à valider vont à la casquette Chef de garde de leur équipe, sinon à « Le centre ».
async function lire(base: Base, acteur: Acteur, aujourdhui: string, maintenant: string, reglage?: Reglage): Promise<{ casquettes: Casquette[]; aDecider: ADecider[] | null; reservations: Map<string, ADecider[]> }> {
	const liste = await tenues(base, acteur, aujourdhui);
	const chef = liste.some((c) => c.id === 'centre' || c.id.startsWith('equipe:'));
	const roles = liste.filter((c) => c.id.startsWith('role:')).map((c) => Number(c.id.slice(5)));
	const [organisation, reservations, remplacements, retard, anomalies] = await Promise.all([
		liste.some((c) => c.id === 'centre') ? lireADecider(base, aujourdhui, reglage) : null,
		demandesParCasquette(base, liste, aujourdhui),
		chef ? remplacementsAValider(base, acteur, maintenant) : [],
		chef && reglage ? prisesEnRetard(base, maintenant, reglage) : null,
		// Les anomalies, pour ceux qui les traitent : « Le centre », le chef de garde de l'équipe d'astreinte, le référent engins.
		reglage && (chef || roles.length) && (await traiteLesAnomalies(base, acteur, aujourdhui)) ? anomaliesADecider(base, maintenant, reglage, roles) : null
	]);
	const versCentre: ADecider[] = [];
	if (anomalies && anomalies.items.length) {
		if (liste.some((c) => c.id === 'centre')) versCentre.push(...anomalies.items);
		for (const cle of [`equipe:${anomalies.equipeId}`, ...anomalies.roles.map((r) => `role:${r}`)])
			if (liste.some((c) => c.id === cle)) reservations.set(cle, [...(reservations.get(cle) ?? []), ...anomalies.items]);
	}
	// La prise de garde en retard : au chef de garde de l'équipe d'astreinte, sinon à « Le centre ».
	if (retard) {
		const cle = `equipe:${retard.equipeId}`;
		const item = { texte: `Prise de garde en retard : ${retard.engins.join(', ')}`, lien: '/engins/prise' };
		if (liste.some((c) => c.id === cle)) reservations.set(cle, [...(reservations.get(cle) ?? []), item]);
		else versCentre.push(item);
	}
	for (const r of remplacements) {
		const cle = `equipe:${r.equipeId}`;
		const item = { texte: r.texte, lien: `/remplacements/${r.id}` };
		if (liste.some((c) => c.id === cle)) reservations.set(cle, [...(reservations.get(cle) ?? []), item]);
		else versCentre.push(item);
	}
	const aDecider = organisation === null ? null : [...versCentre, ...organisation];
	return { casquettes: liste.map((c) => ({ ...c, compte: c.id === 'centre' ? aDecider!.length : (reservations.get(c.id)?.length ?? 0) })), aDecider, reservations };
}

// Les demandes de réservation en attente des ressources gérées par les rôles et comités tenus ; aucune lecture s'il n'y en a pas.
async function demandesParCasquette(base: Base, liste: Omit<Casquette, 'compte'>[], aujourdhui: string): Promise<Map<string, ADecider[]>> {
	const ids = (prefixe: string) => liste.filter((c) => c.id.startsWith(prefixe)).map((c) => Number(c.id.slice(prefixe.length)));
	const roles = ids('role:');
	const comites = ids('comite:');
	const parCasquette = new Map<string, ADecider[]>();
	if (roles.length === 0 && comites.length === 0) return parCasquette;
	const lignes = await base
		.select({
			roleId: ressource.gereeParResponsabiliteId,
			comiteId: ressource.gereeParComiteId,
			ressource: sql<string>`${ressource.nom}`.as('ressource'),
			forme: ressource.forme,
			debut: reservation.debut,
			fin: reservation.fin,
			quantite: reservation.quantite,
			nomDemandeur: reservation.nomDemandeur,
			prenom: personne.prenom,
			nom: personne.nom
		})
		.from(reservation)
		.innerJoin(ressource, eq(ressource.id, reservation.ressourceId))
		.innerJoin(personne, eq(personne.id, reservation.personneId))
		.where(
			and(
				eq(reservation.etat, 'attente'),
				isNull(ressource.retireeLe),
				sql`substr(${reservation.fin}, 1, 10) >= ${aujourdhui}`,
				or(inArray(ressource.gereeParResponsabiliteId, roles.length > 0 ? roles : [0]), inArray(ressource.gereeParComiteId, comites.length > 0 ? comites : [0]))
			)
		)
		.orderBy(asc(reservation.debut), asc(reservation.id));
	for (const l of lignes) {
		const id = l.roleId !== null ? `role:${l.roleId}` : `comite:${l.comiteId}`;
		const texte = [l.ressource, ...(l.forme === 'jours' ? [String(l.quantite)] : []), periodeCourte(l.forme, l.debut, l.fin), l.nomDemandeur ?? `${l.prenom} ${l.nom}`].join(' · ');
		parCasquette.set(id, [...(parCasquette.get(id) ?? []), { texte, lien: '/reservations/a-valider' }]);
	}
	return parCasquette;
}

// Ordre : centre, chef de garde, astreinte, référents, comités. Comptent : « Le centre », les chefs de garde (remplacements à valider),
// et les rôles et comités qui gèrent une ressource.
// `reglage` : l'astreinte du centre, pour compter les plages d'été à revoir.
export async function casquettesDe(base: Base, acteur: Acteur, aujourdhui: string, maintenant = `${aujourdhui}T00:00`, reglage?: Reglage): Promise<Casquette[]> {
	return (await lire(base, acteur, aujourdhui, maintenant, reglage)).casquettes;
}

export async function aDecider(base: Base, acteur: Acteur, aujourdhui: string, reglage?: Reglage): Promise<ADecider[]> {
	const lu = (await lire(base, acteur, aujourdhui, `${aujourdhui}T00:00`, reglage)).aDecider;
	if (lu === null) throw new RefusDroit('GERER_ACCES', { type: 'centre' }, 'Réservé au chef de centre et à son adjoint');
	return lu;
}

// L'accueil : la casquette demandée si elle est tenue, sinon celle où quelque chose attend, sinon la principale (la première).
export async function accueilDe(base: Base, acteur: Acteur, demandee: string | null, aujourdhui: string, maintenant: string, reglage: Reglage): Promise<Accueil> {
	const { casquettes, aDecider, reservations } = await lire(base, acteur, aujourdhui, maintenant, reglage);
	const choisie = (casquettes.find((c) => c.id === demandee) ?? casquettes.find((c) => c.compte > 0) ?? casquettes[0]!).id;
	return { casquettes, choisie, contenu: await contenu(base, choisie, aDecider, reservations.get(choisie) ?? [], aujourdhui) };
}

async function lireADecider(base: Base, aujourdhui: string, reglage?: Reglage): Promise<ADecider[]> {
	// Pas de jointure à noms de colonnes en double : dans un batch, D1 n'en garde qu'une.
	const annee = Number(aujourdhui.slice(0, 4));
	const suivante = annee + 1;
	const [equipes, attributions, responsabilites, personnes, annees, etes, proposes] = await base.batch([
		base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation)),
		base
			.select({ personneId: attribution.personneId, responsabiliteId: attribution.responsabiliteId, type: attribution.perimetreType, perimetreId: attribution.perimetreId, systeme: responsabilite.systeme })
			.from(attribution)
			.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
			.innerJoin(personne, eq(personne.id, attribution.personneId))
			.where(and(enCoursLe(aujourdhui), present)),
		// Hors système et hors comités (un rôle de comité vide par comité serait du bruit).
		base
			.select({ id: responsabilite.id, nom: responsabilite.nom })
			.from(responsabilite)
			.where(and(isNull(responsabilite.archiveeLe), isNull(responsabilite.systeme), ne(responsabilite.typePerimetre, 'comite')))
			.orderBy(asc(responsabilite.nom)),
		base
			.select({ gradeId: personne.gradeId, entreeCentre: personne.entreeCentre, statut: personne.statut, typePersonne: profil.typePersonne })
			.from(personne)
			.leftJoin(profil, eq(profil.id, personne.profilId)),
		base.select({ publieeLe: anneePlanning.publieeLe }).from(anneePlanning).where(eq(anneePlanning.annee, suivante)),
		base.select().from(ete).where(and(gte(ete.annee, annee), lte(ete.annee, suivante))).orderBy(asc(ete.annee)),
		base.selectDistinct({ annee: plageEte.annee }).from(plageEte).where(and(gte(plageEte.annee, annee), lte(plageEte.annee, suivante)))
	]);
	// À partir du 1er octobre, l'année suivante est à préparer tant qu'elle n'est pas publiée.
	const planning = aujourdhui.slice(5) >= '10-01' && !annees.some((a) => a.publieeLe !== null);

	const sansChef = equipes.filter((e) => !attributions.some((a) => a.systeme === 'chef_equipe' && a.type === 'equipe' && a.perimetreId === e.id));
	const sansTitulaire = responsabilites.filter((r) => !attributions.some((a) => a.responsabiliteId === r.id));
	const fiches = personnes.filter((p) => p.statut !== 'parti' && p.typePersonne !== 'exterieur' && (p.gradeId === null || p.entreeCentre === null)).length;

	// L'été : le premier pas fini, cette année ou la suivante.
	const e = etes.map(vueEte).find((x) => x.fin >= aujourdhui);
	const lienEte = (a: number) => `/planning/ete?annee=${a}`;
	const pourLete: ADecider[] = [];
	// Sans l'astreinte du centre (seul l'accueil la donne), l'été n'est pas dit.
	if (reglage && !e) {
		// À ouvrir du 1er mars à la fin d'août, tant que l'été de l'année n'existe pas.
		if (aujourdhui >= `${annee}-03-01` && aujourdhui <= `${annee}-08-31` && !etes.some((x) => x.annee === annee)) pourLete.push({ texte: `Été ${annee} à ouvrir`, lien: lienEte(annee) });
	} else if (reglage && e && !e.publiee) {
		const aRevoir = proposes.some((x) => x.annee === e.annee) ? await plagesARevoir(base, e.annee, aujourdhui, reglage) : 0;
		if (aRevoir > 0) pourLete.push({ texte: `Été ${e.annee} : ${aRevoir} ${aRevoir > 1 ? 'plages' : 'plage'} à revoir`, lien: lienEte(e.annee) });
		else if (aujourdhui > e.dateLimite) pourLete.push({ texte: `Été ${e.annee} à publier`, lien: lienEte(e.annee) });
	}

	return [
		...pourLete,
		...(planning ? [{ texte: `Planning ${suivante} à préparer`, lien: `/planning/preparer?annee=${suivante}` }] : []),
		...sansChef.map((e) => ({ texte: `${e.nom} sans chef de garde`, lien: '/nominations' })),
		...sansTitulaire.map((r) => ({ texte: `${r.nom} : aucun titulaire`, lien: '/nominations' })),
		...(fiches > 0 ? [{ texte: `${fiches} ${fiches > 1 ? 'fiches' : 'fiche'} à compléter (grade ou date d’entrée manquants)`, lien: '/agents?filtre=a-completer' }] : [])
	];
}

// Par domaine, du niveau le plus haut au plus bas : seul le plus haut tenu est dit.
const DOMAINES: [Droit, string][][] = [
	[
		['GERER_PLANNING', 'Gérer le planning.'],
		['VALIDER_REMPLACEMENT', 'Valider les remplacements.'],
		['VOIR_MOTIFS_ABSENCE', 'Voir les motifs d’absence.']
	],
	[
		['TRAITER_ANOMALIE', 'Gérer les engins et les anomalies.'],
		['GERER_FICHES', 'Gérer les engins et les anomalies.']
	],
	[['GERER_STOCK', 'Gérer le stock et la pharmacie.']],
	[
		['GERER_RESERVATIONS', 'Gérer les réservations.'],
		['RESERVER', 'Réserver.']
	],
	[['MODERER_MESSAGERIE', 'Modérer la messagerie.']],
	// Administration : chaque droit est dit à part.
	[['GERER_ACCES', 'Gérer les accès.']],
	[['GERER_COMITES', 'Gérer les comités.']],
	[['GERER_LISTES', 'Gérer les responsabilités.']],
	[['ATTRIBUER_RESPONSABILITE', 'Nommer aux responsabilités.']]
];

// Le contenu d'une casquette déjà vérifiée comme tenue.
async function contenu(base: Base, id: string, aDecider: ADecider[] | null, reservations: ADecider[], aujourdhui: string): Promise<ContenuCasquette> {
	if (id === 'centre') return { type: 'centre', aDecider: aDecider! };
	if (id === 'astreinte') return { type: 'astreinte' };
	const [type, numero] = id.split(':') as ['equipe' | 'role' | 'comite', string];
	if (type === 'equipe') return { type: 'equipe', aDecider: reservations };

	if (type === 'role') {
		const droits = (await base.select({ droit: responsabiliteDroit.droit }).from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, Number(numero)))).map((d) => d.droit);
		const permet = DOMAINES.flatMap((niveaux) => niveaux.find(([droit]) => droits.includes(droit))?.[1] ?? []);
		return { type: 'role', permet, aDecider: reservations };
	}

	const lignes = await base
		.select({ personneId: personne.id, prenom: personne.prenom, nom: personne.nom, role: responsabilite.nom })
		.from(attribution)
		.innerJoin(personne, eq(personne.id, attribution.personneId))
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.where(and(eq(attribution.perimetreType, 'comite'), eq(attribution.perimetreId, Number(numero)), isNull(responsabilite.archiveeLe), enCoursLe(aujourdhui), present))
		.orderBy(asc(personne.nom), asc(personne.prenom), asc(responsabilite.nom));
	// Une personne à la fois membre et rapporteur : une seule ligne.
	const membres = new Map<number, { personneId: number; prenom: string; nom: string; role: string }>();
	for (const l of lignes) {
		const deja = membres.get(l.personneId);
		membres.set(l.personneId, deja ? { ...deja, role: `${deja.role} · ${l.role}` } : l);
	}
	return { type: 'comite', membres: [...membres.values()], aDecider: reservations };
}
