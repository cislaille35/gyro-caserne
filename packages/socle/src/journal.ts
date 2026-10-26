import type { SQL } from 'drizzle-orm';
import type { Base } from './base.ts';
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
