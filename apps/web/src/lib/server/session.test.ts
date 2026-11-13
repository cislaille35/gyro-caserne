import { describe, expect, it, vi } from 'vitest';
import { parseSetCookieHeader } from 'better-auth/cookies';
import { sql } from 'drizzle-orm';
import { personne, session, user } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { creerAuth } from './auth.ts';
import { estAdresseDeBetterAuth, lireSession } from './session.ts';

const SECRET = 'secret-de-test-assez-long-pour-better-auth';
const local = { BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: 'http://localhost' };
const enLigne = { BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: 'https://caserne.exemple.fr' };
const JOUR = 86_400_000;

// Les cookies d'une requête, comme SvelteKit les lit (valeurs décodées) ; set et delete espionnés.
function bocal(entete: string) {
	const valeurs = new Map(entete ? entete.split('; ').map((c) => [c.slice(0, c.indexOf('=')), decodeURIComponent(c.slice(c.indexOf('=') + 1))]) : []);
	return { get: (nom: string) => valeurs.get(nom), set: vi.fn(), delete: vi.fn() };
}

// Signature d'un cookie comme Better Auth : HMAC-SHA256 du jeton, en base64.
async function signer(valeur: string, secret = SECRET) {
	const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return `${valeur}.${btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(valeur)))))}`;
}

// Un agent connecté par Better Auth, par son lien ou par son code : l'en-tête Cookie que son navigateur renvoie.
async function connecte(env = local, par: 'lien' | 'code' = 'lien') {
	const base = await baseDeTest();
	await base.insert(personne).values({ email: 'agent@exemple.fr', prenom: 'A', nom: 'G' });
	const taches: Promise<unknown>[] = [];
	const envoyer = vi.fn(async (_env: unknown, _m: { a: string; sujet: string; texte: string }) => {});
	const auth = creerAuth(env, base, (p) => taches.push(p), envoyer);
	await auth.api.signInMagicLink({ body: { email: 'agent@exemple.fr', callbackURL: '/' }, headers: new Headers() });
	await Promise.all(taches);
	const texte = envoyer.mock.calls[0]![1].texte;
	const { headers } =
		par === 'lien'
			? await auth.api.magicLinkVerify({ query: { token: new URL(texte.match(/https?:\/\/\S+/)![0]).searchParams.get('token')! }, headers: new Headers(), returnHeaders: true })
			: await auth.api.signInEmailOTP({ body: { email: 'agent@exemple.fr', otp: texte.match(/code de connexion : (\d{6})/)![1]! }, headers: new Headers(), returnHeaders: true });
	const cookie = headers.get('set-cookie')!.split(';')[0]!;
	const [nom, valeur] = [cookie.slice(0, cookie.indexOf('=')), decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1))];
	return { base, auth, env, cookie, nom, valeur, jeton: valeur.slice(0, valeur.lastIndexOf('.')) };
}

const echeance = async (base: Awaited<ReturnType<typeof baseDeTest>>) => (await base.select({ e: session.expiresAt }).from(session))[0]?.e.getTime();

describe('lireSession', () => {
	it('un cookie posé par le lien de connexion : l’adresse de l’agent, sans cookie réécrit le jour même', async () => {
		const { base, cookie } = await connecte();
		const cookies = bocal(cookie);
		expect(await lireSession(base, local, cookies)).toEqual({ email: 'agent@exemple.fr' });
		expect(cookies.set).not.toHaveBeenCalled();
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('un cookie posé par le code à 6 chiffres est lu aussi', async () => {
		const { base, cookie } = await connecte(local, 'code');
		expect(await lireSession(base, local, bocal(cookie))).toEqual({ email: 'agent@exemple.fr' });
	});

	it('en ligne (https) : cookie préfixé __Secure-, prolongé avec l’attribut Secure', async () => {
		const { base, cookie, nom, valeur } = await connecte(enLigne);
		expect(nom).toBe('__Secure-better-auth.session_token');
		await base.update(session).set({ expiresAt: new Date(Date.now() + 88 * JOUR) });
		const cookies = bocal(cookie);
		expect(await lireSession(base, enLigne, cookies)).toEqual({ email: 'agent@exemple.fr' });
		expect(cookies.set).toHaveBeenCalledWith(nom, valeur, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 90 * 86_400 });
		// Le même cookie sans préfixe n'est pas lu en ligne.
		expect(await lireSession(base, enLigne, bocal(`better-auth.session_token=${encodeURIComponent(valeur)}`))).toBeNull();
	});

	it('signature fausse, tronquée ou d’un autre secret : rien, sans lire la base', async () => {
		const { valeur, jeton, nom } = await connecte();
		const sansBase = {} as never;
		const fausse = `${jeton}.${'A'.repeat(43)}=`;
		for (const v of [fausse, jeton, `${jeton}.`, `${jeton}.${valeur.slice(-20)}`]) {
			expect(await lireSession(sansBase, local, bocal(`${nom}=${encodeURIComponent(v)}`))).toBeNull();
		}
		const base = (await connecte()).base;
		expect(await lireSession(base, local, bocal(`${nom}=${encodeURIComponent(await signer(jeton, 'un-autre-secret-assez-long-pour-better-auth'))}`))).toBeNull();
	});

	it('sans cookie : rien, sans lire la base', async () => {
		const cookies = bocal('');
		expect(await lireSession({} as never, local, cookies)).toBeNull();
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('jeton bien signé mais inconnu : rien, et les cookies de session effacés', async () => {
		const { base, nom } = await connecte();
		const cookies = bocal(`${nom}=${encodeURIComponent(await signer('jeton-inconnu'))}`);
		expect(await lireSession(base, local, cookies)).toBeNull();
		expect(cookies.delete).toHaveBeenCalledWith(nom, { httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
		expect(cookies.delete.mock.calls.map(([n]) => n)).toEqual([nom, 'better-auth.session_data', 'better-auth.dont_remember']);
	});

	it('session expirée : rien, la session effacée de la base et les cookies aussi', async () => {
		const { base, cookie, nom } = await connecte();
		await base.update(session).set({ expiresAt: new Date(Date.now() - 1000) });
		const cookies = bocal(cookie);
		expect(await lireSession(base, local, cookies)).toBeNull();
		expect(await base.select().from(session)).toEqual([]);
		expect(cookies.delete).toHaveBeenCalledWith(nom, expect.anything());
	});

	it('session dont l’utilisateur n’existe plus : rien, cookies effacés, la ligne gardée (comme Better Auth)', async () => {
		const { base, cookie } = await connecte();
		await base.run(sql`PRAGMA foreign_keys = OFF`);
		await base.delete(user);
		const cookies = bocal(cookie);
		expect(await lireSession(base, local, cookies)).toBeNull();
		expect(cookies.delete).toHaveBeenCalledTimes(3);
		expect(await base.select().from(session)).toHaveLength(1);
	});

	it('session effacée pendant sa prolongation (déconnexion au même instant ailleurs) : rien, cookies effacés', async () => {
		const { base, cookie } = await connecte();
		await base.update(session).set({ expiresAt: new Date(Date.now() + 88 * JOUR) });
		// La mise à jour ne trouve plus la ligne.
		await base.run(sql`create trigger disparue before update on session begin select raise(ignore); end`);
		const cookies = bocal(cookie);
		expect(await lireSession(base, local, cookies)).toBeNull();
		expect(cookies.set).not.toHaveBeenCalled();
		expect(cookies.delete).toHaveBeenCalledTimes(3);
	});

	it('secret vide : refusé net, plutôt que des sessions jamais reconnues sans bruit', async () => {
		await expect(lireSession({} as never, { ...local, BETTER_AUTH_SECRET: '' }, bocal('better-auth.session_token=x.y'))).rejects.toThrow();
	});

	it('déconnexion par Better Auth, ou de tous les appareils : le cookie ne vaut plus rien', async () => {
		const un = await connecte();
		await un.auth.api.signOut({ headers: new Headers({ cookie: un.cookie }) });
		expect(await lireSession(un.base, local, bocal(un.cookie))).toBeNull();

		// Un second appareil : une autre session du même agent.
		const telephone = await connecte();
		const [{ userId, expiresAt }] = (await telephone.base.select().from(session)) as [typeof session.$inferSelect];
		await telephone.base.insert(session).values({ id: 'ordinateur', token: 'jeton-ordinateur', userId, expiresAt, updatedAt: new Date() });
		const ordinateur = `${telephone.nom}=${encodeURIComponent(await signer('jeton-ordinateur'))}`;
		expect(await lireSession(telephone.base, local, bocal(ordinateur))).toEqual({ email: 'agent@exemple.fr' });
		await telephone.auth.api.revokeSessions({ headers: new Headers({ cookie: telephone.cookie }) });
		expect(await lireSession(telephone.base, local, bocal(telephone.cookie))).toBeNull();
		expect(await lireSession(telephone.base, local, bocal(ordinateur))).toBeNull();
	});

	it('après plus d’un jour d’usage : échéance repoussée à 90 jours en base et cookie renvoyé', async () => {
		const { base, cookie, nom, valeur } = await connecte();
		await base.update(session).set({ expiresAt: new Date(Date.now() + 88 * JOUR) });
		const cookies = bocal(cookie);
		expect(await lireSession(base, local, cookies)).toEqual({ email: 'agent@exemple.fr' });
		expect(cookies.set).toHaveBeenCalledExactlyOnceWith(nom, valeur, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 90 * 86_400 });
		expect(await echeance(base)).toBeGreaterThan(Date.now() + 90 * JOUR - 5000);
	});

	it('moins d’un jour après la dernière prolongation : ni base ni cookie touchés', async () => {
		const { base, cookie } = await connecte();
		const avant = Date.now() + 89 * JOUR + JOUR / 2;
		await base.update(session).set({ expiresAt: new Date(avant) });
		const cookies = bocal(cookie);
		await lireSession(base, local, cookies);
		expect(cookies.set).not.toHaveBeenCalled();
		expect(await echeance(base)).toBe(avant);
	});

	it('« ne pas se souvenir de moi » (cookie signé de Better Auth) : pas de prolongation', async () => {
		const { base, cookie } = await connecte();
		await base.update(session).set({ expiresAt: new Date(Date.now() + 88 * JOUR) });
		const cookies = bocal(`${cookie}; better-auth.dont_remember=${encodeURIComponent(await signer('true'))}`);
		expect(await lireSession(base, local, cookies)).toEqual({ email: 'agent@exemple.fr' });
		expect(cookies.set).not.toHaveBeenCalled();
		// Mal signé : ignoré, la session est prolongée.
		const autres = bocal(`${cookie}; better-auth.dont_remember=${encodeURIComponent(await signer('true', 'un-autre-secret-assez-long-pour-better-auth'))}`);
		await lireSession(base, local, autres);
		expect(autres.set).toHaveBeenCalledOnce();
	});
});

// Garde-fou à chaque mise à jour de Better Auth : notre lecture rend ce que rendait auth.api.getSession.
describe('même résultat que getSession de Better Auth', () => {
	const sesCookies = (h: Headers) => parseSetCookieHeader(h.get('set-cookie') ?? '');

	// Attributs d'un cookie, comme Better Auth les écrit ou comme SvelteKit les écrirait avec nos options.
	const attributs = (a: { secure?: boolean; httponly?: boolean; samesite?: string; path?: string; 'max-age'?: number }) => ({ secure: a.secure ?? false, httpOnly: a.httponly, sameSite: a.samesite, path: a.path, maxAge: a['max-age'] });

	for (const env of [local, enLigne]) {
		it(`session valable, puis à prolonger : même agent, même cookie renvoyé (${env.BETTER_AUTH_URL})`, async () => {
			const { base, auth, cookie, nom } = await connecte(env);
			const leur = await auth.api.getSession({ headers: new Headers({ cookie }) });
			expect(await lireSession(base, env, bocal(cookie))).toEqual({ email: leur!.user.email });

			await base.update(session).set({ expiresAt: new Date(Date.now() + 88 * JOUR) });
			const { headers } = await auth.api.getSession({ headers: new Headers({ cookie }), returnHeaders: true });
			const attendu = sesCookies(headers).get(nom)!;
			await base.update(session).set({ expiresAt: new Date(Date.now() + 88 * JOUR) });
			const cookies = bocal(cookie);
			await lireSession(base, env, cookies);
			const [, valeur, options] = cookies.set.mock.calls[0]!;
			expect(valeur).toBe(attendu.value);
			expect(options).toEqual(attributs(attendu));
		});

		it(`jeton inconnu, session expirée, signature fausse : rien des deux côtés, mêmes cookies effacés (${env.BETTER_AUTH_URL})`, async () => {
			for (const cas of ['inconnu', 'expiree', 'signature'] as const) {
				const { base, auth, cookie, nom, jeton } = await connecte(env);
				const entete = cas === 'inconnu' ? `${nom}=${encodeURIComponent(await signer('x'))}` : cas === 'signature' ? `${nom}=${jeton}.${'B'.repeat(43)}=` : cookie;
				if (cas === 'expiree') await base.update(session).set({ expiresAt: new Date(Date.now() - 1000) });
				const [ligne] = await base.select().from(session);
				const { headers, response } = await auth.api.getSession({ headers: new Headers({ cookie: entete }), returnHeaders: true });
				expect(response).toBeNull();
				// Better Auth a effacé la session expirée : on la remet pour notre lecture.
				await base.insert(session).values(ligne!).onConflictDoNothing();
				const cookies = bocal(entete);
				expect(await lireSession(base, env, cookies)).toBeNull();
				// cookies.delete de SvelteKit pose Max-Age=0, comme Better Auth.
				const effaces = [...sesCookies(headers)];
				expect(effaces.every(([, a]) => a['max-age'] === 0 && a.value === '')).toBe(true);
				expect(cookies.delete.mock.calls).toEqual(effaces.map(([n, a]) => [n, { ...attributs(a), maxAge: undefined }].map((x) => (typeof x === 'object' ? Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) : x))));
			}
		});
	}
});

describe('estAdresseDeBetterAuth', () => {
	it('les adresses /api/auth/ de l’appli seulement', () => {
		expect(estAdresseDeBetterAuth(new URL('http://localhost/api/auth/magic-link/verify?token=x'), local)).toBe(true);
		expect(estAdresseDeBetterAuth(new URL('http://localhost/api/authentique'), local)).toBe(false);
		expect(estAdresseDeBetterAuth(new URL('http://localhost/moi'), local)).toBe(false);
		expect(estAdresseDeBetterAuth(new URL('http://ailleurs/api/auth/ok'), local)).toBe(false);
	});
});
