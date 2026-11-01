import { describe, expect, it } from 'vitest';
import { reserver } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { grilleDuMois } from '#lib/reservations.ts';
import { dans, locaux, preparer } from '../de-test.ts';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, id: number | string, requete = '') => (load as any)({ locals, params: { id: String(id) }, url: new URL(`http://x/reservations/${id}${requete}`) });

describe('load de /reservations/[id]', () => {
	it('la ressource et ce qui est pris sur la grille du mois du jour demandé (aujourd’hui par défaut)', async () => {
		const { base, alice, bancs } = await preparer();
		await reserver(base, alice, bancs, { debut: dans(2), fin: dans(3), quantite: 5 }, maintenantParis());
		const data = await charger(locaux(base, alice), bancs);
		expect(data).toMatchObject({ jour: aujourdhuiParis(), aujourdhui: aujourdhuiParis(), peutReserver: true, ressource: { nom: 'Bancs', stock: 12 } });
		expect(data.reservations).toMatchObject([{ quantite: 5, demandeur: 'Alice Test', etat: 'attente', mienne: true }]);
		const loin = grilleDuMois(dans(90))[20]!;
		expect((await charger(locaux(base, alice), bancs, `?jour=${loin}`)).reservations).toEqual([]);
		expect((await charger(locaux(base, alice), bancs, '?jour=n-importe-quoi')).jour).toBe(aujourdhuiParis());
	});

	it('introuvable : 404 ; non accessible (la réserve citoyenne et le matériel) : 403', async () => {
		const { base, alice, estelle, bancs } = await preparer();
		await expect(charger(locaux(base, alice), 999)).rejects.toMatchObject({ status: 404 });
		await expect(charger(locaux(base, alice), 'abc')).rejects.toMatchObject({ status: 404 });
		await expect(charger(locaux(base, estelle), bancs)).rejects.toMatchObject({ status: 403 });
	});
});
