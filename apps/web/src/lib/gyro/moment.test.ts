import { describe, expect, it } from 'vitest';
import { tenueDuMoment } from './moment.ts';

// Dates en UTC, résultat attendu à l'heure de Paris.
const cas: [string, string][] = [
	['2026-12-04T10:00Z', 'saintebarbe'],
	['2026-12-25T10:00Z', 'noel'],
	['2026-12-24T23:30Z', 'noel'],
	['2027-01-01T10:00Z', 'nouvelan'],
	['2027-01-10T10:00Z', 'galette'],
	['2027-02-02T12:00Z', 'chandeleur'],
	['2027-04-01T12:00Z', 'poisson'],
	['2026-07-14T12:00Z', 'bal14'],
	['2026-10-31T12:00Z', 'halloween'],
	['2026-11-10T12:00Z', 'calendriers'],
	['2026-08-10T12:00Z', 'ete'],
	['2027-02-10T12:00Z', 'hiver'],
	['2026-10-26T22:30Z', 'nuit'],
	['2026-10-24T22:30Z', 'nuit'],
	['2026-05-12T06:30Z', 'ptitdej'],
	['2026-05-12T12:00Z', 'normal']
];

describe('tenueDuMoment', () => {
	it.each(cas)('%s donne %s', (date, attendu) => {
		expect(tenueDuMoment(new Date(date))).toBe(attendu);
	});

	it('suit l’heure de Paris au changement d’heure', () => {
		expect(tenueDuMoment(new Date('2026-05-12T03:59Z'))).toBe('nuit'); // 5 h 59 à Paris
		expect(tenueDuMoment(new Date('2026-05-12T04:00Z'))).toBe('ptitdej'); // 6 h 00
		expect(tenueDuMoment(new Date('2026-12-15T05:00Z'))).toBe('ptitdej'); // 6 h en hiver
		expect(tenueDuMoment(new Date('2026-12-15T04:59Z'))).toBe('nuit'); // 5 h 59 en hiver
	});

	it('suit l’heure de Paris au changement d’heure de fin mars', () => {
		expect(tenueDuMoment(new Date('2027-03-28T00:59Z'))).toBe('nuit'); // 1 h 59
		expect(tenueDuMoment(new Date('2027-03-28T01:00Z'))).toBe('nuit'); // 3 h 00
		expect(tenueDuMoment(new Date('2027-03-28T04:30Z'))).toBe('ptitdej'); // 6 h 30
	});

	it('la fête du jour passe avant la nuit', () => {
		expect(tenueDuMoment(new Date('2026-10-31T22:30Z'))).toBe('halloween'); // 23 h 30 le 31
	});
});
