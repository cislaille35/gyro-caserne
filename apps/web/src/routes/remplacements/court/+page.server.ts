import { fail, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { demanderRemplacementCourt, pourDemanderCourt } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { ouRefus } from '#lib/server/planning.ts';
import { exigerConnecte, refus } from '#lib/server/remplacements.ts';
import type { Actions, PageServerLoad } from './$types';

// Le remplacement court : quelques heures dans son astreinte du jour, ouvert à tous les disponibles.
export const load: PageServerLoad = async ({ locals }) => {
	const acteur = exigerConnecte(locals);
	if (acteur.type !== 'personne') redirect(303, '/remplacements');
	return ouRefus(pourDemanderCourt(locals.base, acteur, maintenantParis().slice(0, 16), centre.astreinte), 'Réservé aux agents du centre.');
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const acteur = exigerConnecte(locals);
		const f = await request.formData();
		const debut = f.get('debut');
		const mot = f.get('mot');
		if (typeof debut !== 'string' || debut === '') return fail(400, { message: 'Choisissez l’heure de début.' });
		let id: number;
		try {
			id = await demanderRemplacementCourt(locals.base, acteur, { debut, duree: f.get('duree') === '3' ? 3 : 2, mot: typeof mot === 'string' ? mot : null }, maintenantParis(), centre.astreinte);
		} catch (erreur) {
			return refus(erreur);
		}
		redirect(303, `/remplacements/${id}?envoyee`);
	}
};
