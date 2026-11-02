import { describe, expect, it } from 'vitest';
import { compteFiche, dateCourte, etatPrise, jourCourt, jourHeure, parEquipe, resumerFiche, situationDe, sousLigne, texteEcart, texteReleve } from './textes.ts';

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

	it('prise de garde : état, relève, écart', () => {
		expect(etatPrise(null)).toEqual({ texte: 'Prise à faire', ton: 'alerte' });
		expect(etatPrise({ etat: 'en_cours', valideeLe: null, equipe: 'Équipe 2', par: 'Alice Martin' }).texte).toBe('Prise en cours (Alice Martin)');
		expect(etatPrise({ etat: 'validee', valideeLe: '2026-10-30T18:40', equipe: 'Équipe 2', par: 'Alice Martin' })).toEqual({ texte: 'Prise faite par l’équipe 2, ven. 18 h 40', ton: 'ok' });
		expect(etatPrise({ etat: 'validee', valideeLe: '2026-10-30T19:00', equipe: null, par: 'Alice Martin' }).texte).toBe('Prise faite par Alice Martin, ven. 19 h');
		expect(parEquipe('Les Rouges')).toBe('Les Rouges');
		expect(jourHeure('2026-11-01T08:05')).toBe('dim. 8 h 05');
		expect(jourCourt('2026-10-30T18:00')).toBe('ven. 30 oct.');
		expect(texteReleve({ debut: '2026-10-30T18:00', equipe: { nom: 'Équipe 2' } })).toBe('Relève du ven. 30 oct., équipe 2');
		expect(texteReleve({ debut: '2026-10-30T18:00', equipe: null })).toBe('Relève du ven. 30 oct.');
		expect(texteEcart({ genre: 'manquant', manque: 1, note: 'sous le siège' }, 3)).toBe('Manquant : 1 sur 3 · sous le siège');
		expect(texteEcart({ genre: 'abime', manque: null, note: null })).toBe('Abîmé');
	});
});
