import { error, redirect } from '@sveltejs/kit';
import { quiFaitQuoi, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { PageServerLoad } from './$types';

// Caserne → Comités et référents : qui fait quoi au centre. Les liens « Gérer » viennent des droits du layout.
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	try {
		return await quiFaitQuoi(base, acteur, aujourdhuiParis());
	} catch (erreur) {
		if (erreur instanceof RefusDroit) error(403, 'Réservé aux agents du centre');
		throw erreur;
	}
};
