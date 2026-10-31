import { fail, redirect } from '@sveltejs/kit';
import { couper, DonneeInvalide, mesNotifications, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { Actions, PageServerLoad } from './$types';

// Moi → Notifications : ce téléphone, « Tout couper », et ce qui est coupé. Le super administrateur n'a ni murs ni messagerie.
export const load: PageServerLoad = async ({ locals }) => {
	const acteur = exigerActeur(locals);
	if (acteur.type !== 'personne') redirect(303, '/moi');
	return { clePublique: locals.clePublique ?? null, ...(await mesNotifications(locals.base, acteur, aujourdhuiParis())) };
};

async function changer(locals: App.Locals, lieu: string, oui: boolean, succes: string) {
	const acteur = exigerActeur(locals);
	try {
		await couper(locals.base, acteur, lieu, oui, maintenantParis());
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide || erreur instanceof RefusDroit) return fail(400, { message: 'Ce réglage n’existe plus.' });
		throw erreur;
	}
	return { succes };
}

export const actions: Actions = {
	toutCouper: async ({ locals, request }) => {
		const oui = (await request.formData()).get('oui') === '1';
		return changer(locals, 'tout', oui, oui ? 'Plus rien ne sonne au téléphone.' : 'Les notifications sonnent à nouveau.');
	},
	reactiver: async ({ locals, request }) => {
		const lieu = (await request.formData()).get('lieu');
		return changer(locals, typeof lieu === 'string' ? lieu : '', false, 'Réactivé.');
	}
};
