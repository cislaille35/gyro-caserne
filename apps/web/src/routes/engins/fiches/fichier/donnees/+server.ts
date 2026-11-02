import { json } from '@sveltejs/kit';
import { donneesFichierFiches } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerGestionEngins } from '#lib/server/engins.ts';
import type { RequestHandler } from './$types';

// Ce qu'il faut au navigateur pour écrire le classeur des fiches.
export const GET: RequestHandler = async ({ locals }) => {
	const { acteur, base } = await exigerGestionEngins(locals);
	return json(await donneesFichierFiches(base, acteur, maintenantParis()));
};
