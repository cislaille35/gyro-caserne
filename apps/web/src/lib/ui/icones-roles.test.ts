import { NOMS_ICONES } from '@gyro-caserne/socle';
import { expect, it } from 'vitest';
import { ICONES_ROLES } from './icones-roles.ts';

it('les icônes de l’appli sont exactement celles du socle', () => {
	expect(Object.keys(ICONES_ROLES).sort()).toEqual([...NOMS_ICONES].sort());
});
