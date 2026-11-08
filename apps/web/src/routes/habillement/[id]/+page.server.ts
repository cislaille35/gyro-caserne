import { error, fail, redirect } from '@sveltejs/kit';
import { DonneeInvalide, gesteHabillement, lireDemande, RefusDroit, type GesteHabillement } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { phraseHabillement } from '#lib/habillement.ts';
import { champ, idDe } from '#lib/server/engins.ts';
import type { Actions, PageServerLoad } from './$types';

// Une demande d'habillement : son suivi, son fil et les gestes permis. Inconnue (404) pour qui n'a pas à la voir.
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	try {
		return { demande: await lireDemande(base, acteur, idDe(params.id), maintenantParis()), envoyee: url.searchParams.has('envoyee') };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Cette demande n’existe pas.');
		throw erreur;
	}
};

const SUCCES: Record<GesteHabillement['quoi'], string> = {
	prendre: 'Vous l’avez prise en compte.',
	reprendre: 'Vous l’avez reprise.',
	question: 'Question envoyée.',
	repondre: 'Message envoyé.',
	traiter: 'Demande traitée.',
	livrer: 'Livraison enregistrée.',
	annuler: 'Demande annulée.'
};

function gesteDe(f: FormData): GesteHabillement | null {
	const texte = champ(f, 'texte');
	switch (champ(f, 'quoi')) {
		case 'prendre':
			return { quoi: 'prendre' };
		case 'reprendre':
			return { quoi: 'reprendre' };
		case 'question':
			return { quoi: 'question', texte };
		case 'repondre':
			return { quoi: 'repondre', texte };
		case 'traiter':
			// Une issue inconnue passe telle quelle : le socle la refuse.
			return { quoi: 'traiter', issue: champ(f, 'issue') as 'stock', texte };
		case 'livrer': {
			// Un choix proposé, ou « Autre » et le mot écrit.
			const choix = champ(f, 'recuperation');
			return { quoi: 'livrer', texte: choix === 'autre' || choix === '' ? texte : choix };
		}
		case 'annuler':
			return { quoi: 'annuler' };
		default:
			return null;
	}
}

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const { acteur, base } = locals;
		if (!acteur) redirect(303, '/connexion');
		const geste = gesteDe(await request.formData());
		if (!geste) return fail(400, { quoi: null, message: 'Ce geste n’existe pas.' });
		try {
			await gesteHabillement(base, acteur, idDe(params.id), geste, maintenantParis());
		} catch (erreur) {
			if (erreur instanceof RefusDroit) return fail(403, { quoi: geste.quoi, message: 'Réservé au référent habillement, au chef de centre et à son adjoint.' });
			if (erreur instanceof DonneeInvalide) {
				if (erreur.message === 'Demande inconnue') error(404, 'Cette demande n’existe pas.');
				return fail(400, { quoi: geste.quoi, message: phraseHabillement(erreur.message) });
			}
			throw erreur;
		}
		return { quoi: geste.quoi, succes: SUCCES[geste.quoi] };
	}
};
