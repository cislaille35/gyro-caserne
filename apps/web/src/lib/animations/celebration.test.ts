import { describe, expect, it } from 'vitest';
import { aCelebrer, lireVus, momentAnniversaire, momentPlanningPublie, momentPremiereReservation, noterVu } from './celebration.ts';

const memoire = () => {
	const m = new Map<string, string>();
	return { getItem: (c: string) => m.get(c) ?? null, setItem: (c: string, v: string) => void m.set(c, v), m };
};
const enPanne = {
	getItem: () => {
		throw new Error('bloqué');
	},
	setItem: () => {
		throw new Error('bloqué');
	}
};

describe('moments à célébrer', () => {
	it('anniversaire : une fois dans la journée', () => {
		expect(momentAnniversaire(true, '2026-11-01')).toMatchObject({ cle: 'anniversaire:2026-11-01', tenue: 'anniversaire' });
		expect(momentAnniversaire(false, '2026-11-01')).toBeNull();
	});

	it('première réservation acceptée : seulement quand il n’y en a qu’une', () => {
		const r = (etat: string) => ({ etat });
		expect(momentPremiereReservation([r('acceptee'), r('attente')])).toMatchObject({ cle: 'premiere-reservation' });
		expect(momentPremiereReservation([r('attente'), r('refusee')])).toBeNull();
		expect(momentPremiereReservation([r('acceptee'), r('acceptee')])).toBeNull();
	});

	it('année du planning publiée : par année', () => {
		expect(momentPlanningPublie(2027)).toMatchObject({ cle: 'planning-publie:2027', texte: expect.stringContaining('2027') });
		expect(momentPlanningPublie(null)).toBeNull();
	});
});

describe('quand célébrer', () => {
	const moment = momentPlanningPublie(2027);

	it('une fois par moment', () => {
		expect(aCelebrer(moment, [], { niveau: 'vivant', reduit: false })).toBe(true);
		expect(aCelebrer(moment, ['planning-publie:2027'], { niveau: 'vivant', reduit: false })).toBe(false);
		expect(aCelebrer(null, [], { niveau: 'vivant', reduit: false })).toBe(false);
	});

	it('jamais si « réduire les animations » ou affichage sobre', () => {
		expect(aCelebrer(moment, [], { niveau: 'vivant', reduit: true })).toBe(false);
		expect(aCelebrer(moment, [], { niveau: 'sobre', reduit: false })).toBe(false);
		expect(aCelebrer(moment, [], { niveau: 'equilibre', reduit: false })).toBe(true);
	});
});

describe('mémoire du navigateur', () => {
	it('par personne', () => {
		const s = memoire();
		noterVu(s, 'p:1', 'premiere-reservation');
		expect(lireVus(s, 'p:1')).toEqual(['premiere-reservation']);
		expect(lireVus(s, 'p:2')).toEqual([]);
	});

	it('ne garde que les derniers moments', () => {
		const s = memoire();
		for (let i = 0; i < 60; i++) noterVu(s, 'p:1', `anniversaire:${i}`);
		expect(lireVus(s, 'p:1')).toHaveLength(50);
		expect(lireVus(s, 'p:1').at(-1)).toBe('anniversaire:59');
	});

	it('sans mémoire (bloquée, absente ou abîmée) : rien ne casse', () => {
		expect(lireVus(enPanne, 'p:1')).toEqual([]);
		expect(() => noterVu(enPanne, 'p:1', 'x')).not.toThrow();
		expect(lireVus(undefined, 'p:1')).toEqual([]);
		const s = memoire();
		s.m.set('gyro.celebrations.p:1', '{pas du json');
		expect(lireVus(s, 'p:1')).toEqual([]);
		s.m.set('gyro.celebrations.p:1', '{"a":1}');
		expect(lireVus(s, 'p:1')).toEqual([]);
	});
});
