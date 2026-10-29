import { expect, it } from 'vitest';
import { aujourdhuiParis, clotureParDefaut, maintenantParis, septJoursPlusTard } from './aujourdhui.ts';

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

it('sept jours plus tard, à la minute, avec ou sans les secondes', () => {
	expect(septJoursPlusTard('2026-10-29T12:05:33')).toBe('2026-11-05T12:05');
	expect(septJoursPlusTard('2026-12-28T23:59')).toBe('2027-01-04T23:59');
});

it('clôture préremplie : 7 jours, ou le début de l’événement, jamais plus d’un an après l’ouverture', () => {
	expect(clotureParDefaut('2026-10-29T12:05:33')).toBe('2026-11-05T12:05');
	expect(clotureParDefaut('2026-10-29T12:05', '2026-11-01T19:30')).toBe('2026-11-01T19:30');
	expect(clotureParDefaut('2026-10-29T12:05', '2099-06-01T18:30')).toBe('2027-10-29T12:05');
	// Pile un an : accepté par le socle (365 jours, même heure).
	expect(clotureParDefaut('2027-10-29T12:05', '2028-10-28T12:05')).toBe('2028-10-28T12:05');
	expect(clotureParDefaut('2027-10-29T12:05', '2028-10-29T12:05')).toBe('2028-10-28T12:05');
});
