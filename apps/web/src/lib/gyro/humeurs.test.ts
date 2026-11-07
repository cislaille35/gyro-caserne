import { describe, expect, it } from 'vitest';
import { HUMEURS, humeurDuJour } from './humeurs.ts';

const jours = (annee: number) => Array.from({ length: 365 }, (_, i) => new Date(Date.UTC(annee, 0, 1 + i)).toISOString().slice(0, 10));

describe('humeurs de Gyro', () => {
	it('variées : caserne, engins, météo ; le café une seule fois', () => {
		expect(new Set(HUMEURS).size).toBe(HUMEURS.length);
		expect(HUMEURS.length).toBeGreaterThanOrEqual(8);
		expect(HUMEURS.filter((h) => /café/i.test(h))).toHaveLength(1);
	});

	it('une par jour, jamais la même deux jours de suite ni le même jour sur l’accueil et dans Échanges', () => {
		const annee = jours(2026);
		for (const [i, jour] of annee.entries()) {
			expect(humeurDuJour(jour, 'accueil')).not.toBe(humeurDuJour(jour, 'echanges'));
			if (i) expect(humeurDuJour(jour, 'accueil')).not.toBe(humeurDuJour(annee[i - 1]!, 'accueil'));
		}
		expect(new Set(annee.map((j) => humeurDuJour(j, 'accueil'))).size).toBe(HUMEURS.length);
	});
});
