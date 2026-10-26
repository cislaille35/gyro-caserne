import { dev } from '$app/env';
import { fail } from '@sveltejs/kit';
import { niveauConnu, themeConnu } from '#lib/affichage.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const formulaire = await request.formData();
		const niveau = formulaire.get('niveau');
		const theme = formulaire.get('theme');
		if (!niveauConnu(niveau) || !themeConnu(theme)) {
			return fail(400, { erreur: 'Choix inconnu : merci de choisir dans les listes proposées.' });
		}
		const options = { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: true, secure: !dev } as const;
		cookies.set('niveau', niveau, options);
		cookies.set('theme', theme, options);
		// Le hook lit ceci au rendu : la même réponse s'affiche déjà avec le nouveau choix.
		locals.affichage = { niveau, theme };
		return { enregistre: true, niveau, theme };
	}
};
