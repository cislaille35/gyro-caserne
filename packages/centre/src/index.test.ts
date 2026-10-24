import { describe, expect, it } from 'vitest';
import { defineCentre, erreursCentre, type Centre } from './index.ts';

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

	it('repère une date de référence qui ne tombe pas le jour de prise', () => {
		const centre = { ...exemple, astreinte: { ...exemple.astreinte, reference: { date: '2026-01-15', equipe: 1 } } };
		expect(erreursCentre(centre)).toEqual(["astreinte, référence : le 2026-01-15 n'est pas un vendredi"]);
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
});
