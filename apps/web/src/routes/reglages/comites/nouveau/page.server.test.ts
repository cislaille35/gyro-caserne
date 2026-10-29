import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { comite, journal, responsabilite, responsabiliteDroit } from '@gyro-caserne/socle';
import { charger, envoyer, locaux, preparer } from '../../de-test.ts';
import { actions, load } from './+page.server';

const creer = (locals: unknown, corps: [string, string][]) => envoyer(actions, 'default', locals, corps);

describe('nouveau comité', () => {
	it('refuse un agent ordinaire et qui ne gère pas les comités (403 clair)', async () => {
		const { base, ordinaire, donner } = await preparer();
		await expect(charger(load, locaux(base, ordinaire))).rejects.toMatchObject({ status: 403 });
		await expect(creer(locaux(base, ordinaire), [['nom', 'Sport'], ['theme', 'sport']])).rejects.toMatchObject({ status: 403 });
		const [liste] = await base.insert(responsabilite).values({ nom: 'Gestion listes', nature: 'mission', typePerimetre: 'centre' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: liste!.id, droit: 'GERER_LISTES' });
		const a = await donner('a@exemple.fr', 'Gestion listes');
		const r = await creer(locaux(base, a), [['nom', 'Sport'], ['theme', 'sport']]);
		expect(r).toMatchObject({ status: 403, data: { message: expect.stringContaining('comités') } });
		expect(r.data.message).not.toContain('GERER');
		expect(await base.select().from(journal).where(eq(journal.action, 'creer_comite'))).toHaveLength(0);
	});

	it('crée un comité puis ouvre sa page', async () => {
		const { base, referent } = await preparer();
		await expect(creer(locaux(base, referent), [['nom', ' Sport '], ['theme', 'sport']])).rejects.toMatchObject({ status: 303, location: expect.stringMatching(/^\/reglages\/comites\/\d+$/) });
		expect(await base.select().from(comite).where(eq(comite.nom, 'Sport'))).toHaveLength(1);
	});

	it('crée un comité avec l’icône choisie', async () => {
		const { base, referent } = await preparer();
		await expect(creer(locaux(base, referent), [['nom', 'Sport'], ['theme', 'sport'], ['icone', 'ballon']])).rejects.toMatchObject({ status: 303 });
		expect((await base.select().from(comite).where(eq(comite.nom, 'Sport')))[0]!.icone).toBe('ballon');
	});

	it('sans icône choisie, enregistre une icône nulle', async () => {
		const { base, referent } = await preparer();
		await expect(creer(locaux(base, referent), [['nom', 'Sport'], ['theme', 'amicale']])).rejects.toMatchObject({ status: 303 });
		expect((await base.select().from(comite).where(eq(comite.nom, 'Sport')))[0]!.icone).toBeNull();
		await expect(creer(locaux(base, referent), [['nom', 'Fêtes'], ['theme', 'fêtes'], ['icone', '']])).rejects.toMatchObject({ status: 303 });
		expect((await base.select().from(comite).where(eq(comite.nom, 'Fêtes')))[0]!.icone).toBeNull();
	});

	it('met l’erreur du nom ou du thème sur le bon champ, avec la saisie', async () => {
		const { base, referent } = await preparer();
		expect(await creer(locaux(base, referent), [['nom', 'amicale '], ['theme', 'x']])).toMatchObject({ status: 400, data: { erreurs: { nom: expect.stringContaining('déjà') }, valeurs: { theme: 'x' } } });
		expect(await creer(locaux(base, referent), [['nom', 'Z'], ['theme', ' ']])).toMatchObject({ status: 400, data: { erreurs: { theme: expect.any(String) } } });
	});
});
