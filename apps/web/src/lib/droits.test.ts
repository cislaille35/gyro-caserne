import { describe, expect, it } from 'vitest';
import { DROITS } from '@gyro-caserne/socle';
import { LIBELLES_DROIT } from './droits.ts';

describe('LIBELLES_DROIT', () => {
	it('donne un libellé en français à chaque droit, sans en inventer', () => {
		expect(Object.keys(LIBELLES_DROIT).sort()).toEqual([...DROITS].sort());
		for (const droit of DROITS) expect(LIBELLES_DROIT[droit].trim()).not.toBe('');
	});

	it('n’affiche jamais le nom technique du droit', () => {
		for (const droit of DROITS) expect(LIBELLES_DROIT[droit]).not.toMatch(/[A-Z]_[A-Z]/);
	});
});
