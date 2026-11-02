import { describe, expect, it } from 'vitest';
import { load } from './+page.server';
import { locaux, preparer } from './de-test.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown) => (load as any)({ locals });

describe('load de /engins', () => {
	it('demande la connexion ; refuse qui n’a pas le droit de voir les engins', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
		const { base, sans } = await preparer();
		await expect(charger(locaux(base, sans))).rejects.toMatchObject({ status: 403 });
	});

	it('les engins, rangés par type puis par nom ; qui les gère', async () => {
		const { base, alice, chef } = await preparer();
		const pourAlice = await charger(locaux(base, alice));
		expect(pourAlice.gere).toBe(false);
		expect(pourAlice.engins.map((e: { nom: string; situation: string }) => [e.nom, e.situation])).toEqual([
			['VSAV 1', 'centre'],
			['VSAV 23', 'prete'],
			['FPT 2', 'parti']
		]);
		expect((await charger(locaux(base, chef))).gere).toBe(true);
	});
});
