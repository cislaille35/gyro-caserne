import { describe, expect, it } from 'vitest';
import { aPourvoir, avecTitulaires } from './nominations.ts';

describe('nominations', () => {
	it('joint à chaque rôle ses titulaires, aucun s’il n’en a pas', () => {
		const roles = avecTitulaires([{ responsabiliteId: 1, nom: 'A' }, { responsabiliteId: 2, nom: 'B' }], new Map([[1, ['Alice']]]));
		expect(roles).toEqual([
			{ responsabiliteId: 1, nom: 'A', titulaires: ['Alice'] },
			{ responsabiliteId: 2, nom: 'B', titulaires: [] }
		]);
	});

	it('compte les fonctions sans titulaire, pas les missions', () => {
		expect(aPourvoir([{ nature: 'fonction', titulaires: [] }, { nature: 'fonction', titulaires: ['Alice'] }, { nature: 'fonction', titulaires: [] }, { nature: 'mission', titulaires: [] }])).toBe(2);
		expect(aPourvoir([])).toBe(0);
	});
});
