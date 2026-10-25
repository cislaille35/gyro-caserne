import { describe, expect, it, vi } from 'vitest';
import { personne, verification } from '@gyro-caserne/socle';
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
	// Jeton du dernier lien envoyé.
	const dernierJeton = () => new URL(envoyer.mock.calls.at(-1)![1].texte.split('\n')[1]!).searchParams.get('token')!;
	return { base, auth, envoyer, taches, demander, dernierJeton };
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

describe('jeton du lien', () => {
	it('est gardé haché en base, et le lien connecte', async () => {
		const { base, auth, demander, dernierJeton } = await jeu();
		await demander('agent@exemple.fr');
		const jeton = dernierJeton();
		const lignes = await base.select().from(verification);
		expect(lignes).toHaveLength(1);
		expect(lignes[0]!.identifier).not.toContain(jeton);
		const reponse = await auth.api.magicLinkVerify({ query: { token: jeton }, headers: entetes });
		expect(reponse.user.email).toBe('agent@exemple.fr');
	});
});
