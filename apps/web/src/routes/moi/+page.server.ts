import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.acteur) redirect(303, '/connexion');
};

export const actions: Actions = {
	deconnecter: async ({ request, locals, cookies }) => {
		const { headers } = await locals.auth.api.signOut({ headers: request.headers, returnHeaders: true });
		// Better Auth demande d'effacer ses cookies : on le fait ici, la réponse étant celle de SvelteKit.
		for (const ligne of headers.getSetCookie()) cookies.delete(ligne.slice(0, ligne.indexOf('=')), { path: '/' });
		redirect(303, '/connexion');
	}
};
