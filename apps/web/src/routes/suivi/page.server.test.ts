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
		// Le filtre passe par l'adresse ; un sujet inconnu montre tout.
		expect((await appeler(chef, base, 'http://x/suivi?sujet=agents')).sujet).toBe('agents');
		expect((await appeler(chef, base, 'http://x/suivi?sujet=reglages')).lignes).toEqual([]);
		expect((await appeler(chef, base, 'http://x/suivi?sujet=nimporte')).sujet).toBeNull();
		expect((await appeler(chef, base, 'http://x/suivi?sujet=nimporte')).lignes).toHaveLength(25);
		// Arrivée sur « Tout », puis « Planning » avec la marque de l'arrivée : le repère reste au même endroit.
		const arrivee = await appeler(chef, base);
		expect((await appeler(chef, base, `http://x/suivi?sujet=agents&vu=${arrivee.vu ?? 0}`)).vu).toBe(arrivee.vu ?? 0);
		expect((await appeler(chef, base, 'http://x/suivi?vu=12')).vu).toBe(12);
		// Une marque invalide est ignorée : c'est une arrivée, qui lit la visite déjà marquée (la dernière ligne).
		const derniere = arrivee.lignes[0].id;
		for (const vu of ['-3', 'abc', '1.5', '', '1234567890123']) expect((await appeler(chef, base, `http://x/suivi?vu=${vu}`)).vu, vu).toBe(derniere);
		await expect(appeler(alice, base)).rejects.toMatchObject({ status: 403 });
		await expect(appeler(null, base)).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});
});
