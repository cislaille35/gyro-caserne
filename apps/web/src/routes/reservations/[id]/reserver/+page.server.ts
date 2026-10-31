import { error, redirect } from '@sveltejs/kit';
import { calendrier, DonneeInvalide, RefusDroit, reserver } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { decaler } from '#lib/reservations.ts';
import { champ, exigerConnecte, idDe, refus } from '#lib/server/reservations.ts';
import type { Actions, PageServerLoad } from './$types';

// Ce qui est déjà pris d'ici un peu plus d'un an : la page dit la disponibilité sans revenir au serveur.
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const acteur = exigerConnecte(locals);
	const aujourdhui = aujourdhuiParis();
	try {
		const vue = await calendrier(locals.base, acteur, idDe(params.id), aujourdhui, decaler(aujourdhui, 380), aujourdhui);
		if (!vue.peutReserver) error(403, 'Vous ne pouvez pas réserver cette ressource');
		const demande = url.searchParams.get('jour') ?? '';
		const jour = /^\d{4}-\d{2}-\d{2}$/.test(demande) && demande >= aujourdhui ? demande : aujourdhui;
		return { ressource: vue.ressource, reserveCitoyenne: vue.reserveCitoyenne, prises: vue.reservations.map(({ debut, fin, quantite, etat }) => ({ debut, fin, quantite, etat })), jour, aujourdhui };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Ressource introuvable');
		if (erreur instanceof RefusDroit) error(403, 'Ressource non accessible');
		throw erreur;
	}
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const acteur = exigerConnecte(locals);
		const formulaire = await request.formData();
		const valeurs = Object.fromEntries(['debut', 'fin', 'quantite', 'mot', 'nom', 'telephone'].map((n) => [n, champ(formulaire, n)]));
		let etat: string;
		try {
			const d = { debut: valeurs.debut!, fin: valeurs.fin!, quantite: Number(valeurs.quantite || '1'), mot: valeurs.mot, nomDemandeur: valeurs.nom, telephone: valeurs.telephone };
			etat = (await reserver(locals.base, acteur, idDe(params.id), d, maintenantParis())).etat;
		} catch (erreur) {
			return refus(erreur, valeurs);
		}
		redirect(303, `/reservations/miennes?reservee=${etat}`);
	}
};
