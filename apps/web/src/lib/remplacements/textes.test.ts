import { describe, expect, it } from 'vitest';
import { blocs, majuscule } from './textes.ts';

describe('textes des remplacements', () => {
	it('blocs : les tranches libres qui se suivent, à partir de deux', () => {
		const t = (debut: string, fin: string, prise = false) => ({ debut, fin, prise });
		expect(
			blocs([t('2026-11-06T18:00', '2026-11-07T06:00', true), t('2026-11-07T06:00', '2026-11-08T06:00'), t('2026-11-08T06:00', '2026-11-09T06:00'), t('2026-11-09T18:00', '2026-11-10T06:00')])
		).toEqual([{ debut: '2026-11-07T06:00', fin: '2026-11-09T06:00' }]);
		expect(majuscule('nuit du lundi')).toBe('Nuit du lundi');
	});
});
