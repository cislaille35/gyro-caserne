import { describe, expect, it } from 'vitest';
import { actions, load } from './+page.server';
import { locaux, preparer } from '../de-test.ts';
import { requeteFormulaire } from '../../echanges/de-test.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nouveauType = async (locals: unknown, nom: string) => (actions.nouveauType as any)({ locals, request: await requeteFormulaire([['nom', nom]]) });

describe('/engins/fiches', () => {
	it('réservé à qui gère ; les fiches dans l’ordre des types', async () => {
		const { base, alice, chef } = await preparer();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((load as any)({ locals: locaux(base, alice) })).rejects.toMatchObject({ status: 403 });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect((await (load as any)({ locals: locaux(base, chef) })).fiches.map((f: { type: string }) => f.type)).toEqual(['VSAV', 'FPT', 'VTU']);
	});

	it('un nouveau type ouvre sa fiche vide ; un doublon est refusé', async () => {
		const { base, chef } = await preparer();
		const reponse = await nouveauType(locaux(base, chef), 'ccf').catch((e) => e);
		expect(reponse).toMatchObject({ status: 303 });
		expect(reponse.location).toMatch(/^\/engins\/fiches\/\d+\?nouveau=1$/);
		expect(await nouveauType(locaux(base, chef), 'VSAV')).toMatchObject({ status: 400, data: { message: 'Ce type d’engin existe déjà.', nom: 'VSAV' } });
	});
});
