import { error } from '@sveltejs/kit';
import { enregistrerAptitude, listerAptitudes, retirerAptitude } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { accesReglages, echec, numero, texte } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { listes, base } = await accesReglages(locals, aujourdhuiParis());
	if (!listes) error(403, 'Accès réservé à qui gère les listes du centre');
	return { aptitudes: await listerAptitudes(base) };
};

export const actions: Actions = {
	// Sans `id` : une nouvelle aptitude. Le socle refuse qui ne gère pas les listes.
	enregistrer: async ({ locals, request }) => {
		const { acteur, base } = await accesReglages(locals, aujourdhuiParis());
		const formulaire = await request.formData();
		const id = numero(texte(formulaire, 'id'));
		const cible = id === null ? 'nouvelle' : `aptitude:${id}`;
		const valeurs = { nom: texte(formulaire, 'nom') ?? '' };
		try {
			await enregistrerAptitude(base, acteur, { ...(id === null ? {} : { id }), nom: valeurs.nom, controlee: formulaire.get('controlee') === 'oui' }, maintenantParis());
		} catch (erreur) {
			return echec(erreur, cible, valeurs);
		}
		return { cible, succes: id === null ? `Aptitude ${valeurs.nom.trim()} ajoutée.` : 'Aptitude enregistrée.' };
	},
	retirer: async ({ locals, request }) => {
		const { acteur, base } = await accesReglages(locals, aujourdhuiParis());
		const id = numero(texte(await request.formData(), 'id')) ?? 0;
		try {
			await retirerAptitude(base, acteur, id, maintenantParis());
		} catch (erreur) {
			return echec(erreur, `aptitude:${id}`);
		}
		return { cible: 'nouvelle', succes: 'Aptitude retirée : elle n’est plus proposée.' };
	}
};
