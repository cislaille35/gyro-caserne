import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import centre from '$centre';
import { calculerAnnee, feries } from '@gyro-caserne/socle';
import Page from './+page.svelte';

const equipes = [1, 2, 3, 4].map((id) => ({ id, nom: `Équipe ${id}`, couleur: '#d4a017' }));
const preparation = (autres: Record<string, unknown> = {}) => ({
	annee: 2027,
	publiee: null,
	ordre: [1, 2, 3, 4],
	ordrePropose: [1, 2, 3, 4],
	semaines: calculerAnnee(2027, centre.astreinte, [1, 2, 3, 4], new Map()),
	manoeuvres: [{ id: 5, debut: '2027-03-07T08:30', theme: 'Feux de forêt', lieu: 'Caserne', convoques: [1, 2], petitDejeuner: true, annulee: false, publiee: true }],
	vacances: [],
	feries: feries(2027),
	fetes: { noel: 1, nouvelAn: 1, attendues: { noel: [3], nouvelAn: [1, 2] }, historique: [{ annee: 2026, fete: 'noel', equipeId: 1 }] },
	equipes,
	...autres
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (p = preparation(), form: unknown = null) => render(Page as any, { props: { data: { preparation: p, annees: [2026, 2027] }, form } }).body;

describe('Préparer l’année', () => {
	it('non publiée : le bouton de publication ; publiée : la date', () => {
		expect(page()).toContain('Publier l’année 2027');
		expect(page(preparation({ publiee: '2026-11-01T10:00' }))).toContain('Publiée');
	});

	it('Noël hors de son tour est signalé, le Nouvel An non', () => {
		const html = page();
		expect(html).toContain('Hors de son tour : c’est à Équipe 3 de tenir Noël.');
		expect(html).not.toContain('de tenir le Nouvel An');
		expect(html).toContain('Noël 2026 : Équipe 1');
	});

	it('une liste déroulante par semaine, étiquetée ; les manœuvres et leur état', () => {
		const html = page();
		expect(html).toMatch(/<label for="semaine-2027-01-01"[^>]*>S53 · 1er – 8 janv\./);
		expect(html).toContain('Feux de forêt');
		expect(html).toContain('Annoncée');
		expect(html).toContain('Équipe 1, Équipe 2');
	});

	it('le message d’erreur va au bon formulaire', () => {
		const html = page(preparation(), { cible: 'roulement', message: 'Mettez chaque équipe une fois.' });
		expect(html).toContain('Mettez chaque équipe une fois.');
	});
});
