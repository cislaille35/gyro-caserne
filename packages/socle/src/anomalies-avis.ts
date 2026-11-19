import { and, eq, inArray, isNull, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import type { Base } from './base.ts';
import { enCours } from './dates.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { mettreEnFile } from './notifications.ts';
import { attribution, avisAnomalie, personne, profilDroit, responsabilite, responsabiliteDroit } from './schema.ts';

// Qui est prévenu d'une anomalie, et la ligne de la cloche. Partagé par la prise de garde et le suivi des anomalies.

// Ceux qui traitent les anomalies au centre (TRAITER_ANOMALIE sur le centre : référent engins…, ou à défaut chef de centre et adjoint)
// et le chef de garde de l'équipe d'astreinte. `auteur` : qui signale ; seul référent, il ne compte pas (le chef et l'adjoint sont prévenus). Une requête.
export async function quiTraite(base: Base, aujourdhui: string, equipeAstreinte: number | null, auteur: number | null = null): Promise<number[]> {
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
	const chefDeGarde = valides.filter((t) => t.systeme === 'chef_equipe' && equipeAstreinte !== null && t.perimetreId === equipeAstreinte).map((t) => t.id);
	const ids = [...duProfil.map((p) => p.id), ...valides.filter((t) => t.type === 'centre').map((t) => t.id), ...chefDeGarde];
	// Un référent nommé (un rôle du centre hors système) : le chef de centre et l'adjoint ne sont plus prévenus, sauf de garde.
	// La demande passe dans leur suivi du centre ; sans référent, ce sont eux qui traitent.
	const centre = valides.filter((t) => t.type === 'centre');
	const chefs = centre.filter((t) => t.systeme === 'chef_centre' || t.systeme === 'chef_centre_adjoint').map((t) => t.id);
	const avecReferent = centre.some((t) => t.systeme === null && !chefs.includes(t.id) && t.id !== auteur);
	return [...new Set(ids)].filter((id) => !avecReferent || !chefs.includes(id) || chefDeGarde.includes(id));
}

const parmi = (ids: number[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;

export type AvisAnomalie = { titre: string; texte: string; url: string };

// Écritures à placer dans un batch : la ligne de la cloche et l'envoi au téléphone (lieu « engins » : seul « tout » le coupe).
// `si` : une condition vérifiée à l'écriture (le geste a bien eu lieu).
// `ids` : une liste, ou une sous-requête d'identifiants ; `lieu` : « urgences » pour celles du chef et de l'adjoint.
export function avisAnomalies(base: Base, ids: number[] | SQLWrapper, a: AvisAnomalie, maintenant: string, si?: SQL, lieu: 'engins' | 'urgences' = 'engins') {
	if (Array.isArray(ids) && ids.length === 0) return [];
	const qui = Array.isArray(ids) ? parmi(ids) : ids;
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
				.where(and(inArray(personne.id, qui), si))
		),
		mettreEnFile(base, ids, lieu, { ...a, tag: `${lieu === 'urgences' ? 'urgence' : 'anomalie'}:${a.url}` }, maintenant, si, 'anomalie')
	] as const;
}
