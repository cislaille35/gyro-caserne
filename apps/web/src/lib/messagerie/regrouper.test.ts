import type { VueMessage } from '@gyro-caserne/socle';
import { describe, expect, it } from 'vitest';
import { bandeauNonLus, fusionner, jourDuFil, regrouper } from './regrouper.ts';

const romain = { id: 2, prenom: 'Romain', nom: 'Test', couleur: '#a3195b' };
const manon = { id: 3, prenom: 'Manon', nom: 'Test', couleur: null };
const moi = { id: 1, prenom: 'Thomas', nom: 'Test', couleur: null };

let suivant = 1;
function m(auteur: VueMessage['auteur'], cree_le: string, autres: Partial<VueMessage> = {}): VueMessage {
	return {
		id: suivant++,
		auteur,
		texte: 'Bonjour',
		cree_le,
		modifie: false,
		supprime: null,
		systeme: auteur ? null : 'Romain a créé le groupe',
		reponse: null,
		photos: [],
		reactions: [],
		moi: auteur?.id === 1,
		coche: null,
		...autres
	};
}

const types = (elements: ReturnType<typeof regrouper>) => elements.map((e) => (e.type === 'bloc' ? `bloc:${e.messages.length}` : e.type === 'jour' ? `jour:${e.libelle}` : e.type));

describe('regrouper', () => {
	it('un bloc par auteur tant que les messages se suivent à moins de 5 minutes', () => {
		const fil = [m(romain, '2026-10-29T10:00'), m(romain, '2026-10-29T10:04'), m(romain, '2026-10-29T10:09:30'), m(manon, '2026-10-29T10:10'), m(moi, '2026-10-29T10:11'), m(moi, '2026-10-29T10:11:20')];
		const elements = regrouper(fil, { aujourdhui: '2026-10-29', bandeau: null });
		expect(types(elements)).toEqual(['jour:Aujourd’hui', 'bloc:2', 'bloc:1', 'bloc:1', 'bloc:2']);
		const blocs = elements.filter((e) => e.type === 'bloc');
		expect(blocs.map((b) => [b.auteur?.prenom, b.moi])).toEqual([
			['Romain', false],
			['Romain', false],
			['Manon', false],
			['Thomas', true]
		]);
	});

	it('un séparateur par jour : « Aujourd’hui », « Hier », puis la date, avec l’année si elle change', () => {
		const fil = [m(romain, '2025-12-31T23:58'), m(romain, '2026-10-26T09:00'), m(romain, '2026-10-28T23:59'), m(romain, '2026-10-29T00:01')];
		expect(types(regrouper(fil, { aujourdhui: '2026-10-29', bandeau: null }))).toEqual([
			'jour:Mercredi 31 décembre 2025',
			'bloc:1',
			'jour:Lundi 26 octobre',
			'bloc:1',
			'jour:Hier',
			'bloc:1',
			'jour:Aujourd’hui',
			'bloc:1'
		]);
	});

	it('un message système coupe le bloc et se place seul', () => {
		const fil = [m(romain, '2026-10-29T10:00'), m(null, '2026-10-29T10:01'), m(romain, '2026-10-29T10:02')];
		expect(types(regrouper(fil, { aujourdhui: '2026-10-29', bandeau: null }))).toEqual(['jour:Aujourd’hui', 'bloc:1', 'systeme', 'bloc:1']);
	});

	it('un message supprimé reste dans son bloc', () => {
		const fil = [m(romain, '2026-10-29T10:00'), m(romain, '2026-10-29T10:01', { supprime: 'auteur', texte: '' })];
		expect(types(regrouper(fil, { aujourdhui: '2026-10-29', bandeau: null }))).toEqual(['jour:Aujourd’hui', 'bloc:2']);
	});

	it('le bandeau des non-lus se place devant le premier non lu et coupe le bloc', () => {
		const fil = [m(romain, '2026-10-29T10:00'), m(romain, '2026-10-29T10:01'), m(romain, '2026-10-29T10:02')];
		const elements = regrouper(fil, { aujourdhui: '2026-10-29', bandeau: { premier: fil[1]!.id, nombre: 2 } });
		expect(types(elements)).toEqual(['jour:Aujourd’hui', 'bloc:1', 'non-lus', 'bloc:2']);
		expect(elements[2]).toMatchObject({ type: 'non-lus', nombre: 2 });
	});

	it('des clés stables, pour garder chaque bulle à sa place au rafraîchissement', () => {
		const fil = [m(romain, '2026-10-29T10:00'), m(romain, '2026-10-29T10:01')];
		const avant = regrouper(fil, { aujourdhui: '2026-10-29', bandeau: null });
		const apres = regrouper([...fil, m(romain, '2026-10-29T10:02')], { aujourdhui: '2026-10-29', bandeau: null });
		expect(apres.map((e) => e.cle)).toEqual(avant.map((e) => e.cle));
		expect(new Set(avant.map((e) => e.cle)).size).toBe(avant.length);
	});
});

describe('bandeauNonLus', () => {
	it('compte les messages des autres à partir du premier non lu, sans les miens, les systèmes ni les supprimés', () => {
		const fil = [m(romain, '2026-10-29T10:00'), m(romain, '2026-10-29T10:01'), m(moi, '2026-10-29T10:02'), m(null, '2026-10-29T10:03'), m(manon, '2026-10-29T10:04', { supprime: 'auteur' }), m(manon, '2026-10-29T10:05')];
		expect(bandeauNonLus(fil, fil[1]!.id)).toEqual({ premier: fil[1]!.id, nombre: 2 });
		expect(bandeauNonLus(fil, null)).toBeNull();
		// Le premier non lu est plus ancien que la page : le bandeau va en tête.
		expect(bandeauNonLus(fil, 0)).toEqual({ premier: 0, nombre: 3 });
	});
});

describe('jourDuFil', () => {
	it('« Aujourd’hui », « Hier », sinon le jour et la date', () => {
		expect(jourDuFil('2026-10-29T08:00', '2026-10-29')).toBe('Aujourd’hui');
		expect(jourDuFil('2026-10-28T08:00', '2026-10-29')).toBe('Hier');
		expect(jourDuFil('2026-10-01T08:00', '2026-10-29')).toBe('Jeudi 1 octobre');
	});
});

describe('fusionner', () => {
	it('ajoute les nouveaux, remplace ceux qui reviennent ou ont changé, garde l’ordre des identifiants', () => {
		const a = m(romain, '2026-10-29T10:00');
		const b = m(romain, '2026-10-29T10:01');
		const c = m(manon, '2026-10-29T10:02');
		const fusion = fusionner([a, b], [c, { ...b, texte: 'Modifié', modifie: true }, a]);
		expect(fusion.map((x) => x.id)).toEqual([a.id, b.id, c.id]);
		expect(fusion[1]!.texte).toBe('Modifié');
	});

	it('les messages plus anciens se placent en tête', () => {
		const a = m(romain, '2026-10-29T10:00');
		const b = m(romain, '2026-10-29T10:01');
		expect(fusionner([b], [a]).map((x) => x.id)).toEqual([a.id, b.id]);
	});
});
