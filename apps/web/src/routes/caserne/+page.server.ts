import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Les droits (Nominations, Réglages) viennent du layout.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.acteur) redirect(303, '/connexion');
};
