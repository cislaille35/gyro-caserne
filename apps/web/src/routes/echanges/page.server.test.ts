import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { personne, souhaitAnniversaire } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { locaux, preparer } from './de-test.ts';
import { actions } from './+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const souhaiter = (locals: unknown, corps: Record<string, string>) => (actions.souhaiter as any)({ locals, request: new Request('http://x/echanges?/souhaiter', { method: 'POST', body: new URLSearchParams(corps) }) });

// Alice fête son anniversaire aujourd'hui.
async function avecAnniversaire() {
	const p = await preparer();
	await p.base.update(personne).set({ naissance: `1990-${aujourdhuiParis().slice(5)}` }).where(eq(personne.id, p.alice.id));
	return p;
}

describe('/echanges?/souhaiter', () => {
	it('souhaite l’anniversaire, puis revient sur la page d’où l’on vient', async () => {
		const { base, alice, bruno } = await avecAnniversaire();
		await expect(souhaiter(locaux(base, bruno), { id: String(alice.id), retour: '/echanges/vie' })).rejects.toMatchObject({ status: 303, location: '/echanges/vie' });
		expect(await base.select().from(souhaitAnniversaire)).toMatchObject([{ personneId: alice.id, auteurId: bruno.id }]);
	});

	it('ne revient que dans Échanges ; un refus revient aussi, sans rien écrire', async () => {
		const { base, alice, bruno } = await avecAnniversaire();
		for (const retour of ['https://ailleurs.exemple/echanges', '//ailleurs.exemple', '/moi', '/echanges-pirate', ''])
			await expect(souhaiter(locaux(base, alice), { id: String(alice.id), retour })).rejects.toMatchObject({ status: 303, location: '/echanges' });
		await expect(souhaiter(locaux(base, alice), { id: String(bruno.id), retour: '/echanges' })).rejects.toMatchObject({ status: 303, location: '/echanges' });
		await expect(souhaiter(locaux(base, alice), { id: 'abc', retour: '/echanges' })).rejects.toMatchObject({ status: 303, location: '/echanges' });
		expect(await base.select().from(souhaitAnniversaire)).toEqual([]);
	});

	it('demande la connexion', async () => {
		const { base } = await avecAnniversaire();
		await expect(souhaiter(locaux(base, null), { id: '1' })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});
});
