import { annuler, mesReservations } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { champ, exigerConnecte, idDe, refus } from '#lib/server/reservations.ts';
import type { Actions, PageServerLoad } from './$types';

// Ouvrir la page marque lus les avis de réservation (accord, refus, annulation).
export const load: PageServerLoad = async ({ locals, url }) => {
	const mes = await mesReservations(locals.base, exigerConnecte(locals), maintenantParis());
	const reservee = url.searchParams.get('reservee');
	return { ...mes, reservee: reservee === 'attente' || reservee === 'acceptee' ? reservee : null, confirmer: idDe(url.searchParams.get('annuler')) || null };
};

export const actions: Actions = {
	annuler: async ({ locals, request }) => {
		const acteur = exigerConnecte(locals);
		const formulaire = await request.formData();
		try {
			await annuler(locals.base, acteur, idDe(champ(formulaire, 'id')), champ(formulaire, 'mot') || null, maintenantParis());
		} catch (erreur) {
			return refus(erreur);
		}
		return { succes: 'Réservation annulée.' };
	}
};
