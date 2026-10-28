import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import { actions, load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: Record<string, unknown>) => render(Page as any, { props: { data } }).body;

describe('/moi', () => {
	it('personne connectée : « Mon profil », « Affichage », « Se déconnecter »', () => {
		const page = html({ estPersonne: true });
		expect(page).toMatch(/<a[^>]*href="\/profil"[^>]*>[\s\S]*?Mon profil/);
		expect(page).toMatch(/<a[^>]*href="\/affichage"[^>]*>[\s\S]*?Affichage/);
		expect(page).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/deconnecter"[\s\S]*?<button[^>]*type="submit"[^>]*>[\s\S]*?Se déconnecter/);
	});

	it('super administrateur : pas de « Mon profil »', () => {
		const page = html({ estPersonne: false });
		expect(page).not.toContain('href="/profil"');
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
});
