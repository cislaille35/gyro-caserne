import { describe, expect, it } from 'vitest';
import { aPropos, avecBrouillon, gestesMembre, resumeGroupe } from './infos.ts';

describe('infos d’une conversation', () => {
	it('« Groupe · N membres · créé par X », vous quand c’est soi', () => {
		expect(resumeGroupe({ membres: 4, creePar: 2, creeParPrenom: 'Romain' }, 1)).toBe('Groupe · 4 membres · créé par Romain');
		expect(resumeGroupe({ membres: 2, creePar: 1, creeParPrenom: 'Thomas' }, 1)).toBe('Groupe · 2 membres · créé par vous');
		expect(resumeGroupe({ membres: 1, creePar: 9, creeParPrenom: null }, 1)).toBe('Groupe · 1 membre');
	});

	it('le menu d’un membre : écrire pour tous ; nommer et retirer pour les animateurs ; pas de nommer pour un animateur', () => {
		const manon = { prenom: 'Manon', animateur: false };
		expect(gestesMembre(manon, false)).toEqual([{ cle: 'ecrire', libelle: 'Écrire à Manon' }]);
		expect(gestesMembre(manon, true)).toEqual([
			{ cle: 'ecrire', libelle: 'Écrire à Manon' },
			{ cle: 'nommer', libelle: 'Nommer animateur' },
			{ cle: 'retirer', libelle: 'Retirer du groupe', danger: true }
		]);
		expect(gestesMembre({ prenom: 'Romain', animateur: true }, true).map((g) => g.cle)).toEqual(['ecrire', 'retirer']);
	});

	it('« Répondre en privé » : le début de la publication, 80 caractères au plus, espaces resserrés', () => {
		expect(aPropos('Repas  de\nNoël')).toBe('À propos de « Repas de Noël » : ');
		const long = 'a'.repeat(79) + ' bcd';
		expect(aPropos(long)).toBe(`À propos de « ${'a'.repeat(79)}… » : `);
		expect(aPropos('x'.repeat(80))).toBe(`À propos de « ${'x'.repeat(80)} » : `);
		expect(aPropos('   ')).toBe('');
		expect(aPropos(null)).toBe('');
	});

	it('le préremplissage ne perd pas un brouillon : il passe devant, une seule fois', () => {
		const debut = 'À propos de « Repas » : ';
		expect(avecBrouillon(debut, '')).toBe(debut);
		expect(avecBrouillon(debut, 'Je viens')).toBe(`${debut}\nJe viens`);
		expect(avecBrouillon(debut, `${debut}je viens`)).toBe(`${debut}je viens`);
		expect(avecBrouillon('', 'Je viens')).toBe('Je viens');
	});
});
