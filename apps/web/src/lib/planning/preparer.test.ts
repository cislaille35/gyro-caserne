import { describe, expect, it } from 'vitest';
import centre from '$centre';
import { calculerAnnee } from '@gyro-caserne/socle';
import { deplacer, echangePropose, etapeDe, recapitulatif } from './preparer.ts';

const semaines = calculerAnnee(2027, centre.astreinte, [1, 2, 3, 4], new Map());

describe('préparer l’année', () => {
	it('l’étape vient de l’adresse, Roulement par défaut', () => {
		expect(etapeDe(new URL('http://x/?etape=fetes'))).toBe('fetes');
		expect(etapeDe(new URL('http://x/?etape=nimporte'))).toBe('roulement');
		expect(etapeDe(new URL('http://x/'))).toBe('roulement');
	});

	it('monter et descendre une équipe ; rien ne bouge aux bords', () => {
		expect(deplacer([1, 2, 3, 4], 1, -1)).toEqual([2, 1, 3, 4]);
		expect(deplacer([1, 2, 3, 4], 1, 1)).toEqual([1, 3, 2, 4]);
		expect(deplacer([1, 2, 3, 4], 0, -1)).toEqual([1, 2, 3, 4]);
		expect(deplacer([1, 2, 3, 4], 3, 1)).toEqual([1, 2, 3, 4]);
		expect(deplacer([1, 2, 3, 4], 9, 1)).toEqual([1, 2, 3, 4]);
	});

	it('propose d’échanger la semaine de Noël avec la plus proche d’une équipe dont c’est le tour', () => {
		const noel = semaines.find((s) => s.debut === '2027-12-24')!;
		expect(noel.equipeId).toBe(4);
		const e = echangePropose(semaines, 'noel', [2], 2027)!;
		expect(e.fete.debut).toBe('2027-12-24');
		// Équipe 2 : la semaine du 10 décembre, deux avant Noël.
		expect(e.autre).toMatchObject({ debut: '2027-12-10', equipeId: 2 });
		expect(echangePropose(semaines, 'noel', [4], 2027)).toBeNull();
		expect(echangePropose(semaines, 'noel', [], 2027)).toBeNull();
	});

	it('récapitule l’année', () => {
		const r = recapitulatif({ semaines, manoeuvres: [{ annulee: false }, { annulee: true }], vacances: [{}], fetes: { noel: 4, nouvelAn: 1 }, equipes: [1, 2, 3, 4].map((id) => ({ id, nom: `Équipe ${id}`, couleur: '#000' })) });
		expect(r).toEqual(['53 semaines, aucune changée', '1 manœuvre', 'Noël : Équipe 4 · Nouvel An : Équipe 1', '1 période de vacances']);
	});
});
