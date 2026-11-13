import { describe, expect, it, vi } from 'vitest';
import { personne, session } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { creerAuth } from './auth.ts';
import { lireSession } from './session.ts';

const env = { BETTER_AUTH_SECRET: 'secret-de-test-assez-long-pour-better-auth', BETTER_AUTH_URL: 'http://localhost' };
const JOUR = 86_400_000;

// Un agent connecté par son lien : l'en-tête Cookie que son navigateur renvoie.
async function connecte() {
	const base = await baseDeTest();
	await base.insert(personne).values({ email: 'agent@exemple.fr', prenom: 'A', nom: 'G' });
	const taches: Promise<unknown>[] = [];
	const envoyer = vi.fn(async (_env: unknown, _m: { a: string; sujet: string; texte: string }) => {});
	const auth = creerAuth(env, base, (p) => taches.push(p), envoyer);
	await auth.api.signInMagicLink({ body: { email: 'agent@exemple.fr', callbackURL: '/' }, headers: new Headers() });
	await Promise.all(taches);
	const jeton = new URL(envoyer.mock.calls[0]![1].texte.split('\n')[1]!).searchParams.get('token')!;
	const { headers } = await auth.api.magicLinkVerify({ query: { token: jeton }, headers: new Headers(), returnHeaders: true });
	const requete = new Request('http://localhost/', { headers: { cookie: headers.get('set-cookie')!.split(';')[0]! } });
	const cookies = { set: vi.fn() };
	return { base, auth, requete, cookies };
}

describe('lireSession', () => {
	it('rend la session, sans réécrire le cookie le jour même', async () => {
		const { auth, requete, cookies } = await connecte();
		expect((await lireSession(auth, requete, cookies))?.user.email).toBe('agent@exemple.fr');
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('après un jour d’usage, renvoie au navigateur le cookie prolongé de 90 jours', async () => {
		const { base, auth, requete, cookies } = await connecte();
		await base.update(session).set({ expiresAt: new Date(Date.now() + 88 * JOUR) });
		await lireSession(auth, requete, cookies);
		expect(cookies.set).toHaveBeenCalledTimes(1);
		const [nom, valeur, options] = cookies.set.mock.calls[0]!;
		expect(nom).toBe('better-auth.session_token');
		expect(requete.headers.get('cookie')).toBe(`${nom}=${encodeURIComponent(valeur)}`);
		expect(options).toMatchObject({ maxAge: 90 * 86_400, httpOnly: true, path: '/', sameSite: 'lax' });
	});

	it('sans cookie : null, rien d’écrit', async () => {
		const { auth, cookies } = await connecte();
		expect(await lireSession(auth, new Request('http://localhost/'), cookies)).toBeNull();
		expect(cookies.set).not.toHaveBeenCalled();
	});
});
