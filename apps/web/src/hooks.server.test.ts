import { describe, expect, it, vi } from 'vitest';
import { ENTETES, personne, session } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { creerAuth } from '#lib/server/auth.ts';
import { envoiRefuse } from '#lib/server/taille-envoi.ts';
import { handle, handleError } from './hooks.server.ts';

const SECRET = 'secret-de-test-assez-long-pour-better-auth';
const H = vi.hoisted(() => {
	(globalThis as Record<string, unknown>).__sveltekit_cloudflare_platform = { env: { BETTER_AUTH_SECRET: 'secret-de-test-assez-long-pour-better-auth', BETTER_AUTH_URL: 'http://localhost', BASE: {}, PHOTOS: {} } };
	return { base: null as unknown };
});
vi.mock('@gyro-caserne/socle', async (origine) => ({ ...(await origine<Record<string, unknown>>()), creerBaseD1: () => {
		if (H.base === 'en panne') throw new Error('base en panne');
		return H.base;
	}, creerBasePhotos: () => ({}) }));
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
		const event = { request: envoi(5 * MO), url: new URL('http://x/echanges/vie'), route: { id: '/echanges/[mur]' }, cookies: { get: () => undefined }, locals: {} };
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
		return { event: { request, url: new URL(request.url), route: { id: null }, cookies, locals }, locals };
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

// Une ligne par requête au journal de Cloudflare (décision 0037), écrite avant le travail : la page, même si Cloudflare coupe ensuite.
describe('page au journal', () => {
	const evenement = (chemin: string, route: string | null, options: { method?: string; isSubRequest?: boolean } = {}) => {
		const request = new Request(`http://localhost${chemin}`, { method: options.method ?? 'GET' });
		const cookies = { get: () => undefined, set: vi.fn(), delete: vi.fn() };
		return { request, url: new URL(request.url), route: { id: route }, isSubRequest: options.isSubRequest ?? false, cookies, locals: {} as App.Locals };
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const traiter = (event: object, resolve = async () => new Response('ok')) => handle({ event: event as any, resolve });

	it('écrit le modèle de la page avant d’ouvrir la base, même si la suite échoue', async () => {
		const journal = vi.spyOn(console, 'log').mockImplementation(() => {});
		// La base ne s'ouvre pas : rien d'autre n'a lieu, ni session ni page.
		H.base = 'en panne';
		const resolve = vi.fn();
		await expect(traiter(evenement('/agents/42?courriel=alice@exemple.fr', '/agents/[id]'), resolve)).rejects.toThrow('base en panne');
		expect(resolve).not.toHaveBeenCalled();
		expect(journal.mock.calls).toEqual([['Page GET /agents/[id]']]);
		journal.mockRestore();
	});

	it('écrit aussi l’action d’un formulaire, une adresse de Better Auth et un envoi refusé, sans le reste de l’adresse', async () => {
		const journal = vi.spyOn(console, 'log').mockImplementation(() => {});
		H.base = await baseDeTest();
		await traiter(evenement('/echanges?/souhaiter', '/echanges', { method: 'POST' }));
		await traiter(evenement('/api/auth/ok?token=jeton-secret', null));
		// Un envoi trop lourd, refusé avant tout le reste.
		const lourd = evenement('/echanges/vie?/publier', '/echanges/[mur]', { method: 'POST' });
		lourd.request = new Request(lourd.request.url, { method: 'POST', body: 'x', headers: { 'content-length': String(3 * MO) } });
		expect((await traiter(lourd)).status).toBe(413);
		expect(journal.mock.calls).toEqual([['Page POST /echanges?/souhaiter'], ['Page GET /api/auth'], ['Page POST /echanges/[mur]?/publier']]);
		journal.mockRestore();
	});

	it('rien pour une requête interne de l’appli à elle-même : elle est déjà comptée', async () => {
		const journal = vi.spyOn(console, 'log').mockImplementation(() => {});
		H.base = await baseDeTest();
		await traiter(evenement('/moi', '/moi', { isSubRequest: true }));
		expect(journal).not.toHaveBeenCalled();
		journal.mockRestore();
	});
});

// Le journal du Worker est gardé par Cloudflare (décision 0036) : une erreur imprévue y part résumée, sans les valeurs de la requête.
describe('erreur imprévue', () => {
	const evenement = (route: string | null) => ({ route: { id: route } }) as Parameters<typeof handleError>[0]['event'];

	it('écrit la page en cause et l’erreur sans ses valeurs', () => {
		const console_ = vi.spyOn(console, 'error').mockImplementation(() => {});
		const erreur = new Error('Failed query: select * from "personne" where "email" = ?\nparams: alice.martin@exemple.fr');
		handleError({ kind: 'unknown', error: erreur, event: evenement('/agents/[id]') });
		expect(console_).toHaveBeenCalledTimes(1);
		const ecrit = console_.mock.calls[0]!.join(' ');
		expect(ecrit).toContain('/agents/[id]');
		expect(ecrit).toContain('Failed query');
		expect(ecrit).not.toContain('alice.martin');
		console_.mockRestore();
	});

	it('n’écrit rien pour une page introuvable ou un refus voulu', () => {
		const console_ = vi.spyOn(console, 'error').mockImplementation(() => {});
		handleError({ kind: 'framework', error: { status: 404, message: 'Not found: /agenda/cle-secrete.ics' }, event: evenement(null) });
		handleError({ kind: 'app', error: { status: 404, message: 'Introuvable' }, event: evenement('/agents/[id]') });
		expect(console_).not.toHaveBeenCalled();
		console_.mockRestore();
	});
});
