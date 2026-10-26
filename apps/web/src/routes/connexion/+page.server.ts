import { normaliserAdresse } from '@gyro-caserne/socle';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const email = normaliserAdresse(String((await request.formData()).get('email') ?? ''));
		try {
			if (email) await locals.auth.api.signInMagicLink({ body: { email, callbackURL: '/' }, headers: request.headers });
		} catch (erreur) {
			// Même message dans tous les cas : un échec ne doit pas révéler qu'une adresse est autorisée.
			console.error('Lien de connexion non envoyé', erreur);
		}
		return { envoye: true };
	}
};
