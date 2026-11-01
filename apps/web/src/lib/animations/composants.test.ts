import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Celebration from './Celebration.svelte';
import TirerPourActualiser from './TirerPourActualiser.svelte';
import { momentPlanningPublie } from './celebration.ts';

const source = (chemin: string) => readFileSync(new URL(`../../routes/${chemin}`, import.meta.url), 'utf8');

describe('tirer pour actualiser', () => {
	it('rien de visible avant le geste ; une zone d’état, vide, pour dire « Actualisation… »', () => {
		const html = render(TirerPourActualiser).body;
		expect(html).not.toContain('class="tirer');
		expect(html).toMatch(/<p class="masque" role="status">\s*<\/p>/);
	});

	it('sur l’accueil, Échanges, les notifications et le planning', () => {
		for (const page of ['+page.svelte', 'echanges/+layout.svelte', 'notifications/+page.svelte', 'planning/+page.svelte']) {
			expect(source(page)).toContain('<TirerPourActualiser />');
		}
	});
});

describe('célébration', () => {
	it('jamais rendue par le serveur : décidée dans le navigateur, selon ce qui a déjà été vu', () => {
		const html = render(Celebration, { props: { moment: momentPlanningPublie(2027), qui: 'p1' } }).body;
		expect(html).not.toContain('class="fete');
		expect(html).toMatch(/role="status"/);
	});

	it('sans annonce quand la page dit déjà la nouvelle', () => {
		const html = render(Celebration, { props: { moment: momentPlanningPublie(2027), qui: 'p1', annoncer: false } }).body;
		expect(html).not.toContain('role="status"');
	});

	it('sur les vrais moments : anniversaire (accueil), première réservation, année publiée', () => {
		expect(source('+page.svelte')).toContain('<Celebration moment={momentAnniversaire(');
		expect(source('reservations/miennes/+page.svelte')).toContain('<Celebration moment={momentPremiereReservation(');
		expect(source('planning/preparer/+page.svelte')).toContain('<Celebration moment={momentPlanningPublie(');
	});
});
