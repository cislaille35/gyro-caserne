import { json } from '@sveltejs/kit';
import { donneesFichier } from '@gyro-caserne/socle';
import { exigerGestion } from '#lib/server/formulaire-agent.ts';
import type { RequestHandler } from './$types';

// Ce qu'il faut au navigateur pour écrire le classeur : l'effectif, ou le modèle vierge avec `?modele=1`.
export const GET: RequestHandler = async ({ locals, url }) => {
	const { acteur, aujourdhui } = await exigerGestion(locals);
	return json(await donneesFichier(locals.base, acteur, aujourdhui, url.searchParams.get('modele') === '1'));
};
