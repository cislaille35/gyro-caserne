import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours, enCours, exigerDate, exigerDateHeure } from '../dates.ts';
import { aLeDroit, type Acteur } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { dateFichier } from '../fichier-effectif.ts';
import { lecturesAgents } from '../murs.ts';
import { requeteChefs } from '../remplacements/contexte.ts';
import { ete, journal, personne, plageEte, reponseEte, vacancesAgent } from '../schema.ts';
import { ligneJournal } from '../journal.ts';
import { nomActeur } from '../actions/personnes.ts';
import { exigerAnnee } from './annee.ts';
import { avis } from './avis.ts';

export { avis };
import { semainesDe, type Reglage } from './calendrier.ts';

// L'été : la période et la date limite (le chef), les vacances des agents, les rappels.

export type EteVue = { annee: number; debut: string; fin: string; dateLimite: string; publiee: boolean };
export type Reponse = 'tout' | 'vacances' | null;

const PERIODES_MAX = 10;
const SEMAINES_MAX = 16;

// Du jour de relève de la première semaine au jour de relève qui suit la dernière.
export const vueEte = (e: typeof ete.$inferSelect): EteVue => ({ annee: e.annee, debut: e.debut, fin: ajouterJours(e.fin, 7), dateLimite: e.dateLimite, publiee: e.publieeLe !== null });

// Par défaut : de la dernière relève de juin à la dernière d'août ; vacances à donner avant le 15 mai.
export function periodeParDefaut(annee: number, reglage: Reglage): { debut: string; fin: string; dateLimite: string } {
	const releves = semainesDe(annee, reglage).map((s) => s.debut);
	return { debut: releves.filter((d) => d <= `${annee}-06-30`).at(-1)!, fin: releves.filter((d) => d <= `${annee}-08-31`).at(-1)!, dateLimite: `${annee}-05-15` };
}

async function exigerGestion(base: Base, acteur: Acteur, maintenant: string) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await aLeDroit(base, acteur, 'GERER_PLANNING', { type: 'centre' }, aujourdhui))) throw new RefusDroit('GERER_PLANNING', { type: 'centre' });
	return aujourdhui;
}

// Ouvre (ou règle) l'été : les agents peuvent donner leurs vacances. La période ne change plus une fois l'été publié.
export async function reglerEte(base: Base, acteur: Acteur, annee: number, d: { debut: string; fin: string; dateLimite: string }, maintenant: string, reglage: Reglage): Promise<void> {
	exigerAnnee(annee);
	await exigerGestion(base, acteur, maintenant);
	const releves = semainesDe(annee, reglage).map((s) => s.debut);
	if (!releves.includes(d.debut) || !releves.includes(d.fin)) throw new DonneeInvalide('Jour de relève attendu');
	if (d.fin < d.debut) throw new DonneeInvalide('Fin avant le début');
	if (releves.indexOf(d.fin) - releves.indexOf(d.debut) >= SEMAINES_MAX) throw new DonneeInvalide(`Été trop long : ${SEMAINES_MAX} semaines au plus`);
	exigerDate(d.dateLimite);
	const [existant] = await base.select().from(ete).where(eq(ete.annee, annee));
	if (existant?.publieeLe && (existant.debut !== d.debut || existant.fin !== d.fin)) throw new DonneeInvalide('Été publié : la période ne change plus');
	const valeurs = { debut: d.debut, fin: d.fin, dateLimite: d.dateLimite };
	// Une nouvelle date limite relance les rappels.
	const rappels = existant && existant.dateLimite !== d.dateLimite ? { rappelMoisLe: null, rappelSemaineLe: null } : {};
	// Une autre période : la proposition déjà faite ne vaut plus, elle est à refaire.
	const autrePeriode = existant && (existant.debut !== d.debut || existant.fin !== d.fin);
	await base.batch([
		base.insert(ete).values({ annee, ...valeurs }).onConflictDoUpdate({ target: ete.annee, set: { ...valeurs, ...rappels } }),
		...(autrePeriode ? [base.delete(plageEte).where(eq(plageEte.annee, annee))] : []),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'regler_ete', cibleType: 'planning', cibleId: null, details: { annee, ...valeurs } }, maintenant)
	]);
}

const moiDe = (acteur: Acteur) => {
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux personnes ayant une fiche');
	return acteur.id;
};

// L'été dont on donne les vacances : le premier, cette année ou la suivante, qui n'est pas fini.
async function eteOuvert(base: Base, aujourdhui: string) {
	const annee = Number(aujourdhui.slice(0, 4));
	const lignes = await base.select().from(ete).where(and(gte(ete.annee, annee), lte(ete.annee, annee + 1))).orderBy(asc(ete.annee));
	return lignes.map(vueEte).find((e) => e.fin >= aujourdhui) ?? null;
}

export async function mesVacances(base: Base, acteur: Acteur, maintenant: string): Promise<{ ete: EteVue | null; reponse: { toutEte: boolean; modifieeLe: string } | null; periodes: { id: number; debut: string; fin: string }[] }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	const e = await eteOuvert(base, aujourdhui);
	if (!e) return { ete: null, reponse: null, periodes: [] };
	const [[reponse], periodes] = await base.batch([
		base.select().from(reponseEte).where(and(eq(reponseEte.annee, e.annee), eq(reponseEte.personneId, moi))),
		base.select({ id: vacancesAgent.id, debut: vacancesAgent.debut, fin: vacancesAgent.fin }).from(vacancesAgent).where(and(eq(vacancesAgent.annee, e.annee), eq(vacancesAgent.personneId, moi))).orderBy(asc(vacancesAgent.debut))
	]);
	return { ete: e, reponse: reponse ? { toutEte: reponse.toutEte === 1, modifieeLe: reponse.modifieeLe } : null, periodes };
}

async function exigerEteOuvert(base: Base, annee: number) {
	const [ligne] = await base.select().from(ete).where(eq(ete.annee, annee));
	if (!ligne) throw new DonneeInvalide('Été pas encore ouvert');
	return vueEte(ligne);
}

// Été publié : le chef est prévenu que la répartition est à revoir.
async function prevenirSiPublie(base: Base, e: EteVue, moi: number, maintenant: string) {
	if (!e.publiee) return [];
	const [chefs, [p]] = await base.batch([requeteChefs(base, maintenant.slice(0, 10)), base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.id, moi))]);
	const ids = [...new Set(chefs.filter((c) => c.systeme === 'chef_centre' || c.systeme === 'chef_centre_adjoint').map((c) => c.personneId))].filter((id) => id !== moi);
	return avis(base, ids, 'vacances_changees', `${p?.prenom ?? ''} ${p?.nom ?? ''} a changé ses vacances : à revoir.`.trim(), `/planning/ete?annee=${e.annee}`, maintenant);
}

const repondu = (base: Base, annee: number, moi: number, toutEte: 0 | 1, maintenant: string) =>
	base.insert(reponseEte).values({ annee, personneId: moi, toutEte, modifieeLe: maintenant }).onConflictDoUpdate({ target: [reponseEte.annee, reponseEte.personneId], set: { toutEte, modifieeLe: maintenant } });

export async function ajouterMesVacances(base: Base, acteur: Acteur, annee: number, p: { debut: string; fin: string }, maintenant: string): Promise<number> {
	exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	const e = await exigerEteOuvert(base, annee);
	exigerDate(p.debut);
	exigerDate(p.fin);
	if (p.fin < p.debut) throw new DonneeInvalide('Fin avant le début');
	if (p.fin < e.debut || p.debut >= e.fin) throw new DonneeInvalide('Hors de l’été');
	const siennes = await base.select().from(vacancesAgent).where(and(eq(vacancesAgent.annee, annee), eq(vacancesAgent.personneId, moi)));
	if (siennes.length >= PERIODES_MAX) throw new DonneeInvalide(`${PERIODES_MAX} périodes au plus`);
	if (siennes.some((x) => x.debut <= p.fin && p.debut <= x.fin)) throw new DonneeInvalide('Chevauche une autre période');
	const [lignes] = await base.batch([
		base.insert(vacancesAgent).values({ personneId: moi, annee, debut: p.debut, fin: p.fin }).returning({ id: vacancesAgent.id }),
		repondu(base, annee, moi, 0, maintenant),
		...(await prevenirSiPublie(base, e, moi, maintenant))
	]);
	return lignes[0]!.id;
}

export async function retirerMesVacances(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	const [ligne] = await base.select().from(vacancesAgent).where(and(eq(vacancesAgent.id, id), eq(vacancesAgent.personneId, moi)));
	if (!ligne) throw new DonneeInvalide('Période inconnue');
	const e = await exigerEteOuvert(base, ligne.annee);
	await base.batch([base.delete(vacancesAgent).where(eq(vacancesAgent.id, id)), repondu(base, ligne.annee, moi, 0, maintenant), ...(await prevenirSiPublie(base, e, moi, maintenant))]);
}

// « Je suis disponible tout l'été » : les périodes données sont effacées.
export async function toutLete(base: Base, acteur: Acteur, annee: number, maintenant: string): Promise<void> {
	exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	const e = await exigerEteOuvert(base, annee);
	const [avant] = await base.select().from(vacancesAgent).where(and(eq(vacancesAgent.annee, annee), eq(vacancesAgent.personneId, moi))).limit(1);
	await base.batch([base.delete(vacancesAgent).where(and(eq(vacancesAgent.annee, annee), eq(vacancesAgent.personneId, moi))), repondu(base, annee, moi, 1, maintenant), ...(avant ? await prevenirSiPublie(base, e, moi, maintenant) : [])]);
}

// Les agents concernés par l'été : ceux qui ont accès et une équipe au début de l'été (ou aujourd'hui, s'il est commencé).
export function agentsDeLete(agents: { id: number; prenom: string; nom: string }[], affectations: { personneId: number; equipeId: number; debut: string; fin: string | null }[], date: string) {
	return agents
		.map((a) => ({ ...a, equipeId: affectations.find((x) => x.personneId === a.id && enCours(x.debut, x.fin, date))?.equipeId ?? null }))
		.filter((a): a is typeof a & { equipeId: number } => a.equipeId !== null)
		.sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
}

// Qui a répondu : pour le chef.
export async function reponsesEte(base: Base, acteur: Acteur, annee: number, maintenant: string) {
	exigerAnnee(annee);
	const aujourdhui = await exigerGestion(base, acteur, maintenant);
	const [lignesEte, reponses, periodes, agents, affectations] = await base.batch([
		base.select().from(ete).where(eq(ete.annee, annee)),
		base.select().from(reponseEte).where(eq(reponseEte.annee, annee)),
		base.select().from(vacancesAgent).where(eq(vacancesAgent.annee, annee)).orderBy(asc(vacancesAgent.debut)),
		lecturesAgents(base, aujourdhui)[0],
		lecturesAgents(base, aujourdhui)[1]
	]);
	const e = lignesEte[0] ? vueEte(lignesEte[0]) : null;
	return {
		ete: e,
		agents: agentsDeLete(agents, affectations, aujourdhui).map((a) => {
			const r = reponses.find((x) => x.personneId === a.id);
			return { ...a, reponse: (r ? (r.toutEte === 1 ? 'tout' : 'vacances') : null) as Reponse, periodes: periodes.filter((p) => p.personneId === a.id).map(({ debut, fin }) => ({ debut, fin })) };
		})
	};
}

// Chaque matin (voir planifie.ts) : un mois puis une semaine avant la date limite, un rappel à ceux qui n'ont rien saisi.
// Une seule fois chacun ; un été ouvert tard n'envoie que le dernier rappel dû. Rend le nombre d'étés rappelés.
export async function rappelsEte(base: Base, maintenant: string): Promise<number> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const [etes, reponses, agents, affectations] = await base.batch([
		base.select().from(ete).where(and(sql`${ete.publieeLe} is null`, gte(ete.dateLimite, aujourdhui))),
		base.select({ annee: reponseEte.annee, personneId: reponseEte.personneId }).from(reponseEte),
		lecturesAgents(base, aujourdhui)[0],
		lecturesAgents(base, aujourdhui)[1]
	]);
	const ecritures = [];
	let n = 0;
	for (const e of etes) {
		const semaine = !e.rappelSemaineLe && aujourdhui >= ajouterJours(e.dateLimite, -7);
		const mois = !e.rappelMoisLe && !semaine && aujourdhui >= ajouterJours(e.dateLimite, -30);
		if (!semaine && !mois) continue;
		const sansReponse = agentsDeLete(agents, affectations, aujourdhui)
			.filter((a) => !reponses.some((r) => r.annee === e.annee && r.personneId === a.id))
			.map((a) => a.id);
		ecritures.push(
			base.update(ete).set(semaine ? { rappelSemaineLe: maintenant, rappelMoisLe: e.rappelMoisLe ?? maintenant } : { rappelMoisLe: maintenant }).where(eq(ete.annee, e.annee)),
			...avis(base, sansReponse, 'rappel', `Donnez vos vacances d’été avant le ${dateFichier(e.dateLimite)} : vos dates, ou « disponible tout l’été ».`, '/moi/vacances', maintenant)
		);
		n++;
	}
	const [premiere, ...autres] = ecritures;
	if (premiere) await base.batch([premiere, ...autres]);
	return n;
}

// La dernière relance (« Relancer », par le chef) de l'été, si elle est d'aujourd'hui.
export const requeteRelance = (base: Base, annee: number, aujourdhui: string) =>
	base.select({ quand: journal.quand }).from(journal).where(and(eq(journal.action, 'relancer_ete'), gte(journal.quand, aujourdhui), sql`json_extract(${journal.details}, '$.annee') = ${annee}`)).limit(1);

// « Relancer » : un rappel tout de suite à ceux qui n'ont rien saisi, une fois par jour au plus. Rend le nombre d'agents relancés.
export async function relancerEte(base: Base, acteur: Acteur, annee: number, maintenant: string): Promise<number> {
	exigerAnnee(annee);
	const aujourdhui = await exigerGestion(base, acteur, maintenant);
	const [lignesEte, deja, reponses, agents, affectations] = await base.batch([
		base.select().from(ete).where(eq(ete.annee, annee)),
		requeteRelance(base, annee, aujourdhui),
		base.select({ personneId: reponseEte.personneId }).from(reponseEte).where(eq(reponseEte.annee, annee)),
		lecturesAgents(base, aujourdhui)[0],
		lecturesAgents(base, aujourdhui)[1]
	]);
	const e = lignesEte[0];
	if (!e) throw new DonneeInvalide('Été pas encore ouvert');
	if (e.publieeLe) throw new DonneeInvalide('Été déjà publié');
	// Déjà relancés aujourd'hui, à la main ou par le rappel automatique.
	if (deja.length || [e.rappelMoisLe, e.rappelSemaineLe].some((d) => d?.startsWith(aujourdhui))) throw new DonneeInvalide('Déjà relancés aujourd’hui');
	const ids = agentsDeLete(agents, affectations, aujourdhui).filter((a) => !reponses.some((r) => r.personneId === a.id)).map((a) => a.id);
	if (ids.length === 0) throw new DonneeInvalide('Tout le monde a répondu');
	// Deux clics en même temps : seule la relance écrite la première envoie les rappels.
	const seuleRelance = sql`(select count(*) from ${journal} where ${journal.action} = 'relancer_ete' and ${journal.quand} >= ${aujourdhui} and json_extract(${journal.details}, '$.annee') = ${annee}) = 1`;
	await base.batch([
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'relancer_ete', cibleType: 'planning', cibleId: null, details: { annee, agents: ids.length } }, maintenant),
		...avis(base, ids, 'rappel', `Donnez vos vacances d’été avant le ${dateFichier(e.dateLimite)} : vos dates, ou « disponible tout l’été ».`, '/moi/vacances', maintenant, seuleRelance)
	]);
	return ids.length;
}
