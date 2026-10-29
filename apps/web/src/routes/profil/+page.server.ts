import { redirect } from '@sveltejs/kit';
import { exigerMessagerie, modifierMonProfil, monProfil, RefusDroit } from '@gyro-caserne/socle';
import { echec } from '#lib/server/formulaire-agent.ts';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.acteur) redirect(303, '/connexion');
	const acteur = locals.acteur;
	// La case des coches de lecture n'est montrée qu'à qui a la messagerie.
	const messagerie = exigerMessagerie(locals.base, acteur, aujourdhuiParis()).then(
		() => true,
		(erreur) => {
			if (erreur instanceof RefusDroit) return false;
			throw erreur;
		}
	);
	const [profil, avecMessagerie] = await Promise.all([monProfil(locals.base, acteur), messagerie]);
	return { profil, messagerie: avecMessagerie };
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
			anniversaireVisible: formulaire.has('anniversaireVisible'),
			// La case n'est dans le formulaire (avec son repère) que pour qui a la messagerie.
			...(formulaire.has('avecCoches') ? { cochesLecture: formulaire.has('cochesLecture') } : {})
		};
		try {
			await modifierMonProfil(locals.base, locals.acteur, champs, aujourdhuiParis());
		} catch (erreur) {
			return echec(erreur, { valeurs: { surnom: champs.surnom, telephone: champs.telephone, contactUrgence: champs.contactUrgence } });
		}
		return { succes: true, message: 'Profil enregistré' };
	}
};
