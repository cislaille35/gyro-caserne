import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: Record<string, unknown>) => render(Page as any, { props: { data } }).body;
const lien = (href: string, libelle: string) => new RegExp(`<a[^>]*href="${href}"[^>]*>[\\s\\S]*?${libelle}[\\s\\S]*?</a>`);

describe('/caserne', () => {
	it('demande la connexion', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((load as any)({ locals: { acteur: null } })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('agent ordinaire : « Agents », sans « Nominations » ni « Réglages »', () => {
		const page = html({ peutNominations: false, peutReglages: false });
		expect(page).toMatch(lien('/agents', 'Agents'));
		expect(page).not.toContain('href="/nominations"');
		expect(page).not.toContain('href="/reglages"');
	});

	it('chef de centre : « Agents », « Nominations » et « Réglages »', () => {
		const page = html({ peutNominations: true, peutReglages: true });
		expect(page).toMatch(lien('/agents', 'Agents'));
		expect(page).toMatch(lien('/nominations', 'Nominations'));
		expect(page).toMatch(lien('/reglages', 'Réglages'));
	});

	it('« Engins » et « Comités » annoncés sans fausses données', () => {
		const page = html({ peutNominations: false, peutReglages: false });
		expect(page).toContain('Engins');
		expect(page).toContain('Les engins arrivent bientôt.');
		expect(page).toContain('Comités');
		expect(page).toContain('Les pages des comités arrivent bientôt.');
	});
});
