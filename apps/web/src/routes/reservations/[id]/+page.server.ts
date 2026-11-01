import { error } from '@sveltejs/kit';
import { calendrier, DonneeInvalide, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { decaler, grilleDuMois } from '#lib/reservations.ts';
import { exigerConnecte, idDe } from '#lib/server/reservations.ts';
import type { PageServerLoad } from './$types';

// Le jour demandé (?jour=), sinon aujourd'hui : on lit la grille de son mois (ordinateur) et les sept jours qui suivent (téléphone).
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const acteur = exigerConnecte(locals);
	const aujourdhui = aujourdhuiParis();
	const demande = url.searchParams.get('jour') ?? '';
	const jour = /^\d{4}-\d{2}-\d{2}$/.test(demande) && !Number.isNaN(Date.parse(demande)) ? demande : aujourdhui;
	const grille = grilleDuMois(jour);
	const septJours = decaler(jour, 6);
	const au = septJours > grille[41]! ? septJours : grille[41]!;
	try {
		return { ...(await calendrier(locals.base, acteur, idDe(params.id), grille[0]!, au, aujourdhui)), jour, aujourdhui };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Ressource introuvable');
		if (erreur instanceof RefusDroit) error(403, 'Ressource non accessible');
		throw erreur;
	}
};
