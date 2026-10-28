import { expect, it } from 'vitest';
import { aujourdhuiParis, maintenantParis } from './aujourdhui.ts';

it('donne la date de Paris, pas celle d\'UTC', () => {
	expect(aujourdhuiParis(new Date('2026-10-26T22:30:00Z'))).toBe('2026-10-26');
	expect(aujourdhuiParis(new Date('2026-10-26T23:30:00Z'))).toBe('2026-10-27');
	expect(aujourdhuiParis(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
});

it('donne la date et l’heure de Paris, heure d’été comme d’hiver', () => {
	expect(maintenantParis(new Date('2026-10-26T22:30:05Z'))).toBe('2026-10-26T23:30:05');
	expect(maintenantParis(new Date('2026-07-14T22:05:00Z'))).toBe('2026-07-15T00:05:00');
	expect(maintenantParis(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05T01:00:00');
});
