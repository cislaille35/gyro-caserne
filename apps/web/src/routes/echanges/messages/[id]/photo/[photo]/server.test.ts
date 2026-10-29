import { describe, expect, it } from 'vitest';
import { creerGroupe, envoyer, lireConversation } from '@gyro-caserne/socle';
import { locaux, preparer } from '../../../../de-test.ts';
import { GET } from './+server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (locals: unknown, photo: number | string, id: number | string = 1) => (GET as any)({ locals, params: { id: String(id), photo: String(photo) } });

const octets = () => {
	const o = new Uint8Array(500);
	o.set([0xff, 0xd8, 0xff, 0xe0]);
	return o;
};

describe('photo d’un message', () => {
	it('servie aux membres par sa conversation, jamais en cache partagé ; sinon introuvable', async () => {
		const { base, chef, alice, bruno } = await preparer();
		const groupe = await creerGroupe(base, chef, { nom: 'Garde', membres: [alice.id] }, '2026-10-28T09:00');
		await envoyer(base, base.photos, chef, { conversation: groupe }, { texte: '', photos: [{ type: 'image/jpeg', donnees: octets() }] }, '2026-10-28T09:01');
		const [id] = (await lireConversation(base, alice, groupe, {}, '2026-10-28T09:02')).messages.at(-1)!.photos;
		const reponse: Response = await appeler(locaux(base, alice), id!, groupe);
		expect(reponse.headers.get('content-type')).toBe('image/jpeg');
		expect(reponse.headers.get('cache-control')).toBe('private, max-age=3600');
		expect((await reponse.arrayBuffer()).byteLength).toBe(500);
		// Interdite, inconnue, ou demandée par une autre conversation : 404, sans dire si elle existe.
		await expect(appeler(locaux(base, bruno), id!, groupe)).rejects.toMatchObject({ status: 404 });
		await expect(appeler(locaux(base, alice), 99999, groupe)).rejects.toMatchObject({ status: 404 });
		const { conversation: aDeux } = await envoyer(base, base.photos, alice, { personne: bruno.id }, { texte: 'Salut' }, '2026-10-28T09:03');
		await expect(appeler(locaux(base, alice), id!, aDeux)).rejects.toMatchObject({ status: 404 });
		await expect(appeler(locaux(base, alice), id!, 'abc')).rejects.toMatchObject({ status: 404 });
	});

	it('connexion requise, identifiant illisible', async () => {
		const { base, alice } = await preparer();
		await expect(appeler({ acteur: null }, 1)).rejects.toMatchObject({ status: 401 });
		await expect(appeler(locaux(base, alice), 'abc')).rejects.toMatchObject({ status: 404 });
	});
});
