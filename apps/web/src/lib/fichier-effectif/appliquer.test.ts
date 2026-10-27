import type { Operation } from '@gyro-caserne/socle';
import { describe, expect, it } from 'vitest';
import { appliquerTout } from './appliquer.ts';

const ajouter = (ligne: number): Operation => ({ ligne, type: 'ajouter', donnees: { email: `l${ligne}@exemple.fr`, prenom: 'P', nom: 'N', profilId: 1 } });
const attribuer = (ligne: number): Operation => ({ ligne, type: 'attribuer', personne: { ligne }, responsabiliteId: 5, perimetre: { type: 'centre' } });
const depart = (personneId: number): Operation => ({ ligne: 0, type: 'statut', personneId, statut: 'parti' });
const modifier = (ligne: number, personneId: number): Operation => ({ ligne, type: 'modifier', personneId, champs: { prenom: 'X' } });

describe('appliquerTout', () => {
	it('envoie les opérations une à une, avec les agents créés par les lignes précédentes', async () => {
		const envois: [Operation, Record<number, number>][] = [];
		const ids: Record<number, number> = { 2: 40, 3: 41 };
		const compte = await appliquerTout([ajouter(2), attribuer(2), ajouter(3), attribuer(3)], async (op, nouvelles) => {
			envois.push([op, { ...nouvelles }]);
			return { personneId: op.type === 'ajouter' ? ids[op.ligne]! : null };
		});
		expect(envois.map(([op, n]) => [op.type, op.ligne, n])).toEqual([
			['ajouter', 2, {}],
			['attribuer', 2, { 2: 40 }],
			['ajouter', 3, { 2: 40 }],
			['attribuer', 3, { 2: 40, 3: 41 }]
		]);
		expect(compte).toEqual({ appliquees: 4, erreurs: [], sautees: 0 });
	});

	it('après une erreur, saute la suite de sa ligne seulement', async () => {
		const envoyees: Operation[] = [];
		const operations = [ajouter(2), attribuer(2), modifier(3, 7), modifier(3, 7), modifier(4, 8)];
		const compte = await appliquerTout(operations, async (op) => {
			envoyees.push(op);
			if (op.ligne === 2 || op === operations[2]) throw new Error(`Refus ligne ${op.ligne}`);
			return { personneId: null };
		});
		expect(envoyees).toEqual([operations[0], operations[2], operations[4]]);
		expect(compte).toEqual({
			appliquees: 1,
			erreurs: [
				{ operation: operations[0], message: 'Refus ligne 2' },
				{ operation: operations[2], message: 'Refus ligne 3' }
			],
			sautees: 2
		});
	});

	it('traite chaque départ hors ligne à part : un échec n\'en saute aucun autre', async () => {
		const envoyees: number[] = [];
		const compte = await appliquerTout([depart(10), depart(11), depart(12)], async (op) => {
			if (op.type === 'statut') envoyees.push(op.personneId);
			if (op.type === 'statut' && op.personneId === 10) throw new Error('Refusé');
			return { personneId: null };
		});
		expect(envoyees).toEqual([10, 11, 12]);
		expect(compte).toEqual({ appliquees: 2, erreurs: [{ operation: depart(10), message: 'Refusé' }], sautees: 0 });
	});

	it('annonce l\'avancement, opérations sautées comprises', async () => {
		const etapes: number[] = [];
		await appliquerTout(
			[ajouter(2), attribuer(2), depart(9)],
			async (op) => {
				if (op.type === 'ajouter') throw new Error('Non');
				return { personneId: null };
			},
			(fait) => etapes.push(fait)
		);
		expect(etapes).toEqual([1, 2, 3]);
	});
});
