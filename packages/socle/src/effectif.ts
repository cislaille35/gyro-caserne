import { and, eq, gte, isNull, lte, ne, or } from 'drizzle-orm';
import type { Base } from './base.ts';
import { enCours } from './dates.ts';
import { aLeDroit, occupe, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import type { StatutOperationnel } from './listes.ts';
import { affectationEquipe, attribution, comite, equipe, grade, personne, profil, responsabilite } from './schema.ts';

export type EquipeCourante = { id: number; nom: string; couleur: string };

export type LigneGestion = {
	id: number;
	prenom: string;
	nom: string;
	email: string;
	grade: string | null;
	statut: StatutOperationnel;
	roles: string[];
	aCompleter: boolean;
};

// Une équipe active porte sa couleur et ses chefs en cours (« A. Martin ») ; les autres groupes, rien.
export type GroupeAgents<P> = { titre: string; equipe: { couleur: string; chefs: string[] } | null; personnes: P[] };

export const FILTRES_GESTION = ['a-completer', 'indisponibles', 'partis'] as const;
export type FiltreGestion = (typeof FILTRES_GESTION)[number];
export type ListeGestion = { groupes: GroupeAgents<LigneGestion>[]; comptes: Record<FiltreGestion, number> };

export type FicheAgent = Omit<typeof personne.$inferSelect, 'photo' | 'gradeId' | 'profilId'> & {
	equipe: EquipeCourante | null;
	grade: { id: number; libelle: string } | null;
	profil: { id: number; nom: string } | null;
	protection: 'chef' | 'adjoint' | null;
};

export async function estGestionnaire(base: Base, acteur: Acteur, aujourdhui: string): Promise<boolean> {
	return acteur.type === 'super' || aLeDroit(base, acteur, 'GERER_ACCES', { type: 'centre' }, aujourdhui);
}

async function exigerGestionnaire(base: Base, acteur: Acteur, aujourdhui: string) {
	if (!(await estGestionnaire(base, acteur, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' });
}

// Équipe en cours de chaque personne (équipes actives seulement).
async function equipesCourantes(base: Base, aujourdhui: string): Promise<Map<number, EquipeCourante & { ordre: number }>> {
	const lignes = await base
		.select({ personneId: affectationEquipe.personneId, debut: affectationEquipe.debut, fin: affectationEquipe.fin, id: equipe.id, nom: equipe.nom, couleur: equipe.couleur, ordre: equipe.ordreRotation })
		.from(affectationEquipe)
		.innerJoin(equipe, eq(equipe.id, affectationEquipe.equipeId))
		.where(eq(equipe.active, 1))
		.orderBy(affectationEquipe.debut);
	const parPersonne = new Map<number, EquipeCourante & { ordre: number }>();
	for (const l of lignes) {
		if (enCours(l.debut, l.fin, aujourdhui)) parPersonne.set(l.personneId, { id: l.id, nom: l.nom, couleur: l.couleur, ordre: l.ordre });
	}
	return parPersonne;
}

// Rôles en cours de chaque personne, en une seule requête : « Nom », « Nom (Équipe 2) » ou « Nom (Amicale) ».
// Les responsabilités archivées et les comités dissous n'y figurent pas.
async function rolesCourants(base: Base, aujourdhui: string): Promise<Map<number, string[]>> {
	const lignes = await base
		.select({ personneId: attribution.personneId, nom: responsabilite.nom, type: attribution.perimetreType, equipe: equipe.nom, comite: comite.nom })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.leftJoin(equipe, and(eq(attribution.perimetreType, 'equipe'), eq(equipe.id, attribution.perimetreId)))
		.leftJoin(comite, and(eq(attribution.perimetreType, 'comite'), eq(comite.id, attribution.perimetreId), isNull(comite.dissousLe)))
		.where(and(isNull(responsabilite.archiveeLe), lte(attribution.debut, aujourdhui), or(isNull(attribution.fin), gte(attribution.fin, aujourdhui))));
	const parPersonne = new Map<number, string[]>();
	for (const l of lignes) {
		const lieu = l.type === 'equipe' ? l.equipe : l.type === 'comite' ? l.comite : null;
		if (l.type !== 'centre' && lieu === null) continue;
		parPersonne.set(l.personneId, [...(parPersonne.get(l.personneId) ?? []), lieu === null ? l.nom : `${l.nom} (${lieu})`]);
	}
	for (const roles of parPersonne.values()) roles.sort((a, b) => a.localeCompare(b, 'fr'));
	return parPersonne;
}

const parNom = (a: { nom: string; prenom: string }, b: { nom: string; prenom: string }) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr');

// Chefs d'équipe en cours de chaque équipe, « A. Martin » ; un agent parti ne compte pas.
async function chefsDEquipe(base: Base, aujourdhui: string): Promise<Map<number, string[]>> {
	const lignes = await base
		.select({ equipeId: attribution.perimetreId, prenom: personne.prenom, nom: personne.nom })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.innerJoin(personne, eq(personne.id, attribution.personneId))
		.where(
			and(
				eq(responsabilite.systeme, 'chef_equipe'),
				eq(attribution.perimetreType, 'equipe'),
				ne(personne.statut, 'parti'),
				lte(attribution.debut, aujourdhui),
				or(isNull(attribution.fin), gte(attribution.fin, aujourdhui))
			)
		);
	const parEquipe = new Map<number, string[]>();
	for (const l of lignes.sort(parNom)) {
		if (l.equipeId === null) continue;
		parEquipe.set(l.equipeId, [...(parEquipe.get(l.equipeId) ?? []), `${l.prenom.trim().charAt(0)}. ${l.nom}`]);
	}
	return parEquipe;
}

type Rangee = { id: number; prenom: string; nom: string; statut: StatutOperationnel; type: string | null };

// Par équipe active, puis sans équipe, extérieurs et partis ; sans groupe vide.
async function ranger<R extends Rangee, P>(base: Base, aujourdhui: string, rangees: R[], montrer: (r: R) => P): Promise<GroupeAgents<P>[]> {
	const equipes = await equipesCourantes(base, aujourdhui);
	const chefs = await chefsDEquipe(base, aujourdhui);
	const actives = await base.select({ id: equipe.id, nom: equipe.nom, couleur: equipe.couleur }).from(equipe).where(eq(equipe.active, 1)).orderBy(equipe.ordreRotation);
	const enGroupe = (garde: (r: R) => boolean) => rangees.filter(garde).sort(parNom).map(montrer);
	const present = (r: R) => r.statut !== 'parti' && r.type !== 'exterieur';

	const groupes: GroupeAgents<P>[] = [
		...actives.map((g) => ({ titre: g.nom, equipe: { couleur: g.couleur, chefs: chefs.get(g.id) ?? [] }, personnes: enGroupe((r) => present(r) && equipes.get(r.id)?.id === g.id) })),
		{ titre: 'Sans équipe', equipe: null, personnes: enGroupe((r) => present(r) && !equipes.has(r.id)) },
		{ titre: 'Extérieurs', equipe: null, personnes: enGroupe((r) => r.statut !== 'parti' && r.type === 'exterieur') },
		{ titre: 'Partis', equipe: null, personnes: enGroupe((r) => r.statut === 'parti') }
	];
	return groupes.filter((g) => g.personnes.length > 0);
}

// La vue de tous : ni statut ni e-mail, pas de partis.
export async function vueEffectif(base: Base, aujourdhui: string) {
	const lignes = await base
		.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, statut: personne.statut, grade: grade.libelle, type: profil.typePersonne })
		.from(personne)
		.leftJoin(grade, eq(grade.id, personne.gradeId))
		.leftJoin(profil, eq(profil.id, personne.profilId));
	const roles = await rolesCourants(base, aujourdhui);
	const presentes = lignes.filter((l) => l.statut !== 'parti');
	return ranger(base, aujourdhui, presentes, ({ id, prenom, nom, grade }) => ({ id, prenom, nom, grade, roles: roles.get(id) ?? [] }));
}

const indisponible = (statut: StatutOperationnel) => statut !== 'operationnel' && statut !== 'parti';

export async function listeGestion(base: Base, acteur: Acteur, filtres: { texte?: string; filtre?: FiltreGestion }, aujourdhui: string): Promise<ListeGestion> {
	await exigerGestionnaire(base, acteur, aujourdhui);
	const lignes = await base
		.select({
			id: personne.id,
			prenom: personne.prenom,
			nom: personne.nom,
			email: personne.email,
			statut: personne.statut,
			gradeId: personne.gradeId,
			entreeCentre: personne.entreeCentre,
			grade: grade.libelle,
			type: profil.typePersonne
		})
		.from(personne)
		.leftJoin(grade, eq(grade.id, personne.gradeId))
		.leftJoin(profil, eq(profil.id, personne.profilId));
	const roles = await rolesCourants(base, aujourdhui);
	// Fiche à compléter : sans grade ou sans date d'entrée, pour un agent présent du centre.
	const toutes = lignes.map((l) => ({ ...l, aCompleter: l.statut !== 'parti' && l.type !== 'exterieur' && (l.gradeId === null || l.entreeCentre === null) }));
	const garde: Record<FiltreGestion, (l: (typeof toutes)[number]) => boolean> = {
		'a-completer': (l) => l.aCompleter,
		indisponibles: (l) => indisponible(l.statut),
		partis: (l) => l.statut === 'parti'
	};
	const texte = filtres.texte?.trim().toLowerCase();
	const gardees = toutes
		.filter((l) => !texte || [l.prenom, l.nom, l.email].some((champ) => champ.toLowerCase().includes(texte)))
		.filter((l) => filtres.filtre === undefined || garde[filtres.filtre](l));

	const groupes = await ranger(base, aujourdhui, gardees, ({ id, prenom, nom, email, grade, statut, aCompleter }) => ({ id, prenom, nom, email, grade, statut, roles: roles.get(id) ?? [], aCompleter }));
	const compter = (f: FiltreGestion) => toutes.filter(garde[f]).length;
	return { groupes, comptes: { 'a-completer': compter('a-completer'), indisponibles: compter('indisponibles'), partis: compter('partis') } };
}

export async function ficheAgent(base: Base, acteur: Acteur, id: number, aujourdhui: string): Promise<FicheAgent> {
	await exigerGestionnaire(base, acteur, aujourdhui);
	const [p] = await base.select().from(personne).where(eq(personne.id, id));
	if (!p) throw new DonneeInvalide('Personne inconnue');
	const { photo: _photo, gradeId, profilId, ...champs } = p;

	const [leGrade] = gradeId === null ? [] : await base.select({ id: grade.id, libelle: grade.libelle }).from(grade).where(eq(grade.id, gradeId));
	const [leProfil] = profilId === null ? [] : await base.select({ id: profil.id, nom: profil.nom }).from(profil).where(eq(profil.id, profilId));
	const e = (await equipesCourantes(base, aujourdhui)).get(id);
	const protection = (await occupe(base, id, 'chef_centre', aujourdhui)) ? 'chef' : (await occupe(base, id, 'chef_centre_adjoint', aujourdhui)) ? 'adjoint' : null;

	return { ...champs, equipe: e ? { id: e.id, nom: e.nom, couleur: e.couleur } : null, grade: leGrade ?? null, profil: leProfil ?? null, protection };
}
