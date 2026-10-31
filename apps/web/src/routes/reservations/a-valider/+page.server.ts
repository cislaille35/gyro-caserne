import { accepter, acceptees, annuler, aValider, refuser } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { champ, exigerConnecte, idDe, refus } from '#lib/server/reservations.ts';
import type { Actions, PageServerLoad } from './$types';

// Les demandes à trancher et les réservations acceptées à venir, des ressources que l'acteur gère (rien pour les autres).
export const load: PageServerLoad = async ({ locals }) => {
	const acteur = exigerConnecte(locals);
	const [demandes, lesAcceptees] = await Promise.all([aValider(locals.base, acteur, aujourdhuiParis()), acceptees(locals.base, acteur, aujourdhuiParis())]);
	return { demandes, acceptees: lesAcceptees };
};

async function geste(locals: App.Locals, request: Request, faire: (id: number, texte: string | null) => Promise<void>, succes: string) {
	exigerConnecte(locals);
	const formulaire = await request.formData();
	try {
		await faire(idDe(champ(formulaire, 'id')), champ(formulaire, 'motif') || champ(formulaire, 'mot') || null);
	} catch (erreur) {
		return refus(erreur);
	}
	return { succes };
}

export const actions: Actions = {
	accepter: ({ locals, request }) => geste(locals, request, (id) => accepter(locals.base, locals.acteur!, id, maintenantParis()), 'Demande acceptée : le demandeur est prévenu.'),
	refuser: ({ locals, request }) => geste(locals, request, (id, motif) => refuser(locals.base, locals.acteur!, id, motif, maintenantParis()), 'Demande refusée : le demandeur est prévenu.'),
	annuler: ({ locals, request }) => geste(locals, request, (id, mot) => annuler(locals.base, locals.acteur!, id, mot, maintenantParis()), 'Réservation annulée : le demandeur est prévenu.')
};
