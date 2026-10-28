import { error } from '@sveltejs/kit';
import { DonneeInvalide, photo, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { RequestHandler } from './$types';

// Une photo de publication, seulement pour qui peut lire son mur ; jamais mise en cache partagé.
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.acteur) error(401, 'Connexion requise');
	if (!/^\d+$/.test(params.id)) error(404, 'Photo inconnue');
	try {
		const { type, donnees } = await photo(locals.base, locals.acteur, Number(params.id), aujourdhuiParis());
		// Les octets lus de la base sont dans un ArrayBuffer ordinaire.
		return new Response(donnees as Uint8Array<ArrayBuffer>, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
	} catch (erreur) {
		if (erreur instanceof RefusDroit) error(403, 'Photo non accessible');
		if (erreur instanceof DonneeInvalide) error(404, 'Photo inconnue');
		throw erreur;
	}
};
