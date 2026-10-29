import { error } from '@sveltejs/kit';
import { DonneeInvalide, photoSignalee, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { RequestHandler } from './$types';

// Une photo copiée par un signalement, pour qui modère la messagerie seulement ; jamais gardée en cache.
// Interdite ou inconnue : 404, sans dire si elle existe.
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.acteur) error(401, 'Connexion requise');
	if (!/^\d+$/.test(params.photo) || !/^\d+$/.test(params.id)) error(404, 'Photo inconnue');
	try {
		const { type, donnees } = await photoSignalee(locals.base, locals.basePhotos, locals.acteur, Number(params.id), Number(params.photo), aujourdhuiParis());
		return new Response(donnees as Uint8Array<ArrayBuffer>, { headers: { 'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
	} catch (erreur) {
		if (erreur instanceof RefusDroit || erreur instanceof DonneeInvalide) error(404, 'Photo inconnue');
		throw erreur;
	}
};
