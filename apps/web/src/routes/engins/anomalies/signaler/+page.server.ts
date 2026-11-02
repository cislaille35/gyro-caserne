import { fail, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { aLeDroit, DonneeInvalide, listerEngins, RefusDroit, signalerAnomalie, TAILLE_PHOTO_MAX, type GenreEcart } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { accesEngins, champ, idDe, phraseDe } from '#lib/server/engins.ts';
import type { Actions, PageServerLoad } from './$types';

// Signaler un problème hors prise de garde : l'engin (choisi d'avance depuis sa page), le problème, une note et une photo.
export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base, aujourdhui } = await accesEngins(locals);
	const [{ engins }, peutSignaler] = await Promise.all([listerEngins(base, acteur, aujourdhui), aLeDroit(base, acteur, 'SIGNALER_ANOMALIE', { type: 'centre' }, aujourdhui)]);
	const presents = engins.filter((e) => e.situation !== 'parti').map((e) => ({ id: e.id, nom: e.nom, type: e.type }));
	const choisi = idDe(url.searchParams.get('engin'));
	return { engins: presents, enginId: presents.some((e) => e.id === choisi) ? choisi : null, peutSignaler: peutSignaler && acteur.type === 'personne' };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const { acteur, base } = await accesEngins(locals);
		const f = await request.formData();
		const saisie = { engin: champ(f, 'engin'), libelle: champ(f, 'libelle'), genre: champ(f, 'genre'), note: champ(f, 'note') };
		const fichier = f.get('photo');
		if (fichier instanceof File && fichier.size > TAILLE_PHOTO_MAX) return fail(400, { ...saisie, message: 'Photo trop lourde : 200 Ko au plus.' });
		const photo = fichier instanceof File && fichier.size > 0 ? { type: fichier.type, donnees: new Uint8Array(await fichier.arrayBuffer()) } : null;
		let id: number;
		try {
			// Un genre inconnu passe tel quel : le socle le refuse.
			id = await signalerAnomalie(base, locals.basePhotos, acteur, { enginId: idDe(saisie.engin), libelle: saisie.libelle, genre: saisie.genre as GenreEcart, note: saisie.note, photo }, maintenantParis(), centre.astreinte);
		} catch (erreur) {
			if (erreur instanceof RefusDroit) return fail(403, { ...saisie, message: 'Le signalement est réservé aux agents du centre.' });
			if (erreur instanceof DonneeInvalide) return fail(400, { ...saisie, message: phraseDe(erreur.message) });
			throw erreur;
		}
		redirect(303, `/engins/anomalies/${id}?signalee`);
	}
};
