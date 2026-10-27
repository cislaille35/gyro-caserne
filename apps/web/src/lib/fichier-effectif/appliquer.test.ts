import type { Operation } from '@gyro-caserne/socle';
import { describe, expect, it } from 'vitest';
import { appliquerTout, ConnexionPerdue } from './appliquer.ts';

const ajouter = (ligne: number): Operation => ({ ligne, type: 'ajouter', donnees: { email: `l${ligne}@exemple.fr`, prenom: 'P', nom: 'N', profilId: 1 } });
const attribuer = (ligne: number): Operation => ({ ligne, type: 'attribuer', personne: { ligne }, responsabiliteId: 5, perimetre: { type: 'centre' } });
const depart = (personneId: number): Operation => ({ ligne: 0, type: 'statut', personneId, statut: 'parti' });
const modifier = (ligne: number, personneId: number): Operation => ({ ligne, type: 'modifier', personneId, champs: { prenom: 'X' } });
const PERDUE = 'Connexion perdue : cette opération a peut-être été appliquée. Réexportez pour vérifier.';

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
		expect(compte).toEqual({ appliquees: 4, erreurs: [], nonTentees: [], interruption: null });
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
			nonTentees: [operations[1], operations[3]],
			interruption: null
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
		expect(compte).toEqual({ appliquees: 2, erreurs: [{ operation: depart(10), message: 'Refusé' }], nonTentees: [], interruption: null });
	});

	it('annonce l\'avancement, opérations sautées comprises', async () => {
		const etapes: number[] = [];
		await appliquerTout(
			[ajouter(2), attribuer(2), depart(9)],
			async (op) => {
				if (op.type === 'ajouter') throw new Error('Non');
				return { personneId: null };
			},
			{ avancer: (fait) => etapes.push(fait) }
		);
		expect(etapes).toEqual([1, 2, 3]);
	});

	it('dit en français qu\'une connexion perdue a peut-être appliqué l\'opération', async () => {
		const compte = await appliquerTout([modifier(2, 7), modifier(3, 8)], async (op) => {
			if (op.ligne === 2) throw new ConnexionPerdue();
			return { personneId: null };
		});
		expect(compte.erreurs).toEqual([{ operation: modifier(2, 7), message: PERDUE }]);
		expect(compte.appliquees).toBe(1);
		expect(compte.interruption).toBeNull();
	});

	it('s\'arrête après 3 connexions perdues de suite, le reste compté non tenté', async () => {
		const operations = [modifier(2, 7), depart(10), depart(11), depart(12), modifier(5, 9), depart(13)];
		let envois = 0;
		const etapes: number[] = [];
		const compte = await appliquerTout(
			operations,
			async (op) => {
				envois++;
				if (op === operations[0]) return { personneId: null };
				throw new ConnexionPerdue();
			},
			{ avancer: (fait) => etapes.push(fait) }
		);
		expect(envois).toBe(4);
		expect(compte.appliquees).toBe(1);
		expect(compte.erreurs.map((e) => e.message)).toEqual([PERDUE, PERDUE, PERDUE]);
		expect(compte.nonTentees).toEqual([operations[4], operations[5]]);
		expect(compte.interruption).toBe('connexion');
		expect(etapes.at(-1)).toBe(6);
	});

	it('remet le compte des connexions perdues à zéro dès qu\'une réponse arrive', async () => {
		const reponses = ['perdue', 'perdue', 'refus', 'perdue', 'perdue', 'ok'];
		const operations = reponses.map((_, i) => depart(i + 1));
		const compte = await appliquerTout(operations, async (op) => {
			const r = reponses[operations.indexOf(op)];
			if (r === 'perdue') throw new ConnexionPerdue();
			if (r === 'refus') throw new Error('Refusé');
			return { personneId: null };
		});
		expect(compte.interruption).toBeNull();
		expect(compte.appliquees).toBe(1);
		expect(compte.nonTentees).toEqual([]);
	});

	it('s\'arrête quand on quitte la page, le reste compté non tenté', async () => {
		const arret = new AbortController();
		const operations = [modifier(2, 7), modifier(3, 8), modifier(4, 9)];
		const compte = await appliquerTout(
			operations,
			async () => {
				arret.abort();
				return { personneId: null };
			},
			{ signal: arret.signal }
		);
		expect(compte).toEqual({ appliquees: 1, erreurs: [], nonTentees: [operations[1], operations[2]], interruption: 'abandon' });
	});
});
