import { describe, expect, it } from 'vitest';
import { duAu, momentLong, moisDeLAnnee, semainesParMois, dansLaSemaine } from './dates.ts';

describe('dates du planning', () => {
	it('dit un moment en entier, l’heure sans zéro inutile', () => {
		expect(momentLong('2026-11-06T18:00')).toBe('vendredi 6 novembre, 18 h');
		expect(momentLong('2026-11-13T06:30')).toBe('vendredi 13 novembre, 6 h 30');
		expect(momentLong('2026-05-01T08:00')).toBe('vendredi 1er mai, 8 h');
	});

	it('dit une semaine courte, sur un ou deux mois', () => {
		expect(duAu('2026-11-06', '2026-11-13')).toBe('6 – 13 nov.');
		expect(duAu('2026-11-27', '2026-12-04')).toBe('27 nov. – 4 déc.');
		expect(duAu('2026-05-01', '2026-05-08')).toBe('1er – 8 mai');
		expect(duAu('2026-04-24', '2026-05-01')).toBe('24 avr. – 1er mai');
	});

	it('range les semaines par mois de relève ; douze mois même vides', () => {
		const mois = semainesParMois(2026, [{ debut: '2026-01-02' }, { debut: '2026-01-30' }, { debut: '2026-02-06' }]);
		expect(mois).toHaveLength(12);
		expect(mois[0]).toMatchObject({ nom: 'Janvier', semaines: [{ debut: '2026-01-02' }, { debut: '2026-01-30' }] });
		expect(mois[11]!.semaines).toEqual([]);
		expect(moisDeLAnnee[2]).toBe('Mars');
	});

	it('une date est dans la semaine de relève à relève', () => {
		expect(dansLaSemaine('2026-11-12', '2026-11-06')).toBe(true);
		expect(dansLaSemaine('2026-11-13', '2026-11-06')).toBe(false);
	});
});
