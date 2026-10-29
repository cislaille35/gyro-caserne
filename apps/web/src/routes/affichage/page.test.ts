import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const html = (connecte: boolean) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { connecte, affichage: { niveau: 'equilibre', theme: 'auto' } }, form: null } }).body;

describe('page Affichage', () => {
	it('connecté : retour vers « Moi » ; sinon c’est un onglet, sans retour', () => {
		expect(html(true)).toMatch(/<a[^>]*href="\/moi"[\s\S]*?<h1[^>]*>Affichage<\/h1>/);
		expect(html(false)).not.toContain('href="/moi"');
	});

	it('les choix enregistrés sont cochés', () => {
		const page = html(true);
		expect(page).toMatch(/<input type="radio" name="niveau" value="equilibre"[^>]*checked/);
		expect(page).toMatch(/<input type="radio" name="theme" value="auto"[^>]*checked/);
	});
});
