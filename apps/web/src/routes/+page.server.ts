import { redirect } from '@sveltejs/kit';
import { prenomDe } from '@gyro-caserne/socle';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.acteur) redirect(303, '/connexion');
	return { prenom: await prenomDe(locals.base, locals.acteur) };
};
