import { describe, expect, it } from 'vitest';
import { ceJour, disponibilite, decaler, ETATS, grilleDuMois, horaire, jourLong, moisDe, premierDuMois, semaine } from './reservations.ts';

const r = (debut: string, fin: string, etat = 'acceptee') => ({ debut, fin, etat, quantite: 2 }) as never;

describe('calendrier des réservations', () => {
	it('la semaine (du lundi au dimanche) et la grille du mois (6 semaines, du lundi)', () => {
		expect(semaine('2026-11-05')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
		expect(semaine('2026-11-02')[0]).toBe('2026-11-02');
		expect(semaine('2026-11-08')[0]).toBe('2026-11-02');
		const grille = grilleDuMois('2026-11-17');
		expect(grille).toHaveLength(42);
		expect(grille[0]).toBe('2026-10-26');
		expect(grille[41]).toBe('2026-12-06');
	});

	it('dates en mots et navigation', () => {
		expect(jourLong('2026-11-02')).toBe('lundi 2 nov.');
		expect(moisDe('2026-11-17')).toBe('novembre 2026');
		expect(decaler('2026-11-30', 7)).toBe('2026-12-07');
		expect(premierDuMois('2026-01-31', -1)).toBe('2025-12-01');
		expect(premierDuMois('2026-11-17', 1)).toBe('2026-12-01');
	});

	it('ce qui est pris un jour : jours compris, créneau dont la fin à minuit libère le jour', () => {
		const liste = [r('2026-11-12', '2026-11-14'), r('2026-11-07T18:00', '2026-11-08T00:00'), r('2026-11-07T09:00', '2026-11-09T12:00')];
		expect(ceJour(liste, '2026-11-13')).toHaveLength(1);
		expect(ceJour(liste, '2026-11-08')).toEqual([liste[2]]);
		expect(ceJour(liste, '2026-11-07')).toHaveLength(2);
	});

	it('l’horaire d’un créneau, vu d’un jour', () => {
		expect(horaire({ debut: '2026-11-07T09:00', fin: '2026-11-07T12:30' }, '2026-11-07')).toBe('9 h – 12 h 30');
		expect(horaire({ debut: '2026-11-07T18:00', fin: '2026-11-09T12:00' }, '2026-11-07')).toBe('Dès 18 h');
		expect(horaire({ debut: '2026-11-07T18:00', fin: '2026-11-09T12:00' }, '2026-11-08')).toBe('Toute la journée');
		expect(horaire({ debut: '2026-11-07T18:00', fin: '2026-11-09T12:00' }, '2026-11-09')).toBe('Jusqu’à 12 h');
	});

	it('les états, toujours écrits', () => {
		expect(ETATS.attente).toEqual({ libelle: 'En attente', ton: 'alerte' });
		expect(ETATS.acceptee.libelle).toBe('Acceptée');
		expect(ETATS.refusee.libelle).toBe('Refusée');
		expect(ETATS.annulee.libelle).toBe('Annulée');
	});
});

describe('disponibilité affichée dans « Réserver »', () => {
	const bancs = { nom: 'Bancs', forme: 'jours', stock: 12, gestionnaire: { nom: 'Amicale' } } as never;
	const vl = { nom: 'VL', forme: 'creneau', stock: null, gestionnaire: { nom: 'Référent engins' } } as never;
	const prises = [{ debut: '2026-11-12', fin: '2026-11-14', quantite: 9, etat: 'acceptee' }];
	it('matériel', () => {
		expect(disponibilite(bancs, prises, { debut: '2026-11-10', fin: '2026-11-11', quantite: '12' })).toEqual({ ton: 'ok', texte: 'Disponible : 12 sur 12 sur toute la période.' });
		expect(disponibilite(bancs, prises, { debut: '2026-11-10', fin: '2026-11-12', quantite: '3' })).toEqual({ ton: 'ok', texte: 'Disponible : il en reste au moins 3 sur toute la période.' });
		expect(disponibilite(bancs, prises, { debut: '2026-11-10', fin: '2026-11-12', quantite: '4' })).toEqual({ ton: 'danger', texte: 'Pas assez : il en reste 3 le 12 nov.' });
		expect(disponibilite(bancs, prises, { debut: '2026-11-12', fin: '2026-11-10', quantite: '1' })).toBeNull();
		expect(disponibilite(bancs, prises, { debut: '', fin: '', quantite: '1' })).toBeNull();
	});
	it('créneau', () => {
		const pris = [{ debut: '2026-11-07T09:00', fin: '2026-11-07T12:00', quantite: 1, etat: 'acceptee' }];
		expect(disponibilite(vl, pris, { debut: '2026-11-07T12:00', fin: '2026-11-07T14:00', quantite: '1' })).toEqual({ ton: 'ok', texte: 'Libre : la réservation est acceptée dès l’envoi.' });
		expect(disponibilite(vl, pris, { debut: '2026-11-07T11:00', fin: '2026-11-07T14:00', quantite: '1' })).toEqual({ ton: 'alerte', texte: 'Créneau déjà demandé : votre demande attendra la décision de Référent engins.' });
		expect(disponibilite(vl, pris, { debut: '2026-11-07T14:00', fin: '2026-11-07T11:00', quantite: '1' })).toBeNull();
	});
});
