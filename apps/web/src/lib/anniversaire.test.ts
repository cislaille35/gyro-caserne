import { describe, expect, it } from 'vitest';
import { phraseSouhaits } from './anniversaire.ts';

const p = (prenom: string) => ({ prenom, nom: 'Test' });

describe('phraseSouhaits', () => {
	it('les noms, puis le nombre des autres au-delà de trois', () => {
		expect(phraseSouhaits([])).toBe('');
		expect(phraseSouhaits([p('Paul')])).toBe('Paul Test vous l’a souhaité.');
		expect(phraseSouhaits([p('Paul'), p('Marc')])).toBe('Paul Test et Marc Test vous l’ont souhaité.');
		expect(phraseSouhaits([p('Paul'), p('Marc'), p('Luc')])).toBe('Paul Test, Marc Test et Luc Test vous l’ont souhaité.');
		expect(phraseSouhaits([p('Paul'), p('Marc'), p('Luc'), p('Léa'), p('Zoé')])).toBe('Paul Test, Marc Test et 3 autres collègues vous l’ont souhaité.');
	});
});
