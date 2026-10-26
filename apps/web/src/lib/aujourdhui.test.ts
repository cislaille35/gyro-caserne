import { expect, it } from 'vitest';
import { aujourdhuiParis } from './aujourdhui.ts';

it('donne la date de Paris, pas celle d\'UTC', () => {
	expect(aujourdhuiParis(new Date('2026-10-26T22:30:00Z'))).toBe('2026-10-26');
	expect(aujourdhuiParis(new Date('2026-10-26T23:30:00Z'))).toBe('2026-10-27');
	expect(aujourdhuiParis(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
});
