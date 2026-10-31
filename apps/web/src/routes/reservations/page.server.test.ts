import { describe, expect, it } from 'vitest';
import { reserver } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { dans, locaux, preparer } from './de-test.ts';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown) => (load as any)({ locals });

describe('load de /reservations', () => {
	it('demande la connexion', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('les ressources, ce qui attend chez qui gère, mes réservations à venir', async () => {
		const { base, alice, bruno, bancs, estelle } = await preparer();
		await reserver(base, alice, bancs, { debut: dans(3), fin: dans(3), quantite: 2 }, maintenantParis());
		const deBruno = await charger(locaux(base, bruno));
		expect(deBruno).toMatchObject({ aValider: 1, peutGererMateriel: true, mesAVenir: 0 });
		expect(deBruno.ressources.map((r: { nom: string }) => r.nom)).toEqual(['VL', 'Bancs']);
		expect(await charger(locaux(base, alice))).toMatchObject({ aValider: 0, peutGererMateriel: false, mesAVenir: 1 });
		const deLaReserve = await charger(locaux(base, estelle));
		expect(deLaReserve.reserveCitoyenne).toBe(true);
		expect(deLaReserve.ressources.map((r: { nom: string }) => r.nom)).toEqual(['VL']);
	});
});
