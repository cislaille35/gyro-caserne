import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const equipes = [1, 2].map((id) => ({ id, nom: `Équipe ${id}`, couleur: '#d4a017' }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (manoeuvre: unknown, form: unknown = null) => render(Page as any, { props: { data: { manoeuvre, equipes, annee: '2027' }, form } }).body;

describe('page d’une manœuvre', () => {
	it('nouvelle : tout le centre coché, lieu « Caserne »', () => {
		const html = page(null);
		expect(html).toMatch(/<input type="radio" name="pour" value="tous"[^>]*checked/);
		expect(html).toContain('value="Caserne"');
		expect(html).toContain('Ajouter la manœuvre');
	});

	it('annoncée : ses équipes cochées, « Annuler la manœuvre »', () => {
		const html = page({ id: 3, debut: '2027-03-07T08:30', theme: 'Feux', lieu: 'Bois', convoques: [2], petitDejeuner: true, annulee: false, publiee: true });
		expect(html).toMatch(/value="equipes"[^>]*checked/);
		expect(html).toMatch(/name="equipes" value="2"[^>]*checked/);
		expect(html).toContain('Annuler la manœuvre');
		expect(html).toContain('la publication sera mise à jour');
	});
});
