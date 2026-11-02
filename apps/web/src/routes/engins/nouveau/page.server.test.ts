import { describe, expect, it } from 'vitest';
import { actions, load } from './+page.server';
import { locaux, preparer } from '../de-test.ts';
import { requeteFormulaire } from '../../echanges/de-test.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ajouter = async (locals: unknown, corps: [string, string][]) => (actions.default as any)({ locals, request: await requeteFormulaire(corps) });

describe('/engins/nouveau', () => {
	it('les types proposés, pour qui gère seulement', async () => {
		const { base, alice, chef } = await preparer();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((load as any)({ locals: locaux(base, alice) })).rejects.toMatchObject({ status: 403 });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect((await (load as any)({ locals: locaux(base, chef) })).types.map((t: { nom: string }) => t.nom)).toEqual(['VSAV', 'FPT', 'VTU']);
	});

	it('ajoute l’engin et ouvre sa page ; un nom déjà pris est refusé', async () => {
		const { base, chef, types } = await preparer();
		const reponse = await ajouter(locaux(base, chef), [['nom', 'VTU'], ['type', String(types.VTU)], ['situation', 'centre']]).catch((e) => e);
		expect(reponse).toMatchObject({ status: 303 });
		expect(reponse.location).toMatch(/^\/engins\/\d+$/);
		expect(await ajouter(locaux(base, chef), [['nom', 'vtu'], ['type', String(types.VTU)], ['situation', 'centre']])).toMatchObject({ status: 400, data: { message: 'Ce nom est déjà pris par un engin du centre.' } });
	});
});
