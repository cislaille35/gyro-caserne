import { describe, expect, it } from 'vitest';
import { SEUIL, TIRAGE_MAX, consigne, declenche, forceDuJet, tirage } from './tirage.ts';

describe('tirer pour actualiser', () => {
	it('suit le doigt vers le bas, freiné, et plafonne', () => {
		expect(tirage(0, 50)).toBe(30);
		expect(tirage(0, 1000)).toBe(TIRAGE_MAX);
	});

	it('ignore un geste vers le haut ou surtout de côté (défilement horizontal)', () => {
		expect(tirage(0, -40)).toBe(0);
		expect(tirage(90, 60)).toBe(0);
		expect(tirage(20, 60)).toBe(36);
	});

	it('actualise seulement au-delà du seuil', () => {
		expect(declenche(SEUIL - 1)).toBe(false);
		expect(declenche(SEUIL)).toBe(true);
	});

	it('le jet grossit avec le tirage jusqu’au seuil', () => {
		expect(forceDuJet(0)).toBe(0);
		expect(forceDuJet(SEUIL / 2)).toBe(0.5);
		expect(forceDuJet(TIRAGE_MAX)).toBe(1);
	});

	it('dit quoi faire', () => {
		expect(consigne(20, false)).toBe('Tirez pour actualiser');
		expect(consigne(SEUIL, false)).toBe('Relâchez pour actualiser');
		expect(consigne(SEUIL, true)).toBe('Actualisation…');
	});
});
