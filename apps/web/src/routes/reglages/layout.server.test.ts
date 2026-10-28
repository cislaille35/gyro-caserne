import { describe, expect, it } from 'vitest';
import { responsabilite, responsabiliteDroit } from '@gyro-caserne/socle';
import { charger, locaux, preparer, super_ } from './de-test.ts';
import { load } from './+layout.server';

describe('liste des réglages', () => {
	it('renvoie vers la connexion sans acteur, refuse un agent ordinaire', async () => {
		const { base, ordinaire } = await preparer();
		await expect(charger(load, locaux(base, null))).rejects.toMatchObject({ status: 303, location: '/connexion' });
		await expect(charger(load, locaux(base, ordinaire))).rejects.toMatchObject({ status: 403 });
	});

	it('donne rôles et comités au référent technique, sans pouvoir ni profils', async () => {
		const { base, referent } = await preparer();
		const data = await charger(load, locaux(base, referent));
		expect(data.peutPouvoir).toBe(false);
		expect(data.profils).toBeNull();
		expect(data.comites.map((c: { nom: string }) => c.nom)).toContain('Amicale');
		expect(data.responsabilites.find((r: { nom: string }) => r.nom === 'Rapporteur de comité').protegee).toBe(true);
	});

	it('donne le pouvoir et les profils au chef de centre et au super administrateur', async () => {
		const { base, chef } = await preparer();
		for (const acteur of [chef, super_]) {
			const data = await charger(load, locaux(base, acteur));
			expect(data.peutPouvoir).toBe(true);
			expect(data.profils.map((p: { nom: string }) => p.nom)).toEqual(['Agent', 'Réserve citoyenne']);
		}
	});

	it('met à null la liste dont l’acteur n’a pas le droit', async () => {
		const { base, donner } = await preparer();
		const [liste] = await base.insert(responsabilite).values({ nom: 'Gestion listes', nature: 'mission', typePerimetre: 'centre' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: liste!.id, droit: 'GERER_LISTES' });
		const [com] = await base.insert(responsabilite).values({ nom: 'Gestion comités', nature: 'mission', typePerimetre: 'centre' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: com!.id, droit: 'GERER_COMITES' });
		const a = await donner('a@exemple.fr', 'Gestion listes');
		const b = await donner('b@exemple.fr', 'Gestion comités');
		expect(await charger(load, locaux(base, a))).toMatchObject({ comites: null, responsabilites: expect.any(Array) });
		expect(await charger(load, locaux(base, b))).toMatchObject({ comites: expect.any(Array), responsabilites: null });
	});
});
