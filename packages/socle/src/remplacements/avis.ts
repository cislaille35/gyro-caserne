import { and, inArray, sql, type SQL } from 'drizzle-orm';
import type { Base } from '../base.ts';
import type { AvisRemplacement } from '../listes.ts';
import { TITRES_AVIS } from './titres.ts';
import { mettreEnFile } from '../notifications.ts';
import { avisRemplacement, personne } from '../schema.ts';

// Ce qu'une personne apprend d'une demande : une ligne dans sa cloche et un envoi au téléphone (lieu « remplacements » : seul « tout » le coupe).

const parmi = (ids: number[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;

// Écritures à placer dans le batch de l'action. `demandeId` : un nombre, ou la demande créée dans le même batch.
// `si` : une condition vérifiée à l'écriture (la décision a bien été prise).
export function avis(base: Base, ids: number[], demandeId: number | SQL, quoi: AvisRemplacement, texte: string, url: string, maintenant: string, si?: SQL) {
	if (ids.length === 0) return [];
	const qui = and(inArray(personne.id, parmi(ids)), si);
	return [
		base.insert(avisRemplacement).select(
			base
				.select({
					id: sql<number | null>`null`.as('id'),
					personneId: personne.id,
					demandeId: sql<number>`${demandeId}`.as('demande_id'),
					quoi: sql<string>`${quoi}`.as('quoi'),
					creeLe: sql<string>`${maintenant}`.as('cree_le'),
					lueLe: sql<string | null>`null`.as('lue_le')
				})
				.from(personne)
				.where(qui)
		),
		mettreEnFile(base, ids, 'remplacements', { titre: TITRES_AVIS[quoi], texte, url, tag: `remplacement:${typeof demandeId === 'number' ? demandeId : 'nouvelle'}:${quoi}` }, maintenant, si, 'remplacement')
	] as const;
}
