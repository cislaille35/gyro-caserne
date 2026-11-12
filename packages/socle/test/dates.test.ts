import { describe, expect, it } from 'vitest';
import { ajouterJours, enCours, finEvenement, formatDeDate, heureDeParis, momentEvenement, veille } from '../src/dates.ts';
import { rangDuJour } from '../src/planning/calendrier.ts';

describe('enCours', () => {
	it('inclut le dernier jour', () => {
		expect(enCours('2026-01-01', '2026-01-31', '2026-01-31')).toBe(true);
	});

	it('exclut une période qui n’a pas commencé', () => {
		expect(enCours('2026-02-01', null, '2026-01-31')).toBe(false);
	});

	it('garde une période sans fin', () => {
		expect(enCours('2026-01-01', null, '2030-01-01')).toBe(true);
	});

	it('inclut le premier jour', () => {
		expect(enCours('2026-01-01', null, '2026-01-01')).toBe(true);
	});

	it('exclut une période terminée', () => {
		expect(enCours('2026-01-01', '2026-01-31', '2026-02-01')).toBe(false);
	});
});

// Ancienne écriture de référence : la nouvelle, sans analyse de texte, doit donner les mêmes dates.
const reference = (date: string, jours: number) => {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + jours);
	return d.toISOString().slice(0, 10);
};

describe('ajouterJours', () => {
	it.each([
		['2026-12-31', 1, '2027-01-01'], // fin d'année
		['2027-01-01', -1, '2026-12-31'],
		['2028-02-28', 1, '2028-02-29'], // année bissextile
		['2027-02-28', 1, '2027-03-01'],
		['2026-03-28', 1, '2026-03-29'], // changement d'heure de mars
		['2026-03-29', 1, '2026-03-30'],
		['2026-10-24', 1, '2026-10-25'], // changement d'heure d'octobre
		['2026-10-25', 1, '2026-10-26'],
		['2026-01-31', 365, '2027-01-31'],
		['2026-11-04', 0, '2026-11-04']
	])('%s + %i = %s', (date, jours, attendu) => {
		expect(ajouterJours(date, jours)).toBe(attendu);
	});

	it('donne les mêmes dates que le calcul de référence sur dix ans', () => {
		let jour = '2024-01-01';
		for (let i = 0; i < 3700; i++) {
			expect(ajouterJours(jour, 13)).toBe(reference(jour, 13));
			expect(ajouterJours(jour, -8)).toBe(reference(jour, -8));
			jour = reference(jour, 1);
		}
	});

	it('refuse une date illisible, comme avant', () => {
		expect(() => ajouterJours('pas une date', 1)).toThrow(RangeError);
		expect(() => ajouterJours('', 1)).toThrow(RangeError);
		expect(() => ajouterJours('2026-11-29T08:30', 1)).toThrow(RangeError);
	});

	it('veille : la fin de l’année précédente', () => {
		expect(veille('2027-01-01')).toBe('2026-12-31');
	});
});

describe('rangDuJour', () => {
	it.each([
		['2026-11-02', 0], // lundi
		['2026-11-08', 6], // dimanche
		['2026-10-25', 6], // dimanche du changement d'heure
		['2026-03-29', 6],
		['2027-01-01', 4], // vendredi
		['2026-11-29T08:30', 6] // une date avec son heure : celle des manœuvres
	])('%s : %i', (date, rang) => {
		expect(rangDuJour(date)).toBe(rang);
	});
});

describe('formatDeDate', () => {
	const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' };

	it('réutilise le même format pour les mêmes options', () => {
		expect(formatDeDate({ ...options })).toBe(formatDeDate({ ...options }));
	});

	it('sépare les options et les langues', () => {
		expect(formatDeDate({ month: 'short', timeZone: 'UTC' })).not.toBe(formatDeDate({ month: 'long', timeZone: 'UTC' }));
		expect(formatDeDate({ timeZone: 'UTC' }, 'fr-CA')).not.toBe(formatDeDate({ timeZone: 'UTC' }));
	});

	it('écrit comme un format neuf : fin d’année et changement d’heure compris', () => {
		const zones = ['UTC', 'Europe/Paris'];
		const dates = ['2026-12-31T23:30:00Z', '2027-01-01T00:30:00Z', '2026-03-29T00:59:00Z', '2026-03-29T01:01:00Z', '2026-10-25T00:59:00Z', '2026-10-25T01:01:00Z'];
		for (const timeZone of zones) {
			for (const d of dates) {
				const o: Intl.DateTimeFormatOptions = { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
				expect(formatDeDate(o, 'fr-CA').format(new Date(d))).toBe(new Intl.DateTimeFormat('fr-CA', o).format(new Date(d)));
			}
		}
		expect(formatDeDate(o2()).format(new Date('2026-03-29T00:59:00Z'))).toContain('01:59');
		expect(formatDeDate(o2()).format(new Date('2026-03-29T01:01:00Z'))).toContain('03:01');
	});
});

function o2(): Intl.DateTimeFormatOptions {
	return { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
}

describe('heureDeParis', () => {
	it('l’heure de Paris d’un instant : hiver (+1 h), été (+2 h), passage de minuit', () => {
		expect(heureDeParis(new Date('2026-01-15T09:30:00Z'))).toBe('2026-01-15T10:30');
		expect(heureDeParis(new Date('2026-07-15T09:30:00Z'))).toBe('2026-07-15T11:30');
		expect(heureDeParis(new Date('2026-12-31T23:15:00Z'))).toBe('2027-01-01T00:15');
	});
});

describe('momentEvenement (sans heure de fin, un événement dure 3 h)', () => {
	it('à venir avant son début, en cours jusqu’à 3 h après, passé ensuite', () => {
		expect(finEvenement('2026-10-28T22:00')).toBe('2026-10-29T01:00');
		expect(momentEvenement('2026-10-28T14:00', '2026-10-28T13:59')).toBe('avenir');
		expect(momentEvenement('2026-10-28T14:00', '2026-10-28T14:00')).toBe('enCours');
		expect(momentEvenement('2026-10-28T14:00', '2026-10-28T16:59')).toBe('enCours');
		expect(momentEvenement('2026-10-28T14:00', '2026-10-28T17:00')).toBe('passe');
	});

	it('avec une heure de fin (une manœuvre) : en cours jusqu’à cette fin', () => {
		expect(finEvenement('2026-11-29T07:45', '2026-11-29T12:00')).toBe('2026-11-29T12:00');
		expect(finEvenement('2026-11-29T07:45', null)).toBe('2026-11-29T10:45');
		expect(momentEvenement('2026-11-29T07:45', '2026-11-29T11:59', '2026-11-29T12:00')).toBe('enCours');
		expect(momentEvenement('2026-11-29T07:45', '2026-11-29T12:00', '2026-11-29T12:00')).toBe('passe');
		expect(momentEvenement('2026-11-29T07:45', '2026-11-29T08:30', '2026-11-29T08:00')).toBe('passe');
	});
});
