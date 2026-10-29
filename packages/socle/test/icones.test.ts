import { describe, expect, it } from 'vitest';
import { iconeDuComite, iconeDuRole } from '../src/icones.ts';

const role = (champs: Partial<Parameters<typeof iconeDuRole>[0]>) => ({ nom: 'Rôle', icone: null, modele: null, systeme: null, portee: 'centre', ...champs });

describe('iconeDuRole', () => {
	it('l’icône choisie d’abord, puis celle du modèle', () => {
		expect(iconeDuRole(role({ icone: 'ballon', modele: 'referent_pharmacie', nom: 'Référent engins' }))).toBe('ballon');
		expect(iconeDuRole(role({ modele: 'referent_pharmacie', nom: 'Référent engins' }))).toBe('croix');
	});

	it('puis selon le nom', () => {
		expect(iconeDuRole(role({ nom: 'Référent engins' }))).toBe('camion');
		expect(iconeDuRole(role({ nom: 'Référent pharmacie' }))).toBe('croix');
		expect(iconeDuRole(role({ nom: 'Référent technique' }))).toBe('cle');
	});

	it('sinon selon le thème, qui découle de la portée', () => {
		expect(iconeDuRole(role({ nom: 'Chef de centre', systeme: 'chef_centre' }))).toBe('etoile');
		expect(iconeDuRole(role({ nom: 'Chef de centre adjoint', systeme: 'chef_centre_adjoint' }))).toBe('etoile');
		expect(iconeDuRole(role({ nom: 'Chef d’équipe', systeme: 'chef_equipe', portee: 'equipe' }))).toBe('casque');
		expect(iconeDuRole(role({ nom: 'Rapporteur de comité', portee: 'comite' }))).toBe('groupe');
		expect(iconeDuRole(role({ nom: 'Référent sport' }))).toBe('outil');
	});
});

describe('iconeDuComite', () => {
	it('l’icône choisie quand elle est connue', () => {
		expect(iconeDuComite({ icone: 'ballon', theme: 'amicale' })).toBe('ballon');
	});

	it('sinon selon le thème : cœur pour l’amicale, étoile pour le centre, groupe pour les autres', () => {
		expect(iconeDuComite({ icone: null, theme: 'amicale' })).toBe('coeur');
		expect(iconeDuComite({ icone: null, theme: 'centre' })).toBe('etoile');
		expect(iconeDuComite({ icone: null, theme: 'sport' })).toBe('groupe');
	});

	it('une icône inconnue est ignorée', () => {
		expect(iconeDuComite({ icone: 'licorne', theme: 'amicale' })).toBe('coeur');
	});
});
