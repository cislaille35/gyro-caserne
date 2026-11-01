import { describe, expect, it } from 'vitest';
import { chevauche, jourCourt, joursEntre, restantParJour } from '../src/reservations-calcul.ts';

describe('calcul des réservations', () => {
	it('les jours d’une période, bornes comprises', () => {
		expect(joursEntre('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
		expect(joursEntre('2026-11-02', '2026-11-01')).toEqual([]);
	});

	it('le stock restant par jour : en attente et acceptées comptent, refusées et annulées non', () => {
		const prises = [
			{ debut: '2026-11-12', fin: '2026-11-14', quantite: 5, etat: 'acceptee' },
			{ debut: '2026-11-13', fin: '2026-11-13', quantite: 4, etat: 'attente' },
			{ debut: '2026-11-11', fin: '2026-11-14', quantite: 9, etat: 'refusee' },
			{ debut: '2026-11-11', fin: '2026-11-14', quantite: 9, etat: 'annulee' }
		];
		expect(restantParJour(12, prises, '2026-11-11', '2026-11-14')).toEqual([
			{ jour: '2026-11-11', restant: 12 },
			{ jour: '2026-11-12', restant: 7 },
			{ jour: '2026-11-13', restant: 3 },
			{ jour: '2026-11-14', restant: 7 }
		]);
	});

	it('chevauchement : créneaux bout à bout libres ; jours partagés pris', () => {
		expect(chevauche({ debut: '2026-11-12T10:00', fin: '2026-11-12T12:00' }, { debut: '2026-11-12T12:00', fin: '2026-11-12T14:00' }, 'creneau')).toBe(false);
		expect(chevauche({ debut: '2026-11-12T10:00', fin: '2026-11-12T12:01' }, { debut: '2026-11-12T12:00', fin: '2026-11-12T14:00' }, 'creneau')).toBe(true);
		expect(chevauche({ debut: '2026-11-12', fin: '2026-11-14' }, { debut: '2026-11-14', fin: '2026-11-15' }, 'jours')).toBe(true);
		expect(chevauche({ debut: '2026-11-12', fin: '2026-11-13' }, { debut: '2026-11-14', fin: '2026-11-15' }, 'jours')).toBe(false);
	});

	it('un jour en bref', () => {
		expect(jourCourt('2026-11-13')).toBe('13 nov.');
		expect(jourCourt('2026-11-13T09:00')).toBe('13 nov.');
	});
});
