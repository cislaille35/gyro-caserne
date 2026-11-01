import { and, asc, eq, isNull, max, ne, sql } from 'drizzle-orm';
import type { Base } from './base.ts';
import { exigerDate, exigerDateHeure } from './dates.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { estGestionnaire } from './effectif.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { ligneJournal } from './journal.ts';
import { nomActeur } from './actions/personnes.ts';
import { aptitude, aptitudeAgent, personne } from './schema.ts';

// Les aptitudes : la liste du centre (réglages) et celles de chaque agent, datées.

export type Aptitude = { id: number; nom: string; controlee: boolean; ordre: number };
export type AptitudeAgent = { aptitudeId: number; nom: string; controlee: boolean; obtenueLe: string; expireLe: string | null; valide: boolean };

// Celles du modèle métier : commandement et conduite contrôlées en remplacement. La migration 0013 les ajoute aux bases déjà remplies.
export const APTITUDES_PAR_DEFAUT: [string, boolean][] = [
	['CA2', true],
	['CA1', true],
	['CE', true],
	['COD1', true],
	['COD2', true],
	['INC', false],
	['SAP', false],
	['DIV', false],
	['FDF1', false],
	['FDF2', false]
];

const NOM_MAX = 20;

// Les aptitudes valables à une date : obtenues avant, pas encore expirées.
export function validesLe(lignes: { aptitudeId: number; obtenueLe: string; expireLe: string | null }[], date: string): Set<number> {
	return new Set(lignes.filter((l) => l.obtenueLe <= date && (l.expireLe === null || date <= l.expireLe)).map((l) => l.aptitudeId));
}

const vue = (a: typeof aptitude.$inferSelect): Aptitude => ({ id: a.id, nom: a.nom, controlee: a.controlee === 1, ordre: a.ordre });

export async function listerAptitudes(base: Base): Promise<Aptitude[]> {
	return (await base.select().from(aptitude).where(isNull(aptitude.retireeLe)).orderBy(asc(aptitude.ordre), asc(aptitude.id))).map(vue);
}

async function exigerListes(base: Base, acteur: Acteur, maintenant: string) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await aLeDroit(base, acteur, 'GERER_LISTES', { type: 'centre' }, aujourdhui))) throw new RefusDroit('GERER_LISTES', { type: 'centre' });
}

const journalAptitude = (base: Base, acteur: Acteur, action: string, cibleId: number | ReturnType<typeof sql>, details: object, maintenant: string) =>
	ligneJournal(base, { acteur: nomActeur(acteur), action, cibleType: 'aptitude', cibleId, details }, maintenant);

// Ajoute (sans `id`) ou renomme une aptitude. Nom unique, sans casse, retirées comprises (elles gardent leur nom dans l'historique).
export async function enregistrerAptitude(base: Base, acteur: Acteur, d: { id?: number; nom: string; controlee: boolean }, maintenant: string): Promise<number> {
	await exigerListes(base, acteur, maintenant);
	const nom = typeof d.nom === 'string' ? d.nom.trim() : '';
	if (!nom) throw new DonneeInvalide('Nom vide');
	if (nom.length > NOM_MAX) throw new DonneeInvalide('Nom trop long');
	const memes = await base
		.select({ id: aptitude.id })
		.from(aptitude)
		.where(and(sql`lower(${aptitude.nom}) = lower(${nom})`, d.id === undefined ? undefined : ne(aptitude.id, d.id)));
	if (memes.length > 0) throw new DonneeInvalide('Nom déjà utilisé');
	const controlee = d.controlee ? 1 : 0;
	if (d.id === undefined) {
		const [dernier] = await base.select({ ordre: max(aptitude.ordre) }).from(aptitude);
		const [lignes] = await base.batch([
			base
				.insert(aptitude)
				.values({ nom, controlee, ordre: (dernier?.ordre ?? 0) + 1 })
				.returning({ id: aptitude.id }),
			journalAptitude(base, acteur, 'ajouter_aptitude', sql`last_insert_rowid()`, { nom, controlee: d.controlee }, maintenant)
		]);
		return lignes[0]!.id;
	}
	const [existante] = await base.select().from(aptitude).where(eq(aptitude.id, d.id));
	if (!existante || existante.retireeLe !== null) throw new DonneeInvalide('Aptitude inconnue');
	await base.batch([base.update(aptitude).set({ nom, controlee }).where(eq(aptitude.id, d.id)), journalAptitude(base, acteur, 'modifier_aptitude', d.id, { nom, controlee: d.controlee }, maintenant)]);
	return d.id;
}

// Retirée : plus proposée ni comptée ; les agents la gardent dans leur historique.
export async function retirerAptitude(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	await exigerListes(base, acteur, maintenant);
	await base.batch([base.update(aptitude).set({ retireeLe: maintenant.slice(0, 10) }).where(and(eq(aptitude.id, id), isNull(aptitude.retireeLe))), journalAptitude(base, acteur, 'retirer_aptitude', id, {}, maintenant)]);
}

// Les aptitudes d'un agent : lui-même, ou qui gère les fiches.
export async function aptitudesDe(base: Base, acteur: Acteur, personneId: number, aujourdhui: string): Promise<AptitudeAgent[]> {
	return (await aptitudesEtListe(base, acteur, personneId, aujourdhui)).siennes;
}

// Les aptitudes de l'agent et la liste du centre (la fiche), en une requête.
export async function aptitudesEtListe(base: Base, acteur: Acteur, personneId: number, aujourdhui: string): Promise<{ siennes: AptitudeAgent[]; liste: Aptitude[] }> {
	exigerDate(aujourdhui);
	const soi = acteur.type === 'personne' && acteur.id === personneId;
	if (!soi && !(await estGestionnaire(base, acteur, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' });
	const [lignes, liste] = await base.batch([
		base
			.select({ aptitudeId: aptitudeAgent.aptitudeId, nom: aptitude.nom, controlee: aptitude.controlee, obtenueLe: aptitudeAgent.obtenueLe, expireLe: aptitudeAgent.expireLe })
		.from(aptitudeAgent)
		.innerJoin(aptitude, eq(aptitude.id, aptitudeAgent.aptitudeId))
			.where(and(eq(aptitudeAgent.personneId, personneId), isNull(aptitude.retireeLe)))
			.orderBy(asc(aptitude.ordre), asc(aptitude.id)),
		base.select().from(aptitude).where(isNull(aptitude.retireeLe)).orderBy(asc(aptitude.ordre), asc(aptitude.id))
	]);
	const valides = validesLe(lignes, aujourdhui);
	return { siennes: lignes.map((l) => ({ ...l, controlee: l.controlee === 1, valide: valides.has(l.aptitudeId) })), liste: liste.map(vue) };
}

async function exigerFiches(base: Base, acteur: Acteur, personneId: number, maintenant: string) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await estGestionnaire(base, acteur, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' });
	const [p] = await base.select({ id: personne.id }).from(personne).where(eq(personne.id, personneId));
	if (!p) throw new DonneeInvalide('Personne inconnue');
}

const journalAgent = (base: Base, acteur: Acteur, action: string, personneId: number, details: object, maintenant: string) =>
	ligneJournal(base, { acteur: nomActeur(acteur), action, cibleType: 'personne', cibleId: personneId, details }, maintenant);

// Donne (ou corrige les dates d') une aptitude.
export async function donnerAptitude(base: Base, acteur: Acteur, personneId: number, d: { aptitudeId: number; obtenueLe: string; expireLe: string | null }, maintenant: string): Promise<void> {
	await exigerFiches(base, acteur, personneId, maintenant);
	exigerDate(d.obtenueLe);
	if (d.expireLe !== null) {
		exigerDate(d.expireLe);
		if (d.expireLe < d.obtenueLe) throw new DonneeInvalide('Expiration avant l’obtention');
	}
	const [a] = await base.select().from(aptitude).where(eq(aptitude.id, d.aptitudeId));
	if (!a || a.retireeLe !== null) throw new DonneeInvalide('Aptitude inconnue');
	const dates = { obtenueLe: d.obtenueLe, expireLe: d.expireLe };
	await base.batch([
		base
			.insert(aptitudeAgent)
			.values({ personneId, aptitudeId: d.aptitudeId, ...dates })
			.onConflictDoUpdate({ target: [aptitudeAgent.personneId, aptitudeAgent.aptitudeId], set: dates }),
		journalAgent(base, acteur, 'donner_aptitude', personneId, { aptitude: a.nom, ...dates }, maintenant)
	]);
}

export async function oterAptitude(base: Base, acteur: Acteur, personneId: number, aptitudeId: number, maintenant: string): Promise<void> {
	await exigerFiches(base, acteur, personneId, maintenant);
	await base.batch([
		base.delete(aptitudeAgent).where(and(eq(aptitudeAgent.personneId, personneId), eq(aptitudeAgent.aptitudeId, aptitudeId))),
		journalAgent(base, acteur, 'oter_aptitude', personneId, { aptitudeId }, maintenant)
	]);
}
