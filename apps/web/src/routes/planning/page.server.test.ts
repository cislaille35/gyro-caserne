import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { personne, profil } from '@gyro-caserne/socle';
import { load } from './+page.server';
import { charger, locaux, preparer } from './de-test.ts';

describe('/planning', () => {
	it('demande la connexion', async () => {
		await expect(charger(load, { acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('année non publiée : rien pour l’agent, « Préparer » pour le chef', async () => {
		const { base, alice, chef, annee } = await preparer({ publiee: false });
		expect(await charger(load, locaux(base, alice))).toMatchObject({ planning: { publiee: false, annee, peutPreparer: false } });
		expect(await charger(load, locaux(base, chef))).toMatchObject({ planning: { publiee: false, peutPreparer: true } });
	});

	it('année publiée : ses semaines, sa vue par défaut ; « Toutes les équipes » à la demande', async () => {
		const { base, alice, annee } = await preparer();
		const data = await charger(load, locaux(base, alice));
		expect(data.vue).toBe('moi');
		expect(data.planning.publiee).toBe(true);
		expect(data.planning.semaines.filter((s: { mienne: boolean }) => s.mienne).length).toBeGreaterThan(10);
		expect((await charger(load, locaux(base, alice), '?vue=equipes')).vue).toBe('equipes');
		expect((await charger(load, locaux(base, alice), `?annee=${annee + 1}`)).planning).toMatchObject({ publiee: false, annee: annee + 1 });
	});

	it('sans équipe : toutes les équipes ; année invalide : celle en cours', async () => {
		const { base, chef, annee } = await preparer();
		expect((await charger(load, locaux(base, chef))).vue).toBe('equipes');
		expect((await charger(load, locaux(base, chef), '?annee=abc')).planning.annee).toBe(annee);
	});

	it('refuse qui n’a pas le droit de voir le planning (403)', async () => {
		const { base } = await preparer();
		const [ext] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		const [x] = await base.insert(personne).values({ email: 'x@exemple.fr', prenom: 'X', nom: 'Y', profilId: ext!.id }).returning();
		await expect(charger(load, locaux(base, { type: 'personne', id: x!.id }))).rejects.toMatchObject({ status: 403 });
	});
});
