import { describe, expect, it } from 'vitest';
import { photoPublication, publier } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { jpeg, locaux, preparer } from '../../de-test.ts';
import { GET } from './+server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const demander = (locals: unknown, id: string) => (GET as any)({ locals, params: { id } });

describe('photo d’une publication', () => {
	it('servie à qui lit le mur, en privé, avec son type', async () => {
		const { base, alice } = await preparer();
		const fichier = jpeg(1500);
		await publier(base, alice, 'vie', { type: 'message', texte: 'x', photos: [{ type: 'image/jpeg', donnees: new Uint8Array(await fichier.arrayBuffer()) }] }, maintenantParis());
		const [ph] = await base.select().from(photoPublication);
		const reponse: Response = await demander(locaux(base, alice), String(ph!.id));
		expect(reponse.status).toBe(200);
		expect(reponse.headers.get('content-type')).toBe('image/jpeg');
		expect(reponse.headers.get('cache-control')).toMatch(/^private, max-age=\d+$/);
		expect(reponse.headers.get('x-content-type-options')).toBe('nosniff');
		expect(new Uint8Array(await reponse.arrayBuffer())).toEqual(new Uint8Array(await fichier.arrayBuffer()));
	});

	it('403 pour qui ne lit pas le mur, 404 si inconnue, 401 sans connexion', async () => {
		const { base, alice, bruno, e1 } = await preparer();
		await publier(base, alice, `equipe:${e1.id}`, { type: 'message', texte: 'x', photos: [{ type: 'image/jpeg', donnees: new Uint8Array(await jpeg().arrayBuffer()) }] }, maintenantParis());
		const [ph] = await base.select().from(photoPublication);
		await expect(demander(locaux(base, bruno), String(ph!.id))).rejects.toMatchObject({ status: 403 });
		await expect(demander(locaux(base, alice), '999')).rejects.toMatchObject({ status: 404 });
		await expect(demander(locaux(base, alice), 'abc')).rejects.toMatchObject({ status: 404 });
		await expect(demander({ base, acteur: null }, String(ph!.id))).rejects.toMatchObject({ status: 401 });
	});
});
