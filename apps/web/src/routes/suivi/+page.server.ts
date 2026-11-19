import { error, redirect } from '@sveltejs/kit';
import { RefusDroit, suiviDuCentre } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { PageServerLoad } from './$types';

// Le suivi du centre, pour le chef de centre, l'adjoint et le super administrateur : une page du journal à la fois (`?avant=`).
// La première page marque la visite (les nouveautés de la cloche repartent de zéro). Une requête.
export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const brut = url.searchParams.get('avant');
	const avant = brut && /^\d{1,12}$/.test(brut) ? Number(brut) : undefined;
	const aujourdhui = aujourdhuiParis();
	try {
		return { ...(await suiviDuCentre(base, acteur, aujourdhui, { avant })), aujourdhui };
	} catch (erreur) {
		if (erreur instanceof RefusDroit) error(403, 'Le suivi du centre est réservé au chef de centre et à son adjoint.');
		throw erreur;
	}
};
