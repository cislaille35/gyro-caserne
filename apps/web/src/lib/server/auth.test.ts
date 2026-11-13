import { describe, expect, it, vi } from 'vitest';
import { acteurDe, changerStatut, envoiLien, personne, session, user, verification } from '@gyro-caserne/socle';
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

// Fait comme si le dernier lien envoyé était parti plus tôt.
async function reculer(base: Awaited<ReturnType<typeof jeu>>['base'], ms: number) {
	const [envoi] = await base.select().from(envoiLien);
	await base.update(envoiLien).set({ envoyeLe: new Date(envoi!.envoyeLe.getTime() - ms) });
}

describe('même réponse, adresse connue ou non', () => {
	it('par l’API', async () => {
		const { auth } = await jeu();
		const demande = (email: string) => auth.api.signInMagicLink({ body: { email, callbackURL: '/' }, headers: entetes });
		expect(await demande('inconnu@exemple.fr')).toEqual(await demande('agent@exemple.fr'));
	});

	it('par la route HTTP', async () => {
		const { auth, envoyer, taches } = await jeu();
		const demande = async (email: string) => {
			const reponse = await auth.handler(
				new Request('http://localhost/api/auth/sign-in/magic-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, callbackURL: '/' }) })
			);
			return { statut: reponse.status, corps: await reponse.text() };
		};
		const inconnue = await demande('inconnu@exemple.fr');
		const connue = await demande('agent@exemple.fr');
		await Promise.all(taches);
		expect(connue.statut).toBe(200);
		expect(inconnue).toEqual(connue);
		expect(envoyer).toHaveBeenCalledTimes(1);
	});

	it('même si l’envoi du courriel échoue', async () => {
		const { auth, envoyer, taches } = await jeu();
		const demande = (email: string) => auth.api.signInMagicLink({ body: { email, callbackURL: '/' }, headers: entetes });
		const attendue = await demande('inconnu@exemple.fr');
		envoyer.mockRejectedValueOnce(new Error('panne'));
		const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await demande('agent@exemple.fr')).toEqual(attendue);
		await Promise.all(taches);
		expect(erreurs).toHaveBeenCalled();
		erreurs.mockRestore();
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
		await reculer(base, 61_000);
		await demander('agent@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(2);
	});

	it('un lien en attente, non encore envoyé, ne bloque pas', async () => {
		const { base, envoyer, demander } = await jeu();
		await base.insert(verification).values({ id: 'attente', identifier: 'magic-link:attente', value: JSON.stringify({ type: 'magic-link', email: 'agent@exemple.fr' }), expiresAt: new Date(Date.now() + 300_000) });
		await demander('agent@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(1);
	});

	it('sous un flot de demandes, un lien repart 60 s après le dernier envoyé', async () => {
		const { base, envoyer, demander } = await jeu();
		await demander('agent@exemple.fr');
		for (let i = 0; i < 3; i++) {
			await reculer(base, 15_000);
			await demander('agent@exemple.fr');
		}
		expect(envoyer).toHaveBeenCalledTimes(1);
		// Les demandes refusées sont effacées : seul le lien envoyé reste.
		expect(await base.select().from(verification)).toHaveLength(1);
		await reculer(base, 16_000);
		await demander('agent@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(2);
	});

	it('deux demandes de part et d’autre des 60 s : la seconde part', async () => {
		const { base, envoyer, demander } = await jeu();
		await demander('agent@exemple.fr');
		await reculer(base, 59_900);
		await demander('agent@exemple.fr');
		await reculer(base, 200);
		await demander('agent@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(2);
	});
});

describe('envoi qui échoue', () => {
	it('efface le lien et permet un nouvel essai tout de suite', async () => {
		const { base, envoyer, demander } = await jeu();
		envoyer.mockRejectedValueOnce(new Error('panne'));
		const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {});
		await demander('agent@exemple.fr');
		erreurs.mockRestore();
		expect(await base.select().from(verification)).toHaveLength(0);
		await demander('agent@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(2);
		expect(await base.select().from(verification)).toHaveLength(1);
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

	it.each(['suspendu', 'parti'] as const)('un agent %s après sa connexion n’a plus accès, malgré une session de 90 jours', async (statut) => {
		const { base, auth, demander, dernierJeton } = await jeu();
		await demander('agent@exemple.fr');
		const { headers } = await auth.api.magicLinkVerify({ query: { token: dernierJeton() }, headers: entetes, returnHeaders: true });
		const cookie = new Headers({ cookie: headers.get('set-cookie')!.split(';')[0]! });
		expect(await auth.api.getSession({ headers: cookie })).not.toBeNull();

		const [agent] = await base.select().from(personne);
		await changerStatut(base, base.photos, { type: 'super', email: 'admin@exemple.fr' }, agent!.id, statut, '2026-10-25T10:00');
		expect(await auth.api.getSession({ headers: cookie })).toBeNull();
		expect(await acteurDe(base, 'agent@exemple.fr', [])).toBeNull();
	});
});

describe('session de 90 jours, prolongée à l’usage', () => {
	const JOUR = 86_400_000;
	// Connexion par le lien : rend l'en-tête Cookie du navigateur et l'en-tête Set-Cookie reçu.
	async function connecte() {
		const j = await jeu();
		await j.demander('agent@exemple.fr');
		const { headers } = await j.auth.api.magicLinkVerify({ query: { token: j.dernierJeton() }, headers: entetes, returnHeaders: true });
		const recu = headers.get('set-cookie')!;
		return { ...j, recu, cookie: new Headers({ cookie: recu.split(';')[0]! }) };
	}

	it('à la connexion, le cookie et la session valent 90 jours', async () => {
		const { base, recu } = await connecte();
		expect(recu).toContain('Max-Age=7776000');
		const [s] = await base.select().from(session);
		expect(s!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 89 * JOUR);
	});

	it('moins d’un jour après, rien n’est réécrit', async () => {
		const { auth, cookie } = await connecte();
		const { headers } = await auth.api.getSession({ headers: cookie, returnHeaders: true });
		expect(headers.get('set-cookie')).toBeNull();
	});

	it('plus d’un jour après, la session et le cookie repartent pour 90 jours', async () => {
		const { base, auth, cookie } = await connecte();
		// La session a été ouverte il y a deux jours : il lui en reste 88.
		await base.update(session).set({ expiresAt: new Date(Date.now() + 88 * JOUR) });
		const { headers, response } = await auth.api.getSession({ headers: cookie, returnHeaders: true });
		expect(response).not.toBeNull();
		expect(headers.get('set-cookie')).toContain('Max-Age=7776000');
		const [s] = await base.select().from(session);
		expect(s!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 89 * JOUR);
	});
});
