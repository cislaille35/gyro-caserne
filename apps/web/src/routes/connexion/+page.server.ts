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

// Code faux, expiré ou trop d'essais : un seul message. Les distinguer dirait qu'un code existe, donc que l'adresse est autorisée.
const CODE_REFUSE = 'Ce code ne marche pas : il est faux, a expiré (5 minutes) ou a déjà eu 3 essais. Vérifiez les 6 chiffres du dernier courriel, ou renvoyez-le.';
const REFUS_DE_BETTER_AUTH = ['INVALID_OTP', 'OTP_EXPIRED', 'TOO_MANY_ATTEMPTS'];

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
			if (!REFUS_DE_BETTER_AUTH.includes((erreur as { body?: { code?: string } }).body?.code ?? '')) console.error('Connexion par code en échec', erreur);
			return refus(CODE_REFUSE);
		}
		redirect(303, '/');
	}
};
