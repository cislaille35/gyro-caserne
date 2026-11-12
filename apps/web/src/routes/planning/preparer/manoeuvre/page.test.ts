import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import centre from '$centre';
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

	it('nouvelle : début et fin proposés par le centre ; existante : les siens', () => {
		const html = page(null);
		expect(html).toMatch(new RegExp(`name="heure"[^>]*value="${centre.manoeuvres.debut}"`));
		expect(html).toMatch(new RegExp(`name="fin"[^>]*value="${centre.manoeuvres.fin}"`));
		expect(html).toContain('Heure de fin');
		const existante = page({ id: 3, debut: '2027-03-07T07:45', fin: '2027-03-07T12:00', theme: 'Feux', lieu: 'Bois', convoques: 'tous', petitDejeuner: false, annulee: false, publiee: false });
		expect(existante).toMatch(/name="heure"[^>]*value="07:45"/);
		expect(existante).toMatch(/name="fin"[^>]*value="12:00"/);
	});

	it('annoncée : ses équipes cochées, « Annuler la manœuvre »', () => {
		const html = page({ id: 3, debut: '2027-03-07T08:30', fin: '2027-03-07T11:30', theme: 'Feux', lieu: 'Bois', convoques: [2], petitDejeuner: true, annulee: false, publiee: true });
		expect(html).toMatch(/value="equipes"[^>]*checked/);
		expect(html).toMatch(/name="equipes" value="2"[^>]*checked/);
		expect(html).toContain('Annuler la manœuvre');
		expect(html).toContain('la publication sera mise à jour');
	});

	it('un refus en modifiant garde l’identifiant : pas de doublon au renvoi', () => {
		const html = page(null, { cible: 'manoeuvre', message: 'Cette date est déjà passée.', valeurs: { id: '3', date: '2020-01-01', heure: '08:30', theme: 'Feux', lieu: 'Bois', pour: 'tous', petitDejeuner: '', equipes: [] } });
		expect(html).toMatch(/<input type="hidden" name="id" value="3"/);
	});
});
