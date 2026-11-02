import { describe, expect, it } from 'vitest';
import { compteFiche, dateCourte, resumerFiche, situationDe, sousLigne } from './textes.ts';

const engin = { id: 1, nom: 'VSAV 23', type: 'VSAV', typeId: 1, immatriculation: 'AB-123-CD', situation: 'prete' as const, provenance: 'CIS Exemple-Nord', etat: 'disponible' as const, partiLe: null };

describe('textes des engins', () => {
	it('dit la situation en toutes lettres', () => {
		expect(situationDe(engin)).toBe('Prêté au centre par CIS Exemple-Nord');
		expect(situationDe({ ...engin, situation: 'centre' })).toBe('Au centre');
		expect(situationDe({ ...engin, situation: 'parti', partiLe: '2026-11-02' })).toBe('Parti le 2 nov. 2026');
	});
	it('sous-ligne : type, plaque, prêt', () => {
		expect(sousLigne(engin)).toBe('VSAV · AB-123-CD · prêté par CIS Exemple-Nord');
		expect(sousLigne({ ...engin, situation: 'centre', immatriculation: null })).toBe('VSAV');
	});
	it('compte zones et éléments', () => {
		expect(compteFiche([{ elements: [1, 2] }, { elements: [3] }])).toBe('2 zones · 3 éléments');
		expect(dateCourte('2026-01-05T10:00')).toBe('5 janv. 2026');
	});

	it('résume les changements d’une fiche importée', () => {
		expect(resumerFiche({ ajoutes: ['a', 'b'], retires: ['c'], modifies: [], ordre: true })).toBe('2 éléments ajoutés, 1 retiré, rangement changé');
		expect(resumerFiche({ ajoutes: [], retires: [], modifies: [], ordre: false })).toBe('Aucun changement');
	});
});
