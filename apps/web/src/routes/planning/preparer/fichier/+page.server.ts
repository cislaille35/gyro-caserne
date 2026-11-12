import { eq } from 'drizzle-orm';
import { anneePlanning } from '@gyro-caserne/socle';
import { anneeDe } from '#lib/server/planning.ts';
import { exigerPlanning } from '#lib/server/fichier-planning.ts';
import type { PageServerLoad } from './$types';

// publiee : pour dire, après l'import, si les agents voient déjà les changements.
export const load: PageServerLoad = async ({ locals, url }) => {
	await exigerPlanning(locals);
	const annee = anneeDe(url);
	const [ligne] = await locals.base.select({ publieeLe: anneePlanning.publieeLe }).from(anneePlanning).where(eq(anneePlanning.annee, annee));
	return { annee, publiee: Boolean(ligne?.publieeLe) };
};
