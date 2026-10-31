import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { reservation, reserver } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { requeteFormulaire } from '../../../echanges/de-test.ts';
import { dans, locaux, preparer } from '../../de-test.ts';
import { actions, load } from './+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const charger = (locals: unknown, id: number, requete = '') => (load as any)({ locals, params: { id: String(id) }, url: new URL(`http://x/reservations/${id}/reserver${requete}`) });
const envoyer = async (locals: unknown, id: number, champs: [string, string][]) => (actions.default as any)({ locals, params: { id: String(id) }, request: await requeteFormulaire(champs) });

describe('/reservations/[id]/reserver', () => {
	it('load : la ressource, ce qui est déjà pris à venir, le jour proposé (jamais passé)', async () => {
		const { base, alice, bancs } = await preparer();
		await reserver(base, alice, bancs, { debut: dans(2), fin: dans(3), quantite: 5 }, maintenantParis());
		const data = await charger(locaux(base, alice), bancs, `?jour=${dans(4)}`);
		expect(data).toMatchObject({ ressource: { nom: 'Bancs' }, reserveCitoyenne: false, jour: dans(4) });
		expect(data.prises).toEqual([{ debut: dans(2), fin: dans(3), quantite: 5, etat: 'attente' }]);
		expect((await charger(locaux(base, alice), bancs, '?jour=2020-01-01')).jour).toBe(aujourdhuiParis());
	});

	it('load : sans droit de réserver, 403 ; inconnue, 404', async () => {
		const { base, estelle, alice, bancs } = await preparer();
		await expect(charger(locaux(base, estelle), bancs)).rejects.toMatchObject({ status: 403 });
		await expect(charger(locaux(base, alice), 999)).rejects.toMatchObject({ status: 404 });
	});

	it('réserver la VL : acceptée, vers « Mes réservations » ; la réserve citoyenne donne un nom', async () => {
		const { base, alice, estelle, vl } = await preparer();
		const j = dans(3);
		await expect(envoyer(locaux(base, alice), vl, [['debut', `${j}T09:00`], ['fin', `${j}T12:00`], ['mot', 'Formation']])).rejects.toMatchObject({ status: 303, location: '/reservations/miennes?reservee=acceptee' });
		await expect(envoyer(locaux(base, estelle), vl, [['debut', `${j}T10:00`], ['fin', `${j}T11:00`], ['nom', 'Mme Durand'], ['telephone', '0600']])).rejects.toMatchObject({ location: '/reservations/miennes?reservee=attente' });
		const lignes = await base.select().from(reservation).where(eq(reservation.ressourceId, vl));
		expect(lignes.map((l) => [l.etat, l.mot, l.nomDemandeur, l.telephone])).toEqual([
			['acceptee', 'Formation', null, null],
			['attente', null, 'Mme Durand', '0600']
		]);
	});

	it('un refus du socle est redit, les valeurs gardées', async () => {
		const { base, alice, bancs } = await preparer();
		const r = await envoyer(locaux(base, alice), bancs, [['debut', dans(2)], ['fin', dans(2)], ['quantite', '13'], ['mot', 'Fête']]);
		expect(r).toMatchObject({ status: 400, data: { message: expect.stringMatching(/^Bancs : il en reste 12 le .+\.$/), valeurs: { debut: dans(2), quantite: '13', mot: 'Fête' } } });
		expect(r.data.message).not.toMatch(/\.\.$/);
	});
});
