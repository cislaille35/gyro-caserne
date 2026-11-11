import { and, asc, eq, gte, isNull, lte, max, or } from 'drizzle-orm';
import type { Base } from './base.ts';
import { enCours } from './dates.ts';
import type { Acteur } from './droits.ts';
import { estGestionnaire } from './effectif.ts';
import { RefusDroit } from './erreurs.ts';
import { STATUTS_OPERATIONNELS, type StatutOperationnel } from './listes.ts';
import { affectationEquipe, aptitude, aptitudeAgent, attribution, comite, equipe, grade, journal, personne, profil, responsabilite } from './schema.ts';

export const ENTETES = ['N°', 'E-mail', 'Prénom', 'Nom', 'Grade', 'Date de grade', 'Équipe', 'Statut', 'Profil', 'Téléphone', 'Naissance', 'Entrée au centre', 'Engagement SPV'] as const;

export const LIBELLES_STATUT: Record<StatutOperationnel, string> = {
	operationnel: 'Opérationnel',
	stagiaire: 'Stagiaire',
	inapte_temporaire: 'Inapte temporaire',
	suspendu: 'Suspendu',
	parti: 'Parti'
};

// Plus grands n° du journal et des personnes au moment de l'export, et son jour.
export type Repere = { journal: number; personne: number; date: string };

export type DonneesFichier = {
	entetes: string[];
	listes: { grades: string[]; equipes: string[]; statuts: string[]; profils: string[]; rolesComite: string[] };
	colonnesListe: Record<string, keyof DonneesFichier['listes'] | 'oui'>;
	lignes: string[][];
	repere: Repere | null;
};

// 'AAAA-MM-JJ' → 'JJ/MM/AAAA' ; vide si pas de date.
export function dateFichier(iso: string | null): string {
	if (iso === null) return '';
	const [annee, mois, jour] = iso.split('-');
	return `${jour}/${mois}/${annee}`;
}

// 'JJ/MM/AAAA' ou 'J/M/AAAA' → 'AAAA-MM-JJ' ; null si ce n'est pas une vraie date.
export function dateIso(texte: string): string | null {
	const morceaux = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texte.trim());
	if (!morceaux) return null;
	const [, jour, mois, annee] = morceaux;
	const iso = `${annee}-${mois!.padStart(2, '0')}-${jour!.padStart(2, '0')}`;
	const date = new Date(`${iso}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

// Une colonne par aptitude du centre : « Oui » ou vide.
export const colonneAptitude = (nom: string) => `Aptitude : ${nom}`;

const SYSTEMES_SANS_COLONNE = ['chef_centre', 'chef_centre_adjoint'];

export async function donneesFichier(base: Base, acteur: Acteur, aujourdhui: string, modele: boolean): Promise<DonneesFichier> {
	if (!(await estGestionnaire(base, acteur, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' });

	// Toutes les lectures d'un bloc : une seule requête comptée.
	// Pas de jointure à noms de colonnes en double : dans un batch, D1 n'en garde qu'une.
	const [grades, equipes, profils, responsabilites, comites, personnes, affectations, attributions, [dernierJournal], [dernierePersonne], aptitudes, aptitudesAgents] = await base.batch([
		base.select({ id: grade.id, libelle: grade.libelle }).from(grade).orderBy(asc(grade.ordre)),
		base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation)),
		base.select({ id: profil.id, nom: profil.nom }).from(profil).orderBy(asc(profil.id)),
		base.select().from(responsabilite).where(isNull(responsabilite.archiveeLe)),
		base.select({ id: comite.id, nom: comite.nom }).from(comite).where(isNull(comite.dissousLe)),
		// Un agent effacé n'a plus de ligne dans le fichier.
		base.select().from(personne).where(isNull(personne.effaceLe)),
		base.select().from(affectationEquipe).orderBy(asc(affectationEquipe.debut)),
		base
			.select({ personneId: attribution.personneId, responsabiliteId: attribution.responsabiliteId, type: attribution.perimetreType, perimetreId: attribution.perimetreId, systeme: responsabilite.systeme })
			.from(attribution)
			.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
			.where(and(lte(attribution.debut, aujourdhui), or(isNull(attribution.fin), gte(attribution.fin, aujourdhui)))),
		base.select({ id: max(journal.id) }).from(journal),
		base.select({ id: max(personne.id) }).from(personne),
		base.select({ id: aptitude.id, nom: aptitude.nom }).from(aptitude).where(isNull(aptitude.retireeLe)).orderBy(asc(aptitude.ordre), asc(aptitude.id)),
		base.select({ personneId: aptitudeAgent.personneId, aptitudeId: aptitudeAgent.aptitudeId }).from(aptitudeAgent)
	]);

	const parNom = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom, 'fr');
	const colonnesRoles = responsabilites
		.filter((r) => (r.typePerimetre === 'centre' || r.typePerimetre === 'equipe') && !SYSTEMES_SANS_COLONNE.includes(r.systeme ?? ''))
		.sort(parNom);
	const rolesComite = responsabilites.filter((r) => r.typePerimetre === 'comite').sort(parNom);
	const colonnesComites = comites.sort(parNom);

	const listes = {
		grades: grades.map((g) => g.libelle),
		equipes: equipes.map((e) => e.nom),
		statuts: STATUTS_OPERATIONNELS.map((s) => LIBELLES_STATUT[s]),
		profils: profils.map((p) => p.nom),
		rolesComite: rolesComite.map((r) => r.nom)
	};
	const colonnesListe: DonneesFichier['colonnesListe'] = { Grade: 'grades', Équipe: 'equipes', Statut: 'statuts', Profil: 'profils' };
	for (const r of colonnesRoles) colonnesListe[r.nom] = 'oui';
	for (const c of colonnesComites) colonnesListe[`Comité : ${c.nom}`] = 'rolesComite';
	for (const a of aptitudes) colonnesListe[colonneAptitude(a.nom)] = 'oui';
	const entetes = [...ENTETES, ...colonnesRoles.map((r) => r.nom), ...colonnesComites.map((c) => `Comité : ${c.nom}`), ...aptitudes.map((a) => colonneAptitude(a.nom))];

	if (modele) return { entetes, listes, colonnesListe, lignes: [], repere: null };

	const libelleGrade = new Map(grades.map((g) => [g.id, g.libelle]));
	const nomProfil = new Map(profils.map((p) => [p.id, p.nom]));
	const nomEquipe = new Map(equipes.map((e) => [e.id, e.nom]));
	const equipeDe = new Map<number, string>();
	for (const a of affectations) {
		const nom = nomEquipe.get(a.equipeId);
		if (nom !== undefined && enCours(a.debut, a.fin, aujourdhui)) equipeDe.set(a.personneId, nom);
	}
	const protegees = new Set(attributions.filter((a) => SYSTEMES_SANS_COLONNE.includes(a.systeme ?? '')).map((a) => a.personneId));
	const nomRoleComite = new Map(rolesComite.map((r) => [r.id, r.nom]));
	const attributionsDe = new Map<number, typeof attributions>();
	for (const a of attributions) attributionsDe.set(a.personneId, [...(attributionsDe.get(a.personneId) ?? []), a]);

	const lignes = personnes
		.filter((p) => !protegees.has(p.id))
		.sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'))
		.map((p) => {
			const siennes = attributionsDe.get(p.id) ?? [];
			return [
				String(p.id),
				p.email,
				p.prenom,
				p.nom,
				(p.gradeId !== null && libelleGrade.get(p.gradeId)) || '',
				dateFichier(p.dateGrade),
				equipeDe.get(p.id) ?? '',
				LIBELLES_STATUT[p.statut],
				(p.profilId !== null && nomProfil.get(p.profilId)) || '',
				p.telephone ?? '',
				dateFichier(p.naissance),
				dateFichier(p.entreeCentre),
				dateFichier(p.engagementSpv),
				...colonnesRoles.map((r) => (siennes.some((a) => a.responsabiliteId === r.id) ? 'Oui' : '')),
				// Deux rôles dans un même comité : les deux noms, que l'import refusera.
				...colonnesComites.map((c) =>
					siennes
						.filter((a) => a.type === 'comite' && a.perimetreId === c.id && nomRoleComite.has(a.responsabiliteId))
						.map((a) => nomRoleComite.get(a.responsabiliteId)!)
						.sort((x, y) => x.localeCompare(y, 'fr'))
						.join(', ')
				),
				...aptitudes.map((a) => (aptitudesAgents.some((x) => x.personneId === p.id && x.aptitudeId === a.id) ? 'Oui' : ''))
			];
		});

	return { entetes, listes, colonnesListe, lignes, repere: { journal: dernierJournal?.id ?? 0, personne: dernierePersonne?.id ?? 0, date: aujourdhui } };
}
