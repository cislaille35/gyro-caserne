import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { reservation, reserver } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { requeteFormulaire } from '../../echanges/de-test.ts';
import { dans, locaux, preparer } from '../de-test.ts';
import { actions, load } from './+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const charger = (locals: unknown) => (load as any)({ locals });
const agir = async (nom: 'accepter' | 'refuser' | 'annuler', locals: unknown, champs: [string, string][]) => (actions[nom] as any)({ locals, request: await requeteFormulaire(champs) });
const etat = async (base: any, id: number) => (await base.select().from(reservation).where(eq(reservation.id, id)))[0];

describe('/reservations/a-valider', () => {
	it('les demandes de qui gère, avec leurs conflits ; les acceptées à venir ; rien pour un autre agent', async () => {
		const { base, alice, bruno, chef, vl, bancs } = await preparer();
		const { id: v1 } = await reserver(base, alice, vl, { debut: `${dans(2)}T09:00`, fin: `${dans(2)}T12:00` }, maintenantParis());
		const { id: v2 } = await reserver(base, bruno, vl, { debut: `${dans(2)}T10:00`, fin: `${dans(2)}T11:00` }, maintenantParis());
		await reserver(base, alice, bancs, { debut: dans(3), fin: dans(3), quantite: 2 }, maintenantParis());
		const duChef = await charger(locaux(base, chef));
		expect(duChef.demandes).toMatchObject([{ demande: { id: v2 }, conflits: [{ id: v1 }] }]);
		expect(duChef.acceptees.map((r: { id: number }) => r.id)).toEqual([v1]);
		expect((await charger(locaux(base, bruno))).demandes).toMatchObject([{ demande: { ressource: 'Bancs' }, conflits: [] }]);
		expect(await charger(locaux(base, alice))).toMatchObject({ demandes: [], acceptees: [], maintenant: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/) });
	});

	it('accepter, refuser avec un motif, annuler une acceptée avec un mot', async () => {
		const { base, alice, bruno, bancs } = await preparer();
		const { id: a } = await reserver(base, alice, bancs, { debut: dans(3), fin: dans(3), quantite: 2 }, maintenantParis());
		const { id: b } = await reserver(base, alice, bancs, { debut: dans(4), fin: dans(4), quantite: 2 }, maintenantParis());
		expect(await agir('accepter', locaux(base, bruno), [['id', String(a)]])).toEqual({ succes: 'Demande acceptée : le demandeur est prévenu.' });
		expect(await agir('refuser', locaux(base, bruno), [['id', String(b)], ['motif', 'Déjà prêtés']])).toEqual({ succes: 'Demande refusée : le demandeur est prévenu.' });
		expect(await etat(base, b)).toMatchObject({ etat: 'refusee', motif: 'Déjà prêtés' });
		expect(await agir('annuler', locaux(base, bruno), [['id', String(a)], ['mot', 'Bancs cassés']])).toEqual({ succes: 'Réservation annulée : le demandeur est prévenu.' });
		expect(await etat(base, a)).toMatchObject({ etat: 'annulee', motif: 'Bancs cassés' });
		expect(await agir('accepter', locaux(base, bruno), [['id', String(a)]])).toMatchObject({ status: 400, data: { message: 'Cette demande a déjà été traitée.' } });
		expect(await agir('accepter', locaux(base, alice), [['id', String(b)]])).toMatchObject({ status: 403 });
	});

	it('VL en conflit : « Garder cette demande » annule l’autre', async () => {
		const { base, alice, bruno, chef, vl } = await preparer();
		const { id: v1 } = await reserver(base, alice, vl, { debut: `${dans(2)}T09:00`, fin: `${dans(2)}T12:00` }, maintenantParis());
		const { id: v2 } = await reserver(base, bruno, vl, { debut: `${dans(2)}T10:00`, fin: `${dans(2)}T11:00` }, maintenantParis());
		await agir('accepter', locaux(base, chef), [['id', String(v2)]]);
		expect(await etat(base, v1)).toMatchObject({ etat: 'annulee' });
	});
});
