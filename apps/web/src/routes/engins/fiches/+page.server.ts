import { redirect } from '@sveltejs/kit';
import { creerTypeEngin, lireFiches } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { champ, exigerGestionEngins, refus } from '#lib/server/engins.ts';
import type { Actions, PageServerLoad } from './$types';

// Les fiches de prise de garde, une par type d'engin, et un nouveau type.
export const load: PageServerLoad = async ({ locals }) => {
	const { base } = await exigerGestionEngins(locals);
	return { fiches: await lireFiches(base) };
};

export const actions: Actions = {
	nouveauType: async ({ locals, request }) => {
		const { acteur, base } = await exigerGestionEngins(locals);
		const nom = champ(await request.formData(), 'nom');
		let id: number;
		try {
			id = await creerTypeEngin(base, acteur, nom, maintenantParis());
		} catch (erreur) {
			return refus(erreur, { nom });
		}
		redirect(303, `/engins/fiches/${id}?nouveau=1`);
	}
};
