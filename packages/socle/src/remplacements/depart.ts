import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { demandeRemplacement, destinataireRemplacement } from '../schema.ts';

// Au départ d'une personne (écritures à placer dans un batch) : ses demandes en cours sont annulées ;
// celles où elle remplaçait repartent (une demande ouverte attend un autre collègue, une ciblée passe « refusée »).
export const remplacementsAuDepart = (base: Base, personneId: number, maintenant: string) => [
	base
		.update(demandeRemplacement)
		.set({ etat: 'annulee', motif: 'Départ du demandeur', trancheeLe: maintenant })
		.where(and(eq(demandeRemplacement.demandeurId, personneId), inArray(demandeRemplacement.etat, ['attente', 'refusee', 'a_valider', 'conclue']), sql`${demandeRemplacement.debut} > ${maintenant}`)),
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
		.where(and(eq(demandeRemplacement.remplacantId, personneId), inArray(demandeRemplacement.etat, ['a_valider', 'conclue']), sql`${demandeRemplacement.debut} > ${maintenant}`)),
	base.delete(destinataireRemplacement).where(and(eq(destinataireRemplacement.personneId, personneId), isNull(destinataireRemplacement.refuseLe)))
];
