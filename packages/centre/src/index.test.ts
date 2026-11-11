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
	it('accepte et contrôle les heures d’astreinte en semaine', () => {
		const avec = (semaine: { debut: string; fin: string }) => ({ ...exemple, astreinte: { ...exemple.astreinte, semaine } });
		expect(erreursCentre(avec({ debut: '18:00', fin: '06:00' }))).toEqual([]);
		expect(erreursCentre(avec({ debut: '18h', fin: '06:00' }))).toEqual(['astreinte en semaine : heure « 18h » au format HH:MM attendue']);
	});

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

	it('accepte un département (vigilance Météo-France) et refuse un numéro inconnu', () => {
		for (const departement of ['35', '01', '2A', '2B', '95']) expect(erreursCentre({ ...exemple, departement })).toEqual([]);
		for (const departement of ['3', '350', '20', '2C', '974', 'ille'])
			expect(erreursCentre({ ...exemple, departement })).toEqual([`département « ${departement} » : numéro de métropole attendu, par exemple 35 ou 2A`]);
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

	it('garde les publications des murs 24 mois par défaut, ou la durée choisie ; même règle que les messages', () => {
		expect(defineCentre(exemple).conservationPublicationsMois).toBe(24);
		expect(defineCentre({ ...exemple, conservationPublicationsMois: 36 }).conservationPublicationsMois).toBe(36);
		for (const mois of [0, 1.5, -3])
			expect(erreursCentre({ ...exemple, conservationPublicationsMois: mois })).toEqual([`conservation des publications : ${mois} mois, un nombre entier de 1 au moins attendu`]);
	});

	it('anomalies : étape « en attente » oui, « vérifiée » non, libellés d’origine, par défaut ; ou le choix du centre', () => {
		expect(defineCentre(exemple).anomalies).toEqual({ enAttente: true, verifiee: false, libelles: {} });
		expect(defineCentre({ ...exemple, anomalies: { verifiee: true, libelles: { reparee: 'Remise en état' } } }).anomalies).toEqual({ enAttente: true, verifiee: true, libelles: { reparee: 'Remise en état' } });
	});

	it('refuse un libellé d’étape vide ou trop long', () => {
		expect(erreursCentre({ ...exemple, anomalies: { libelles: { signalee: ' ' } } })).toEqual(['anomalies, libellé de l’étape « signalee » : de 1 à 30 caractères']);
		expect(erreursCentre({ ...exemple, anomalies: { libelles: { reparee: 'x'.repeat(31) } } })).toEqual(['anomalies, libellé de l’étape « reparee » : de 1 à 30 caractères']);
	});

	it('manœuvres : de 8 h 30 à 11 h 30 et « Oui », « Non » au petit-déjeuner par défaut ; ou le choix du centre', () => {
		expect(defineCentre(exemple).manoeuvres).toEqual({ debut: '08:30', fin: '11:30', petitDejeuner: ['Oui', 'Non'] });
		expect(defineCentre({ ...exemple, manoeuvres: { debut: '07:45', fin: '12:00' } }).manoeuvres).toEqual({ debut: '07:45', fin: '12:00', petitDejeuner: ['Oui', 'Non'] });
		const choix = ['Croissant', 'Pain au chocolat', 'Pain au raisin', 'Rien pour moi'];
		expect(defineCentre({ ...exemple, manoeuvres: { petitDejeuner: choix } }).manoeuvres).toEqual({ debut: '08:30', fin: '11:30', petitDejeuner: choix });
	});

	it('manœuvres : heures au format HH:MM, la fin après le début', () => {
		expect(erreursCentre({ ...exemple, manoeuvres: { debut: '7h45' } })).toEqual(['manœuvres, début : heure « 7h45 » au format HH:MM attendue']);
		expect(erreursCentre({ ...exemple, manoeuvres: { fin: '24:00' } })).toEqual(['manœuvres, fin : heure « 24:00 » au format HH:MM attendue']);
		expect(erreursCentre({ ...exemple, manoeuvres: { debut: '12:00', fin: '07:45' } })).toEqual(['manœuvres : la fin (12:00 → 07:45) doit suivre le début, le même jour']);
		// Avec le début par défaut (08:30)
		expect(erreursCentre({ ...exemple, manoeuvres: { fin: '08:00' } })).toEqual(['manœuvres : la fin (08:30 → 08:00) doit suivre le début, le même jour']);
	});

	it('manœuvres : de 2 à 6 choix de petit-déjeuner, distincts, de 1 à 100 caractères', () => {
		const avec = (petitDejeuner: string[]) => erreursCentre({ ...exemple, manoeuvres: { petitDejeuner } });
		expect(avec(['Oui'])).toEqual(['manœuvres, petit-déjeuner : de 2 à 6 choix']);
		expect(avec(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual(['manœuvres, petit-déjeuner : de 2 à 6 choix']);
		expect(avec(['Croissant', ' '])).toEqual(['manœuvres, petit-déjeuner : choix vide']);
		expect(avec(['Croissant', 'x'.repeat(101)])).toEqual([`manœuvres, petit-déjeuner : choix « ${'x'.repeat(101)} », 100 caractères au plus`]);
		expect(avec(['Croissant', 'croissant '])).toEqual(['manœuvres, petit-déjeuner : choix « croissant » en double']);
	});
});
