import { error, json } from '@sveltejs/kit';
import { lireEnTete } from '#lib/server/cloche.ts';
import type { RequestHandler } from './$types';

// Le nombre de la cloche, relu après chaque changement de page : une consultation le fait baisser sans recharger.
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.acteur) error(401, 'Connexion requise');
	const { cloche } = await lireEnTete(locals.base, locals.acteur);
	return json({ cloche }, { headers: { 'cache-control': 'no-store' } });
};
