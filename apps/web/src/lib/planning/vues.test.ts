import { describe, expect, it } from 'vitest';
import centre from '$centre';
import { calculerAnnee, feries } from '@gyro-caserne/socle';
import { grilleDuMois, joursDeLaSemaine, plagesDuJour, reperesDe, reperesDeLaGrille, resumeDuMois, type Donnees } from './vues.ts';

const semaines = calculerAnnee(2026, centre.astreinte, [1, 2, 3, 4], new Map()).map((s) => ({ ...s, mienne: s.equipeId === 1 }));
const semaine = (debut: string) => semaines.find((s) => s.debut === debut)!;
const d: Donnees = {
	annee: 2026,
	feries: feries(2026),
	vacances: [{ id: 1, nom: 'Vacances de la Toussaint', debut: '2026-10-17', fin: '2026-11-02' }],
	manoeuvres: [
		{ id: 1, debut: '2026-11-08T08:30', theme: 'Sport + SAP', convoque: true },
		{ id: 2, debut: '2026-11-10T19:00', theme: 'Feux', convoque: false }
	],
	remplacements: [{ debut: '2026-11-09T18:00', fin: '2026-11-10T06:00', titulaire: 'Alice Martin', remplacant: 'Bruno Petit', moi: null }]
};

describe('vues du planning', () => {
	it('les plages d’un jour : nuit, journée entière, début et fin d’un week-end', () => {
		const p = semaine('2026-11-06').periodes;
		expect(plagesDuJour('2026-11-06', p)).toEqual(['dès 18 h']);
		expect(plagesDuJour('2026-11-07', p)).toEqual(['24 h']);
		expect(plagesDuJour('2026-11-09', p)).toEqual(['jusqu’à 6 h', '18 h – 6 h']);
		// Le 11 novembre est férié : toute la journée.
		expect(plagesDuJour('2026-11-11', p)).toEqual(['24 h']);
		expect(plagesDuJour('2026-11-13', p)).toEqual([]);
	});

	it('la semaine du vendredi au jeudi, avec ses repères du jour', () => {
		const jours = joursDeLaSemaine(semaine('2026-11-06'), d, 'equipes');
		expect(jours.map((j) => j.date)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
		expect(jours[2]!.reperes).toEqual([{ genre: 'manoeuvre', texte: '« Sport + SAP », 8 h 30', date: '2026-11-08' }]);
		expect(jours[3]!.reperes[0]).toMatchObject({ genre: 'remplacement', texte: expect.stringContaining('Bruno Petit remplace Alice Martin') });
		expect(jours[5]!.reperes[0]).toMatchObject({ genre: 'ferie', texte: 'Armistice 1918' });
	});

	it('mes repères : seulement mes manœuvres et mes remplacements', () => {
		const r = reperesDe(semaine('2026-11-06'), d, 'moi');
		expect(r.map((x) => x.genre)).toEqual(['ferie', 'manoeuvre']);
	});

	it('le mois en bandes de semaines (vendredi → jeudi), à cheval sur deux mois', () => {
		const g = grilleDuMois(2026, 11, semaines);
		expect(g[0]!.semaine.debut).toBe('2026-10-30');
		expect(g[0]!.jours.map((j) => j.dansLeMois)).toEqual([false, false, true, true, true, true, true]);
		expect(g.at(-1)!.semaine.debut).toBe('2026-11-27');
		expect(g).toHaveLength(5);
	});

	it('janvier commence par la semaine de l’année d’avant : jours sans semaine', () => {
		const g = grilleDuMois(2026, 1, semaines);
		expect(g[0]!.semaine.debut).toBe('2026-01-02');
	});

	it('résume un mois', () => {
		const nov = semaines.filter((s) => s.debut.startsWith('2026-11'));
		expect(resumeDuMois(2026, 11, nov, d, 'moi')).toBe('1 astreinte · 1 manœuvre · 2 fériés');
		expect(resumeDuMois(2026, 11, nov, d, 'equipes')).toBe('4 semaines · 2 manœuvres · 2 fériés');
		expect(
			resumeDuMois(
				2026,
				2,
				semaines.filter((s) => s.debut.startsWith('2026-02')),
				{ ...d, manoeuvres: [] },
				'moi'
			)
		).toBe('1 astreinte');
	});

	it('Noël 2026 tombe un vendredi de relève : la semaine va jusqu’au vendredi 18 h, avec la garde de Noël', () => {
		const jours = joursDeLaSemaine(semaine('2026-12-18'), d, 'equipes');
		const noel = jours.find((j) => j.date === '2026-12-25')!;
		expect(noel.plages).toEqual(['jusqu’à 18 h']);
		expect(noel.reperes.map((r) => r.texte)).toEqual(['Noël', 'Garde de Noël']);
		// Une semaine ordinaire s'arrête au jeudi.
		expect(joursDeLaSemaine(semaine('2026-11-06'), d, 'equipes')).toHaveLength(7);
	});

	it('les repères de la grille du mois : chacun à son jour, sans doublon ni remplacement ; Noël et le Nouvel An marqués', () => {
		const r = reperesDeLaGrille(grilleDuMois(2026, 12, semaines), d, 'moi');
		// La garde de Noël est dans la semaine du 18, mais le 25 est la première case de celle du 25.
		expect(r.filter((x) => x.date === '2026-12-25').map((x) => `${x.genre} ${x.texte}`)).toEqual(['ferie Noël', 'fete Garde de Noël']);
		expect(r.filter((x) => x.genre === 'fete').map((x) => x.date)).toEqual(['2026-12-25', '2026-12-31']);
		expect(reperesDeLaGrille(grilleDuMois(2026, 11, semaines), d, 'equipes').map((x) => x.genre)).toEqual(['ferie', 'manoeuvre', 'manoeuvre', 'ferie']);
	});
});
