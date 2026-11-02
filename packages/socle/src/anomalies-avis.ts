import { and, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import type { Base } from './base.ts';
import { enCours } from './dates.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { mettreEnFile } from './notifications.ts';
import { attribution, avisAnomalie, personne, profilDroit, responsabilite, responsabiliteDroit } from './schema.ts';

// Qui est prévenu d'une anomalie, et la ligne de la cloche. Partagé par la prise de garde et le suivi des anomalies.

// Ceux qui traitent les anomalies au centre (TRAITER_ANOMALIE sur le centre : chef de centre, adjoint, référent engins…)
// et le chef de garde de l'équipe d'astreinte. Une requête.
export async function quiTraite(base: Base, aujourdhui: string, equipeAstreinte: number | null): Promise<number[]> {
	const avecAcces = inArray(personne.statut, [...STATUTS_AVEC_ACCES]);
	const [duProfil, tenues] = await base.batch([
		base
			.select({ id: personne.id })
			.from(personne)
			.innerJoin(profilDroit, eq(profilDroit.profilId, personne.profilId))
			.where(and(avecAcces, eq(profilDroit.droit, 'TRAITER_ANOMALIE'), eq(profilDroit.perimetreType, 'centre'))),
		base
			.select({ id: attribution.personneId, type: attribution.perimetreType, perimetreId: attribution.perimetreId, portee: responsabilite.typePerimetre, systeme: responsabilite.systeme, debut: attribution.debut, fin: attribution.fin })
			.from(attribution)
			.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
			.innerJoin(responsabiliteDroit, and(eq(responsabiliteDroit.responsabiliteId, responsabilite.id), eq(responsabiliteDroit.droit, 'TRAITER_ANOMALIE')))
			.innerJoin(personne, eq(personne.id, attribution.personneId))
			.where(and(avecAcces, isNull(responsabilite.archiveeLe)))
	]);
	const valides = tenues.filter((t) => t.type === t.portee && enCours(t.debut, t.fin, aujourdhui));
	const ids = [
		...duProfil.map((p) => p.id),
		...valides.filter((t) => t.type === 'centre' || (t.systeme === 'chef_equipe' && equipeAstreinte !== null && t.perimetreId === equipeAstreinte)).map((t) => t.id)
	];
	return [...new Set(ids)];
}

const parmi = (ids: number[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;

export type AvisAnomalie = { titre: string; texte: string; url: string };

// Écritures à placer dans un batch : la ligne de la cloche et l'envoi au téléphone (lieu « engins » : seul « tout » le coupe).
// `si` : une condition vérifiée à l'écriture (le geste a bien eu lieu).
export function avisAnomalies(base: Base, ids: number[], a: AvisAnomalie, maintenant: string, si?: SQL) {
	if (ids.length === 0) return [];
	return [
		base.insert(avisAnomalie).select(
			base
				.select({
					id: sql<number | null>`null`.as('id'),
					personneId: personne.id,
					titre: sql<string>`${a.titre}`.as('titre'),
					texte: sql<string>`${a.texte}`.as('texte'),
					url: sql<string>`${a.url}`.as('url'),
					creeLe: sql<string>`${maintenant}`.as('cree_le'),
					lueLe: sql<string | null>`null`.as('lue_le')
				})
				.from(personne)
				.where(and(inArray(personne.id, parmi(ids)), si))
		),
		mettreEnFile(base, ids, 'engins', { ...a, tag: `anomalie:${a.url}` }, maintenant, si)
	] as const;
}
