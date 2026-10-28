import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { creerResponsabilite, journal, responsabilite, responsabiliteDroit } from '@gyro-caserne/socle';
import { charger, envoyer, locaux, preparer } from '../../de-test.ts';
import { actions, load } from './+page.server';

const agir = (nom: string, locals: unknown, id: number, corps: [string, string][]) => envoyer(actions, nom, locals, corps, { id: String(id) });
// Le formulaire principal tel qu'envoyé par la page, sans les niveaux.
const fiche = (nom: string, attributeur = 'chef_centre'): [string, string][] => [['nom', nom], ['nature', 'mission'], ['attributeur', attributeur]];

describe('page d’un rôle', () => {
	it('refuse un agent ordinaire, au chargement et pour chaque action ; 404 pour un rôle inconnu', async () => {
		const { base, ordinaire, referent, resp } = await preparer();
		const engins = await resp('Référent engins');
		await expect(charger(load, locaux(base, ordinaire), { id: String(engins.id) })).rejects.toMatchObject({ status: 403 });
		for (const nom of Object.keys(actions)) {
			await expect(agir(nom, locaux(base, ordinaire), engins.id, [...fiche('X'), ['confirmation', 'oui'], ['domaine', 'tout']])).rejects.toMatchObject({ status: 403 });
		}
		await expect(charger(load, locaux(base, referent), { id: '999' })).rejects.toMatchObject({ status: 404 });
		await expect(charger(load, locaux(base, referent), { id: 'abc' })).rejects.toMatchObject({ status: 404 });
	});

	it('rôle système : lecture seule, et le serveur refuse toute modification', async () => {
		const { base, chef, resp, droitsDe } = await preparer();
		const chefEq = await resp('Chef d’équipe');
		const data = await charger(load, locaux(base, chef), { id: String(chefEq.id) });
		expect(data.raison).toContain('système');
		const avant = await droitsDe(chefEq.id);
		for (const nom of ['enregistrer', 'revenir', 'detail']) {
			const r = await agir(nom, locaux(base, chef), chefEq.id, [...fiche('Chef d’équipe'), ['niveau-planning', '3'], ['droits', 'VOIR_PLANNING'], ['domaine', 'tout']]);
			expect(r).toMatchObject({ status: 400, data: { message: expect.stringContaining('système') } });
		}
		expect(await droitsDe(chefEq.id)).toEqual(avant);
	});

	it('référent technique sur un rôle à droit de pouvoir : lecture seule et refus du serveur, rien d’écrit', async () => {
		const { base, referent, resp, droitsDe } = await preparer();
		const rap = await resp('Rapporteur de comité');
		expect((await charger(load, locaux(base, referent), { id: String(rap.id) })).raison).toContain('administration');
		const avant = await droitsDe(rap.id);
		const e = await agir('enregistrer', locaux(base, referent), rap.id, [...fiche('Rapporteur de comité', 'comite_vise'), ['niveau-stock', '1']]);
		expect(e).toMatchObject({ status: 403, data: { cible: 'role', message: expect.stringContaining('chef de centre') } });
		const a = await agir('archiver', locaux(base, referent), rap.id, [['confirmation', 'oui']]);
		expect(a).toMatchObject({ status: 403 });
		expect(await droitsDe(rap.id)).toEqual(avant);
		expect((await resp('Rapporteur de comité')).archiveeLe).toBeNull();
	});

	it('enregistre un niveau : seul ce domaine change', async () => {
		const { base, referent, resp, droitsDe } = await preparer();
		const pharma = await resp('Référent pharmacie');
		const r = await agir('enregistrer', locaux(base, referent), pharma.id, [...fiche('Référent pharmacie'), ['niveau-engins', '1'], ['niveau-stock', '1'], ['niveau-planning', '0'], ['icone', 'croix']]);
		expect(r).toMatchObject({ cible: 'role', succes: expect.stringContaining('Référent pharmacie') });
		expect(await droitsDe(pharma.id)).toEqual(['GERER_FICHES', 'GERER_STOCK', 'TRAITER_ANOMALIE']);
		expect((await resp('Référent pharmacie')).icone).toBe('croix');
	});

	it('un domaine « Sur mesure » non touché garde ses droits', async () => {
		const { base, chef, droitsDe } = await preparer();
		const [mesure] = await base.insert(responsabilite).values({ nom: 'Planificateur', nature: 'mission', typePerimetre: 'centre' }).returning();
		await base.insert(responsabiliteDroit).values([{ responsabiliteId: mesure!.id, droit: 'GERER_PLANNING' }, { responsabiliteId: mesure!.id, droit: 'LIRE_SALON' }]);
		const r = await agir('enregistrer', locaux(base, chef), mesure!.id, [...fiche('Planificateur'), ['niveau-planning', 'sur_mesure'], ['niveau-stock', '0'], ['administration', 'oui']]);
		expect(r.succes).toBeDefined();
		expect(await droitsDe(mesure!.id)).toEqual(['GERER_PLANNING', 'LIRE_SALON']);
		expect(await base.select().from(journal).where(eq(journal.action, 'modifier_responsabilite'))).toHaveLength(0);
	});

	it('le référent qui envoie une case d’administration est refusé, rien d’écrit', async () => {
		const { base, referent, resp, droitsDe } = await preparer();
		const engins = await resp('Référent engins');
		const avant = await droitsDe(engins.id);
		const r = await agir('enregistrer', locaux(base, referent), engins.id, [...fiche('Référent engins'), ['administration', 'oui'], ['admin', 'GERER_ACCES']]);
		expect(r).toMatchObject({ status: 403 });
		const d = await agir('detail', locaux(base, referent), engins.id, [...avant.map((x): [string, string] => ['droits', x]), ['droits', 'GERER_ACCES']]);
		expect(d).toMatchObject({ status: 403, data: { cible: 'detail' } });
		expect(await droitsDe(engins.id)).toEqual(avant);
	});

	it('sans les cases d’administration, les droits de pouvoir restent ; le chef les coche', async () => {
		const { base, chef, resp, droitsDe } = await preparer();
		const rap = await resp('Rapporteur de comité');
		await agir('enregistrer', locaux(base, chef), rap.id, [...fiche('Rapporteur de comité', 'comite_vise'), ['niveau-stock', '1']]);
		expect(await droitsDe(rap.id)).toEqual(['ATTRIBUER_RESPONSABILITE', 'GERER_STOCK']);
		await agir('enregistrer', locaux(base, chef), rap.id, [...fiche('Rapporteur de comité', 'comite_vise'), ['administration', 'oui'], ['admin', 'GERER_COMITES']]);
		expect(await droitsDe(rap.id)).toEqual(['GERER_COMITES', 'GERER_STOCK']);
	});

	it('met l’erreur du nom sur le champ', async () => {
		const { base, referent, resp } = await preparer();
		const engins = await resp('Référent engins');
		const r = await agir('enregistrer', locaux(base, referent), engins.id, fiche(' référent PHARMACIE '));
		expect(r).toMatchObject({ status: 400, data: { cible: 'role', erreurs: { nom: expect.stringContaining('déjà') } } });
	});

	it('« Revenir au modèle » rend les droits du modèle, domaine par domaine ou en entier', async () => {
		const { base, chef, droitsDe } = await preparer();
		const id = await creerResponsabilite(base, chef, { nom: 'Référent matériel', nature: 'mission', portee: 'centre', attributeur: { type: 'chef_centre' }, droits: ['GERER_STOCK', 'RESERVER'], modele: 'referent_materiel' }, '2026-01-01');
		const stock = await agir('revenir', locaux(base, chef), id, [['domaine', 'stock']]);
		expect(stock.succes).toBeDefined();
		expect(await droitsDe(id)).toEqual(['RESERVER']);
		await agir('revenir', locaux(base, chef), id, [['domaine', 'tout']]);
		expect(await droitsDe(id)).toEqual(['GERER_FICHES', 'TRAITER_ANOMALIE']);
	});

	it('sans modèle, rien à revenir', async () => {
		const { base, referent, resp } = await preparer();
		const engins = await resp('Référent engins');
		expect(await agir('revenir', locaux(base, referent), engins.id, [['domaine', 'tout']])).toMatchObject({ status: 400 });
	});

	it('détail droit par droit : garde les droits de pouvoir de qui ne les gère pas', async () => {
		const { base, chef, referent, resp, droitsDe } = await preparer();
		const engins = await resp('Référent engins');
		await base.insert(responsabiliteDroit).values({ responsabiliteId: engins.id, droit: 'GERER_ACCES' });
		await agir('detail', locaux(base, chef), engins.id, [['droits', 'VOIR_PLANNING'], ['droits', 'GERER_ACCES']]);
		expect(await droitsDe(engins.id)).toEqual(['GERER_ACCES', 'VOIR_PLANNING']);
		const pharma = await resp('Référent pharmacie');
		const r = await agir('detail', locaux(base, referent), pharma.id, [['droits', 'FAIRE_PRISE_DE_GARDE']]);
		expect(r).toMatchObject({ cible: 'detail', succes: expect.any(String) });
		expect(await droitsDe(pharma.id)).toEqual(['FAIRE_PRISE_DE_GARDE']);
	});

	it('archive avec confirmation seulement, jamais un rôle système', async () => {
		const { base, referent, resp } = await preparer();
		const engins = await resp('Référent engins');
		expect(await agir('archiver', locaux(base, referent), engins.id, [])).toMatchObject({ status: 400, data: { cible: 'archiver', message: expect.stringContaining('confirme') } });
		expect(await agir('archiver', locaux(base, referent), engins.id, [['confirmation', 'oui']])).toMatchObject({ succes: expect.any(String) });
		expect((await resp('Référent engins')).archiveeLe).not.toBeNull();
		const sys = await resp('Chef d’équipe');
		expect(await agir('archiver', locaux(base, referent), sys.id, [['confirmation', 'oui']])).toMatchObject({ status: 400, data: { message: expect.stringContaining('système') } });
	});
});
