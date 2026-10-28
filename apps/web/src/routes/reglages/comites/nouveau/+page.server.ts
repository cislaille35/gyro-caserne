import { error, redirect } from '@sveltejs/kit';
import { creerComite } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { accesReglages, echec, texte } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { comites } = await accesReglages(locals, aujourdhuiParis());
	if (!comites) error(403, 'Accès réservé à qui gère les comités du centre');
	return {};
};

export const actions: Actions = {
	// Le socle refuse qui ne gère pas les comités : le message s'affiche sur la page.
	default: async ({ locals, request }) => {
		const aujourdhui = aujourdhuiParis();
		const { acteur, base } = await accesReglages(locals, aujourdhui);
		const formulaire = await request.formData();
		const valeurs = { nom: texte(formulaire, 'nom') ?? '', theme: texte(formulaire, 'theme') ?? '' };
		let id: number;
		try {
			id = await creerComite(base, acteur, valeurs, aujourdhui);
		} catch (erreur) {
			return echec(erreur, 'comite-nouveau', valeurs);
		}
		redirect(303, `/reglages/comites/${id}`);
	}
};
