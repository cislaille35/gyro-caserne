import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours, enCours, exigerDate, exigerDateHeure } from '../dates.ts';
import { effectifs, requeteConclues } from '../remplacements/effectifs.ts';
import { aLeDroit, type Acteur } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import type { ReponseEvenement } from '../listes.ts';
import { equipesConvoquees, type Convocation } from '../murs.ts';
import { ligneJournal } from '../journal.ts';
import { texte } from '../commun.ts';
import { nomActeur } from '../actions/personnes.ts';
import { affectationEquipe, anneePlanning, equipe, gardeFete, manoeuvre, publication, reponseEvenement, semaineChangee, vacancesScolaires } from '../schema.ts';
import { colonnesPublication } from './manoeuvres.ts';
import { calculerAnnee, feries, fetes, semainesDe, tourDesFetes, type Fete, type Periode, type Reglage, type SemaineCalculee } from './calendrier.ts';

export type Convoques = 'tous' | number[];
export type DonneesManoeuvre = { id?: number; debut: string; theme: string; lieu: string; convoques: Convoques; petitDejeuner: boolean };
// `convoques` : les équipes ; `convocation` : avec les agents ajoutés ou retirés par un échange.
export type ManoeuvreVue = { id: number; debut: string; theme: string; lieu: string; convoques: Convoques; convocation: Convocation; petitDejeuner: boolean; annulee: boolean; publiee: boolean; publicationId: number | null };
export type Vacances = { id: number; nom: string; debut: string; fin: string };
export type EquipePlanning = { id: number; nom: string; couleur: string };

const ANNEE_MIN = 2020;
const ANNEE_MAX = 2100;

export function exigerAnnee(annee: number): number {
	if (!Number.isInteger(annee) || annee < ANNEE_MIN || annee > ANNEE_MAX) throw new DonneeInvalide('Année invalide');
	return annee;
}

const peutGerer = (base: Base, acteur: Acteur, aujourdhui: string) => aLeDroit(base, acteur, 'GERER_PLANNING', { type: 'centre' }, aujourdhui);

async function exigerGestion(base: Base, acteur: Acteur, maintenant: string): Promise<string> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await peutGerer(base, acteur, aujourdhui))) throw new RefusDroit('GERER_PLANNING', { type: 'centre' });
	return aujourdhui;
}

const journalPlanning = (base: Base, acteur: Acteur, action: string, details: object, maintenant: string, cibleId: number | SQL | null = null) =>
	ligneJournal(base, { acteur: nomActeur(acteur), action, cibleType: 'planning', cibleId, details }, maintenant);

export const vueManoeuvre = (m: typeof manoeuvre.$inferSelect): ManoeuvreVue => ({
	id: m.id,
	debut: m.debut,
	theme: m.theme,
	lieu: m.lieu,
	convoques: equipesConvoquees(JSON.parse(m.convoques) as Convocation),
	convocation: JSON.parse(m.convoques) as Convocation,
	petitDejeuner: m.petitDejeuner === 1,
	annulee: m.annuleeLe !== null,
	publiee: m.publicationId !== null,
	publicationId: m.publicationId
});

// Les lectures communes à la préparation et à la consultation : années, semaines changées, manœuvres, vacances, équipes, historique des fêtes.
export function lectures(base: Base, debut: string, fin: string) {
	return [
		base.select().from(anneePlanning),
		base.select().from(semaineChangee).where(and(gte(semaineChangee.debut, debut), lte(semaineChangee.debut, fin))),
		base.select().from(manoeuvre).where(and(gte(manoeuvre.debut, debut), lte(manoeuvre.debut, `${fin}T23:59`))).orderBy(asc(manoeuvre.debut)),
		base.select().from(vacancesScolaires).where(and(lte(vacancesScolaires.debut, fin), gte(vacancesScolaires.fin, debut))).orderBy(asc(vacancesScolaires.debut)),
		base.select({ id: equipe.id, nom: equipe.nom, couleur: equipe.couleur, active: equipe.active }).from(equipe).orderBy(asc(equipe.ordreRotation)),
		base.select().from(gardeFete).orderBy(desc(gardeFete.annee), asc(gardeFete.fete))
	] as const;
}

const semainesCalculees = (annee: number, ordreJson: string | undefined, changees: { debut: string; equipeId: number }[], reglage: Reglage): SemaineCalculee[] => {
	const ordre = JSON.parse(ordreJson ?? '[]') as number[];
	if (ordre.length === 0) return [];
	return calculerAnnee(annee, reglage, ordre, new Map(changees.filter((c) => c.debut.startsWith(`${annee}-`)).map((c) => [c.debut, c.equipeId])));
};

// L'ordre que donnerait la référence du centre (centre.ts) pour la première semaine de l'année, parmi les équipes actives.
export function ordrePropose(annee: number, reglage: Reglage, equipes: { id: number; active: number }[]): number[] {
	const actives = equipes.filter((e) => e.active === 1);
	const premiere = semainesDe(annee, reglage)[0]!.debut;
	const semaines = Math.round((Date.parse(premiere) - Date.parse(reglage.reference.date)) / (7 * 864e5));
	const n = actives.length;
	const decalage = (((reglage.reference.equipe - 1 + semaines) % n) + n) % n;
	return [...actives.slice(decalage), ...actives.slice(0, decalage)].map((e) => e.id);
}

export type Preparation = Awaited<ReturnType<typeof preparerAnnee>>;

// Tout ce que le chef voit en préparant l'année. Les fêtes des années précédentes déjà dans l'appli complètent l'historique saisi.
export async function preparerAnnee(base: Base, acteur: Acteur, annee: number, maintenant: string, reglage: Reglage) {
	exigerAnnee(annee);
	await exigerGestion(base, acteur, maintenant);
	const [annees, changees, manoeuvres, vacances, equipes, saisies] = await base.batch(lectures(base, `${annee - 3}-01-01`, `${annee}-12-31`));
	const ligne = annees.find((a) => a.annee === annee);
	const semaines = semainesCalculees(annee, ligne?.ordre, changees, reglage);
	const historique: { annee: number; fete: Fete; equipeId: number }[] = saisies.map((s) => ({ annee: s.annee, fete: s.fete, equipeId: s.equipeId }));
	for (const a of annees.filter((x) => x.annee < annee && x.annee >= annee - 3 && x.publieeLe !== null)) {
		const f = fetes(a.annee, semainesCalculees(a.annee, a.ordre, changees, reglage));
		for (const [fete, id] of [['noel', f.noel], ['nouvel_an', f.nouvelAn]] as const) {
			if (id !== null && !historique.some((h) => h.annee === a.annee && h.fete === fete)) historique.push({ annee: a.annee, fete, equipeId: id });
		}
	}
	historique.sort((a, b) => b.annee - a.annee || a.fete.localeCompare(b.fete));
	const actives = equipes.filter((e) => e.active === 1);
	return {
		annee,
		publiee: ligne?.publieeLe ?? null,
		ordre: JSON.parse(ligne?.ordre ?? '[]') as number[],
		ordrePropose: ordrePropose(annee, reglage, equipes),
		semaines,
		manoeuvres: manoeuvres.filter((m) => m.debut.startsWith(`${annee}-`)).map(vueManoeuvre),
		vacances: vacances.filter((v) => v.fin >= `${annee}-01-01`) as Vacances[],
		feries: feries(annee),
		fetes: { ...fetes(annee, semaines), attendues: tourDesFetes(historique, actives.map((e) => e.id), annee), historique },
		equipes: equipes.map(({ id, nom, couleur }) => ({ id, nom, couleur }))
	};
}

async function exigerEquipes(base: Base, ids: number[]) {
	if (!ids.every((id) => Number.isInteger(id) && id > 0)) throw new DonneeInvalide('Équipe inconnue');
	const connues = await base.select({ id: equipe.id }).from(equipe).where(inArray(equipe.id, ids));
	if (connues.length !== new Set(ids).size) throw new DonneeInvalide('Équipe inconnue');
}

export async function reglerRoulement(base: Base, acteur: Acteur, annee: number, ordre: number[], maintenant: string): Promise<void> {
	exigerAnnee(annee);
	await exigerGestion(base, acteur, maintenant);
	if (!Array.isArray(ordre) || ordre.length < 2 || new Set(ordre).size !== ordre.length) throw new DonneeInvalide('Au moins deux équipes, chacune une fois');
	await exigerEquipes(base, ordre);
	const json = JSON.stringify(ordre);
	await base.batch([
		base.insert(anneePlanning).values({ annee, ordre: json }).onConflictDoUpdate({ target: anneePlanning.annee, set: { ordre: json } }),
		journalPlanning(base, acteur, 'regler_roulement', { annee, ordre }, maintenant)
	]);
}

// `choix` : l'équipe voulue pour des semaines de l'année (jour de relève). Seuls les écarts au roulement sont gardés.
export async function changerSemaines(base: Base, acteur: Acteur, annee: number, choix: Record<string, number>, maintenant: string, reglage: Reglage): Promise<void> {
	exigerAnnee(annee);
	await exigerGestion(base, acteur, maintenant);
	const [ligne] = await base.select().from(anneePlanning).where(eq(anneePlanning.annee, annee));
	if (!ligne || ligne.ordre === '[]') throw new DonneeInvalide('Réglez d’abord le roulement');
	const ordre = JSON.parse(ligne.ordre) as number[];
	const toutes = semainesDe(annee, reglage);
	const debuts = new Map(Object.entries(choix));
	for (const debut of debuts.keys()) if (!toutes.some((s) => s.debut === debut)) throw new DonneeInvalide('Semaine inconnue');
	await exigerEquipes(base, [...new Set(debuts.values())]);
	const ecritures = [];
	for (const [debut, equipeId] of debuts) {
		const i = toutes.findIndex((s) => s.debut === debut);
		ecritures.push(
			equipeId === ordre[i % ordre.length]
				? base.delete(semaineChangee).where(eq(semaineChangee.debut, debut))
				: base.insert(semaineChangee).values({ debut, equipeId }).onConflictDoUpdate({ target: semaineChangee.debut, set: { equipeId } })
		);
	}
	await base.batch([journalPlanning(base, acteur, 'changer_semaines', { annee, semaines: debuts.size }, maintenant), ...ecritures]);
}

export async function noterFete(base: Base, acteur: Acteur, annee: number, fete: Fete, equipeId: number | null, maintenant: string): Promise<void> {
	exigerAnnee(annee);
	await exigerGestion(base, acteur, maintenant);
	if (fete !== 'noel' && fete !== 'nouvel_an') throw new DonneeInvalide('Fête inconnue');
	if (equipeId !== null) await exigerEquipes(base, [equipeId]);
	const cle = and(eq(gardeFete.annee, annee), eq(gardeFete.fete, fete));
	await base.batch([
		equipeId === null
			? base.delete(gardeFete).where(cle)
			: base.insert(gardeFete).values({ annee, fete, equipeId }).onConflictDoUpdate({ target: [gardeFete.annee, gardeFete.fete], set: { equipeId } }),
		journalPlanning(base, acteur, 'noter_fete', { annee, fete, equipeId }, maintenant)
	]);
}

export async function ajouterVacances(base: Base, acteur: Acteur, v: { nom: string; debut: string; fin: string }, maintenant: string): Promise<number> {
	await exigerGestion(base, acteur, maintenant);
	const nom = texte(v.nom, 'Nom', 60);
	exigerDate(v.debut);
	exigerDate(v.fin);
	if (v.fin < v.debut) throw new DonneeInvalide('Fin avant le début');
	const [lignes] = await base.batch([
		base.insert(vacancesScolaires).values({ nom, debut: v.debut, fin: v.fin }).returning({ id: vacancesScolaires.id }),
		journalPlanning(base, acteur, 'ajouter_vacances', { nom, debut: v.debut, fin: v.fin }, maintenant)
	]);
	return lignes[0]!.id;
}

export async function retirerVacances(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	await exigerGestion(base, acteur, maintenant);
	await base.batch([base.delete(vacancesScolaires).where(eq(vacancesScolaires.id, id)), journalPlanning(base, acteur, 'retirer_vacances', {}, maintenant, id)]);
}

// Contrôle une manœuvre saisie ; rend les colonnes à écrire.
export async function exigerManoeuvre(base: Base, d: DonneesManoeuvre, maintenant: string) {
	exigerDateHeure(d.debut, 'Début');
	const debut = d.debut.slice(0, 16);
	if (debut < maintenant.slice(0, 16)) throw new DonneeInvalide('Manœuvre passée');
	const theme = texte(d.theme, 'Thème', 100);
	const lieu = texte(d.lieu, 'Lieu', 200);
	let convoques: Convoques = 'tous';
	if (d.convoques !== 'tous') {
		if (!Array.isArray(d.convoques) || d.convoques.length === 0) throw new DonneeInvalide('Choisissez au moins une équipe');
		convoques = [...new Set(d.convoques)];
		await exigerEquipes(base, convoques);
	}
	return { debut, theme, lieu, convoques: JSON.stringify(convoques), petitDejeuner: d.petitDejeuner ? 1 : 0 };
}

export async function enregistrerManoeuvre(base: Base, acteur: Acteur, d: DonneesManoeuvre, maintenant: string): Promise<number> {
	await exigerGestion(base, acteur, maintenant);
	const valeurs = await exigerManoeuvre(base, d, maintenant);
	if (d.id === undefined) {
		const [lignes] = await base.batch([
			base.insert(manoeuvre).values(valeurs).returning({ id: manoeuvre.id }),
			journalPlanning(base, acteur, 'ajouter_manoeuvre', { debut: valeurs.debut }, maintenant, sql`last_insert_rowid()`)
		]);
		return lignes[0]!.id;
	}
	const [existante] = await base
		.select({ annuleeLe: manoeuvre.annuleeLe, publicationId: manoeuvre.publicationId, debut: manoeuvre.debut, convoques: manoeuvre.convoques, ouverture: publication.sondageOuverture, cloture: publication.sondageCloture })
		.from(manoeuvre)
		.leftJoin(publication, eq(publication.id, manoeuvre.publicationId))
		.where(eq(manoeuvre.id, d.id));
	if (!existante || existante.annuleeLe !== null) throw new DonneeInvalide('Manœuvre inconnue');
	// Déjà annoncée : sa publication suit (les convoqués sont prévenus par manoeuvreChangee). Même date : le sondage garde sa clôture ;
	// nouvelle date : la clôture est recalculée et la relance pourra repartir.
	const memeDate = existante.debut === valeurs.debut;
	// Les échanges entre agents restent, tant que la manœuvre ne convoque pas tout le centre.
	const avant = JSON.parse(existante.convoques) as Convocation;
	if (!Array.isArray(avant) && avant !== 'tous' && valeurs.convoques !== '"tous"') valeurs.convoques = JSON.stringify({ ...avant, equipes: JSON.parse(valeurs.convoques) });
	const cloture = memeDate ? existante.cloture : null;
	const suivre = existante.publicationId === null ? [] : [base.update(publication).set({ ...colonnesPublication(valeurs, maintenant, existante.ouverture, cloture), modifieeLe: maintenant }).where(eq(publication.id, existante.publicationId))];
	await base.batch([base.update(manoeuvre).set({ ...valeurs, ...(memeDate ? {} : { relanceLe: null }) }).where(eq(manoeuvre.id, d.id)), ...suivre, journalPlanning(base, acteur, 'modifier_manoeuvre', { debut: valeurs.debut }, maintenant, d.id)]);
	return d.id;
}

export async function supprimerManoeuvre(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	await exigerGestion(base, acteur, maintenant);
	const [existante] = await base.select().from(manoeuvre).where(eq(manoeuvre.id, id));
	if (!existante || existante.annuleeLe !== null) throw new DonneeInvalide('Manœuvre inconnue');
	if (existante.debut <= maintenant.slice(0, 16)) throw new DonneeInvalide('Manœuvre passée');
	// Déjà annoncée : elle est annulée, sa publication reste et le dit.
	if (existante.publicationId !== null) {
		await base.batch([
			base.update(manoeuvre).set({ annuleeLe: maintenant }).where(eq(manoeuvre.id, id)),
			base.update(publication).set({ annuleeLe: maintenant, modifieeLe: maintenant }).where(eq(publication.id, existante.publicationId)),
			journalPlanning(base, acteur, 'annuler_manoeuvre', {}, maintenant, id)
		]);
		return;
	}
	await base.batch([base.delete(manoeuvre).where(eq(manoeuvre.id, id)), journalPlanning(base, acteur, 'supprimer_manoeuvre', {}, maintenant, id)]);
}

export async function publierAnnee(base: Base, acteur: Acteur, annee: number, maintenant: string): Promise<void> {
	exigerAnnee(annee);
	await exigerGestion(base, acteur, maintenant);
	const [ligne] = await base.select().from(anneePlanning).where(eq(anneePlanning.annee, annee));
	if (!ligne || ligne.ordre === '[]') throw new DonneeInvalide('Réglez d’abord le roulement');
	if (ligne.publieeLe !== null) return;
	await base.batch([base.update(anneePlanning).set({ publieeLe: maintenant }).where(eq(anneePlanning.annee, annee)), journalPlanning(base, acteur, 'publier_annee', { annee }, maintenant)]);
}

// Semaines d'une année publiée, avec le roulement : lecture partagée par l'onglet Planning, l'agenda et la tâche de nuit.
export function anneesPubliees(annees: (typeof anneePlanning.$inferSelect)[], changees: { debut: string; equipeId: number }[], reglage: Reglage): Map<number, SemaineCalculee[]> {
	return new Map(annees.filter((a) => a.publieeLe !== null).map((a) => [a.annee, semainesCalculees(a.annee, a.ordre, changees, reglage)]));
}

// L'équipe de la personne à une date, d'après ses affectations.
export const equipeLe = (affectations: { equipeId: number; debut: string; fin: string | null }[], date: string) => affectations.find((a) => enCours(a.debut, a.fin, date))?.equipeId ?? null;

// Convoqué : son équipe l'est, sauf s'il a cédé sa place ; ou il a pris celle d'un autre.
export function convoque(c: Convocation, equipeId: number | null, personneId: number): boolean {
	if (c === 'tous') return true;
	if (!Array.isArray(c) && c.retires.includes(personneId)) return false;
	if (!Array.isArray(c) && c.ajoutes.includes(personneId)) return true;
	return equipeId !== null && (Array.isArray(c) ? c : c.equipes).includes(equipeId);
}

export type PlanningAgent =
	| { publiee: false; annee: number; peutPreparer: boolean }
	| {
			publiee: true;
			annee: number;
			peutPreparer: boolean;
			equipes: EquipePlanning[];
			semaines: (SemaineCalculee & { mienne: boolean })[];
			manoeuvres: (ManoeuvreVue & { convoque: boolean })[];
			vacances: Vacances[];
			feries: { date: string; nom: string }[];
			fetes: { noel: number | null; nouvelAn: number | null };
			monEquipe: number | null;
			// Les remplacements conclus de l'année ; `moi` : je cède ma période, ou je prends celle d'un autre.
			remplacements: { debut: string; fin: string; titulaire: string; remplacant: string; moi: 'cede' | 'prend' | null }[];
			prochaine: {
				astreinte: { debut: string; fin: string; equipeId: number; enCours: boolean; periodes: Periode[] } | null;
				// `reponse` : la mienne, si la manœuvre est déjà annoncée.
				manoeuvre: (ManoeuvreVue & { reponse: ReponseEvenement | null }) | null;
				fete: { fete: Fete; date: string } | null;
			};
	  };

// L'année vue par un agent (VOIR_PLANNING). Ses semaines suivent son équipe à la date de chaque relève.
// « Prochaine » regarde l'année demandée et la suivante, publiées.
export async function planningDe(base: Base, acteur: Acteur, annee: number, maintenant: string, reglage: Reglage): Promise<PlanningAgent> {
	exigerAnnee(annee);
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await aLeDroit(base, acteur, 'VOIR_PLANNING', { type: 'centre' }, aujourdhui))) throw new RefusDroit('VOIR_PLANNING', { type: 'centre' });
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	// Dès la mi-décembre de l'année d'avant : une semaine commencée fin décembre peut être encore en cours.
	const debutLecture = `${Math.min(annee, Number(aujourdhui.slice(0, 4))) - 1}-12-18`;
	const finLecture = `${Math.max(annee, Number(aujourdhui.slice(0, 4))) + 1}-12-31`;
	const [[annees, changees, manoeuvres, vacances, equipes, , conclues], affectations, gerer] = await Promise.all([
		base.batch([...lectures(base, debutLecture, finLecture), requeteConclues(base, ajouterJours(`${annee}-01-01`, -7), `${annee}-12-31`)]),
		base.select({ equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe).where(eq(affectationEquipe.personneId, moi)),
		peutGerer(base, acteur, aujourdhui)
	]);
	// Les années lues seulement : hors de cette fenêtre, les semaines changées ne sont pas lues.
	const publiees = anneesPubliees(annees.filter((a) => a.annee >= Number(debutLecture.slice(0, 4)) && a.annee <= Number(finLecture.slice(0, 4))), changees, reglage);
	const semainesAnnee = publiees.get(annee);
	if (!semainesAnnee) return { publiee: false, annee, peutPreparer: gerer };

	const mienne = (s: SemaineCalculee) => equipeLe(affectations, s.debut) === s.equipeId;
	const toutes = [...publiees.entries()].sort(([a], [b]) => a - b).flatMap(([, s]) => s);
	const prochaineSemaine = toutes.find((s) => mienne(s) && s.periodes.at(-1)!.fin > maintenant);
	const vues = manoeuvres.map(vueManoeuvre).filter((m) => !m.annulee);
	const convoqueA = (m: ManoeuvreVue) => convoque(m.convocation, equipeLe(affectations, m.debut.slice(0, 10)), moi);
	const prochaineManoeuvre = vues.find((m) => m.debut >= maintenant.slice(0, 16) && convoqueA(m) && publiees.has(Number(m.debut.slice(0, 4))));
	const [reponse] = prochaineManoeuvre?.publicationId
		? await base.select({ reponse: reponseEvenement.reponse }).from(reponseEvenement).where(and(eq(reponseEvenement.publicationId, prochaineManoeuvre.publicationId), eq(reponseEvenement.personneId, moi)))
		: [];
	let fete: { fete: Fete; date: string } | null = null;
	for (const [a, s] of [...publiees.entries()].sort(([x], [y]) => x - y)) {
		const f = fetes(a, s);
		const candidates = [
			{ fete: 'noel' as const, date: `${a}-12-25`, equipeId: f.noel },
			{ fete: 'nouvel_an' as const, date: `${a}-12-31`, equipeId: f.nouvelAn }
		];
		const trouvee = candidates.find((c) => c.date >= aujourdhui && c.equipeId !== null && equipeLe(affectations, c.date) === c.equipeId);
		if (trouvee) {
			fete = { fete: trouvee.fete, date: trouvee.date };
			break;
		}
	}
	return {
		publiee: true,
		annee,
		peutPreparer: gerer,
		equipes: equipes.map(({ id, nom, couleur }) => ({ id, nom, couleur })),
		semaines: semainesAnnee.map((s) => ({ ...s, mienne: mienne(s) })),
		manoeuvres: vues.filter((m) => m.debut.startsWith(`${annee}-`)).map((m) => ({ ...m, convoque: convoqueA(m) })),
		vacances: vacances.filter((v) => v.debut <= `${annee}-12-31` && v.fin >= `${annee}-01-01`) as Vacances[],
		feries: feries(annee),
		fetes: fetes(annee, semainesAnnee),
		monEquipe: equipeLe(affectations, aujourdhui),
		remplacements: effectifs(conclues)
			.filter((r) => r.fin > `${annee}-01-01` && r.debut < `${annee + 1}-01-01`)
			.map(({ debut, fin, titulaire, remplacant, titulaireId, remplacantId }) => ({ debut, fin, titulaire, remplacant, moi: titulaireId === moi ? ('cede' as const) : remplacantId === moi ? ('prend' as const) : null })),
		prochaine: {
			astreinte: prochaineSemaine
				? { debut: prochaineSemaine.periodes[0]!.debut, fin: prochaineSemaine.periodes.at(-1)!.fin, equipeId: prochaineSemaine.equipeId, enCours: prochaineSemaine.periodes[0]!.debut <= maintenant.slice(0, 16), periodes: prochaineSemaine.periodes }
				: null,
			manoeuvre: prochaineManoeuvre ? { ...prochaineManoeuvre, reponse: reponse?.reponse ?? null } : null,
			fete
		}
	};
}

// La page d'une manœuvre (nouvelle si `id` est nul) : la manœuvre et les équipes actives.
export async function manoeuvreAPreparer(base: Base, acteur: Acteur, id: number | null, maintenant: string): Promise<{ manoeuvre: ManoeuvreVue | null; equipes: EquipePlanning[] }> {
	await exigerGestion(base, acteur, maintenant);
	const [lignes, equipes] = await base.batch([
		base.select().from(manoeuvre).where(eq(manoeuvre.id, id ?? 0)),
		base.select({ id: equipe.id, nom: equipe.nom, couleur: equipe.couleur }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation))
	]);
	if (id !== null && !lignes[0]) throw new DonneeInvalide('Manœuvre inconnue');
	return { manoeuvre: lignes[0] ? vueManoeuvre(lignes[0]) : null, equipes };
}
