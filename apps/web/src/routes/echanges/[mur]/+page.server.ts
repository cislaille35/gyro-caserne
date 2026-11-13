import { asc } from 'drizzle-orm';
import { anniversairesDuJour, couper, epingler, equipe, estCoupe, lireMur, modifierPublication, supprimerPublication } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { echecMur, erreurLecture, exigerActeur } from '#lib/server/formulaire-mur.ts';
import { gestes, surPublication } from '#lib/server/gestes-mur.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const acteur = exigerActeur(locals);
	const avant = url.searchParams.get('avant');
	try {
		const mur = await lireMur(locals.base, acteur, params.mur, { avant: avant === null ? undefined : /^\d+$/.test(avant) ? Number(avant) : NaN, nombre: 20 }, maintenantParis());
		// Les équipes, pour nommer les convoqués et convoquer (les actives) ; sur un mur d'équipe, c'est l'équipe du mur.
		const equipes = mur.mur.type === 'equipe' ? [] : await locals.base.select({ id: equipe.id, nom: equipe.nom, active: equipe.active }).from(equipe).orderBy(asc(equipe.ordreRotation));
		// « Vie du centre » souhaite les anniversaires du jour.
		const anniversaires = mur.mur.type === 'vie' ? await anniversairesDuJour(locals.base, acteur, aujourdhuiParis()) : [];
		// Le bouton « couper » de l'en-tête : nul pour le super administrateur, qui ne reçoit rien.
		const coupe = acteur.type === 'personne' ? await estCoupe(locals.base, acteur, `mur:${params.mur}`) : null;
		return { ...mur, equipes, anniversaires, plusAnciennes: avant !== null, coupe };
	} catch (erreur) {
		erreurLecture(erreur);
	}
};

export const actions: Actions = {
	couper: async ({ locals, params, request }) => {
		const acteur = exigerActeur(locals);
		const oui = (await request.formData()).get('oui') === '1';
		try {
			await couper(locals.base, acteur, `mur:${params.mur}`, oui, maintenantParis());
		} catch (erreur) {
			return echecMur(erreur, 'couper');
		}
		return { cible: 'couper', succes: oui ? 'Notifications coupées pour ce mur.' : 'Notifications réactivées pour ce mur.' };
	},
	modifier: ({ locals, params, request }) =>
		surPublication({ locals, params, request }, async (acteur, id, f) => {
			const texte = f.get('texte');
			await modifierPublication(locals.base, acteur, id, { texte: typeof texte === 'string' ? texte : '' }, maintenantParis());
			return 'Publication modifiée.';
		}),
	supprimer: ({ locals, params, request }) =>
		surPublication({ locals, params, request }, async (acteur, id) => {
			await supprimerPublication(locals.base, locals.basePhotos, acteur, id, maintenantParis());
			return 'Publication supprimée.';
		}),
	epingler: ({ locals, params, request }) =>
		surPublication({ locals, params, request }, async (acteur, id, f) => {
			const oui = f.get('oui') === '1';
			await epingler(locals.base, acteur, id, oui, maintenantParis());
			return oui ? 'Publication épinglée.' : 'Épingle retirée.';
		}),
	...gestes
};
