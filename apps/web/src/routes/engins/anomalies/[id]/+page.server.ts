import { error, fail } from '@sveltejs/kit';
import centre from '$centre';
import { DonneeInvalide, gesteAnomalie, lireAnomalie, RefusDroit, type GesteAnomalie, type MotifAttente } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { accesEngins, champ, idDe, phraseDe } from '#lib/server/engins.ts';
import type { Actions, PageServerLoad } from './$types';

// Une anomalie : où elle en est, son historique, et les gestes permis (avancer, clore, rendre l'engin indisponible, le remettre en service).
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { acteur, base } = await accesEngins(locals);
	try {
		return { anomalie: await lireAnomalie(base, acteur, idDe(params.id), maintenantParis(), centre.anomalies), signalee: url.searchParams.has('signalee') };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Cette anomalie n’existe pas.');
		throw erreur;
	}
};

const REFUS: Record<string, string> = {
	TRAITER_ANOMALIE: 'Seuls le référent engins, les chefs de garde, le chef de centre et son adjoint décident de l’indisponibilité et clôturent sans réparation.',
	PRENDRE_EN_CHARGE_ANOMALIE: 'La prise en charge est réservée aux agents du centre.'
};

const SUCCES: Record<GesteAnomalie['quoi'], string> = {
	prendre: 'Vous l’avez prise en charge.',
	attente: 'Mise en attente.',
	reparee: 'Réparation enregistrée.',
	verifiee: 'Vérification enregistrée.',
	clore: 'Anomalie close.',
	indisponible: 'L’engin est maintenant indisponible.',
	remettre: 'L’engin est remis en service.'
};

function gesteDe(f: FormData): GesteAnomalie | null {
	const texte = champ(f, 'texte');
	switch (champ(f, 'quoi')) {
		case 'prendre':
			return { quoi: 'prendre' };
		case 'attente':
			// Un motif inconnu passe tel quel : le socle le refuse.
			return { quoi: 'attente', motif: champ(f, 'motif') as MotifAttente, texte };
		case 'reparee':
			return { quoi: 'reparee', texte };
		case 'verifiee':
			return { quoi: 'verifiee' };
		case 'clore':
			return { quoi: 'clore', texte };
		case 'indisponible':
			return { quoi: 'indisponible' };
		case 'remettre':
			return { quoi: 'remettre' };
		default:
			return null;
	}
}

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const { acteur, base } = await accesEngins(locals);
		const geste = gesteDe(await request.formData());
		if (!geste) return fail(400, { quoi: null, message: 'Ce geste n’existe pas.' });
		try {
			await gesteAnomalie(base, acteur, idDe(params.id), geste, maintenantParis(), centre.anomalies);
		} catch (erreur) {
			if (erreur instanceof RefusDroit) return fail(403, { quoi: geste.quoi, message: REFUS[erreur.droit] ?? REFUS.TRAITER_ANOMALIE });
			if (erreur instanceof DonneeInvalide) return fail(400, { quoi: geste.quoi, message: phraseDe(erreur.message) });
			throw erreur;
		}
		return { quoi: geste.quoi, succes: SUCCES[geste.quoi] };
	}
};
