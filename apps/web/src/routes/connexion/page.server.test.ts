import { describe, expect, it, vi } from 'vitest';
import { deposerEcusson, personne, verification } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { creerAuth } from '#lib/server/auth.ts';
import { locaux, preparer, super_ } from '../reglages/de-test.ts';
import { actions, load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown) => (load as any)({ locals });

describe('connexion : l’écusson du centre', () => {
	it('sa version s’il y en a un, sinon null (une requête, la page n’est vue qu’à la connexion)', async () => {
		const { base } = await preparer();
		expect(await charger(locaux(base, null))).toEqual({ ecusson: null });
		const o = new Uint8Array(100);
		o.set([0xff, 0xd8, 0xff, 0xe0]);
		const v = await deposerEcusson(base, base.photos, super_, { type: 'image/jpeg', donnees: o }, maintenantParis());
		base.requetes = 0;
		expect(await charger(locaux(base, null))).toEqual({ ecusson: v });
		expect(base.requetes).toBe(1);
	});
});

// Une vraie authentification sur une base de test : le courriel est gardé au lieu de partir.
async function jeu() {
	const base = await baseDeTest();
	await base.insert(personne).values({ email: 'agent@exemple.fr', prenom: 'A', nom: 'G' });
	const taches: Promise<unknown>[] = [];
	const envoyer = vi.fn(async (_env: unknown, _m: { a: string; sujet: string; texte: string }) => {});
	const auth = creerAuth({ BETTER_AUTH_SECRET: 'secret-de-test-assez-long-pour-better-auth', BETTER_AUTH_URL: 'http://localhost' }, base, (p) => taches.push(p), envoyer);
	const cookies = { set: vi.fn() };
	const agir = async (nom: 'envoyer' | 'code', corps: Record<string, string>) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const resultat = await (actions[nom] as any)({ locals: { base, auth }, cookies, request: new Request('http://localhost/connexion', { method: 'POST', body: new URLSearchParams(corps) }) });
		await Promise.all(taches.splice(0));
		return resultat;
	};
	const dernierCode = () => envoyer.mock.calls.at(-1)![1].texte.match(/\b\d{6}\b/)![0];
	return { base, envoyer, cookies, agir, dernierCode };
}

describe('connexion : recevoir le courriel', () => {
	it('même réponse, adresse connue ou non, avec l’adresse rappelée et l’attente avant un renvoi', async () => {
		const { envoyer, agir } = await jeu();
		const connue = await agir('envoyer', { email: ' Agent@exemple.fr' });
		expect(connue).toMatchObject({ envoye: true, email: 'agent@exemple.fr', renvoiDans: 60 });
		expect(envoyer).toHaveBeenCalledTimes(1);
		const inconnue = await agir('envoyer', { email: 'inconnu@exemple.fr' });
		expect(Object.keys(inconnue)).toEqual(Object.keys(connue));
		expect(envoyer).toHaveBeenCalledTimes(1);
	});
});

describe('connexion : taper le code', () => {
	const essai = (agir: Awaited<ReturnType<typeof jeu>>['agir'], code: string, email = 'agent@exemple.fr') => agir('code', { email, code, envoyeLe: String(Date.now()) });
	const autreQue = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

	it('le bon code : la session est posée dans les cookies, puis l’accueil', async () => {
		const { cookies, agir, dernierCode } = await jeu();
		await agir('envoyer', { email: 'agent@exemple.fr' });
		await expect(essai(agir, dernierCode())).rejects.toMatchObject({ status: 303, location: '/' });
		const [nom, , options] = cookies.set.mock.calls.find(([n]) => n === 'better-auth.session_token')!;
		expect(nom).toBe('better-auth.session_token');
		expect(options).toMatchObject({ path: '/', httpOnly: true, sameSite: 'lax', maxAge: 7_776_000 });
	});

	it('les espaces tapés dans le code sont ignorés', async () => {
		const { agir, dernierCode } = await jeu();
		await agir('envoyer', { email: 'agent@exemple.fr' });
		const code = dernierCode();
		await expect(essai(agir, `${code.slice(0, 3)} ${code.slice(3)}`)).rejects.toMatchObject({ status: 303 });
	});

	const REFUS = /^Ce code ne marche pas : il est faux, a expiré \(5 minutes\) ou a déjà eu 3 essais\./;

	it('un code faux : un message clair, l’écran du code reste ouvert', async () => {
		const { cookies, agir, dernierCode } = await jeu();
		await agir('envoyer', { email: 'agent@exemple.fr' });
		const reponse = await essai(agir, autreQue(dernierCode()));
		expect(reponse).toMatchObject({ status: 400, data: { envoye: true, email: 'agent@exemple.fr', erreur: expect.stringMatching(REFUS) } });
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('pas 6 chiffres : refusé sans compter d’essai', async () => {
		const { base, agir, dernierCode } = await jeu();
		await agir('envoyer', { email: 'agent@exemple.fr' });
		expect(await essai(agir, '12a')).toMatchObject({ status: 400, data: { erreur: 'Le code a 6 chiffres.' } });
		const [ligne] = (await base.select().from(verification)).filter((v) => v.identifier.startsWith('sign-in-otp-'));
		expect(ligne!.value.endsWith(':0')).toBe(true);
		await expect(essai(agir, dernierCode())).rejects.toMatchObject({ status: 303 });
	});

	it('un code expiré : le même message', async () => {
		const { base, agir, dernierCode } = await jeu();
		await agir('envoyer', { email: 'agent@exemple.fr' });
		await base.update(verification).set({ expiresAt: new Date(Date.now() - 1000) });
		expect(await essai(agir, dernierCode())).toMatchObject({ status: 400, data: { erreur: expect.stringMatching(REFUS) } });
	});

	it('trop d’essais : le même message, même pour le bon code', async () => {
		const { agir, dernierCode } = await jeu();
		await agir('envoyer', { email: 'agent@exemple.fr' });
		const code = dernierCode();
		for (let i = 0; i < 3; i++) await essai(agir, autreQue(code));
		expect(await essai(agir, code)).toMatchObject({ status: 400, data: { erreur: expect.stringMatching(REFUS) } });
	});

	it('adresse connue ou non, les refus sont les mêmes : ils ne disent pas qu’un code existe', async () => {
		const { agir, dernierCode } = await jeu();
		const envoyeLe = String(Date.now());
		const quatreEssais = async (email: string, code: string) => {
			const reponses = [];
			for (let i = 0; i < 4; i++) reponses.push(await agir('code', { email, code, envoyeLe }));
			return reponses;
		};
		await agir('envoyer', { email: 'agent@exemple.fr' });
		await agir('envoyer', { email: 'inconnu@exemple.fr' });
		const faux = autreQue(dernierCode());
		expect(await quatreEssais('agent@exemple.fr', faux)).toEqual(await quatreEssais('inconnu@exemple.fr', faux).then((r) => r.map((x) => ({ ...x, data: { ...x.data, email: 'agent@exemple.fr' } }))));
	});

	it('le délai avant un renvoi suit l’heure d’envoi, de 60 s à 0', async () => {
		const { agir } = await jeu();
		const il_y_a = (s: number) => agir('code', { email: 'agent@exemple.fr', code: '000000', envoyeLe: String(Date.now() - s * 1000) });
		expect((await il_y_a(20)).data.renvoiDans).toBe(40);
		expect((await il_y_a(90)).data.renvoiDans).toBe(0);
		expect((await agir('code', { email: 'agent@exemple.fr', code: '000000', envoyeLe: 'n’importe quoi' })).data.renvoiDans).toBe(0);
	});
});
