import { error, fail } from '@sveltejs/kit';
import { DonneeInvalide, deposerEcusson, ecussonDuCentre, retirerEcusson } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { accesReglages, echec, manque, texte, type Reponse } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

// L'écusson du centre : réservé à qui gère les listes du centre (comme les aptitudes et l'armement).
async function acces(locals: App.Locals) {
	const a = await accesReglages(locals, aujourdhuiParis());
	if (!a.listes) error(403, 'Accès réservé à qui gère les listes du centre');
	return a;
}

export const load: PageServerLoad = async ({ locals }) => {
	const { base } = await acces(locals);
	return { ecusson: await ecussonDuCentre(base) };
};

// Les refus du socle, dits sous le champ.
const ERREURS: Record<string, string> = {
	'Photo JPEG ou WebP seulement': 'Image JPEG ou WebP seulement.',
	'Photo trop lourde (200 Ko au plus)': 'Image trop lourde : 200 Ko au plus.'
};

export const actions: Actions = {
	deposer: async ({ locals, request }) => {
		const cible = 'ecusson';
		const { acteur, base } = await acces(locals);
		const fichier = (await request.formData()).get('image');
		if (!(fichier instanceof File) || fichier.size === 0) return fail<Reponse>(400, { cible, erreurs: { image: 'Choisissez une image.' } });
		try {
			await deposerEcusson(base, locals.basePhotos, acteur, { type: fichier.type, donnees: new Uint8Array(await fichier.arrayBuffer()) }, maintenantParis());
		} catch (erreur) {
			if (erreur instanceof DonneeInvalide && ERREURS[erreur.message]) return fail<Reponse>(400, { cible, erreurs: { image: ERREURS[erreur.message]! } });
			return echec(erreur, cible);
		}
		return { cible, succes: 'Écusson enregistré.' } satisfies Reponse;
	},
	retirer: async ({ locals, request }) => {
		const cible = 'retirer';
		const { acteur, base } = await acces(locals);
		if (texte(await request.formData(), 'confirmation') !== 'oui') return manque(cible, 'Cochez « Je confirme » pour continuer.');
		try {
			await retirerEcusson(base, locals.basePhotos, acteur, maintenantParis());
		} catch (erreur) {
			return echec(erreur, cible);
		}
		return { cible, succes: 'Écusson retiré.' } satisfies Reponse;
	}
};
