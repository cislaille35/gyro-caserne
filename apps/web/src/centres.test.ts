import { describe, expect, it } from 'vitest';
import { erreursCentre, type Centre } from '@gyro-caserne/centre';

// Tous les centres décrits dans le dépôt, pas seulement celui de la compilation en cours
const fichiers = import.meta.glob<{ default: Centre }>('../../../centres/*/centre.ts');

describe('centres du dépôt', () => {
	it('en trouve au moins un', () => {
		expect(Object.keys(fichiers).length).toBeGreaterThan(0);
	});

	for (const [chemin, charger] of Object.entries(fichiers)) {
		const dossier = chemin.split('/').at(-2);

		it(`${dossier} est bien décrit`, async () => {
			const { default: centre } = await charger();
			expect(erreursCentre(centre)).toEqual([]);
			expect(centre.id).toBe(dossier);
		});
	}
});
