import { describe, expect, it, vi } from 'vitest';
import { personne } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { creerAuth } from './auth.ts';

const env = { BETTER_AUTH_SECRET: 'secret-de-test-assez-long-pour-better-auth', BETTER_AUTH_URL: 'http://localhost' };
const entetes = new Headers();

async function jeu() {
	const base = await baseDeTest();
	await base.insert(personne).values({ email: 'agent@exemple.fr', prenom: 'A', nom: 'G' });
	const taches: Promise<unknown>[] = [];
	const envoyer = vi.fn(async (_env: unknown, _m: { a: string; sujet: string; texte: string }) => {});
	const auth = creerAuth(env, base, (p) => taches.push(p), envoyer);
	// Demande un lien puis attend les tâches de fond.
	const demander = async (email: string) => {
		await auth.api.signInMagicLink({ body: { email, callbackURL: '/' }, headers: entetes });
		await Promise.all(taches.splice(0));
	};
	return { base, auth, envoyer, taches, demander };
}

describe('lien de connexion', () => {
	it('répond sans attendre l’envoi du courriel', async () => {
		const { auth, envoyer, taches } = await jeu();
		envoyer.mockImplementation(() => new Promise(() => {}));
		await auth.api.signInMagicLink({ body: { email: 'agent@exemple.fr', callbackURL: '/' }, headers: entetes });
		expect(taches).toHaveLength(1);
	});

	it('part pour une adresse autorisée', async () => {
		const { envoyer, demander } = await jeu();
		await demander('agent@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(1);
		expect(envoyer.mock.calls[0]![1].a).toBe('agent@exemple.fr');
	});

	it('ne part pas pour une adresse inconnue', async () => {
		const { envoyer, demander } = await jeu();
		await demander('inconnu@exemple.fr');
		expect(envoyer).not.toHaveBeenCalled();
	});
});
