import { describe, expect, it, vi } from 'vitest';
import { acteurDe, changerStatut, envoiLien, personne, session, user, verification } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { creerAuth } from './auth.ts';

const env = { BETTER_AUTH_SECRET: 'secret-de-test-assez-long-pour-better-auth', BETTER_AUTH_URL: 'http://localhost' };
const entetes = new Headers();
// Les liens en base (le code à 6 chiffres est à part).
const liensEnBase = async (base: Awaited<ReturnType<typeof baseDeTest>>) => (await base.select().from(verification)).filter((v) => v.identifier.startsWith('magic-link:'));

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
	const dernierTexte = () => envoyer.mock.calls.at(-1)![1].texte;
	// Jeton du dernier lien envoyé.
	const dernierJeton = () => new URL(dernierTexte().match(/https?:\/\/\S+/)![0]).searchParams.get('token')!;
	// Code à 6 chiffres du dernier courriel.
	const dernierCode = () => dernierTexte().match(/\b\d{6}\b/)![0];
	const saisir = (otp: string, email = 'agent@exemple.fr') => auth.api.signInEmailOTP({ body: { email, otp }, headers: entetes });
	return { base, auth, envoyer, taches, demander, dernierJeton, dernierCode, saisir };
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
		expect(await liensEnBase(base)).toHaveLength(1);
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
		expect(await liensEnBase(base)).toHaveLength(1);
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
		expect(await liensEnBase(base)).toHaveLength(1);
	});
});

describe('jeton du lien', () => {
	it('est gardé haché en base, et le lien connecte', async () => {
		const { base, auth, demander, dernierJeton } = await jeu();
		await demander('agent@exemple.fr');
		const jeton = dernierJeton();
		const lignes = await liensEnBase(base);
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

describe('se déconnecter de tous ses appareils', () => {
	it('revokeSessions ferme toutes les sessions de l’agent, et seulement les siennes', async () => {
		const { base, auth, demander, dernierJeton, envoyer } = await jeu();
		await base.insert(personne).values({ email: 'autre@exemple.fr', prenom: 'B', nom: 'H' });
		const connecter = async (email: string) => {
			await base.delete(envoiLien);
			await demander(email);
			const { headers } = await auth.api.magicLinkVerify({ query: { token: dernierJeton() }, headers: entetes, returnHeaders: true });
			return new Headers({ cookie: headers.get('set-cookie')!.split(';')[0]! });
		};
		const telephone = await connecter('agent@exemple.fr');
		const ordinateur = await connecter('agent@exemple.fr');
		const autre = await connecter('autre@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(3);
		await auth.api.revokeSessions({ headers: telephone });
		expect(await auth.api.getSession({ headers: telephone })).toBeNull();
		expect(await auth.api.getSession({ headers: ordinateur })).toBeNull();
		expect(await auth.api.getSession({ headers: autre })).not.toBeNull();
	});
});

describe('code à 6 chiffres, dans le même courriel que le lien', () => {
	// Un code différent de celui envoyé.
	const autreQue = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');
	const codesEnBase = async (base: Awaited<ReturnType<typeof jeu>>['base']) => (await base.select().from(verification)).filter((v) => v.identifier.startsWith('sign-in-otp-'));

	it('un seul courriel : le code bien visible, dit à taper dans l’appli, puis le lien', async () => {
		const { envoyer, demander, dernierCode } = await jeu();
		await demander('agent@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(1);
		const texte = envoyer.mock.calls[0]![1].texte;
		const code = dernierCode();
		expect(texte.split('\n')[0]).toContain(code);
		expect(texte).toMatch(/appli/);
		expect(texte.indexOf(code)).toBeLessThan(texte.indexOf('http'));
	});

	it('rien pour une adresse inconnue', async () => {
		const { base, demander } = await jeu();
		await demander('inconnu@exemple.fr');
		expect(await base.select().from(verification)).toHaveLength(0);
	});

	it('gardé en base sous une empreinte liée au secret de l’appli, jamais en clair', async () => {
		const { base, demander, dernierCode } = await jeu();
		await demander('agent@exemple.fr');
		const code = dernierCode();
		const [ligne] = await codesEnBase(base);
		expect(ligne!.value).not.toContain(code);
		// Pas la simple empreinte SHA-256 du code, qu'on retrouverait en essayant le million de codes possibles.
		const sha = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)));
		const shaB64 = btoa(String.fromCharCode(...sha)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		expect(ligne!.value).not.toContain(shaB64);
	});

	it('le bon code connecte, valable 90 jours comme le lien', async () => {
		const { auth, demander, dernierCode } = await jeu();
		await demander('agent@exemple.fr');
		const { headers, response } = await auth.api.signInEmailOTP({ body: { email: 'agent@exemple.fr', otp: dernierCode() }, headers: entetes, returnHeaders: true });
		expect(response.user.email).toBe('agent@exemple.fr');
		expect(headers.get('set-cookie')).toContain('Max-Age=7776000');
	});

	it('un code faux est refusé, et le bon marche encore', async () => {
		const { demander, dernierCode, saisir } = await jeu();
		await demander('agent@exemple.fr');
		const code = dernierCode();
		await expect(saisir(autreQue(code))).rejects.toMatchObject({ body: { code: 'INVALID_OTP' } });
		expect((await saisir(code)).user.email).toBe('agent@exemple.fr');
	});

	it('un code expiré (5 minutes) est refusé', async () => {
		const { base, demander, dernierCode, saisir } = await jeu();
		await demander('agent@exemple.fr');
		const [ligne] = await codesEnBase(base);
		expect(ligne!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 300_000);
		expect(ligne!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 290_000);
		await base.update(verification).set({ expiresAt: new Date(Date.now() - 1000) });
		await expect(saisir(dernierCode())).rejects.toMatchObject({ body: { code: 'OTP_EXPIRED' } });
	});

	it('trois essais faux : le code ne marche plus', async () => {
		const { base, demander, dernierCode, saisir } = await jeu();
		await demander('agent@exemple.fr');
		const code = dernierCode();
		for (let i = 0; i < 3; i++) await expect(saisir(autreQue(code))).rejects.toMatchObject({ body: { code: 'INVALID_OTP' } });
		await expect(saisir(code)).rejects.toMatchObject({ body: { code: 'TOO_MANY_ATTEMPTS' } });
		expect(await codesEnBase(base)).toHaveLength(0);
	});

	it('un code ne sert qu’une fois', async () => {
		const { demander, dernierCode, saisir } = await jeu();
		await demander('agent@exemple.fr');
		const code = dernierCode();
		await saisir(code);
		await expect(saisir(code)).rejects.toMatchObject({ body: { code: 'INVALID_OTP' } });
	});

	it('pour une autre adresse, le code est refusé comme un code faux', async () => {
		const { base, demander, dernierCode, saisir } = await jeu();
		await base.insert(personne).values({ email: 'autre@exemple.fr', prenom: 'B', nom: 'H' });
		await demander('agent@exemple.fr');
		await expect(saisir(dernierCode(), 'autre@exemple.fr')).rejects.toMatchObject({ body: { code: 'INVALID_OTP' } });
		await expect(saisir(dernierCode(), 'inconnu@exemple.fr')).rejects.toMatchObject({ body: { code: 'INVALID_OTP' } });
	});

	it('un courriel par minute : pas de nouveau code, le premier reste valable', async () => {
		const { base, envoyer, demander, dernierCode, saisir } = await jeu();
		await demander('agent@exemple.fr');
		const code = dernierCode();
		await demander('agent@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(1);
		expect(await codesEnBase(base)).toHaveLength(1);
		expect((await saisir(code)).user.email).toBe('agent@exemple.fr');
	});

	it('un nouveau courriel, après la minute : seul le dernier code marche', async () => {
		const { base, envoyer, demander, dernierCode, saisir } = await jeu();
		await demander('agent@exemple.fr');
		const ancien = dernierCode();
		await reculer(base, 61_000);
		await demander('agent@exemple.fr');
		expect(envoyer).toHaveBeenCalledTimes(2);
		const nouveau = dernierCode();
		expect(await codesEnBase(base)).toHaveLength(1);
		if (ancien !== nouveau) await expect(saisir(ancien)).rejects.toMatchObject({ body: { code: 'INVALID_OTP' } });
		expect((await saisir(nouveau)).user.email).toBe('agent@exemple.fr');
	});

	it('si le courriel ne part pas, le code est effacé avec le lien', async () => {
		const { base, envoyer, demander } = await jeu();
		envoyer.mockRejectedValueOnce(new Error('panne'));
		const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {});
		await demander('agent@exemple.fr');
		erreurs.mockRestore();
		expect(await base.select().from(verification)).toHaveLength(0);
	});

	it('le code utilisé, le lien du même courriel ne connecte plus', async () => {
		const { base, auth, demander, dernierCode, dernierJeton, saisir } = await jeu();
		await demander('agent@exemple.fr');
		const jeton = dernierJeton();
		await saisir(dernierCode());
		expect(await liensEnBase(base)).toHaveLength(0);
		// Better Auth renvoie vers la page d'erreur, sans ouvrir de session.
		await expect(auth.api.magicLinkVerify({ query: { token: jeton }, headers: entetes })).rejects.toThrow();
		expect(await base.select().from(session)).toHaveLength(1);
	});

	it('le lien ouvert (Safari sur iPhone), le code reste valable pour l’appli installée', async () => {
		const { auth, demander, dernierCode, dernierJeton, saisir } = await jeu();
		await demander('agent@exemple.fr');
		await auth.api.magicLinkVerify({ query: { token: dernierJeton() }, headers: entetes });
		expect((await saisir(dernierCode())).user.email).toBe('agent@exemple.fr');
	});

	it('par la route HTTP : aucune route du plugin n’est ouverte, le code ne passe que par la page de connexion', async () => {
		const { auth, envoyer, taches } = await jeu();
		const appeler = (chemin: string, corps: object) =>
			auth.handler(new Request(`http://localhost/api/auth${chemin}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify(corps) }));
		for (const chemin of ['/sign-in/email-otp', '/email-otp/send-verification-otp', '/email-otp/check-verification-otp', '/email-otp/verify-email', '/email-otp/request-password-reset', '/forget-password/email-otp', '/email-otp/reset-password', '/email-otp/request-email-change', '/email-otp/change-email']) {
			expect((await appeler(chemin, { email: 'agent@exemple.fr', type: 'sign-in', otp: '000000' })).status, chemin).toBe(404);
		}
		await Promise.all(taches);
		expect(envoyer).not.toHaveBeenCalled();
	});

	it('pas de compte créé par le code pour une adresse qui n’est plus autorisée', async () => {
		const { base, demander, dernierCode, saisir } = await jeu();
		await demander('agent@exemple.fr');
		// La fiche change d'adresse hors de l'appli : le code en attente désigne une adresse inconnue.
		await base.update(personne).set({ email: 'nouvelle@exemple.fr' });
		await expect(saisir(dernierCode())).rejects.toThrow();
		expect(await base.select().from(user)).toHaveLength(0);
	});

	it('un agent suspendu : son code en attente est effacé', async () => {
		const { base, demander, dernierCode, saisir } = await jeu();
		await demander('agent@exemple.fr');
		const [agent] = await base.select().from(personne);
		await changerStatut(base, base.photos, { type: 'super', email: 'admin@exemple.fr' }, agent!.id, 'suspendu', '2026-10-25T10:00');
		await expect(saisir(dernierCode())).rejects.toMatchObject({ body: { code: 'INVALID_OTP' } });
	});
});
