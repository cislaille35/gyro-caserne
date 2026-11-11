import { error } from '@sveltejs/kit';
import { DonneeInvalide, octetsEcusson } from '@gyro-caserne/socle';
import type { RequestHandler } from './$types';

// L'écusson du centre, à une adresse fixe dont la version (?v=) change à chaque remplacement : le navigateur le garde un an et ne le
// redemande pas d'une page à l'autre. Public : il s'affiche aussi à la connexion. Seul l'écusson en place est servi.
export const GET: RequestHandler = async ({ locals, url }) => {
	const v = url.searchParams.get('v') ?? '';
	if (!/^\d+$/.test(v)) error(404, 'Écusson inconnu');
	try {
		const { type, donnees } = await octetsEcusson(locals.base, locals.basePhotos, Number(v));
		return new Response(donnees as Uint8Array<ArrayBuffer>, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Écusson inconnu');
		throw erreur;
	}
};
