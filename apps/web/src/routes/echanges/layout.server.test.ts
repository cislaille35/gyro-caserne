import { describe, expect, it } from 'vitest';
import { publier } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer } from './de-test.ts';
import { load } from './+layout.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown) => (load as any)({ locals });

describe('liste des murs', () => {
	it('demande la connexion', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('montre les murs de la personne et leurs nouveautés', async () => {
		const { base, chef, alice, e1 } = await preparer();
		await publier(base, chef, 'vie', { type: 'message', texte: 'Bonjour' }, maintenantParis());
		await publier(base, chef, 'vie', { type: 'message', texte: 'Encore' }, maintenantParis());
		const data = await charger(locaux(base, alice));
		expect(data.murs).toEqual([
			{ cle: 'centre', nom: 'Le centre', type: 'centre', lectureSeule: false, nouveautes: 0 },
			{ cle: 'vie', nom: 'Vie du centre', type: 'vie', lectureSeule: false, nouveautes: 2 },
			{ cle: `equipe:${e1.id}`, nom: e1.nom, type: 'equipe', lectureSeule: false, nouveautes: 0 }
		]);
	});
});
