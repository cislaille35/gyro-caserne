import type { Centre } from '@gyro-caserne/centre';
import { asc, eq } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours } from '../dates.ts';
import { anneePlanning, equipe } from '../schema.ts';
import { ajouterVacances, enregistrerManoeuvre, ordrePropose, publierAnnee, reglerRoulement } from './annee.ts';
import { rangDuJour } from './calendrier.ts';

// Données fictives seulement (développement local, préprod) : l'année en cours et la suivante publiées, d'après la référence du centre,
// quatre manœuvres thématiques des dimanches à venir et les vacances de Noël. Ne fait rien si l'année en cours est déjà préparée.
export async function chargerPlanningFictif(base: Base, centre: Centre, maintenant: string): Promise<void> {
	const annee = Number(maintenant.slice(0, 4));
	const [deja] = await base.select().from(anneePlanning).where(eq(anneePlanning.annee, annee));
	if (deja) return;
	const qui = { type: 'super', email: 'planning-fictif@exemple.fr' } as const;
	const equipes = await base.select({ id: equipe.id, active: equipe.active }).from(equipe).orderBy(asc(equipe.ordreRotation));
	const ids = equipes.filter((e) => e.active === 1).map((e) => e.id);
	for (const a of [annee, annee + 1]) {
		await reglerRoulement(base, qui, a, ordrePropose(a, centre.astreinte, equipes), maintenant);
		await publierAnnee(base, qui, a, maintenant);
	}
	const themes: [string, number[] | 'tous', boolean][] = [
		['Sport + SAP', ids.slice(0, 2), true],
		['Feux de forêt', ids.slice(2, 4), true],
		['Sainte Barbe', 'tous', false],
		['Désincarcération', ids.slice(0, 1), true]
	];
	let dimanche = ajouterJours(maintenant.slice(0, 10), 7 - rangDuJour(maintenant.slice(0, 10)) + 6);
	for (const [theme, convoques, petitDejeuner] of themes) {
		await enregistrerManoeuvre(base, qui, { debut: `${dimanche}T08:30`, theme, lieu: 'Caserne', convoques, petitDejeuner }, maintenant);
		dimanche = ajouterJours(dimanche, 21);
	}
	await ajouterVacances(base, qui, { nom: 'Vacances de Noël', debut: `${annee}-12-19`, fin: `${annee + 1}-01-04` }, maintenant);
}
