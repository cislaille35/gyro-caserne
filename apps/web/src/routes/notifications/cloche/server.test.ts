import { describe, expect, it } from 'vitest';
import { lirePublication, notifierPublication, publier } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer } from '../../echanges/de-test.ts';
import { GET } from './+server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (locals: unknown) => (GET as any)({ locals });
const nombre = async (locals: unknown) => ((await (await appeler(locals)).json()) as { cloche: number }).cloche;

describe('nombre de la cloche', () => {
	it('demande la connexion', async () => {
		await expect(appeler({ acteur: null })).rejects.toMatchObject({ status: 401 });
	});

	it('les non-lus, relus après une consultation, en JSON jamais mis en cache', async () => {
		const { base, chef, alice } = await preparer();
		const maintenant = maintenantParis();
		const id = await publier(base, base.photos, chef, 'centre', { type: 'annonce', texte: 'Note', priseDeConnaissance: true }, maintenant);
		await notifierPublication(base, id, maintenant);
		await notifierPublication(base, await publier(base, base.photos, chef, 'vie', { type: 'message', texte: 'Repas' }, maintenant), maintenant);
		const reponse: Response = await appeler(locaux(base, alice));
		expect(reponse.headers.get('cache-control')).toBe('no-store');
		expect(await reponse.json()).toEqual({ cloche: 2 });
		await lirePublication(base, alice, id, maintenant);
		expect(await nombre(locaux(base, alice))).toBe(1);
	});
});
