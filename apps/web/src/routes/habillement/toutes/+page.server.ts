import { error, redirect } from '@sveltejs/kit';
import { RefusDroit, toutesLesDemandes } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { PageServerLoad } from './$types';

// Toutes les demandes d'habillement, pour qui les traite : en cours (les nouvelles d'abord), puis les dernières terminées.
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	try {
		return await toutesLesDemandes(base, acteur, aujourdhuiParis());
	} catch (erreur) {
		if (erreur instanceof RefusDroit) error(403, 'Réservé au référent habillement, au chef de centre et à son adjoint.');
		throw erreur;
	}
};
