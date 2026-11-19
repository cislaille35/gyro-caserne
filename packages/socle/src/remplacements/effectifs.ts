import { and, eq, gte, inArray, lte, or, sql, type SQLWrapper } from 'drizzle-orm';
import type { Base } from '../base.ts';
import type { Periode } from '../planning/calendrier.ts';
import { demandeRemplacement } from '../schema.ts';

// Les remplacements conclus, période par période : qui tient l'astreinte à la place de qui. Pour le planning et l'agenda.

export type Effectif = Periode & { titulaireId: number; remplacantId: number; titulaire: string; remplacant: string };

const periodes = (json: string | null): Periode[] => (json ? (JSON.parse(json) as Periode[]) : []);

// Les demandes conclues qui commencent entre `du` et `au` (dates) ; `personneId` : seulement celles où elle a part.
export function requeteConclues(base: Base, du: string, au: string, personneId: number | null = null) {
	const nom = (colonne: SQLWrapper) => sql<string>`coalesce((select p.prenom || ' ' || p.nom from personne p where p.id = ${colonne}), '')`;
	return base
		.select({ id: demandeRemplacement.id, genre: demandeRemplacement.genre, demandeurId: demandeRemplacement.demandeurId, remplacantId: demandeRemplacement.remplacantId, periodes: demandeRemplacement.periodes, periodesCible: demandeRemplacement.periodesCible, demandeur: nom(demandeRemplacement.demandeurId).as('nom_demandeur'), nomRemplacant: nom(demandeRemplacement.remplacantId).as('nom_remplacant') })
		.from(demandeRemplacement)
		.where(
			and(
				eq(demandeRemplacement.etat, 'conclue'),
				inArray(demandeRemplacement.genre, ['remplacement', 'echange']),
				gte(demandeRemplacement.debut, du),
				lte(demandeRemplacement.debut, `${au}T23:59`),
				personneId === null ? undefined : or(eq(demandeRemplacement.demandeurId, personneId), eq(demandeRemplacement.remplacantId, personneId))
			)
		);
}

// Mes plages courtes cédées (2 ou 3 h, conclues) qui commencent aujourd'hui, ou hier soir et courent encore. Pour la plaque de l'Accueil.
export function requeteCourtsCedes(base: Base, personneId: number, jour: string, veille: string) {
	return base
		.select({ periodes: demandeRemplacement.periodes, remplacant: sql<string>`coalesce((select p.prenom || ' ' || p.nom from personne p where p.id = ${demandeRemplacement.remplacantId}), '')` })
		.from(demandeRemplacement)
		.where(and(eq(demandeRemplacement.demandeurId, personneId), eq(demandeRemplacement.etat, 'conclue'), eq(demandeRemplacement.court, 1), gte(demandeRemplacement.debut, `${veille}T21:00`), lte(demandeRemplacement.debut, `${jour}T23:59`)));
}

// Les plages pas encore finies, avec qui les tient.
export const courtsCedes = (lignes: { periodes: string; remplacant: string }[], maintenant: string) =>
	lignes.flatMap((l) => periodes(l.periodes).filter((p) => p.fin > maintenant).map((p) => ({ ...p, remplacant: l.remplacant })));

type Conclue = Awaited<ReturnType<typeof requeteConclues>>[number];

// Remplacement : le remplaçant tient les périodes du demandeur. Échange : en plus, le demandeur tient celles du collègue.
export function effectifs(lignes: Conclue[]): Effectif[] {
	return lignes
		.flatMap((d) => [
			...periodes(d.periodes).map((p) => ({ ...p, titulaireId: d.demandeurId, remplacantId: d.remplacantId!, titulaire: d.demandeur, remplacant: d.nomRemplacant })),
			...periodes(d.periodesCible).map((p) => ({ ...p, titulaireId: d.remplacantId!, remplacantId: d.demandeurId, titulaire: d.nomRemplacant, remplacant: d.demandeur }))
		])
		.sort((a, b) => a.debut.localeCompare(b.debut));
}
