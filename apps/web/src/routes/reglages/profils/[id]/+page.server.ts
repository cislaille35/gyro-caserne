import { error } from '@sveltejs/kit';
import { listerProfils, modifierDroitsProfil, type Droit } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { appliquerNiveaux } from '#lib/paquets.ts';
import { accesReglages, echec, niveauxChoisis, numero, type Reponse } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

// Les profils : chef de centre, adjoint et super administrateur seulement.
async function lireProfil(locals: App.Locals, brut: string) {
	const aujourdhui = aujourdhuiParis();
	const { acteur, base, pouvoir } = await accesReglages(locals, aujourdhui);
	if (!pouvoir) error(403, 'Accès réservé au chef de centre, à son adjoint et au super administrateur');
	const id = numero(brut);
	const profil = id === null ? undefined : (await listerProfils(base, acteur, aujourdhui)).find((p) => p.id === id);
	if (!profil) error(404, 'Profil introuvable');
	return { acteur, base, aujourdhui, profil };
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { profil } = await lireProfil(locals, params.id);
	return { profil };
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const { acteur, base, aujourdhui, profil } = await lireProfil(locals, params.id);
		const cible = 'profil';
		try {
			await modifierDroitsProfil(base, acteur, profil.id, appliquerNiveaux(profil.droits as Droit[], niveauxChoisis(await request.formData())), aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible);
		}
		return { cible, succes: `Le profil « ${profil.nom} » est enregistré.` } satisfies Reponse;
	}
};
