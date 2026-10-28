import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { attribution, journal, responsabilite } from '@gyro-caserne/socle';
import { charger, envoyer, locaux, preparer } from '../../de-test.ts';
import { actions, load } from './+page.server';

const agir = (nom: string, locals: unknown, id: number, corps: [string, string][]) => envoyer(actions, nom, locals, corps, { id: String(id) });

describe('page d’un comité', () => {
	it('refuse un agent ordinaire ; 404 pour un comité inconnu', async () => {
		const { base, ordinaire, referent, com } = await preparer();
		const amicale = await com('Amicale');
		await expect(charger(load, locaux(base, ordinaire), { id: String(amicale.id) })).rejects.toMatchObject({ status: 403 });
		for (const nom of Object.keys(actions)) {
			await expect(agir(nom, locaux(base, ordinaire), amicale.id, [['nom', 'X'], ['theme', 'x'], ['confirmation', 'oui']])).rejects.toMatchObject({ status: 403 });
		}
		await expect(charger(load, locaux(base, referent), { id: '999' })).rejects.toMatchObject({ status: 404 });
	});

	it('montre le comité, ses membres et son rapporteur', async () => {
		const { base, referent, com, donner } = await preparer();
		const amicale = await com('Amicale');
		await donner('rap@exemple.fr', 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		const data = await charger(load, locaux(base, referent), { id: String(amicale.id) });
		expect(data.comite).toMatchObject({ nom: 'Amicale', membresEnCours: 1, rapporteurs: ['P N'] });
	});

	it('modifie un comité ; le comité du centre ne se renomme pas', async () => {
		const { base, referent, com } = await preparer();
		const amicale = await com('Amicale');
		expect(await agir('modifier', locaux(base, referent), amicale.id, [['nom', 'Amicale 2'], ['theme', 'fêtes']])).toMatchObject({ cible: 'comite', succes: expect.any(String) });
		const centreCom = await com('Comité du centre');
		expect(await agir('modifier', locaux(base, referent), centreCom.id, [['nom', 'Autre'], ['theme', 'centre']])).toMatchObject({ status: 400, data: { erreurs: { nom: expect.stringContaining('centre') } } });
	});

	it('dissout seulement avec confirmation ; jamais le comité du centre', async () => {
		const { base, referent, com } = await preparer();
		const amicale = await com('Amicale');
		expect(await agir('dissoudre', locaux(base, referent), amicale.id, [])).toMatchObject({ status: 400, data: { cible: 'dissoudre', message: expect.stringContaining('confirme') } });
		expect((await com('Amicale')).dissousLe).toBeNull();
		expect(await agir('dissoudre', locaux(base, referent), amicale.id, [['confirmation', 'oui']])).toMatchObject({ succes: expect.any(String) });
		expect((await com('Amicale')).dissousLe).not.toBeNull();
		const c = await com('Comité du centre');
		expect(await agir('dissoudre', locaux(base, referent), c.id, [['confirmation', 'oui']])).toMatchObject({ status: 400, data: { message: expect.stringContaining('centre') } });
	});

	it('refuse de dissoudre un comité qui attribue un rôle de portée « comité »', async () => {
		const { base, referent, com } = await preparer();
		const amicale = await com('Amicale');
		await base.insert(responsabilite).values({ nom: 'Délégué', nature: 'mission', typePerimetre: 'comite', comiteAttributeurId: amicale.id });
		expect(await agir('dissoudre', locaux(base, referent), amicale.id, [['confirmation', 'oui']])).toMatchObject({ status: 400, data: { message: 'Changez d’abord qui attribue « Délégué »' } });
	});

	it('dissoudre retire le rôle au rapporteur et le journal le note', async () => {
		const { base, chef, com, donner } = await preparer();
		const amicale = await com('Amicale');
		const rap = await donner('rap@exemple.fr', 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		await agir('dissoudre', locaux(base, chef), amicale.id, [['confirmation', 'oui']]);
		const [ligne] = await base.select().from(attribution).where(and(eq(attribution.personneId, rap.id)));
		expect(ligne!.fin).not.toBeNull();
		expect(await base.select().from(journal).where(eq(journal.action, 'dissoudre_comite'))).toHaveLength(1);
	});
});
