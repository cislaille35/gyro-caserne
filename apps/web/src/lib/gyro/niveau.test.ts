import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { Affichage } from '../affichage.ts';
import Vide from '../ui/Vide.svelte';
import GyroDuMoment from './GyroDuMoment.svelte';
import GyroAccueil from './GyroAccueil.svelte';
import { cinqTouches } from './cinqTouches.ts';
import { gyroSelonNiveau } from './niveau.ts';

const rendre = (composant: any, niveau: Affichage['niveau'], props: Record<string, unknown> = {}) =>
	render(composant, { props, context: new Map([['affichage', { niveau, theme: 'auto' }]]) }).body;

describe('gyroSelonNiveau', () => {
	it('sobre : caché', () => expect(gyroSelonNiveau('sobre')).toEqual({ visible: false, anime: false }));
	it('équilibré : visible, immobile', () => expect(gyroSelonNiveau('equilibre')).toEqual({ visible: true, anime: false }));
	it('vivant : visible, animé', () => expect(gyroSelonNiveau('vivant')).toEqual({ visible: true, anime: true }));
});

describe('cinqTouches', () => {
	it('cinq appuis rapprochés', () => expect(cinqTouches([0, 300, 600, 900, 1200], 1300)).toBe(true));
	it('quatre appuis', () => expect(cinqTouches([0, 300, 600, 900], 1000)).toBe(false));
	it('trop étalés', () => expect(cinqTouches([0, 500, 1000, 1500, 2600], 2600)).toBe(false));
});

describe('Vide', () => {
	it('sobre : le texte, pas de Gyro', () => {
		const page = rendre(Vide, 'sobre', { texte: 'Rien à afficher' });
		expect(page).toContain('Rien à afficher');
		expect(page).not.toContain('<svg');
	});
	it('vivant : le texte et Gyro', () => {
		const page = rendre(Vide, 'vivant', { texte: 'Rien à afficher' });
		expect(page).toContain('Rien à afficher');
		expect(page).toContain('<svg');
	});
});

describe('GyroAccueil', () => {
	it('est un bouton nommé, avec un Gyro décoratif', () => {
		const page = rendre(GyroAccueil, 'vivant');
		expect(page).toMatch(/<button[^>]*type="button"[^>]*aria-label="Faire réagir Gyro"|<button[^>]*aria-label="Faire réagir Gyro"[^>]*type="button"/);
		expect(page).toContain('aria-hidden="true"');
		expect(page).not.toContain('role="img"');
		expect(page).toContain('aria-live="polite"');
		expect(page).not.toContain('pin-pon');
	});
});

describe('surprise (tenue chargement)', () => {
	it('équilibré : immobile, aucune classe d’animation', () => {
		expect(rendre(GyroDuMoment, 'equilibre', { tenue: 'chargement' })).not.toMatch(/class="a-/);
	});
	it('vivant : animé', () => {
		expect(rendre(GyroDuMoment, 'vivant', { tenue: 'chargement' })).toMatch(/class="a-/);
	});
	it('sobre : GyroAccueil sans bouton ni zone aria-live', () => {
		const page = rendre(GyroAccueil, 'sobre');
		expect(page).not.toContain('<button');
		expect(page).not.toContain('aria-live');
	});
});
