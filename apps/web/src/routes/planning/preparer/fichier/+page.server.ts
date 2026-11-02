import { anneeDe } from '#lib/server/planning.ts';
import { exigerPlanning } from '#lib/server/fichier-planning.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	await exigerPlanning(locals);
	return { annee: anneeDe(url) };
};
