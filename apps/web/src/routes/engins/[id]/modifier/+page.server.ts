import { error, redirect } from '@sveltejs/kit';
import { DonneeInvalide, enregistrerEngin, lireEngin, lireFiches } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerGestionEngins, idDe, refus, saisieEngin } from '#lib/server/engins.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { acteur, base, aujourdhui } = await exigerGestionEngins(locals);
	try {
		const [{ engin }, fiches] = await Promise.all([lireEngin(base, acteur, idDe(params.id), aujourdhui), lireFiches(base)]);
		return { engin, types: fiches.map((f) => ({ id: f.typeId, nom: f.type })) };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Cet engin n’existe pas.');
		throw erreur;
	}
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		const { acteur, base } = await exigerGestionEngins(locals);
		const { valeurs, saisie } = saisieEngin(await request.formData());
		try {
			await enregistrerEngin(base, acteur, { ...saisie, id: idDe(params.id) }, maintenantParis());
		} catch (erreur) {
			return refus(erreur, { valeurs });
		}
		redirect(303, `/engins/${params.id}`);
	}
};
