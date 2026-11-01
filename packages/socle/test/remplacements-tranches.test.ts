import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { feries, periodesDeLaSemaine } from '../src/planning/calendrier.ts';
import { reunir, soustraire, texteDemande, texteTranche, tranchesDe } from '../src/remplacements/tranches.ts';

const reglage = centreExemple.astreinte;
const f2026 = new Set(feries(2026).map((f) => f.date));
const semaine = (debut: string) => tranchesDe(periodesDeLaSemaine(debut, reglage, f2026), reglage);

describe('tranches', () => {
	it('semaine ordinaire : vendredi soir, deux gardes de 24 h, puis les nuits', () => {
		expect(semaine('2026-11-13')).toEqual([
			{ debut: '2026-11-13T18:00', fin: '2026-11-14T06:00' },
			{ debut: '2026-11-14T06:00', fin: '2026-11-15T06:00' },
			{ debut: '2026-11-15T06:00', fin: '2026-11-16T06:00' },
			{ debut: '2026-11-16T18:00', fin: '2026-11-17T06:00' },
			{ debut: '2026-11-17T18:00', fin: '2026-11-18T06:00' },
			{ debut: '2026-11-18T18:00', fin: '2026-11-19T06:00' },
			{ debut: '2026-11-19T18:00', fin: '2026-11-20T06:00' }
		]);
	});

	it('mercredi 11 novembre férié : nuit du mardi, puis 24 h du mercredi', () => {
		expect(semaine('2026-11-06').slice(3, 6)).toEqual([
			{ debut: '2026-11-09T18:00', fin: '2026-11-10T06:00' },
			{ debut: '2026-11-10T18:00', fin: '2026-11-11T06:00' },
			{ debut: '2026-11-11T06:00', fin: '2026-11-12T06:00' }
		]);
	});

	it('nuit du passage à l’heure d’hiver (25 octobre 2026) : heures de Paris inchangées', () => {
		expect(semaine('2026-10-23').slice(1, 3)).toEqual([
			{ debut: '2026-10-24T06:00', fin: '2026-10-25T06:00' },
			{ debut: '2026-10-25T06:00', fin: '2026-10-26T06:00' }
		]);
	});

	it('astreinte continue : tranches de 24 h à l’heure de relève', () => {
		const continu = { ...reglage, semaine: undefined };
		expect(tranchesDe([{ debut: '2026-11-13T18:00', fin: '2026-11-15T18:00' }], continu)).toEqual([
			{ debut: '2026-11-13T18:00', fin: '2026-11-14T18:00' },
			{ debut: '2026-11-14T18:00', fin: '2026-11-15T18:00' }
		]);
	});

	it('soustraire et réunir', () => {
		const p = [{ debut: '2026-11-13T18:00', fin: '2026-11-16T06:00' }];
		expect(soustraire(p, [{ debut: '2026-11-14T06:00', fin: '2026-11-15T06:00' }])).toEqual([
			{ debut: '2026-11-13T18:00', fin: '2026-11-14T06:00' },
			{ debut: '2026-11-15T06:00', fin: '2026-11-16T06:00' }
		]);
		expect(reunir(semaine('2026-11-13').slice(0, 3))).toEqual(p);
	});

	it('textes', () => {
		expect(texteTranche({ debut: '2026-11-16T18:00', fin: '2026-11-17T06:00' })).toBe('nuit du lundi 16 novembre');
		expect(texteTranche({ debut: '2026-11-14T06:00', fin: '2026-11-15T06:00' })).toBe('24 h du samedi 14 novembre');
		expect(texteDemande(semaine('2026-11-13').slice(0, 3))).toBe('du vendredi 13 novembre, 18 h au lundi 16 novembre, 6 h');
		expect(texteDemande([semaine('2026-11-13')[3]!, semaine('2026-11-13')[5]!])).toBe('nuit du lundi 16 novembre et nuit du mercredi 18 novembre');
	});
});
