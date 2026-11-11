import { describe, expect, it } from 'vitest';
import { deposerEcusson } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer, super_ } from '../reglages/de-test.ts';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown) => (load as any)({ locals });

describe('connexion : l’écusson du centre', () => {
	it('sa version s’il y en a un, sinon null (une requête, la page n’est vue qu’à la connexion)', async () => {
		const { base } = await preparer();
		expect(await charger(locaux(base, null))).toEqual({ ecusson: null });
		const o = new Uint8Array(100);
		o.set([0xff, 0xd8, 0xff, 0xe0]);
		const v = await deposerEcusson(base, base.photos, super_, { type: 'image/jpeg', donnees: o }, maintenantParis());
		base.requetes = 0;
		expect(await charger(locaux(base, null))).toEqual({ ecusson: v });
		expect(base.requetes).toBe(1);
	});
});
