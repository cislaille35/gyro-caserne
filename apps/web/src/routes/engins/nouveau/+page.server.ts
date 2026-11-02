import { redirect } from '@sveltejs/kit';
import { enregistrerEngin, lireFiches } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerGestionEngins, refus, saisieEngin } from '#lib/server/engins.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { base } = await exigerGestionEngins(locals);
	return { types: (await lireFiches(base)).map((f) => ({ id: f.typeId, nom: f.type })) };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const { acteur, base } = await exigerGestionEngins(locals);
		const { valeurs, saisie } = saisieEngin(await request.formData());
		let id: number;
		try {
			id = await enregistrerEngin(base, acteur, saisie, maintenantParis());
		} catch (erreur) {
			return refus(erreur, { valeurs });
		}
		redirect(303, `/engins/${id}`);
	}
};
