import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { personne, profil } from '@gyro-caserne/socle';
import { actions, load } from './+page.server';
import { charger, envoyer, locaux, preparer } from './de-test.ts';

describe('/planning', () => {
	it('demande la connexion', async () => {
		await expect(charger(load, { acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('année non publiée : rien pour l’agent, « Préparer » pour le chef', async () => {
		const { base, alice, chef, annee } = await preparer({ publiee: false });
		expect(await charger(load, locaux(base, alice))).toMatchObject({ planning: { publiee: false, annee, peutPreparer: false } });
		expect(await charger(load, locaux(base, chef))).toMatchObject({ planning: { publiee: false, peutPreparer: true } });
	});

	it('année publiée : ses semaines, la vue Semaine par défaut ; les autres vues à la demande', async () => {
		const { base, alice, annee } = await preparer();
		const data = await charger(load, locaux(base, alice));
		expect(data.vue).toBe('semaine');
		expect(data.planning.semaines.some((s: { debut: string }) => s.debut === data.semaine)).toBe(true);
		expect(data.mois).toBe(Number(data.maintenant.slice(5, 7)));
		expect(data.remplacements).toEqual({ miennes: [], pourMoi: [], aValider: [] });
		for (const vue of ['mois', 'annee', 'equipes']) expect((await charger(load, locaux(base, alice), `?vue=${vue}`)).vue).toBe(vue);
		expect((await charger(load, locaux(base, alice), '?vue=moi')).vue).toBe('annee');
		expect((await charger(load, locaux(base, alice), '?vue=nimporte')).vue).toBe('semaine');
		const premiere = data.planning.semaines[0].debut;
		expect((await charger(load, locaux(base, alice), `?vue=semaine&semaine=${premiere}`)).semaine).toBe(premiere);
		expect((await charger(load, locaux(base, alice), '?vue=semaine&semaine=derniere')).semaine).toBe(data.planning.semaines.at(-1).debut);
		expect((await charger(load, locaux(base, alice), '?vue=semaine&semaine=2001-01-01')).semaine).toBe(data.semaine);
		expect((await charger(load, locaux(base, alice), '?vue=mois&mois=3')).mois).toBe(3);
		expect((await charger(load, locaux(base, alice), '?vue=mois&mois=13')).mois).toBe(data.mois);
		expect(data.planning.publiee).toBe(true);
		expect(data.planning.semaines.filter((s: { mienne: boolean }) => s.mienne).length).toBeGreaterThan(10);
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

	it('répondre à la manœuvre sur place : une publication inconnue est refusée', async () => {
		const { base, alice } = await preparer();
		expect(
			await envoyer(actions, 'repondre', locaux(base, alice), [
				['id', '9999'],
				['reponse', 'present']
			])
		).toMatchObject({ status: 404 });
	});
});
