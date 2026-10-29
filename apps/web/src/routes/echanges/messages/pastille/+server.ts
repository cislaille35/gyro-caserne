import { error, json } from '@sveltejs/kit';
import { nonLusTotal } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { RequestHandler } from './$types';

// La pastille d'Échanges : le nombre de messages non lus, interrogé toutes les 30 s. Une requête.
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.acteur) error(401, 'Connexion requise');
	return json(
		{
			nonLus: await nonLusTotal(locals.base, locals.acteur, aujourdhuiParis())
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
};
