import { and, asc, eq, gte, isNull, lte, ne, or } from 'drizzle-orm';
import type { Base } from './base.ts';
import type { Acteur } from './droits.ts';
import { RefusDroit } from './erreurs.ts';
import { iconeDuRole, type NomIcone } from './icones.ts';
import type { Droit } from './listes.ts';
import { attribution, comite, equipe, personne, profil, responsabilite, responsabiliteDroit } from './schema.ts';

// id : 'centre', 'astreinte', 'equipe:<id>', 'role:<id>' ou 'comite:<id>'.
export type Casquette = { id: string; nom: string; icone: NomIcone; compte: number };
export type ADecider = { texte: string; lien: string };
export type ContenuCasquette =
	| { type: 'centre'; aDecider: ADecider[] }
	| { type: 'astreinte' }
	| { type: 'equipe' }
	| { type: 'role'; permet: string[] }
	| { type: 'comite'; membres: { personneId: number; prenom: string; nom: string; role: string }[] };
export type Accueil = { casquettes: Casquette[]; choisie: string; contenu: ContenuCasquette };

const enCoursLe = (aujourdhui: string) => and(lte(attribution.debut, aujourdhui), or(isNull(attribution.fin), gte(attribution.fin, aujourdhui)));
// Un agent parti ne tient plus rien.
const present = ne(personne.statut, 'parti');

const parNom = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom, 'fr');

// Rôles tenus aujourd'hui par une personne (non archivés), à passer à un batch.
// `nomme` : le rôle donne ATTRIBUER_RESPONSABILITE ; tout rôle de comité qui le porte fait de son titulaire le modérateur du mur du comité (rapporteur).
// Partagé avec les murs (murs.ts).
export function requeteTenues(base: Base, personneId: number, aujourdhui: string) {
	return base
		.select({ responsabiliteId: attribution.responsabiliteId, type: attribution.perimetreType, perimetreId: attribution.perimetreId, portee: responsabilite.typePerimetre, nom: responsabilite.nom, systeme: responsabilite.systeme, icone: responsabilite.icone, modele: responsabilite.modele, nomme: responsabiliteDroit.droit })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.leftJoin(responsabiliteDroit, and(eq(responsabiliteDroit.responsabiliteId, attribution.responsabiliteId), eq(responsabiliteDroit.droit, 'ATTRIBUER_RESPONSABILITE')))
		.where(and(eq(attribution.personneId, personneId), isNull(responsabilite.archiveeLe), enCoursLe(aujourdhui)));
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
			.map((e) => ({ id: `equipe:${e.id}`, nom: `Chef d’équipe · ${e.nom}`, icone: 'casque' as const })),
		{ id: 'astreinte', nom: 'Mon astreinte', icone: 'casque' },
		...[...referents].map(([id, r]) => ({ id: `role:${id}`, ...r })).sort(parNom),
		...comites.filter((c) => tient((l) => l.type === 'comite' && l.perimetreId === c.id)).map((c) => ({ id: `comite:${c.id}`, nom: c.nom, icone: 'groupe' as const }))
	];
}

// Les casquettes et, pour « Le centre », ce qui est à décider : chaque lecture une seule fois.
async function lire(base: Base, acteur: Acteur, aujourdhui: string): Promise<{ casquettes: Casquette[]; aDecider: ADecider[] | null }> {
	const liste = await tenues(base, acteur, aujourdhui);
	const aDecider = liste.some((c) => c.id === 'centre') ? await lireADecider(base, aujourdhui) : null;
	return { casquettes: liste.map((c) => ({ ...c, compte: c.id === 'centre' ? aDecider!.length : 0 })), aDecider };
}

// Ordre : centre, chef d'équipe, astreinte, référents, comités. Seul « Le centre » a déjà de quoi compter.
export async function casquettesDe(base: Base, acteur: Acteur, aujourdhui: string): Promise<Casquette[]> {
	return (await lire(base, acteur, aujourdhui)).casquettes;
}

export async function aDecider(base: Base, acteur: Acteur, aujourdhui: string): Promise<ADecider[]> {
	const lu = (await lire(base, acteur, aujourdhui)).aDecider;
	if (lu === null) throw new RefusDroit('GERER_ACCES', { type: 'centre' }, 'Réservé au chef de centre et à son adjoint');
	return lu;
}

// L'accueil : la casquette demandée si elle est tenue, sinon celle où quelque chose attend, sinon la principale (la première).
export async function accueilDe(base: Base, acteur: Acteur, demandee: string | null, aujourdhui: string): Promise<Accueil> {
	const { casquettes, aDecider } = await lire(base, acteur, aujourdhui);
	const choisie = (casquettes.find((c) => c.id === demandee) ?? casquettes.find((c) => c.compte > 0) ?? casquettes[0]!).id;
	return { casquettes, choisie, contenu: await contenu(base, choisie, aDecider, aujourdhui) };
}

async function lireADecider(base: Base, aujourdhui: string): Promise<ADecider[]> {
	// Pas de jointure à noms de colonnes en double : dans un batch, D1 n'en garde qu'une.
	const [equipes, attributions, responsabilites, personnes] = await base.batch([
		base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation)),
		base
			.select({ responsabiliteId: attribution.responsabiliteId, type: attribution.perimetreType, perimetreId: attribution.perimetreId, systeme: responsabilite.systeme })
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
			.leftJoin(profil, eq(profil.id, personne.profilId))
	]);

	const sansChef = equipes.filter((e) => !attributions.some((a) => a.systeme === 'chef_equipe' && a.type === 'equipe' && a.perimetreId === e.id));
	const sansTitulaire = responsabilites.filter((r) => !attributions.some((a) => a.responsabiliteId === r.id));
	const fiches = personnes.filter((p) => p.statut !== 'parti' && p.typePersonne !== 'exterieur' && (p.gradeId === null || p.entreeCentre === null)).length;

	return [
		...sansChef.map((e) => ({ texte: `${e.nom} sans chef d’équipe`, lien: '/nominations' })),
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
async function contenu(base: Base, id: string, aDecider: ADecider[] | null, aujourdhui: string): Promise<ContenuCasquette> {
	if (id === 'centre') return { type: 'centre', aDecider: aDecider! };
	if (id === 'astreinte') return { type: 'astreinte' };
	const [type, numero] = id.split(':') as ['equipe' | 'role' | 'comite', string];
	if (type === 'equipe') return { type: 'equipe' };

	if (type === 'role') {
		const droits = (await base.select({ droit: responsabiliteDroit.droit }).from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, Number(numero)))).map((d) => d.droit);
		const permet = DOMAINES.flatMap((niveaux) => niveaux.find(([droit]) => droits.includes(droit))?.[1] ?? []);
		return { type: 'role', permet };
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
	return { type: 'comite', membres: [...membres.values()] };
}
