import { describe, expect, it } from 'vitest';
import { lireMur, publier } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer } from './de-test.ts';
import { load } from './+layout.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, url: object = new URL('http://x/echanges')) => (load as any)({ locals, url });

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

	it('se recharge à chaque changement d’adresse : la pastille d’un mur visité disparaît', async () => {
		const { base, chef, alice } = await preparer();
		await publier(base, chef, 'vie', { type: 'message', texte: 'Bonjour' }, maintenantParis());
		// SvelteKit ne relance ce chargement que s'il a lu l'adresse.
		let lue = false;
		const url = {
			get pathname() {
				lue = true;
				return '/echanges/centre';
			}
		};
		await charger(locaux(base, alice), url);
		expect(lue).toBe(true);
		await lireMur(base, alice, 'vie', {}, maintenantParis());
		const apres = await charger(locaux(base, alice), new URL('http://x/echanges/centre'));
		expect(apres.murs.find((m: { cle: string }) => m.cle === 'vie').nouveautes).toBe(0);
	});
});
