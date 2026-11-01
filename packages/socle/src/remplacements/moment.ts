import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours, exigerDateHeure } from '../dates.ts';
import { demandeRemplacement, personne } from '../schema.ts';
import { avis } from './avis.ts';
import { periodesDe, requeteChefs, valideurs } from './contexte.ts';
import { texteDemande } from './tranches.ts';

const RELANCE = '08:00';

// Toutes les dix minutes (voir planifie.ts) : une demande non conclue expire au début de sa première période ;
// la veille, à partir de 8 h, une demande de remplacement sans remplaçant est relancée une fois, au demandeur et au chef d'équipe.
// Expirée à valider : le remplaçant et le chef sont prévenus aussi.
export async function remplacementsDuMoment(base: Base, maintenant: string): Promise<{ expirees: number; relances: number }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const m = maintenant.slice(0, 16);
	const demain = ajouterJours(aujourdhui, 1);
	const sansRemplacant = inArray(demandeRemplacement.etat, ['attente', 'refusee']);
	const [aExpirer, aRelancer, chefs, personnes] = await base.batch([
		base
			.select()
			.from(demandeRemplacement)
			.where(and(inArray(demandeRemplacement.etat, ['attente', 'refusee', 'a_valider']), lte(demandeRemplacement.debut, m))),
		m.slice(11) >= RELANCE
			? base
					.select()
					.from(demandeRemplacement)
					.where(and(sansRemplacant, eq(demandeRemplacement.genre, 'remplacement'), isNull(demandeRemplacement.relanceLe), sql`substr(${demandeRemplacement.debut}, 1, 10) = ${demain}`))
			: base.select().from(demandeRemplacement).where(sql`0`),
		requeteChefs(base, aujourdhui),
		base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne)
	]);
	const nom = (id: number) => {
		const p = personnes.find((x) => x.id === id);
		return p ? `${p.prenom} ${p.nom}` : '';
	};
	const ecritures = [];
	for (const d of aExpirer) {
		const si = sql`exists (select 1 from ${demandeRemplacement} where ${demandeRemplacement.id} = ${d.id} and ${demandeRemplacement.etat} = 'expiree' and ${demandeRemplacement.trancheeLe} = ${maintenant})`;
		ecritures.push(
			base
				.update(demandeRemplacement)
				.set({ etat: 'expiree', trancheePar: 'planning', trancheeLe: maintenant })
				.where(and(eq(demandeRemplacement.id, d.id), eq(demandeRemplacement.etat, d.etat))),
			...avis(base, [d.demandeurId, ...(d.etat === 'a_valider' && d.remplacantId !== null ? [d.remplacantId, ...valideurs(chefs, d.equipeId, d.demandeurId, d.remplacantId)] : [])], d.id, 'expiree', `${texteDemande(periodesDe(d.periodes)) || 'Échange de manœuvre'} · le titulaire reste responsable`, `/remplacements/${d.id}`, maintenant, si)
		);
	}
	for (const d of aRelancer) {
		const texte = texteDemande(periodesDe(d.periodes));
		ecritures.push(
			base.update(demandeRemplacement).set({ relanceLe: maintenant }).where(and(eq(demandeRemplacement.id, d.id), isNull(demandeRemplacement.relanceLe))),
			...avis(base, [d.demandeurId], d.id, 'relance', `Personne n’a encore accepté : ${texte}`, `/remplacements/${d.id}`, maintenant),
			...avis(base, valideurs(chefs, d.equipeId, d.demandeurId, d.remplacantId), d.id, 'relance', `${nom(d.demandeurId)} n’a pas encore de remplaçant demain · ${texte}`, `/remplacements/${d.id}`, maintenant)
		);
	}
	const [premiere, ...autres] = ecritures;
	if (premiere) await base.batch([premiere, ...autres]);
	return { expirees: aExpirer.length, relances: aRelancer.length };
}
