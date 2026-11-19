import { sql, type SQL } from 'drizzle-orm';
import { instruction, type Base } from './base.ts';
import { journal } from './schema.ts';

type EntreeJournal = { acteur: string; action: string; cibleType: string; cibleId: number | SQL | null; details?: object };

// Renvoie la requête sans l'exécuter : à placer dans un batch avec l'action journalisée.
export function ligneJournal(base: Base, entree: EntreeJournal, quand: string) {
	return base.insert(journal).values({
		quand,
		acteur: entree.acteur,
		action: entree.action,
		cibleType: entree.cibleType,
		cibleId: entree.cibleId,
		details: JSON.stringify(entree.details ?? {})
	});
}

// Pareil, écrite seulement si `si` est vrai au moment de l'écriture (le geste gardé a bien eu lieu).
export function ligneJournalSi(base: Base, entree: EntreeJournal, quand: string, si: SQL) {
	return instruction(
		base,
		sql`INSERT INTO ${journal} (quand, acteur, action, cible_type, cible_id, details) SELECT ${quand}, ${entree.acteur}, ${entree.action}, ${entree.cibleType}, ${entree.cibleId}, ${JSON.stringify(entree.details ?? {})} WHERE ${si}`
	);
}
