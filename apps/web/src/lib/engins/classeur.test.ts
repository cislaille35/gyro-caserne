import { describe, expect, it } from 'vitest';
import { ecrireClasseurFiches, lireClasseurFiches, nomDuFichierFiches } from './classeur.ts';

const donnees = {
	entetes: ['Réf.', 'Zone', 'Élément', 'Quantité'],
	feuilles: [
		{ nom: 'VSAV', lignes: [['1', 'Cabine', 'Radio : essai', ''], ['2', 'Cabine', 'Gilets haute visibilité', '3']] },
		{ nom: 'VTU', lignes: [] }
	]
};

describe('classeur des fiches', () => {
	it('aller-retour : une feuille par type, les cellules relues sont celles écrites', async () => {
		const lu = await lireClasseurFiches(await ecrireClasseurFiches(donnees));
		expect(lu.feuilles).toEqual({
			VSAV: [
				{ numero: 2, cellules: ['1', 'Cabine', 'Radio : essai', ''] },
				{ numero: 3, cellules: ['2', 'Cabine', 'Gilets haute visibilité', '3'] }
			],
			VTU: []
		});
		expect(lu.entetes?.VSAV).toEqual(['Réf.', 'Zone', 'Élément', 'Quantité']);
	});

	it('nom du fichier daté', () => {
		expect(nomDuFichierFiches('2026-11-02')).toBe('fiches-engins-2026-11-02.xlsx');
	});
});
