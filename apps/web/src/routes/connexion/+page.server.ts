import { fail, redirect } from '@sveltejs/kit';
import { ecussonDuCentre, normaliserAdresse } from '@gyro-caserne/socle';
import { recopierCookies } from '#lib/server/session.ts';
import type { Actions, PageServerLoad } from './$types';

// L'écusson du centre, s'il y en a un : une petite lecture, la page n'est vue qu'à la connexion.
export const load: PageServerLoad = async ({ locals }) => ({ ecusson: await ecussonDuCentre(locals.base) });

// Un courriel par minute et par adresse : secondes à attendre avant de pouvoir le renvoyer.
function renvoiDans(envoyeLe: number): number {
	return Math.max(0, Math.min(60, 60 - Math.floor((Date.now() - envoyeLe) / 1000)));
}

// Les refus de Better Auth, dits simplement.
const ERREURS_DU_CODE: Record<string, string> = {
	INVALID_OTP: 'Code incorrect. Vérifiez les 6 chiffres du dernier courriel reçu.',
	OTP_EXPIRED: 'Ce code a expiré : il ne vaut que 5 minutes. Renvoyez l’e-mail pour en recevoir un nouveau.',
	TOO_MANY_ATTEMPTS: 'Trop d’essais : ce code ne marche plus. Renvoyez l’e-mail pour en recevoir un nouveau.'
};

export const actions: Actions = {
	envoyer: async ({ request, locals }) => {
		const email = normaliserAdresse(String((await request.formData()).get('email') ?? ''));
		try {
			if (email) await locals.auth.api.signInMagicLink({ body: { email, callbackURL: '/' }, headers: request.headers });
		} catch (erreur) {
			// Même message dans tous les cas : un échec ne doit pas révéler qu'une adresse est autorisée.
			console.error('Lien de connexion non envoyé', erreur);
		}
		// L’adresse est rappelée à la personne, telle qu’elle l’a tapée (normalisée) : rien de plus n’est dit.
		const envoyeLe = Date.now();
		return { envoye: true, email, envoyeLe, renvoiDans: renvoiDans(envoyeLe) };
	},
	// Le code à 6 chiffres du courriel, tapé dans l'appli : utile surtout à l'appli installée sur iPhone, que le lien n'atteint pas.
	code: async ({ request, locals, cookies }) => {
		const donnees = await request.formData();
		const email = normaliserAdresse(String(donnees.get('email') ?? ''));
		const code = String(donnees.get('code') ?? '').replace(/\s/g, '');
		const envoyeLe = Number(donnees.get('envoyeLe')) || 0;
		const refus = (erreur: string) => fail(400, { envoye: true, email, envoyeLe, renvoiDans: renvoiDans(envoyeLe), erreur });
		if (!/^\d{6}$/.test(code)) return refus('Le code a 6 chiffres.');
		try {
			const { headers } = await locals.auth.api.signInEmailOTP({ body: { email, otp: code }, headers: request.headers, returnHeaders: true });
			recopierCookies(headers, cookies);
		} catch (erreur) {
			const raison = (erreur as { body?: { code?: string } }).body?.code ?? '';
			if (!ERREURS_DU_CODE[raison]) console.error('Connexion par code en échec', erreur);
			return refus(ERREURS_DU_CODE[raison] ?? 'La connexion n’a pas abouti. Réessayez dans un instant.');
		}
		redirect(303, '/');
	}
};
