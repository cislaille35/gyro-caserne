import { describe, expect, it } from 'vitest';
import { teinteDuMur } from './teinte.ts';

describe('teinteDuMur', () => {
	it('Le centre en rouge, un comité selon son icône, une équipe selon sa couleur, sinon neutre', () => {
		expect(teinteDuMur('centre', { icone: 'maison', couleur: null })).toEqual({ fond: 'var(--rouge)', encre: 'var(--sur-rouge)', trait: 'transparent' });
		expect(teinteDuMur('comite', { icone: 'coeur', couleur: null })).toEqual({ fond: 'var(--icone-coeur-fond)', encre: 'var(--icone-coeur-texte)', trait: 'transparent' });
		expect(teinteDuMur('equipe', { icone: null, couleur: '#d4a017' })).toEqual({ fond: 'color-mix(in srgb, #d4a017 30%, var(--surface))', encre: 'var(--encre)', trait: '#d4a017' });
		expect(teinteDuMur('equipe', { icone: null, couleur: null })).toEqual({ fond: 'var(--statut-neutre-fond)', encre: 'var(--encre)', trait: 'transparent' });
	});
});
