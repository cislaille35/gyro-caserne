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
	return semaines.flatMap((s) => s.tranches).find((t) => t.etat === 'libre')!;
}

describe('/remplacements', () => {
	it('Alice demande depuis l’écran ; Bruno la voit « Pour moi » et l’accepte ; la page de la demande le dit', async () => {
		const jeu = await preparer();
		const nuit = await premiereNuit(jeu);
		const page = await charger(demander, locaux(jeu.base, jeu.alice), '/remplacements/demander');
		expect(page).toMatchObject({ mode: 'remplacement', etape: 'quand' });
		expect(page.semaines.length).toBeGreaterThan(0);
		const p = encodeURIComponent(`${nuit.debut}|${nuit.fin}`);
		const verifier = await charger(demander, locaux(jeu.base, jeu.alice), `/remplacements/demander?p=${p}&pour=tous&etape=verifier`);
		expect(verifier).toMatchObject({ etape: 'verifier', pour: 'tous', choisies: [{ debut: nuit.debut, fin: nuit.fin }], message: null });
		expect(verifier.candidats.map((c: { prenom: string }) => c.prenom)).toContain('Bruno');
		await expect(envoyer(actionsDemander, 'default', locaux(jeu.base, jeu.alice), [['periode', `${nuit.debut}|${nuit.fin}`], ['pour', 'tous'], ['mot', 'Mariage']])).rejects.toMatchObject({ status: 303, location: expect.stringMatching(/^\/remplacements\/\d+\?envoyee$/) });

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

	it('rien de coché : un message ; destinataire non choisi : un message', async () => {
		const jeu = await preparer();
		const nuit = await premiereNuit(jeu);
		expect(await envoyer(actionsDemander, 'default', locaux(jeu.base, jeu.alice), [['pour', 'tous']])).toMatchObject({ status: 400, data: { message: 'Touchez au moins un jour.' } });
		expect(await envoyer(actionsDemander, 'default', locaux(jeu.base, jeu.alice), [['periode', `${nuit.debut}|${nuit.fin}`]])).toMatchObject({ status: 400, data: { message: 'Choisissez « Tout le monde » ou un collègue.' } });
	});

	it('parcours : une étape demandée sans les précédentes revient à celle qui manque, en le disant ; le jour venu du planning est pré-choisi', async () => {
		const jeu = await preparer();
		const nuit = await premiereNuit(jeu);
		expect(await charger(demander, locaux(jeu.base, jeu.alice), '/remplacements/demander?etape=verifier')).toMatchObject({ etape: 'quand', message: 'Touchez au moins un jour.' });
		const p = encodeURIComponent(`${nuit.debut}|${nuit.fin}`);
		expect(await charger(demander, locaux(jeu.base, jeu.alice), `/remplacements/demander?p=${p}&etape=verifier`)).toMatchObject({ etape: 'qui', message: 'Choisissez « Tout le monde » ou un collègue.' });
		const duJour = await charger(demander, locaux(jeu.base, jeu.alice), `/remplacements/demander?jour=${nuit.debut.slice(0, 10)}`);
		expect(duJour).toMatchObject({ etape: 'quand', choisies: [{ debut: nuit.debut, fin: nuit.fin }], message: null });
		expect(duJour.semaine.tranches.some((t: { debut: string }) => t.debut === nuit.debut)).toBe(true);
	});

	it('échange : ma période, le collègue, sa période, vérifier ; puis la proposition', async () => {
		const jeu = await preparer();
		const nuit = await premiereNuit(jeu);
		const p = encodeURIComponent(`${nuit.debut}|${nuit.fin}`);
		const avec = await charger(demander, locaux(jeu.base, jeu.alice), `/remplacements/demander?mode=echange&p=${p}&etape=avec`);
		expect(avec).toMatchObject({ mode: 'echange', etape: 'avec' });
		const bruno = avec.echangeables.find((c: { prenom: string }) => c.prenom === 'Bruno');
		const sienne = await charger(demander, locaux(jeu.base, jeu.alice), `/remplacements/demander?mode=echange&p=${p}&avec=${bruno.id}&etape=sienne`);
		expect(sienne).toMatchObject({ etape: 'sienne', avec: { prenom: 'Bruno' } });
		const sa = sienne.semainesAvec.flatMap((s: { tranches: { etat: string }[] }) => s.tranches).find((t: { etat: string }) => t.etat === 'libre');
		const verifier = await charger(demander, locaux(jeu.base, jeu.alice), `/remplacements/demander?mode=echange&p=${p}&avec=${bruno.id}&ps=${encodeURIComponent(`${sa.debut}|${sa.fin}`)}&etape=verifier`);
		expect(verifier).toMatchObject({ etape: 'verifier', choisiesAvec: [{ debut: sa.debut, fin: sa.fin }] });
		await expect(
			envoyer(actionsDemander, 'default', locaux(jeu.base, jeu.alice), [['mode', 'echange'], ['periode', `${nuit.debut}|${nuit.fin}`], ['avec', String(bruno.id)], ['periodeCible', `${sa.debut}|${sa.fin}`]])
		).rejects.toMatchObject({ status: 303 });
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
		expect(await charger(manoeuvre, locaux(jeu.base, jeu.alice), '/remplacements/manoeuvre')).toMatchObject({ miennes: [], collegues: [], mienne: null });
	});

	it('super administrateur : pas de demande, page sans liste', async () => {
		const jeu = await preparer();
		expect(await charger(load, locaux(jeu.base, { type: 'super', email: 'a@b.fr' }))).toEqual({ personne: false });
	});
});
