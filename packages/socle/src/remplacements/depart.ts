import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { demandeRemplacement, destinataireRemplacement } from '../schema.ts';
import { avis } from './avis.ts';
import { periodesDe } from './contexte.ts';
import { texteDemande } from './tranches.ts';

const EN_COURS = ['attente', 'refusee', 'a_valider', 'conclue'] as const;

// Au départ d'une personne (écritures à placer dans un batch) : ses demandes en cours sont annulées, son remplaçant prévenu ;
// celles où elle remplaçait repartent (une demande ouverte attend un autre collègue, une ciblée passe « refusée »), le titulaire prévenu.
export async function remplacementsAuDepart(base: Base, personneId: number, maintenant: string) {
	const aVenir = sql`${demandeRemplacement.debut} > ${maintenant}`;
	// Un échange de manœuvre conclu a déjà déplacé les convocations : il reste tel quel.
	const pasManoeuvreConclue = sql`not (${demandeRemplacement.genre} = 'manoeuvre' and ${demandeRemplacement.etat} = 'conclue')`;
	const touchees = await base
		.select()
		.from(demandeRemplacement)
		.where(and(or(eq(demandeRemplacement.demandeurId, personneId), eq(demandeRemplacement.remplacantId, personneId)), inArray(demandeRemplacement.etat, [...EN_COURS]), aVenir, pasManoeuvreConclue));
	const texte = (d: (typeof touchees)[number]) => texteDemande(periodesDe(d.periodes)) || 'Échange de manœuvre';
	const prevenir = touchees.flatMap((d) =>
		d.demandeurId === personneId
			? avis(base, [...(d.remplacantId !== null && ['a_valider', 'conclue'].includes(d.etat) ? [d.remplacantId] : []), ...(d.cibleId !== null && d.etat === 'attente' ? [d.cibleId] : [])], d.id, 'annulee', `Départ du demandeur · ${texte(d)}`, `/remplacements/${d.id}`, maintenant)
			: d.genre === 'manoeuvre'
				? []
				: avis(base, [d.demandeurId], d.id, 'desistement', `Départ de votre remplaçant · ${texte(d)} · vous redevenez responsable`, `/remplacements/${d.id}`, maintenant)
	);
	return [
		base
			.update(demandeRemplacement)
			.set({ etat: 'annulee', motif: 'Départ du demandeur', trancheeLe: maintenant })
			.where(and(eq(demandeRemplacement.demandeurId, personneId), inArray(demandeRemplacement.etat, [...EN_COURS]), aVenir, pasManoeuvreConclue)),
		base
			.update(demandeRemplacement)
			.set({
				etat: sql`case when ${demandeRemplacement.genre} = 'remplacement' and ${demandeRemplacement.cibleId} is null then 'attente' else 'refusee' end`,
				remplacantId: null,
				manque: null,
				accepteeLe: null,
				motif: 'Départ du remplaçant',
				trancheeLe: maintenant
			})
			.where(and(eq(demandeRemplacement.remplacantId, personneId), inArray(demandeRemplacement.genre, ['remplacement', 'echange']), inArray(demandeRemplacement.etat, ['a_valider', 'conclue']), aVenir)),
		base.delete(destinataireRemplacement).where(and(eq(destinataireRemplacement.personneId, personneId), isNull(destinataireRemplacement.refuseLe))),
		...prevenir
	] as const;
}
