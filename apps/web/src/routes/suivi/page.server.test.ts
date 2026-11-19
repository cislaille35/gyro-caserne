import { describe, expect, it } from 'vitest';
import { journal } from '@gyro-caserne/socle';
import { preparer } from '../echanges/de-test.ts';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (acteur: unknown, base: unknown, url = 'http://x/suivi') => (load as any)({ locals: { acteur, base }, url: new URL(url) });

describe('/suivi (serveur)', () => {
	it('le chef lit le suivi, page par page ; un agent est refusé ; un visiteur va à la connexion', async () => {
		const { base, chef, alice } = await preparer();
		await base.insert(journal).values(Array.from({ length: 27 }, () => ({ quand: '2026-11-18T10:00', acteur: `personne:${alice.id}`, action: 'changer_statut', cibleType: 'personne', cibleId: alice.id })));
		const premiere = await appeler(chef, base);
		expect(premiere.lignes).toHaveLength(25);
		expect(premiere.suite).not.toBeNull();
		expect((await appeler(chef, base, `http://x/suivi?avant=${premiere.suite}`)).lignes.length).toBeGreaterThan(0);
		await expect(appeler(alice, base)).rejects.toMatchObject({ status: 403 });
		await expect(appeler(null, base)).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});
});
