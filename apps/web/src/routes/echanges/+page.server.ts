import { redirect } from '@sveltejs/kit';
import { DonneeInvalide, souhaiter } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { Actions } from './$types';

// « Souhaiter » sous un anniversaire du jour, depuis la liste des murs ou un mur : on revient sur cette page (son adresse, sans `?avant=`),
// la page relue dit « Souhaité ». Un refus (plus d'anniversaire, déjà souhaité) revient aussi, sans rien écrire.
export const actions: Actions = {
	souhaiter: async ({ locals, request }) => {
		const acteur = exigerActeur(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const retour = String(f.get('retour') ?? '');
		if (/^[1-9]\d{0,14}$/.test(id)) {
			try {
				await souhaiter(locals.base, acteur, Number(id), maintenantParis());
			} catch (erreur) {
				if (!(erreur instanceof DonneeInvalide)) throw erreur;
			}
		}
		redirect(303, /^\/echanges(\/[\w:-]+)*$/.test(retour) ? retour : '/echanges');
	}
};
