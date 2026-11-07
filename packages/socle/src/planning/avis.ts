import { and, inArray, sql, type SQL } from 'drizzle-orm';
import type { Base } from '../base.ts';
import type { AvisEte } from '../listes.ts';
import { mettreEnFile, TITRES_ETE } from '../notifications.ts';
import { avisEte, personne } from '../schema.ts';

const parmi = (ids: number[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;

// Écritures à placer dans un batch : la ligne de la cloche et l'envoi au téléphone (lieu « planning » : seul « tout » le coupe).
// `si` : une condition vérifiée à l'écriture (la publication a bien eu lieu).
export function avis(base: Base, ids: number[], quoi: AvisEte, texte: string, url: string, maintenant: string, si?: SQL) {
	if (ids.length === 0) return [];
	return [
		base.insert(avisEte).select(
			base
				.select({
					id: sql<number | null>`null`.as('id'),
					personneId: personne.id,
					quoi: sql<string>`${quoi}`.as('quoi'),
					texte: sql<string>`${texte}`.as('texte'),
					url: sql<string>`${url}`.as('url'),
					creeLe: sql<string>`${maintenant}`.as('cree_le'),
					lueLe: sql<string | null>`null`.as('lue_le')
				})
				.from(personne)
				.where(and(inArray(personne.id, parmi(ids)), si))
		),
		mettreEnFile(base, ids, 'planning', { titre: TITRES_ETE[quoi], texte, url, tag: `ete:${quoi}` }, maintenant, si, 'ete')
	] as const;
}

