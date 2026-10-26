import { eq } from 'drizzle-orm';
import type { Base } from './base.ts';
import { enCours } from './dates.ts';
import { aLeDroit, occupe, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import type { StatutOperationnel } from './listes.ts';
import { affectationEquipe, equipe, grade, personne, profil } from './schema.ts';

export type EquipeCourante = { id: number; nom: string; couleur: string };

export type LigneGestion = {
	id: number;
	prenom: string;
	nom: string;
	email: string;
	grade: string | null;
	equipe: EquipeCourante | null;
	statut: StatutOperationnel;
	exterieur: boolean;
};

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

const parNom = (a: { nom: string; prenom: string }, b: { nom: string; prenom: string }) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr');

export async function vueEffectif(base: Base, aujourdhui: string) {
	const lignes = await base
		.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, statut: personne.statut, grade: grade.libelle, type: profil.typePersonne })
		.from(personne)
		.leftJoin(grade, eq(grade.id, personne.gradeId))
		.leftJoin(profil, eq(profil.id, personne.profilId));
	const equipes = await equipesCourantes(base, aujourdhui);
	const groupes = await base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(equipe.ordreRotation);

	const presentes = lignes.filter((l) => l.statut !== 'parti');
	const sansIdentifiants = ({ id, prenom, nom, grade }: (typeof presentes)[number]) => ({ id, prenom, nom, grade });
	const enGroupe = (garde: (l: (typeof presentes)[number]) => boolean) => presentes.filter(garde).sort(parNom).map(sansIdentifiants);

	const resultat = [
		...groupes.map((g) => ({ titre: g.nom, personnes: enGroupe((l) => l.type !== 'exterieur' && equipes.get(l.id)?.id === g.id) })),
		{ titre: 'Sans équipe', personnes: enGroupe((l) => l.type !== 'exterieur' && !equipes.has(l.id)) },
		{ titre: 'Extérieurs', personnes: enGroupe((l) => l.type === 'exterieur') }
	];
	return resultat.filter((g) => g.personnes.length > 0);
}

export async function listeGestion(
	base: Base,
	acteur: Acteur,
	filtres: { texte?: string; equipeId?: number | 'aucune'; statut?: StatutOperationnel },
	aujourdhui: string
): Promise<LigneGestion[]> {
	await exigerGestionnaire(base, acteur, aujourdhui);
	const lignes = await base
		.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, email: personne.email, statut: personne.statut, grade: grade.libelle, type: profil.typePersonne })
		.from(personne)
		.leftJoin(grade, eq(grade.id, personne.gradeId))
		.leftJoin(profil, eq(profil.id, personne.profilId));
	const equipes = await equipesCourantes(base, aujourdhui);
	const texte = filtres.texte?.trim().toLowerCase();

	return lignes
		.map(({ type, ...l }): LigneGestion => {
			const e = equipes.get(l.id);
			return { ...l, equipe: e ? { id: e.id, nom: e.nom, couleur: e.couleur } : null, exterieur: type === 'exterieur' };
		})
		.filter((l) => !texte || [l.prenom, l.nom, l.email].some((champ) => champ.toLowerCase().includes(texte)))
		.filter((l) => filtres.equipeId === undefined || (filtres.equipeId === 'aucune' ? l.equipe === null : l.equipe?.id === filtres.equipeId))
		.filter((l) => filtres.statut === undefined || l.statut === filtres.statut)
		.sort(parNom);
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
