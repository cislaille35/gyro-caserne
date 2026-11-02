import { error } from '@sveltejs/kit';
import { DonneeInvalide, photoAnomalie, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { RequestHandler } from './$types';

// La photo d'un écart de prise de garde, à qui voit les engins ; jamais mise en cache partagé.
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.acteur) error(401, 'Connexion requise');
	if (!/^\d{1,9}$/.test(params.id)) error(404, 'Photo inconnue');
	try {
		const { type, donnees } = await photoAnomalie(locals.base, locals.basePhotos, locals.acteur, Number(params.id), aujourdhuiParis());
		return new Response(donnees as Uint8Array<ArrayBuffer>, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
	} catch (erreur) {
		if (erreur instanceof RefusDroit) error(403, 'Photo non accessible');
		if (erreur instanceof DonneeInvalide) error(404, 'Photo inconnue');
		throw erreur;
	}
};
