import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// L'aide à l'installation : tout se décide dans le navigateur. Aucune requête à la base.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.acteur) redirect(303, '/connexion');
	return {};
};
