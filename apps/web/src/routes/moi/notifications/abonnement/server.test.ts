import { describe, expect, it } from 'vitest';
import { abonnementPush } from '@gyro-caserne/socle';
import { locaux, preparer } from '../../../echanges/de-test.ts';
import { DELETE, POST } from './+server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const requete = (methode: string, corps: unknown) => new Request('http://x/moi/notifications/abonnement', { method: methode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
const abonnement = { endpoint: 'https://fcm.googleapis.com/fcm/send/alice', keys: { p256dh: 'BCle', auth: 'secret' }, appareil: 'Mozilla/5.0 (iPhone)' };

describe('/moi/notifications/abonnement', () => {
	it('POST abonne cet appareil ; DELETE le désabonne', async () => {
		const { base, alice } = await preparer();
		const reponse = await (POST as any)({ locals: locaux(base, alice), request: requete('POST', abonnement) });
		expect(reponse.status).toBe(200);
		expect(await base.select().from(abonnementPush)).toMatchObject([{ personneId: alice.id, endpoint: abonnement.endpoint, appareil: 'Mozilla/5.0 (iPhone)' }]);
		expect((await (DELETE as any)({ locals: locaux(base, alice), request: requete('DELETE', { endpoint: abonnement.endpoint }) })).status).toBe(200);
		expect(await base.select().from(abonnementPush)).toEqual([]);
	});

	it('refuse sans connexion ou sans fiche (401), un abonnement invalide (400)', async () => {
		const { base, alice } = await preparer();
		await expect((POST as any)({ locals: locaux(base, null), request: requete('POST', abonnement) })).rejects.toMatchObject({ status: 401 });
		await expect((POST as any)({ locals: locaux(base, { type: 'super', email: 'a@b.fr' }), request: requete('POST', abonnement) })).rejects.toMatchObject({ status: 401 });
		await expect((POST as any)({ locals: locaux(base, alice), request: requete('POST', { ...abonnement, endpoint: 'http://x' }) })).rejects.toMatchObject({ status: 400 });
		await expect((POST as any)({ locals: locaux(base, alice), request: new Request('http://x', { method: 'POST', body: 'pas du JSON' }) })).rejects.toMatchObject({ status: 400 });
	});
});
