import { error } from '@sveltejs/kit';
import centre from '$centre';
import { demandeVue, DonneeInvalide, RefusDroit } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerConnecte, gestesRemplacement } from '#lib/server/remplacements.ts';
import type { Actions, PageServerLoad } from './$types';

// Une demande : pour qui y a part (demandeur, destinataire, remplaçant, chef qui valide).
export const load: PageServerLoad = async ({ locals, params }) => {
	const acteur = exigerConnecte(locals);
	const id = /^\d{1,9}$/.test(params.id) ? Number(params.id) : 0;
	try {
		return await demandeVue(locals.base, acteur, id, maintenantParis(), centre.astreinte);
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Demande introuvable');
		if (erreur instanceof RefusDroit) error(403, 'Cette demande ne vous concerne pas.');
		throw erreur;
	}
};

export const actions: Actions = gestesRemplacement;
