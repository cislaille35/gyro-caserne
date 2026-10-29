import { describe, expect, it } from 'vitest';
import { charger, locaux, preparer, super_ } from './de-test.ts';
import { load as layout } from './+layout.server';
import { load } from './+page.server';

// La page comme SvelteKit la charge : la liste des réglages (parent), puis la page.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (locals: unknown) => (load as any)({ locals, parent: () => charger(layout, locals) });

describe('page Réglages : jauge des photos', () => {
	it('donnée au chef de centre, à l’adjoint et au super administrateur, pas au référent technique', async () => {
		const { base, chef, referent, donner } = await preparer();
		const adjoint = await donner('adjoint@exemple.fr', 'Chef de centre adjoint');
		for (const acteur of [chef, adjoint, super_]) expect((await page(locaux(base, acteur))).photos).toEqual({ octets: 0, limite: 500 * 1000 * 1000, alerte: false });
		expect((await page(locaux(base, referent))).photos).toBeNull();
	});
});
