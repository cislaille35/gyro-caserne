import { describe, expect, it } from 'vitest';
import { phraseAudience, phraseDuMur } from './phrases.ts';

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
});

describe('phraseDuMur', () => {
	it('une phrase par sorte de mur', () => {
		expect(phraseDuMur('centre', 'Le centre')).toBe('Les infos officielles du chef et de l’adjoint');
		expect(phraseDuMur('vie', 'Vie du centre')).toBe('Pour tout le monde : sorties, sport, photos');
		expect(phraseDuMur('equipe', 'Équipe 1')).toBe('Votre équipe d’astreinte');
		expect(phraseDuMur('comite', 'Amicale')).toBe('Le comité Amicale');
		expect(phraseDuMur('comite', 'Comité du centre')).toBe('Comité du centre');
	});
});
