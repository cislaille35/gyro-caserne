import { describe, expect, it } from 'vitest';
import { alertesFetes, apresImport, resumer } from './textes.ts';

const vide = { semaines: [], manoeuvres: { ajoutees: [], modifiees: [], retirees: [] }, vacances: { ajoutees: [], retirees: [] }, fetes: [], ete: { ajouts: 0, retraits: 0 }, erreurs: [] };
const m = { debut: '2027-03-07T08:30', theme: 'Incendie' };

describe('aperçu du fichier du planning', () => {
	it('le résumé, sans les parties vides', () => {
		expect(resumer(vide)).toBe('Aucun changement');
		const s = { debut: '2027-01-08', numero: 1, avant: 'Équipe 1', apres: 'Équipe 2' };
		expect(
			resumer({ ...vide, semaines: [s, s, s], manoeuvres: { ajoutees: [m, m], modifiees: [m], retirees: [{ ...m, annoncee: false }] }, fetes: [{ fete: 'noel', avant: 'Équipe 1', apres: 'Équipe 2', horsTour: true }] })
		).toBe('3 semaines changées, 2 manœuvres ajoutées, 1 modifiée, 1 retirée, Noël passe à l’Équipe 2');
		expect(resumer({ ...vide, ete: { ajouts: 2, retraits: 1 } })).toBe('été : 3 présences changées');
	});

	it('l’alerte du tour des fêtes', () => {
		expect(alertesFetes({ ...vide, fetes: [{ fete: 'noel', avant: 'Équipe 1', apres: 'Équipe 2', horsTour: true }, { fete: 'nouvel_an', avant: null, apres: 'Équipe 3', horsTour: false }] })).toEqual(['Équipe 2 tiendrait Noël hors de son tour.']);
	});

	it('après l’import, ce que voient les agents, selon que l’année est publiée ou non', () => {
		expect(apresImport(true)).toBe('Année publiée : les agents voient déjà les changements ; les convoqués des manœuvres annoncées sont prévenus.');
		expect(apresImport(false)).toBe('Année en brouillon : les agents ne voient rien avant la publication, à l’étape « Vérifier et publier ».');
	});
});
