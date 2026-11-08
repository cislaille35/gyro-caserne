import { fail, redirect } from '@sveltejs/kit';
import { DonneeInvalide, demanderTenue, gereHabillement, mesDemandes } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { phraseHabillement } from '#lib/habillement.ts';
import { champ } from '#lib/server/engins.ts';
import type { Actions, PageServerLoad } from './$types';

// Caserne → Habillement : faire une demande, et mes demandes. Le super administrateur ne demande rien : il voit toutes les demandes.
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	if (acteur.type === 'super') redirect(303, '/habillement/toutes');
	const [miennes, gere] = await Promise.all([mesDemandes(base, acteur), gereHabillement(base, acteur, aujourdhuiParis())]);
	return { ...miennes, gere };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const { acteur, base } = locals;
		if (!acteur) redirect(303, '/connexion');
		const texte = champ(await request.formData(), 'texte');
		let id: number;
		try {
			id = await demanderTenue(base, acteur, texte, maintenantParis());
		} catch (erreur) {
			if (erreur instanceof DonneeInvalide) return fail(400, { texte, message: phraseHabillement(erreur.message) });
			throw erreur;
		}
		redirect(303, `/habillement/${id}?envoyee`);
	}
};
