import { describe, expect, it } from 'vitest';
import { responsabilite } from '@gyro-caserne/socle';
import { charger, envoyer, locaux, preparer } from '../../de-test.ts';
import { actions, load } from './+page.server';

const creer = (locals: unknown, corps: [string, string][]) => envoyer(actions, 'default', locals, corps);
const corps = (modele: string, extra: [string, string][] = []): [string, string][] => {
	const defauts: [string, string][] = [['modele', modele], ['nom', 'Pharmacie bis'], ['nature', 'mission'], ['portee', 'centre'], ['attributeur', 'chef_centre']];
	const remplaces = new Set(extra.map(([cle]) => cle));
	return [...defauts.filter(([cle]) => !remplaces.has(cle)), ...extra];
};

describe('nouveau rôle', () => {
	it('refuse un agent ordinaire', async () => {
		const { base, ordinaire } = await preparer();
		await expect(charger(load, locaux(base, ordinaire))).rejects.toMatchObject({ status: 403 });
		await expect(creer(locaux(base, ordinaire), corps('referent_pharmacie'))).rejects.toMatchObject({ status: 403 });
	});

	it('propose les modèles ; ceux qui donnent du pouvoir sont réservés à qui le gère', async () => {
		const { base, referent, chef } = await preparer();
		const data = await charger(load, locaux(base, referent));
		expect(data.choisi).toBeNull();
		expect(data.modeles.map((m: { id: string }) => m.id)).toEqual(['referent_materiel', 'referent_pharmacie', 'referent_technique', 'membre_comite', 'rapporteur_comite', 'vierge']);
		expect(data.modeles.filter((m: { reserve: boolean }) => m.reserve).map((m: { id: string }) => m.id)).toEqual(['referent_technique', 'rapporteur_comite']);
		expect((await charger(load, locaux(base, chef))).modeles.some((m: { reserve: boolean }) => m.reserve)).toBe(false);
	});

	it('préremplit le formulaire avec le modèle choisi', async () => {
		const { base, referent } = await preparer();
		const data = await charger(load, locaux(base, referent), {}, 'http://x/reglages/roles/nouveau?modele=membre_comite');
		expect(data.choisi).toMatchObject({ id: 'membre_comite', nom: 'Membre de comité', portee: 'comite', icone: 'groupe' });
		expect((await charger(load, locaux(base, referent), {}, 'http://x/?modele=licorne')).choisi).toBeNull();
	});

	it('crée depuis « Référent pharmacie » avec les droits du modèle, puis ouvre sa page', async () => {
		const { base, referent, resp, droitsDe } = await preparer();
		// Les droits envoyés par le formulaire sont ignorés : seuls comptent ceux du modèle.
		await expect(creer(locaux(base, referent), corps('referent_pharmacie', [['droits', 'GERER_PLANNING']]))).rejects.toMatchObject({ status: 303, location: expect.stringMatching(/^\/reglages\/roles\/\d+$/) });
		const cree = await resp('Pharmacie bis');
		expect(cree).toMatchObject({ modele: 'referent_pharmacie', icone: 'croix', typePerimetre: 'centre' });
		expect(await droitsDe(cree.id)).toEqual(['GERER_STOCK']);
	});

	it('garde l’icône choisie', async () => {
		const { base, referent, resp } = await preparer();
		await expect(creer(locaux(base, referent), corps('vierge', [['nom', 'Référent sport'], ['icone', 'ballon']]))).rejects.toMatchObject({ status: 303 });
		expect(await resp('Référent sport')).toMatchObject({ modele: 'vierge', icone: 'ballon' });
	});

	it('refuse au référent technique un modèle à droit de pouvoir, rien d’écrit', async () => {
		const { base, referent } = await preparer();
		const avant = (await base.select().from(responsabilite)).length;
		const r = await creer(locaux(base, referent), corps('rapporteur_comite', [['portee', 'comite'], ['attributeur', 'comite_vise']]));
		expect(r).toMatchObject({ status: 403, data: { message: expect.stringContaining('chef de centre') } });
		expect(await base.select().from(responsabilite)).toHaveLength(avant);
	});

	it('refuse un modèle inconnu, un nom en double, qui attribue incohérent, avec la saisie', async () => {
		const { base, referent } = await preparer();
		expect(await creer(locaux(base, referent), corps('licorne'))).toMatchObject({ status: 400, data: { message: expect.stringContaining('modèle') } });
		expect(await creer(locaux(base, referent), corps('referent_pharmacie', [['nom', 'référent PHARMACIE']]))).toMatchObject({ status: 400, data: { erreurs: { nom: expect.stringContaining('déjà') }, valeurs: { nom: 'référent PHARMACIE' } } });
		expect(await creer(locaux(base, referent), corps('membre_comite', [['portee', 'comite']]))).toMatchObject({ status: 400, data: { erreurs: { attributeur: expect.any(String) } } });
	});
});
