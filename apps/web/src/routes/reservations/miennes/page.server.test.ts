import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { refuser, reservation, reserver } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { requeteFormulaire } from '../../echanges/de-test.ts';
import { dans, locaux, preparer } from '../de-test.ts';
import { actions, load } from './+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const charger = (locals: unknown, requete = '') => (load as any)({ locals, url: new URL(`http://x/reservations/miennes${requete}`) });
const annuler = async (locals: unknown, id: number | string) => (actions.annuler as any)({ locals, request: await requeteFormulaire([['id', String(id)]]) });

describe('/reservations/miennes', () => {
	it('à venir et passées ; la phrase après une réservation ; la confirmation d’annulation demandée', async () => {
		const { base, alice, bancs } = await preparer();
		const { id } = await reserver(base, alice, bancs, { debut: dans(2), fin: dans(2), quantite: 2 }, maintenantParis());
		const data = await charger(locaux(base, alice), `?reservee=attente&annuler=${id}`);
		expect(data.aVenir).toMatchObject([{ id, ressource: 'Bancs', etat: 'attente', annulable: true }]);
		expect(data.passees).toEqual([]);
		expect(data.reservee).toBe('attente');
		expect(data.confirmer).toBe(id);
		expect((await charger(locaux(base, alice), '?reservee=autre')).reservee).toBeNull();
	});

	it('ouvrir la page marque lus les avis de réservation', async () => {
		const { base, alice, bruno, bancs } = await preparer();
		const { id } = await reserver(base, alice, bancs, { debut: dans(2), fin: dans(2), quantite: 2 }, maintenantParis());
		await refuser(base, bruno, id, null, maintenantParis());
		const { enTeteDe } = await import('@gyro-caserne/socle');
		expect((await enTeteDe(base, alice, dans(0))).nonLues).toBe(1);
		await charger(locaux(base, alice));
		expect((await enTeteDe(base, alice, dans(0))).nonLues).toBe(0);
	});

	it('annuler : la sienne ; celle d’un autre, refusé avec un message', async () => {
		const { base, alice, bruno, vl } = await preparer();
		const { id } = await reserver(base, alice, vl, { debut: `${dans(2)}T09:00`, fin: `${dans(2)}T12:00` }, maintenantParis());
		expect(await annuler(locaux(base, bruno), id)).toMatchObject({ status: 403, data: { message: 'Ce n’est pas votre réservation.' } });
		expect(await annuler(locaux(base, alice), id)).toEqual({ succes: 'Réservation annulée.' });
		expect((await base.select().from(reservation).where(eq(reservation.id, id)))[0]!.etat).toBe('annulee');
	});
});
