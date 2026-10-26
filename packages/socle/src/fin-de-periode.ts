import { and, gte, isNull, lt, or, type SQL } from 'drizzle-orm';
import type { Base } from './base.ts';
import { veille } from './dates.ts';
import { affectationEquipe, attribution } from './schema.ts';

// Règle commune aux équipes, aux attributions et à leurs archivages. Parmi les lignes visées par `filtre`,
// celles en cours ou à venir (sans fin, ou finissant aujourd'hui ou plus tard) :
// - commencées aujourd'hui ou plus tard : supprimées ;
// - commencées avant : terminées la veille.
// Renvoie les deux requêtes à placer dans un batch.
export function finirOuSupprimer(base: Base, table: typeof affectationEquipe | typeof attribution, filtre: SQL | undefined, aujourdhui: string) {
	const ouverte = and(filtre, or(isNull(table.fin), gte(table.fin, aujourdhui)));
	return [
		base.delete(table).where(and(ouverte, gte(table.debut, aujourdhui))),
		base.update(table).set({ fin: veille(aujourdhui) }).where(and(ouverte, lt(table.debut, aujourdhui)))
	] as const;
}
