import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { Base } from './base.ts';
import { occupe, type Acteur } from './droits.ts';
import { RefusDroit } from './erreurs.ts';
import type { NomIcone } from './icones.ts';
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
	| { type: 'comite'; membres: { prenom: string; nom: string; role: string }[] };

const enCoursLe = (aujourdhui: string) => and(lte(attribution.debut, aujourdhui), or(isNull(attribution.fin), gte(attribution.fin, aujourdhui)));

// En attendant l'icône choisie par rôle : déduite du nom.
function iconeDuRole(nom: string): NomIcone {
	const n = nom.toLowerCase();
	return n.includes('engin') ? 'camion' : n.includes('pharmacie') ? 'croix' : n.includes('technique') ? 'cle' : 'outil';
}

const parNom = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom, 'fr');

// Les casquettes tenues, sans leur compte : une seule requête.
async function tenues(base: Base, acteur: Acteur, aujourdhui: string): Promise<Omit<Casquette, 'compte'>[]> {
	const centre = { id: 'centre', nom: 'Le centre', icone: 'etoile' as const };
	if (acteur.type === 'super') return [centre];

	const [lignes, equipes, comites] = await base.batch([
		base
			.select({ responsabiliteId: attribution.responsabiliteId, type: attribution.perimetreType, perimetreId: attribution.perimetreId, portee: responsabilite.typePerimetre, nom: responsabilite.nom, systeme: responsabilite.systeme })
			.from(attribution)
			.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
			.where(and(eq(attribution.personneId, acteur.id), isNull(responsabilite.archiveeLe), enCoursLe(aujourdhui))),
		base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation)),
		base.select({ id: comite.id, nom: comite.nom }).from(comite).where(isNull(comite.dissousLe)).orderBy(asc(comite.nom))
	]);
	// Une attribution hors du type de périmètre de sa responsabilité ne compte pas (comme pour les droits).
	const valides = lignes.filter((l) => l.type === l.portee);
	const tient = (garde: (l: (typeof valides)[number]) => boolean) => valides.some(garde);

	const referents = new Map<number, string>();
	for (const l of valides) if (l.type === 'centre' && l.systeme === null) referents.set(l.responsabiliteId, l.nom);

	return [
		...(tient((l) => l.systeme === 'chef_centre' || l.systeme === 'chef_centre_adjoint') ? [centre] : []),
		...equipes
			.filter((e) => tient((l) => l.systeme === 'chef_equipe' && l.perimetreId === e.id))
			.map((e) => ({ id: `equipe:${e.id}`, nom: `Chef d’équipe · ${e.nom}`, icone: 'casque' as const })),
		{ id: 'astreinte', nom: 'Mon astreinte', icone: 'casque' },
		...[...referents].map(([id, nom]) => ({ id: `role:${id}`, nom, icone: iconeDuRole(nom) })).sort(parNom),
		...comites.filter((c) => tient((l) => l.type === 'comite' && l.perimetreId === c.id)).map((c) => ({ id: `comite:${c.id}`, nom: c.nom, icone: 'groupe' as const }))
	];
}

// Ordre : centre, chef d'équipe, astreinte, référents, comités. Seul « Le centre » a déjà de quoi compter.
export async function casquettesDe(base: Base, acteur: Acteur, aujourdhui: string): Promise<Casquette[]> {
	const liste = await tenues(base, acteur, aujourdhui);
	const compteCentre = liste.some((c) => c.id === 'centre') ? (await lireADecider(base, aujourdhui)).length : 0;
	return liste.map((c) => ({ ...c, compte: c.id === 'centre' ? compteCentre : 0 }));
}

export async function aDecider(base: Base, acteur: Acteur, aujourdhui: string): Promise<ADecider[]> {
	const aLeCentre =
		acteur.type === 'super' || (await occupe(base, acteur.id, 'chef_centre', aujourdhui)) || (await occupe(base, acteur.id, 'chef_centre_adjoint', aujourdhui));
	if (!aLeCentre) throw new RefusDroit('GERER_ACCES', { type: 'centre' }, 'Réservé au chef de centre et à son adjoint');
	return lireADecider(base, aujourdhui);
}

async function lireADecider(base: Base, aujourdhui: string): Promise<ADecider[]> {
	// Pas de jointure à noms de colonnes en double : dans un batch, D1 n'en garde qu'une.
	const [equipes, attributions, responsabilites, personnes] = await base.batch([
		base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation)),
		base
			.select({ responsabiliteId: attribution.responsabiliteId, type: attribution.perimetreType, perimetreId: attribution.perimetreId, systeme: responsabilite.systeme })
			.from(attribution)
			.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
			.where(enCoursLe(aujourdhui)),
		base.select({ id: responsabilite.id, nom: responsabilite.nom }).from(responsabilite).where(and(isNull(responsabilite.archiveeLe), isNull(responsabilite.systeme))).orderBy(asc(responsabilite.nom)),
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
		...(fiches > 0 ? [{ texte: `${fiches} ${fiches > 1 ? 'fiches' : 'fiche'} à compléter (grade ou date d’entrée manquants)`, lien: '/agents' }] : [])
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

// Le contenu d'une casquette tenue ; null si l'acteur ne la tient pas.
export async function contenuCasquette(base: Base, acteur: Acteur, id: string, aujourdhui: string): Promise<ContenuCasquette | null> {
	if (!(await tenues(base, acteur, aujourdhui)).some((c) => c.id === id)) return null;
	if (id === 'centre') return { type: 'centre', aDecider: await lireADecider(base, aujourdhui) };
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
		.where(and(eq(attribution.perimetreType, 'comite'), eq(attribution.perimetreId, Number(numero)), isNull(responsabilite.archiveeLe), enCoursLe(aujourdhui)))
		.orderBy(asc(personne.nom), asc(personne.prenom), asc(responsabilite.nom));
	// Une personne à la fois membre et rapporteur : une seule ligne.
	const membres = new Map<number, { prenom: string; nom: string; role: string }>();
	for (const l of lignes) {
		const deja = membres.get(l.personneId);
		membres.set(l.personneId, deja ? { ...deja, role: `${deja.role} · ${l.role}` } : { prenom: l.prenom, nom: l.nom, role: l.role });
	}
	return { type: 'comite', membres: [...membres.values()] };
}
