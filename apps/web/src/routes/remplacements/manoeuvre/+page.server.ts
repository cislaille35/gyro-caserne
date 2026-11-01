import { fail, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { manoeuvresEchangeables, proposerEchangeManoeuvre } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { ouRefus } from '#lib/server/planning.ts';
import { exigerConnecte, refus } from '#lib/server/remplacements.ts';
import type { Actions, PageServerLoad } from './$types';

// Mes manœuvres convoquées par équipe, et celles des collègues où je ne suis pas convoqué.
export const load: PageServerLoad = async ({ locals }) => {
	const acteur = exigerConnecte(locals);
	if (acteur.type !== 'personne') redirect(303, '/remplacements');
	return ouRefus(manoeuvresEchangeables(locals.base, acteur, maintenantParis(), centre.astreinte), 'Réservé aux agents du centre.');
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const acteur = exigerConnecte(locals);
		const f = await request.formData();
		const mienne = Number(f.get('mienne'));
		const [cible, sienne] = String(f.get('sienne') ?? '').split(':').map(Number);
		if (!mienne || !cible || !sienne) return fail(400, { message: 'Choisissez votre manœuvre et celle du collègue.' });
		let id: number;
		try {
			id = await proposerEchangeManoeuvre(locals.base, acteur, { manoeuvreId: mienne, cibleId: cible, manoeuvreCibleId: sienne, mot: typeof f.get('mot') === 'string' ? (f.get('mot') as string) : null }, maintenantParis(), centre.astreinte);
		} catch (erreur) {
			return refus(erreur);
		}
		redirect(303, `/remplacements/${id}`);
	}
};
