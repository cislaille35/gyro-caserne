import { describe, expect, it } from 'vitest';
import { quand } from './quand.ts';

describe('quand', () => {
	const aujourdhui = '2026-10-29';
	it('aujourd’hui : l’heure', () => {
		expect(quand('2026-10-29T09:00:00', aujourdhui)).toBe('9 h');
		expect(quand('2026-10-29T14:05:00', aujourdhui)).toBe('14 h 05');
	});
	it('hier, puis le jour de la semaine, puis la date', () => {
		expect(quand('2026-10-28T23:00:00', aujourdhui)).toBe('hier');
		expect(quand('2026-10-26T10:00:00', aujourdhui)).toBe('lun.');
		expect(quand('2026-10-22T10:00:00', aujourdhui)).toBe('22 oct.');
	});
});
