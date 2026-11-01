import { describe, expect, it } from 'vitest';
import centre from '$centre';
import { demanderRemplacement, pourDemander } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { actions, load } from './+page.server';
import { actions as actionsDetail, load as detail } from './[id]/+page.server';
import { actions as actionsDemander, load as demander } from './demander/+page.server';
import { load as manoeuvre } from './manoeuvre/+page.server';
import { charger, envoyer, locaux, preparer } from './de-test.ts';

// La première nuit libre d'Alice.
async function premiereNuit(jeu: Awaited<ReturnType<typeof preparer>>) {
	const { semaines } = await pourDemander(jeu.base, jeu.alice, maintenantParis(), centre.astreinte);
	return semaines.flatMap((s) => s.tranches).find((t) => !t.prise)!;
}

describe('/remplacements', () => {
	it('Alice demande depuis l’écran ; Bruno la voit « Pour moi » et l’accepte ; la page de la demande le dit', async () => {
		const jeu = await preparer();
		const nuit = await premiereNuit(jeu);
		const page = await charger(demander, locaux(jeu.base, jeu.alice), '/remplacements/demander');
		expect(page.mode).toBe('remplacement');
		expect(page.semaines.length).toBeGreaterThan(0);
		await expect(envoyer(actionsDemander, 'default', locaux(jeu.base, jeu.alice), [['periode', `${nuit.debut}|${nuit.fin}`], ['pour', 'tous'], ['mot', 'Mariage']])).rejects.toMatchObject({ status: 303, location: expect.stringMatching(/^\/remplacements\/\d+$/) });

		const pourBruno = await charger(load, locaux(jeu.base, jeu.bruno));
		expect(pourBruno.onglet).toBe('pour-moi');
		expect(pourBruno.pourMoi).toHaveLength(1);
		const id = pourBruno.pourMoi[0].id;
		expect(await envoyer(actions, 'accepter', locaux(jeu.base, jeu.bruno), [['id', String(id)]])).toEqual({ succes: expect.stringContaining('c’est conclu') });
		expect(await envoyer(actions, 'accepter', locaux(jeu.base, jeu.chef), [['id', String(id)]])).toMatchObject({ status: 400 });

		const vue = await charger(detail, locaux(jeu.base, jeu.alice), `/remplacements/${id}`, { id: String(id) });
		expect(vue.demande).toMatchObject({ etat: 'conclue', mot: 'Mariage', remplacant: { prenom: 'Bruno' } });
		const miennes = await charger(load, locaux(jeu.base, jeu.alice), '/remplacements?onglet=miennes');
		expect(miennes.miennes.map((v: { id: number }) => v.id)).toEqual([id]);
		expect(await envoyer(actionsDetail, 'desister', locaux(jeu.base, jeu.bruno), [['id', String(id)]], { id: String(id) })).toEqual({ succes: expect.stringContaining('titulaire est prévenu') });
	});

	it('rien de coché : un message ; collègue non choisi : un message', async () => {
		const jeu = await preparer();
		const nuit = await premiereNuit(jeu);
		expect(await envoyer(actionsDemander, 'default', locaux(jeu.base, jeu.alice), [['pour', 'tous']])).toMatchObject({ status: 400, data: { message: 'Cochez au moins une de vos périodes.' } });
		expect(await envoyer(actionsDemander, 'default', locaux(jeu.base, jeu.alice), [['periode', `${nuit.debut}|${nuit.fin}`], ['pour', 'collegue']])).toMatchObject({ status: 400, data: { message: 'Choisissez le collègue.' } });
	});

	it('« Tout le week-end » coche d’un geste les tranches qui se suivent', async () => {
		const jeu = await preparer();
		const { semaines } = await pourDemander(jeu.base, jeu.alice, maintenantParis(), centre.astreinte);
		const semaine = semaines.find((s) => s.tranches.length >= 5)!;
		const [a, , c] = semaine.tranches;
		await expect(envoyer(actionsDemander, 'default', locaux(jeu.base, jeu.alice), [['periode-bloc', `${a!.debut}|${c!.fin}`], ['pour', 'tous']])).rejects.toMatchObject({ status: 303 });
		const apres = await pourDemander(jeu.base, jeu.alice, maintenantParis(), centre.astreinte);
		expect(apres.semaines.find((s) => s.semaine === semaine.semaine)!.tranches.filter((t) => t.prise).length).toBeGreaterThanOrEqual(2);
	});

	it('une demande d’un autre : 403 ; inconnue : 404', async () => {
		const jeu = await preparer();
		const nuit = await premiereNuit(jeu);
		const id = await demanderRemplacement(jeu.base, jeu.alice, { periodes: [nuit], cibleId: jeu.chef.id }, maintenantParis(), centre.astreinte);
		await expect(charger(detail, locaux(jeu.base, jeu.bruno), `/remplacements/${id}`, { id: String(id) })).rejects.toMatchObject({ status: 403 });
		await expect(charger(detail, locaux(jeu.base, jeu.alice), '/remplacements/999', { id: '999' })).rejects.toMatchObject({ status: 404 });
	});

	it('échanger une manœuvre : rien à échanger sans manœuvre par équipe', async () => {
		const jeu = await preparer();
		expect(await charger(manoeuvre, locaux(jeu.base, jeu.alice), '/remplacements/manoeuvre')).toEqual({ miennes: [], collegues: [] });
	});

	it('super administrateur : pas de demande, page sans liste', async () => {
		const jeu = await preparer();
		expect(await charger(load, locaux(jeu.base, { type: 'super', email: 'a@b.fr' }))).toEqual({ personne: false });
	});
});
