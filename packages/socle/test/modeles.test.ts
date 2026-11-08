import { describe, expect, it } from 'vitest';
import { NOMS_ICONES } from '../src/icones.ts';
import { DROITS } from '../src/listes.ts';
import { MODELES } from '../src/modeles.ts';

describe('MODELES', () => {
	it('chaque modèle a un identifiant unique, une icône connue et des droits connus', () => {
		expect(new Set(MODELES.map((m) => m.id)).size).toBe(MODELES.length);
		for (const m of MODELES) {
			expect(NOMS_ICONES).toContain(m.icone);
			for (const d of m.droits) expect(DROITS).toContain(d);
		}
	});

	it('donne les modèles attendus', () => {
		const de = (id: string) => MODELES.find((m) => m.id === id);
		expect(de('referent_materiel')).toEqual({ id: 'referent_materiel', nom: 'Référent matériel', nature: 'mission', portee: 'centre', icone: 'camion', droits: ['TRAITER_ANOMALIE', 'GERER_FICHES'] });
		expect(de('referent_pharmacie')).toMatchObject({ nature: 'mission', portee: 'centre', icone: 'croix', droits: ['GERER_STOCK'] });
		expect(de('referent_technique')).toMatchObject({ nature: 'fonction', portee: 'centre', icone: 'cle', droits: ['GERER_LISTES', 'GERER_COMITES'] });
		expect(de('referent_habillement')).toEqual({ id: 'referent_habillement', nom: 'Référent habillement', nature: 'mission', portee: 'centre', icone: 'veste', droits: ['GERER_HABILLEMENT'] });
		expect(de('membre_comite')).toMatchObject({ nature: 'mission', portee: 'comite', icone: 'groupe', droits: [] });
		expect(de('rapporteur_comite')).toMatchObject({ nature: 'mission', portee: 'comite', icone: 'livre', droits: ['ATTRIBUER_RESPONSABILITE'] });
		expect(de('vierge')).toMatchObject({ nom: 'Vierge', nature: 'mission', portee: 'centre', icone: 'outil', droits: [] });
	});
});
