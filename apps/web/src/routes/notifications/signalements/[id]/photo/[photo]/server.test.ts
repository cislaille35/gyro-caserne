import { describe, expect, it } from 'vitest';
import { envoyer, signalements, signaler } from '@gyro-caserne/socle';
import { locaux, preparer } from '../../../../../echanges/de-test.ts';
import { GET } from './+server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (locals: unknown, id: number | string, photo: number | string) => (GET as any)({ locals, params: { id: String(id), photo: String(photo) } });

const octets = () => {
	const o = new Uint8Array(300);
	o.set([0xff, 0xd8, 0xff, 0xe0]);
	return o;
};

describe('photo d’un message signalé', () => {
	it('servie au modérateur seul, jamais en cache partagé ; sinon introuvable', async () => {
		const { base, chef, alice, bruno } = await preparer();
		const m = await envoyer(base, base.photos, bruno, { personne: alice.id }, { texte: '', photos: [{ type: 'image/jpeg', donnees: octets() }] }, '2026-10-29T10:00');
		await signaler(base, alice, m.message, '2026-10-29T10:01');
		const [s] = await signalements(base, chef, '2026-10-29');
		const reponse: Response = await appeler(locaux(base, chef), s!.id, s!.photos[0]!);
		expect(reponse.headers.get('content-type')).toBe('image/jpeg');
		expect(reponse.headers.get('cache-control')).toBe('private, no-store');
		expect((await reponse.arrayBuffer()).byteLength).toBe(300);
		for (const a of [alice, bruno]) await expect(appeler(locaux(base, a), s!.id, s!.photos[0]!)).rejects.toMatchObject({ status: 404 });
		await expect(appeler(locaux(base, chef), s!.id, 99999)).rejects.toMatchObject({ status: 404 });
		await expect(appeler(locaux(base, chef), 'abc', s!.photos[0]!)).rejects.toMatchObject({ status: 404 });
		await expect(appeler({ acteur: null }, s!.id, s!.photos[0]!)).rejects.toMatchObject({ status: 401 });
	});
});
