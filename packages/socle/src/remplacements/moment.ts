import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours, exigerDateHeure } from '../dates.ts';
import { demandeRemplacement, personne } from '../schema.ts';
import { avis } from './avis.ts';
import { periodesDe, requeteChefs, valideurs } from './contexte.ts';
import { texteDemande } from './tranches.ts';

const RELANCE = '08:00';

// Toutes les dix minutes (voir planifie.ts) : une demande non conclue expire au début de sa première période ;
// la veille, à partir de 8 h, une demande de remplacement sans remplaçant est relancée une fois, au demandeur et au chef de garde,
// et en urgence au chef de centre et à l'adjoint.
// Expirée à valider : le remplaçant et le chef sont prévenus aussi.
export async function remplacementsDuMoment(base: Base, maintenant: string): Promise<{ expirees: number; relances: number }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const m = maintenant.slice(0, 16);
	const demain = ajouterJours(aujourdhui, 1);
	const sansRemplacant = inArray(demandeRemplacement.etat, ['attente', 'refusee']);
	const [aExpirer, aRelancer] = await base.batch([
		base
			.select()
			.from(demandeRemplacement)
			.where(and(inArray(demandeRemplacement.etat, ['attente', 'refusee', 'a_valider']), lte(demandeRemplacement.debut, m))),
		m.slice(11) >= RELANCE
			? base
					.select()
					.from(demandeRemplacement)
					.where(and(sansRemplacant, eq(demandeRemplacement.genre, 'remplacement'), isNull(demandeRemplacement.relanceLe), sql`substr(${demandeRemplacement.debut}, 1, 10) = ${demain}`))
			: base.select().from(demandeRemplacement).where(sql`0`)
	]);
	// Le plus souvent, rien à faire : les chefs et les noms ne sont lus que s'il le faut.
	if (aExpirer.length === 0 && aRelancer.length === 0) return { expirees: 0, relances: 0 };
	const [chefs, personnes] = await base.batch([requeteChefs(base, aujourdhui), base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne)]);
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
	// Le chef de centre et l'adjoint l'apprennent aussi, en urgence (une seule fois, même s'ils valident pour l'équipe).
	const duCentre = [...new Set(chefs.filter((c) => c.systeme === 'chef_centre' || c.systeme === 'chef_centre_adjoint').map((c) => c.personneId))];
	for (const d of aRelancer) {
		const texte = texteDemande(periodesDe(d.periodes));
		const phrase = `${nom(d.demandeurId)} n’a pas encore de remplaçant demain · ${texte}`;
		const urgence = duCentre.filter((id) => id !== d.demandeurId);
		ecritures.push(
			base.update(demandeRemplacement).set({ relanceLe: maintenant }).where(and(eq(demandeRemplacement.id, d.id), isNull(demandeRemplacement.relanceLe))),
			...avis(base, [d.demandeurId], d.id, 'relance', `Personne n’a encore accepté : ${texte}`, `/remplacements/${d.id}`, maintenant),
			...avis(base, valideurs(chefs, d.equipeId, d.demandeurId, d.remplacantId).filter((id) => !urgence.includes(id)), d.id, 'relance', phrase, `/remplacements/${d.id}`, maintenant),
			...avis(base, urgence, d.id, 'relance', phrase, `/remplacements/${d.id}`, maintenant, undefined, 'urgences')
		);
	}
	const [premiere, ...autres] = ecritures;
	if (premiere) await base.batch([premiere, ...autres]);
	return { expirees: aExpirer.length, relances: aRelancer.length };
}
