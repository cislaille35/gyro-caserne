import { describe, expect, it } from 'vitest';
import { valeurConnue } from './choix.ts';

const options = [{ valeur: '1' }, { valeur: '2' }, { valeur: '' }];

describe('valeurConnue', () => {
	it('prend la valeur voulue quand elle fait partie de la liste', () => {
		expect(valeurConnue('2', options, '1')).toBe('2');
		expect(valeurConnue('', options, '1')).toBe('');
	});

	it('garde le choix en cours quand la valeur voulue n’existe pas : la liste ne se vide jamais', () => {
		expect(valeurConnue('', [{ valeur: '1' }, { valeur: '2' }], '2')).toBe('2');
	});
});
