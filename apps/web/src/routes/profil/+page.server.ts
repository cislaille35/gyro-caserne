import { redirect } from '@sveltejs/kit';
import { modifierMonProfil, monProfil } from '@gyro-caserne/socle';
import { echec } from '#lib/server/formulaire-agent.ts';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.acteur) redirect(303, '/connexion');
	return { profil: await monProfil(locals.base, locals.acteur) };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.acteur) redirect(303, '/connexion');
		const formulaire = await request.formData();
		const texte = (cle: string) => String(formulaire.get(cle) ?? '');
		// Une case décochée n'est pas envoyée : absente = faux.
		const champs = {
			surnom: texte('surnom'),
			telephone: texte('telephone'),
			contactUrgence: texte('contactUrgence'),
			telephoneVisible: formulaire.has('telephoneVisible'),
			anniversaireVisible: formulaire.has('anniversaireVisible')
		};
		try {
			await modifierMonProfil(locals.base, locals.acteur, champs, aujourdhuiParis());
		} catch (erreur) {
			return echec(erreur, { valeurs: { surnom: champs.surnom, telephone: champs.telephone, contactUrgence: champs.contactUrgence } });
		}
		return { succes: true, message: 'Profil enregistré' };
	}
};
