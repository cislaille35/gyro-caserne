import { describe, expect, it } from 'vitest';
import { calculerAnnee, equipeA, feries, fetes, periodesDeLaSemaine, semainesDe, tourDesFetes, type Reglage } from '../src/planning/calendrier.ts';

const laille: Reglage = {
	debut: { jour: 'vendredi', heure: '18:00' },
	fin: { jour: 'vendredi', heure: '06:00' },
	reference: { date: '2026-01-02', equipe: 1 },
	semaine: { debut: '18:00', fin: '06:00' }
};
const continu: Reglage = { debut: { jour: 'lundi', heure: '08:00' }, fin: { jour: 'lundi', heure: '08:00' }, reference: { date: '2026-01-05', equipe: 1 } };
const fer = (annee: number) => new Set(feries(annee).map((f) => f.date));

describe('jours fériés', () => {
	it('calcule Pâques et les fêtes mobiles', () => {
		const f = feries(2026);
		expect(f).toHaveLength(11);
		expect(f).toContainEqual({ date: '2026-04-06', nom: 'Lundi de Pâques' });
		expect(f).toContainEqual({ date: '2026-05-14', nom: 'Ascension' });
		expect(f).toContainEqual({ date: '2026-05-25', nom: 'Lundi de Pentecôte' });
		expect(f.map((x) => x.date)).toContain('2026-12-25');
		expect(feries(2027)).toContainEqual({ date: '2027-03-29', nom: 'Lundi de Pâques' });
	});
});

describe('semaines', () => {
	it('une semaine appartient à l’année où elle commence', () => {
		const s = semainesDe(2027, laille);
		expect(s[0]).toEqual({ debut: '2027-01-01', numero: 53 });
		expect(s.at(-1)!.debut).toBe('2027-12-31');
		expect(s).toHaveLength(53);
		expect(semainesDe(2026, laille)[0]).toEqual({ debut: '2026-01-02', numero: 1 });
	});
});

describe('périodes d’astreinte aux vraies heures', () => {
	it('semaine ordinaire : du vendredi 18 h au lundi 6 h, puis les nuits', () => {
		expect(periodesDeLaSemaine('2026-11-13', laille, fer(2026))).toEqual([
			{ debut: '2026-11-13T18:00', fin: '2026-11-16T06:00' },
			{ debut: '2026-11-16T18:00', fin: '2026-11-17T06:00' },
			{ debut: '2026-11-17T18:00', fin: '2026-11-18T06:00' },
			{ debut: '2026-11-18T18:00', fin: '2026-11-19T06:00' },
			{ debut: '2026-11-19T18:00', fin: '2026-11-20T06:00' }
		]);
	});

	it('un jeudi férié : du mercredi 18 h au vendredi 6 h d’un seul tenant', () => {
		// Ascension, jeudi 14 mai 2026
		expect(periodesDeLaSemaine('2026-05-08', laille, fer(2026))).toEqual([
			// Le vendredi 8 mai est férié : la relève reste à 18 h
			{ debut: '2026-05-08T18:00', fin: '2026-05-11T06:00' },
			{ debut: '2026-05-11T18:00', fin: '2026-05-12T06:00' },
			{ debut: '2026-05-12T18:00', fin: '2026-05-13T06:00' },
			{ debut: '2026-05-13T18:00', fin: '2026-05-15T06:00' }
		]);
	});

	it('relève un vendredi férié : la semaine sortante va jusqu’à 18 h', () => {
		expect(periodesDeLaSemaine('2026-12-18', laille, fer(2026)).at(-1)).toEqual({ debut: '2026-12-24T18:00', fin: '2026-12-25T18:00' });
	});

	it('sans heures de semaine : une seule période continue', () => {
		expect(periodesDeLaSemaine('2026-11-16', continu, fer(2026))).toEqual([{ debut: '2026-11-16T08:00', fin: '2026-11-23T08:00' }]);
	});
});

describe('équipes de l’année', () => {
	const ordre = [12, 13, 14, 15];

	it('suit le roulement, sauf les semaines changées', () => {
		const annee = calculerAnnee(2026, laille, ordre, new Map([['2026-01-09', 15]]));
		expect(annee.slice(0, 4).map((s) => s.equipeId)).toEqual([12, 15, 14, 15]);
		expect(annee[1]!.changee).toBe(true);
		expect(annee[0]!.changee).toBe(false);
	});

	it('restreinte à une période (l’été) : les mêmes semaines que l’année entière, roulement et semaines changées compris', () => {
		const changees = new Map([['2026-07-10', 15]]);
		const ete = { debut: '2026-06-26', fin: '2026-09-04' };
		const toute = calculerAnnee(2026, laille, ordre, changees).filter((s) => s.debut >= ete.debut && s.debut < ete.fin);
		expect(toute.length).toBeGreaterThan(8);
		expect(calculerAnnee(2026, laille, ordre, changees, ete)).toEqual(toute);
	});

	it('Noël et Nouvel An : l’équipe d’astreinte le 25 à midi et le 31 au soir', () => {
		const annee = calculerAnnee(2026, laille, ordre, new Map());
		// Semaine du 18 décembre (index 50) : 50 % 4 = 2 ; semaine du 25 décembre : 3
		expect(fetes(2026, annee)).toEqual({ noel: 14, nouvelAn: 15 });
		expect(equipeA('2026-12-25T19:00', annee)).toBe(15);
		expect(equipeA('2026-11-18T12:00', annee)).toBeNull();
	});
});

describe('tour des fêtes', () => {
	it('attend l’équipe qui l’a tenue il y a le plus longtemps, ou jamais', () => {
		const historique = [
			{ annee: 2023, fete: 'noel' as const, equipeId: 1 },
			{ annee: 2024, fete: 'noel' as const, equipeId: 2 },
			{ annee: 2025, fete: 'noel' as const, equipeId: 3 },
			{ annee: 2025, fete: 'nouvel_an' as const, equipeId: 1 }
		];
		expect(tourDesFetes(historique, [1, 2, 3, 4], 2026)).toEqual({ noel: [4], nouvelAn: [2, 3, 4] });
		expect(tourDesFetes([...historique, { annee: 2022, fete: 'noel', equipeId: 4 }], [1, 2, 3, 4], 2026).noel).toEqual([4]);
		// L'année elle-même et les suivantes ne comptent pas
		expect(tourDesFetes([{ annee: 2026, fete: 'noel', equipeId: 1 }], [1, 2], 2026).noel).toEqual([1, 2]);
	});
});
