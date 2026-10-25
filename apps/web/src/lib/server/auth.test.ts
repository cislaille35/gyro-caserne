import { describe, expect, it, vi } from 'vitest';
import { acteurDe, changerStatut, personne, user, verification } from '@gyro-caserne/socle';
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

	it('ne part pas pour une adresse inconnue, et n’en garde aucune trace', async () => {
		const { base, envoyer, demander } = await jeu();
		await demander('inconnu@exemple.fr');
		expect(envoyer).not.toHaveBeenCalled();
		expect(await base.select().from(verification)).toHaveLength(0);
	});
});

describe('un lien par minute et par adresse', () => {
	it('ne renvoie rien moins de 60 s après, et le premier lien reste valable', async () => {
		const { base, auth, envoyer, demander, dernierJeton } = await jeu();
		await demander('agent@exemple.fr');
		const jeton = dernierJeton();
		await demander('agent@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(1);
		expect(await base.select().from(verification)).toHaveLength(1);
		const reponse = await auth.api.magicLinkVerify({ query: { token: jeton }, headers: entetes });
		expect(reponse.user.email).toBe('agent@exemple.fr');
	});

	it('n’envoie qu’un lien pour un double clic', async () => {
		const { auth, envoyer, taches } = await jeu();
		const demande = () => auth.api.signInMagicLink({ body: { email: 'agent@exemple.fr', callbackURL: '/' }, headers: entetes });
		await Promise.all([demande(), demande()]);
		await Promise.all(taches);
		expect(envoyer).toHaveBeenCalledTimes(1);
	});

	it('renvoie un lien après 60 s', async () => {
		const { base, envoyer, demander } = await jeu();
		await demander('agent@exemple.fr');
		await base.update(verification).set({ createdAt: new Date(Date.now() - 61_000) });
		await demander('agent@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(2);
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

describe('connexion par le lien', () => {
	it('ne crée pas de compte pour une adresse non autorisée', async () => {
		const { base, auth, demander, dernierJeton } = await jeu();
		await demander('agent@exemple.fr');
		// Le jeton en base désigne désormais une adresse inconnue.
		await base.update(verification).set({ value: JSON.stringify({ type: 'magic-link', email: 'inconnu@exemple.fr' }) });
		await expect(auth.api.magicLinkVerify({ query: { token: dernierJeton() }, headers: entetes })).rejects.toThrow();
		expect(await base.select().from(user)).toHaveLength(0);
	});

	it('un agent suspendu après sa connexion n’a plus accès', async () => {
		const { base, auth, demander, dernierJeton } = await jeu();
		await demander('agent@exemple.fr');
		const { headers } = await auth.api.magicLinkVerify({ query: { token: dernierJeton() }, headers: entetes, returnHeaders: true });
		const cookie = new Headers({ cookie: headers.get('set-cookie')!.split(';')[0]! });
		expect(await auth.api.getSession({ headers: cookie })).not.toBeNull();

		const [agent] = await base.select().from(personne);
		await changerStatut(base, { type: 'super', email: 'admin@exemple.fr' }, agent!.id, 'suspendu', '2026-10-25');
		expect(await auth.api.getSession({ headers: cookie })).toBeNull();
		expect(await acteurDe(base, 'agent@exemple.fr', [])).toBeNull();
	});
});
