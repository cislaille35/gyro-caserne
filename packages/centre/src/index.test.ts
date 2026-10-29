import { describe, expect, it } from 'vitest';
import { defineCentre, erreursCentre, type Centre, type JourSemaine } from './index.ts';

const exemple: Centre = {
	id: 'exemple',
	nom: 'CIS Exemple',
	commune: 'Exemple',
	fuseauHoraire: 'Europe/Paris',
	position: { latitude: 48, longitude: -1.7 },
	equipes: [
		{ numero: 1, nom: 'Équipe 1', couleur: '#f5c518' },
		{ numero: 2, nom: 'Équipe 2', couleur: '#e75480' }
	],
	astreinte: {
		debut: { jour: 'vendredi', heure: '17:30' },
		fin: { jour: 'vendredi', heure: '06:00' },
		reference: { date: '2026-01-16', equipe: 1 }
	}
};

describe('erreursCentre', () => {
	it('accepte un centre bien décrit', () => {
		expect(erreursCentre(exemple)).toEqual([]);
	});

	it('repère un id mal formé', () => {
		expect(erreursCentre({ ...exemple, id: 'Mauvais Id' })).toEqual([
			'id « Mauvais Id » : minuscules, chiffres et tirets seulement'
		]);
	});

	it('repère un nom vide', () => {
		expect(erreursCentre({ ...exemple, nom: '  ' })).toEqual(['nom vide']);
	});

	it('repère un fuseau horaire inconnu', () => {
		expect(erreursCentre({ ...exemple, fuseauHoraire: 'Europe/Laillé' })).toEqual([
			'fuseau horaire « Europe/Laillé » inconnu'
		]);
		// Un décalage fixe ignore le passage à l'heure d'été
		expect(erreursCentre({ ...exemple, fuseauHoraire: '+01:00' })).toEqual(['fuseau horaire « +01:00 » inconnu']);
	});

	it('repère une position hors des limites', () => {
		expect(erreursCentre({ ...exemple, position: { latitude: 91, longitude: 0 } })).toEqual([
			'position hors des limites'
		]);
		expect(erreursCentre({ ...exemple, position: { latitude: 0, longitude: -181 } })).toEqual([
			'position hors des limites'
		]);
	});

	it('repère une rotation à une seule équipe', () => {
		const centre = { ...exemple, equipes: [exemple.equipes[0]] };
		expect(erreursCentre(centre)).toEqual(['il faut au moins deux équipes pour une rotation']);
	});

	it('repère un jour inconnu', () => {
		const centre = {
			...exemple,
			astreinte: { ...exemple.astreinte, fin: { jour: 'vendredy' as JourSemaine, heure: '06:00' } }
		};
		expect(erreursCentre(centre)).toEqual(['astreinte, fin : jour « vendredy » inconnu']);
	});

	it('repère une heure mal formée', () => {
		const centre = { ...exemple, astreinte: { ...exemple.astreinte, debut: { jour: 'vendredi' as const, heure: '24:00' } } };
		expect(erreursCentre(centre)).toEqual(['astreinte, début : heure « 24:00 » au format HH:MM attendue']);
	});

	it('repère une date de référence mal écrite', () => {
		const centre = { ...exemple, astreinte: { ...exemple.astreinte, reference: { date: '16/01/2026', equipe: 1 } } };
		expect(erreursCentre(centre)).toEqual(['astreinte, référence : date « 16/01/2026 » invalide']);
	});

	it('repère une date de référence qui n’existe pas', () => {
		// Le 31 avril n'existe pas (JavaScript le lirait comme le vendredi 1er mai)
		const centre = { ...exemple, astreinte: { ...exemple.astreinte, reference: { date: '2026-04-31', equipe: 1 } } };
		expect(erreursCentre(centre)).toEqual(['astreinte, référence : date « 2026-04-31 » invalide']);
		const mois13 = { ...exemple, astreinte: { ...exemple.astreinte, reference: { date: '2026-13-01', equipe: 1 } } };
		expect(erreursCentre(mois13)).toEqual(['astreinte, référence : date « 2026-13-01 » invalide']);
	});

	it('repère une date de référence qui ne tombe pas le jour de prise', () => {
		const centre = { ...exemple, astreinte: { ...exemple.astreinte, reference: { date: '2026-01-15', equipe: 1 } } };
		expect(erreursCentre(centre)).toEqual(["astreinte, référence : le 2026-01-15 n'est pas un vendredi"]);
	});

	it('repère une équipe de référence inconnue', () => {
		const centre = { ...exemple, astreinte: { ...exemple.astreinte, reference: { date: '2026-01-16', equipe: 5 } } };
		expect(erreursCentre(centre)).toEqual(['astreinte, référence : équipe 5 inconnue']);
	});

	it('repère des équipes mal numérotées et une couleur invalide', () => {
		const centre = {
			...exemple,
			equipes: [
				{ numero: 1, nom: 'A', couleur: 'jaune' },
				{ numero: 3, nom: 'B', couleur: '#000000' }
			]
		};
		expect(erreursCentre(centre)).toEqual([
			'équipe « A » : couleur « jaune » invalide',
			'équipe « B » : numéro 3 au lieu de 2'
		]);
	});
});

describe('defineCentre', () => {
	it('refuse un centre mal décrit', () => {
		expect(() => defineCentre({ ...exemple, id: 'Mauvais Id' })).toThrow(/minuscules/);
	});

	it('garde les messages 12 mois par défaut, ou la durée choisie', () => {
		expect(defineCentre(exemple).conservationMessagesMois).toBe(12);
		expect(defineCentre({ ...exemple, conservationMessagesMois: 24 }).conservationMessagesMois).toBe(24);
	});

	it('refuse une durée de conservation qui n’est pas un nombre entier de mois, 1 au moins', () => {
		for (const mois of [0, 1.5, -3])
			expect(erreursCentre({ ...exemple, conservationMessagesMois: mois })).toEqual([`conservation des messages : ${mois} mois, un nombre entier de 1 au moins attendu`]);
	});
});
