import { describe, expect, it, vi } from 'vitest';
import { ENTETES, personne, session } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { creerAuth } from '#lib/server/auth.ts';
import { envoiRefuse } from '#lib/server/taille-envoi.ts';
import { handle } from './hooks.server.ts';

const SECRET = 'secret-de-test-assez-long-pour-better-auth';
const H = vi.hoisted(() => {
	(globalThis as Record<string, unknown>).__sveltekit_cloudflare_platform = { env: { BETTER_AUTH_SECRET: 'secret-de-test-assez-long-pour-better-auth', BETTER_AUTH_URL: 'http://localhost', BASE: {}, PHOTOS: {} } };
	return { base: null as unknown };
});
vi.mock('@gyro-caserne/socle', async (origine) => ({ ...(await origine<Record<string, unknown>>()), creerBaseD1: () => H.base, creerBasePhotos: () => ({}) }));
vi.mock('#lib/server/auth.ts', async (origine) => {
	const m = await origine<typeof import('#lib/server/auth.ts')>();
	return { ...m, creerAuth: vi.fn(m.creerAuth) };
});

const MO = 1024 * 1024;
const envoi = (longueur: number | null, type = 'application/x-www-form-urlencoded', methode = 'POST') => {
	const request = new Request('http://x/echanges/vie', { method: methode, body: 'x', headers: { 'content-type': type } });
	if (longueur === null) request.headers.delete('content-length');
	else request.headers.set('content-length', String(longueur));
	return request;
};

describe('taille des envois, pour toutes les routes', () => {
	it('refuse en 413, avant toute lecture, un envoi sans longueur ou de plus de 2 Mo', async () => {
		const sans = envoiRefuse(envoi(null), '/echanges/vie');
		expect(sans?.status).toBe(413);
		expect(await sans!.text()).toBe('Envoi trop lourd : 2 Mo au plus.');
		expect(envoiRefuse(envoi(2 * MO + 1), '/echanges/vie')?.status).toBe(413);
		expect(envoiRefuse(envoi(-1), '/echanges/vie')?.status).toBe(413);
		expect(envoiRefuse(envoi(2 * MO), '/echanges/vie')).toBeNull();
		for (const methode of ['PUT', 'PATCH', 'DELETE']) expect(envoiRefuse(envoi(3 * MO, 'text/plain', methode), '/x')?.status).toBe(413);
	});

	it('laisse passer les lectures et les envois sans corps', () => {
		expect(envoiRefuse(new Request('http://x/'), '/')).toBeNull();
		expect(envoiRefuse(new Request('http://x/', { method: 'HEAD' }), '/')).toBeNull();
		expect(envoiRefuse(new Request('http://x/deconnexion', { method: 'POST' }), '/deconnexion')).toBeNull();
	});

	it('aperçu du fichier des agents : 4 Mo, réponse en JSON', async () => {
		expect(envoiRefuse(envoi(3 * MO, 'application/json'), '/agents/fichier/apercu')).toBeNull();
		const refus = envoiRefuse(envoi(4 * MO + 1, 'application/json'), '/agents/fichier/apercu');
		expect(refus?.status).toBe(413);
		expect(await refus!.json()).toEqual({ message: 'Envoi trop lourd : 4 Mo au plus.' });
		expect(envoiRefuse(envoi(3 * MO, 'application/json'), '/agents/fichier/operation')?.status).toBe(413);
	});

	it('un fichier de 2 000 lignes aux champs les plus longs, avec 20 colonnes de rôles, tient dans la limite de l’aperçu', () => {
		const cellules = ['99999', `${'é'.repeat(126)}@x.fr`, 'é'.repeat(60), 'é'.repeat(60), 'Lieutenant hors classe', '01/06/2020', 'Équipe 12', 'Inapte temporaire', 'Chef de centre adjoint', '+33 6 12 34 56 78 9', '12/03/1985', '01/09/2005', '01/09/2005', ...Array<string>(20).fill('Trésorier adjoint')];
		const entetes = [...ENTETES, ...Array.from({ length: 20 }, (_, i) => `Comité : Comité n° ${i}`)];
		const corps = JSON.stringify({ entetes, lignes: Array.from({ length: 2000 }, (_, i) => ({ numero: i + 2, cellules })), repere: { journal: 123456, personne: 2345, date: '2026-10-28' } });
		const longueur = new TextEncoder().encode(corps).byteLength;
		expect(longueur).toBeGreaterThan(2 * MO);
		expect(envoiRefuse(envoi(longueur, 'application/json'), '/agents/fichier/apercu')).toBeNull();
	});

	it('appliquée par les hooks avant la session et la route', async () => {
		const resolve = vi.fn();
		const event = { request: envoi(5 * MO), url: new URL('http://x/echanges/vie'), cookies: { get: () => undefined }, locals: {} };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const reponse = await handle({ event: event as any, resolve });
		expect(reponse.status).toBe(413);
		expect(resolve).not.toHaveBeenCalled();
	});
});

describe('session lue par le hook, sans créer Better Auth', () => {
	// Un agent connecté par son lien : la base et l'en-tête Cookie de son navigateur.
	async function connecte(statut: 'operationnel' | 'suspendu' | 'parti' = 'operationnel') {
		const base = await baseDeTest();
		H.base = base;
		const [p] = await base.insert(personne).values({ email: 'agent@exemple.fr', prenom: 'A', nom: 'G' }).returning({ id: personne.id });
		const taches: Promise<unknown>[] = [];
		const envoyer = vi.fn(async (_env: unknown, _m: { a: string; sujet: string; texte: string }) => {});
		const auth = creerAuth({ BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: 'http://localhost' }, base, (t) => taches.push(t), envoyer);
		await auth.api.signInMagicLink({ body: { email: 'agent@exemple.fr', callbackURL: '/' }, headers: new Headers() });
		await Promise.all(taches);
		const jeton = new URL(envoyer.mock.calls[0]![1].texte.match(/https?:\/\/\S+/)![0]).searchParams.get('token')!;
		const { headers } = await auth.api.magicLinkVerify({ query: { token: jeton }, headers: new Headers(), returnHeaders: true });
		if (statut !== 'operationnel') await base.update(personne).set({ statut });
		vi.mocked(creerAuth).mockClear();
		return { base, id: p!.id, cookie: headers.get('set-cookie')!.split(';')[0]! };
	}

	function requete(chemin: string, cookie: string) {
		const request = new Request(`http://localhost${chemin}`, { headers: cookie ? { cookie } : {} });
		const [nom, valeur] = [cookie.slice(0, cookie.indexOf('=')), decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1))];
		const locals = {} as App.Locals;
		const cookies = { get: (n: string) => (cookie && n === nom ? valeur : undefined), set: vi.fn(), delete: vi.fn() };
		return { event: { request, url: new URL(request.url), cookies, locals }, locals };
	}

	it('une page : l’agent reconnu, et Better Auth jamais créé', async () => {
		const { cookie, id } = await connecte();
		const { event, locals } = requete('/moi', cookie);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await handle({ event: event as any, resolve: async () => new Response('ok') });
		expect(locals.acteur).toEqual({ type: 'personne', id });
		expect(creerAuth).not.toHaveBeenCalled();
	});

	it('agent suspendu ou parti : pas d’acteur', async () => {
		for (const statut of ['suspendu', 'parti'] as const) {
			const { cookie } = await connecte(statut);
			const { event, locals } = requete('/', cookie);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await handle({ event: event as any, resolve: async () => new Response('ok') });
			expect(locals.acteur).toBeNull();
		}
	});

	it('Better Auth créé au premier usage de locals.auth seulement, une fois', async () => {
		const { cookie } = await connecte();
		const { event, locals } = requete('/connexion', cookie);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await handle({ event: event as any, resolve: async () => new Response(String(locals.auth === locals.auth)) });
		expect(creerAuth).toHaveBeenCalledTimes(1);
	});

	it('une adresse de Better Auth : il répond lui-même, la session n’est pas lue ni prolongée', async () => {
		const { base, cookie } = await connecte();
		const echeance = new Date(Date.now() + 88 * 86_400_000);
		await base.update(session).set({ expiresAt: echeance });
		const { event, locals } = requete('/api/auth/ok', cookie);
		const resolve = vi.fn();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const reponse = await handle({ event: event as any, resolve });
		expect(await reponse.json()).toEqual({ ok: true });
		expect(resolve).not.toHaveBeenCalled();
		expect(locals.acteur).toBeNull();
		expect((await base.select().from(session))[0]!.expiresAt).toEqual(echeance);
	});
});
