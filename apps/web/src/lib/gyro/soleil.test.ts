import { describe, expect, it } from 'vitest';
import { soleilCouche } from './soleil.ts';

// Paris. Lever et coucher (heure de Paris) : 21 juin 5 h 46 et 21 h 58 ; 21 décembre 8 h 41 et 16 h 56.
const PARIS = { latitude: 48.857, longitude: 2.352 };
const cas: [string, string, boolean][] = [
	['été, 10 min avant le lever', '2026-06-21T03:36Z', true],
	['été, 10 min après le lever', '2026-06-21T03:56Z', false],
	['été, 10 min avant le coucher', '2026-06-21T19:48Z', false],
	['été, 10 min après le coucher', '2026-06-21T20:08Z', true],
	['hiver, 10 min avant le lever', '2026-12-21T07:31Z', true],
	['hiver, 10 min après le lever', '2026-12-21T07:51Z', false],
	['hiver, 10 min avant le coucher', '2026-12-21T15:46Z', false],
	['hiver, 10 min après le coucher', '2026-12-21T16:06Z', true],
	['midi', '2026-03-15T12:00Z', false],
	['minuit', '2026-03-15T23:00Z', true]
];

describe('soleilCouche', () => {
	it.each(cas)('%s (%s) : couché %s', (_, date, attendu) => {
		expect(soleilCouche(new Date(date), PARIS)).toBe(attendu);
	});

	it('suit la position du centre : plus tard à l’ouest', () => {
		// 21 juin à 22 h 05 à Paris : couché à Paris, pas encore à Brest (coucher vers 22 h 15).
		expect(soleilCouche(new Date('2026-06-21T20:05Z'), PARIS)).toBe(true);
		expect(soleilCouche(new Date('2026-06-21T20:05Z'), { latitude: 48.39, longitude: -4.49 })).toBe(false);
	});
});
