import { describe, expect, it } from 'vitest';
import { tenueDuMoment as tenue } from './moment.ts';

// Le centre fictif (près de Rennes) : le soleil s'y couche environ 15 minutes après Paris.
const ICI = { latitude: 48.1, longitude: -1.7 };
const tenueDuMoment = (date: Date, ambiance?: Parameters<typeof tenue>[1]) => tenue(date, ambiance, ICI);

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

	it('la météo du centre habille Gyro, après les fêtes, la nuit et le p’tit-déj', () => {
		const midi = new Date('2026-11-10T12:00Z');
		expect(tenueDuMoment(midi, 'pluie')).toBe('pluie');
		expect(tenueDuMoment(midi, 'orage')).toBe('orage');
		expect(tenueDuMoment(midi, 'neige')).toBe('hiver');
		expect(tenueDuMoment(midi, 'gel')).toBe('hiver');
		expect(tenueDuMoment(midi, 'chaleur')).toBe('ete');
		expect(tenueDuMoment(midi, 'vent')).toBe('vent');
		expect(tenueDuMoment(midi, 'brouillard')).toBe('brouillard');
		// Beau temps ou nuages : la tenue habituelle.
		expect(tenueDuMoment(midi, 'clair')).toBe('calendriers');
		expect(tenueDuMoment(midi, 'nuageux')).toBe('calendriers');
		expect(tenueDuMoment(new Date('2026-12-25T10:00Z'), 'pluie')).toBe('noel');
		expect(tenueDuMoment(new Date('2026-10-26T22:30Z'), 'pluie')).toBe('nuit');
		expect(tenueDuMoment(new Date('2026-05-12T06:30Z'), 'pluie')).toBe('ptitdej');
	});

	it('pas de soleil une fois le soleil couché : ni l’été, ni la chaleur', () => {
		// 10 août, coucher vers 21 h 25 au centre.
		expect(tenueDuMoment(new Date('2026-08-10T19:00Z'))).toBe('ete'); // 21 h
		expect(tenueDuMoment(new Date('2026-08-10T19:45Z'))).toBe('normal'); // 21 h 45
		expect(tenueDuMoment(new Date('2026-08-10T19:45Z'), 'chaleur')).toBe('normal');
		// 21 juin, coucher vers 22 h 13 au centre.
		expect(tenueDuMoment(new Date('2026-06-21T20:00Z'))).toBe('ete'); // 22 h
		expect(tenueDuMoment(new Date('2026-06-21T20:25Z'))).toBe('normal'); // 22 h 25
		// Chaleur un soir de septembre, après le coucher (vers 20 h 30) : la tenue de saison.
		expect(tenueDuMoment(new Date('2026-09-05T17:00Z'), 'chaleur')).toBe('ete'); // 19 h
		expect(tenueDuMoment(new Date('2026-09-05T19:30Z'), 'chaleur')).toBe('normal'); // 21 h 30
		// L'hiver, le soleil se couche tôt, mais aucune tenue de l'hiver n'en montre.
		expect(tenueDuMoment(new Date('2026-12-15T17:30Z'))).toBe('calendriers');
		expect(tenueDuMoment(new Date('2027-01-20T17:30Z'), 'neige')).toBe('galette');
	});
});
