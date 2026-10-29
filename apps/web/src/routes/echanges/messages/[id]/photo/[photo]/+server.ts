import { error } from '@sveltejs/kit';
import { DonneeInvalide, photoMessage, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { RequestHandler } from './$types';

// Une photo de message, seulement pour les membres de sa conversation, demandée par celle-ci ; jamais mise en cache partagé.
// Interdite ou inconnue : 404, sans dire si elle existe.
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.acteur) error(401, 'Connexion requise');
	if (!/^\d+$/.test(params.photo) || !/^\d+$/.test(params.id)) error(404, 'Photo inconnue');
	try {
		const { type, donnees } = await photoMessage(locals.base, locals.basePhotos, locals.acteur, Number(params.photo), aujourdhuiParis(), Number(params.id));
		// Les octets lus de la base sont dans un ArrayBuffer ordinaire.
		return new Response(donnees as Uint8Array<ArrayBuffer>, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
	} catch (erreur) {
		if (erreur instanceof RefusDroit || erreur instanceof DonneeInvalide) error(404, 'Photo inconnue');
		throw erreur;
	}
};
