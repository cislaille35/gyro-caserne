import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import { actions, load } from './+page.server';
import { abonnementPush } from '@gyro-caserne/socle';
import { preparer } from '../echanges/de-test.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
const html = (data: Record<string, unknown>) => render(Page as any, { props: { data } }).body;

describe('/moi', () => {
	it('personne connectée : « Mon profil », « Notifications », « Affichage », « Se déconnecter »', () => {
		const page = html({ estPersonne: true });
		expect(page).toMatch(/<a[^>]*href="\/moi\/notifications"[^>]*>[\s\S]*?Notifications/);
		expect(page).toMatch(/<a[^>]*href="\/profil"[^>]*>[\s\S]*?Mon profil/);
		expect(page).toMatch(/<a[^>]*href="\/moi\/agenda"[^>]*>[\s\S]*?Ajouter à mon agenda/);
		expect(page).toMatch(/<a[^>]*href="\/affichage"[^>]*>[\s\S]*?Affichage/);
		expect(page).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/deconnecter"[\s\S]*?<button[^>]*type="submit"[^>]*>[\s\S]*?Se déconnecter/);
	});

	it('« Installer l’appli », pour tous (super administrateur compris), avant « Affichage »', () => {
		for (const estPersonne of [true, false]) {
			const page = html({ estPersonne });
			expect(page).toMatch(/<a[^>]*href="\/moi\/installer"[^>]*>[\s\S]*?Installer l’appli/);
			expect(page.indexOf('href="/moi/installer"')).toBeLessThan(page.indexOf('href="/affichage"'));
		}
	});

	it('carte d’identité : visage à la couleur de l’équipe, nom, grade · équipe', () => {
		const page = html({ estPersonne: true, identite: { prenom: 'Claire', nom: 'Chef', grade: 'Lieutenant', equipe: { nom: 'Équipe 1', couleur: '#d4a017' } } });
		expect(page).toMatch(/class="visage[^"]*"[^>]*style="background: #d4a017;/);
		expect(page).toContain('Claire Chef');
		expect(page).toContain('Lieutenant · Équipe 1');
		expect(page.indexOf('Claire Chef')).toBeLessThan(page.indexOf('href="/profil"'));
	});

	it('mes aptitudes, celle qui ne vaut pas aujourd’hui dite en texte', () => {
		const aptitudes = [
			{ aptitudeId: 1, nom: 'CA2', valide: true },
			{ aptitudeId: 4, nom: 'COD1', valide: false }
		];
		expect(html({ estPersonne: true, identite: { prenom: 'Claire', nom: 'Chef', grade: null, equipe: null }, aptitudes })).toContain('Aptitudes : CA2, COD1 (pas valable aujourd’hui)');
	});

	it('la carte du super administrateur', () => {
		expect(html({ estPersonne: false, identite: null })).toContain('Super administrateur');
		// Sans grade ni équipe : son rôle.
		expect(html({ estPersonne: true, identite: { prenom: 'Claire', nom: 'Chef', grade: null, role: 'Chef de centre', equipe: null } })).toContain('Chef de centre');
	});

	it('sans grade, équipe ni rôle : le nom seul, rien d’inventé', () => {
		const page = html({ estPersonne: true, identite: { prenom: 'Paul', nom: 'Neuf', grade: null, role: null, equipe: null } });
		expect(page).toContain('Paul Neuf');
		expect(page).not.toContain('Agent du centre');
		expect(page).not.toMatch(/<p class="doux[^"]*">\s*<\/p>/);
	});

	it('la carte vient de l’effectif ; rien pour le super administrateur', async () => {
		const { base, alice } = await preparer();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const charger = (acteur: unknown) => (load as any)({ locals: { base, acteur } });
		expect(await charger(alice)).toEqual({ identite: { prenom: 'Alice', nom: 'Test', grade: null, role: null, equipe: { nom: expect.any(String), couleur: expect.stringMatching(/^#/) } }, aptitudes: [] });
		expect(await charger({ type: 'super', email: 'a@b.fr' })).toEqual({ identite: null, aptitudes: [] });
	});

	it('super administrateur : pas de « Mon profil »', () => {
		const page = html({ estPersonne: false });
		expect(page).not.toContain('href="/profil"');
		expect(page).not.toContain('href="/moi/notifications"');
		expect(page).not.toContain('href="/moi/agenda"');
		expect(page).toContain('href="/affichage"');
		expect(page).toContain('Se déconnecter');
	});

	it('demande la connexion', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((load as any)({ locals: { acteur: null } })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('« Se déconnecter » ferme la session, efface ses cookies et mène à la connexion', async () => {
		const entetes = new Headers();
		entetes.append('set-cookie', 'better-auth.session_token=; Max-Age=0; Path=/');
		entetes.append('set-cookie', 'better-auth.session_data=; Max-Age=0; Path=/');
		const signOut = vi.fn(async () => ({ headers: entetes, response: { success: true } }));
		const supprimer = vi.fn();
		const request = new Request('http://x/moi?/deconnecter', { method: 'POST', headers: { cookie: 'better-auth.session_token=abc' } });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const appel = (actions.deconnecter as any)({ request, locals: { auth: { api: { signOut } } }, cookies: { delete: supprimer } });
		await expect(appel).rejects.toMatchObject({ status: 303, location: '/connexion' });
		expect(signOut).toHaveBeenCalledWith({ headers: request.headers, returnHeaders: true });
		expect(supprimer).toHaveBeenCalledWith('better-auth.session_token', { path: '/' });
		expect(supprimer).toHaveBeenCalledWith('better-auth.session_data', { path: '/' });
	});

	it('« Me déconnecter de tous mes appareils » : sous « Plus », avec « Je confirme » et un bouton grave', () => {
		for (const estPersonne of [true, false]) {
			const page = html({ estPersonne });
			expect(page).toMatch(/<details class="plus[^"]*"[^>]*>\s*<summary>Plus<\/summary>[\s\S]*action="\?\/deconnecterPartout"[\s\S]*name="confirmation" value="oui"[\s\S]*class="grave[^"]*"[^>]*>(<!---->)?Me déconnecter de tous mes appareils/);
		}
		// Refusé faute de confirmation : le pli reste ouvert, avec le message.
		const refus = render(Page as any, { props: { data: { estPersonne: true }, form: { message: 'Cochez « Je confirme » pour continuer.' } } }).body;
		expect(refus).toMatch(/<details class="plus[^"]*" open/);
		expect(refus).toContain('Cochez « Je confirme » pour continuer.');
	});

	it('« Me déconnecter de tous mes appareils » : sans confirmation, rien ne se passe', async () => {
		const revokeSessions = vi.fn();
		const request = new Request('http://x/moi?/deconnecterPartout', { method: 'POST', body: new URLSearchParams({}) });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const reponse = await (actions.deconnecterPartout as any)({ request, locals: { acteur: { type: 'personne', id: 1 }, auth: { api: { revokeSessions } } }, cookies: { delete: vi.fn() } });
		expect(reponse).toMatchObject({ status: 400, data: { message: 'Cochez « Je confirme » pour continuer.' } });
		expect(revokeSessions).not.toHaveBeenCalled();
	});

	it('« Me déconnecter de tous mes appareils » : ferme toutes ses sessions, oublie tous ses appareils, mène à la connexion', async () => {
		const { base, alice } = await preparer();
		await base.insert(abonnementPush).values([
			{ personneId: alice.id, endpoint: 'https://fcm.googleapis.com/fcm/send/1', p256dh: 'B', auth: 'a', appareil: 'Téléphone', creeLe: '2026-11-01T10:00' },
			{ personneId: alice.id, endpoint: 'https://web.push.apple.com/2', p256dh: 'B', auth: 'a', appareil: 'iPad', creeLe: '2026-11-01T10:00' }
		]);
		const entetes = new Headers();
		entetes.append('set-cookie', 'better-auth.session_token=; Max-Age=0; Path=/');
		const revokeSessions = vi.fn(async () => ({ status: true }));
		const signOut = vi.fn(async () => ({ headers: entetes, response: { success: true } }));
		const supprimer = vi.fn();
		const request = new Request('http://x/moi?/deconnecterPartout', { method: 'POST', headers: { cookie: 'better-auth.session_token=abc' }, body: new URLSearchParams({ confirmation: 'oui' }) });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const appel = (actions.deconnecterPartout as any)({ request, locals: { base, acteur: alice, auth: { api: { revokeSessions, signOut } } }, cookies: { delete: supprimer } });
		await expect(appel).rejects.toMatchObject({ status: 303, location: '/connexion' });
		expect(revokeSessions).toHaveBeenCalledWith({ headers: request.headers });
		expect(await base.select().from(abonnementPush)).toEqual([]);
		expect(supprimer).toHaveBeenCalledWith('better-auth.session_token', { path: '/' });
	});
});
