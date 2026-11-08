import { describe, expect, it } from 'vitest';
import { murDuComite, phraseAudience, phraseDuMur } from './phrases.ts';

describe('phraseAudience', () => {
	it('Le centre et Vie du centre : tous les agents, avec le nombre', () => {
		expect(phraseAudience('centre', 'Le centre', 38)).toBe('Visible par tous les agents du centre (38)');
		expect(phraseAudience('vie', 'Vie du centre', 38)).toBe('Visible par tous les agents du centre (38)');
	});
	it('une équipe : ses membres, le chef et l’adjoint ; « le membre » quand il est seul', () => {
		expect(phraseAudience('equipe', 'Équipe 1', 9)).toBe('Visible par les 9 membres de l’équipe 1, le chef et l’adjoint');
		expect(phraseAudience('equipe', 'Équipe 1', 1)).toBe('Visible par le membre de l’équipe 1, le chef et l’adjoint');
		expect(phraseAudience('equipe', 'Rouge', 4)).toBe('Visible par les 4 membres de l’équipe Rouge, le chef et l’adjoint');
	});
	it('un comité : ses membres, le chef et l’adjoint', () => {
		expect(phraseAudience('comite', 'Amicale', 12)).toBe('Visible par les 12 membres de l’Amicale, le chef et l’adjoint');
		expect(phraseAudience('comite', 'Comité du centre', 1)).toBe('Visible par le membre du comité du centre, le chef et l’adjoint');
		expect(phraseAudience('comite', 'Sport', 5)).toBe('Visible par les 5 membres du comité Sport, le chef et l’adjoint');
	});
	it('sans membre : le dit, au lieu de « les 0 membres »', () => {
		expect(phraseAudience('comite', 'Comité du centre', 0)).toBe('Aucun membre pour l’instant : visible par le chef et l’adjoint');
		expect(phraseAudience('equipe', 'Équipe 3', 0)).toBe('Aucun membre pour l’instant : visible par le chef et l’adjoint');
	});
});

describe('phraseDuMur', () => {
	it('une phrase par sorte de mur', () => {
		expect(phraseDuMur('centre')).toBe('Les infos officielles du chef et de l’adjoint');
		expect(phraseDuMur('vie')).toBe('Pour tout le monde : sorties, sport, photos');
		expect(phraseDuMur('equipe')).toBe('Votre équipe d’astreinte');
	});
	it('un comité : rien, la phrase répéterait son nom', () => {
		expect(phraseDuMur('comite')).toBeNull();
	});
});

describe('murDuComite', () => {
	it('le nom du lien vers le mur d’un comité', () => {
		expect(murDuComite('Amicale')).toBe('Le mur de l’Amicale');
		expect(murDuComite('Comité du centre')).toBe('Le mur du comité du centre');
		expect(murDuComite('Sport')).toBe('Le mur du comité Sport');
	});
});
