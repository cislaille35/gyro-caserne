import { describe, expect, it } from 'vitest';
import { periodeParDefaut, reglerEte, vacancesAgent } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { charger, envoyer, locaux, preparer } from '../../planning/de-test.ts';
import { actions, load } from './+page.server';

describe('/moi/vacances', () => {
	it('été pas encore ouvert : rien à saisir ; le super administrateur n’a pas de fiche', async () => {
		const { base, alice } = await preparer();
		expect(await charger(load, locaux(base, alice))).toEqual({ vacances: { ete: null, reponse: null, periodes: [] } });
		expect(await charger(load, locaux(base, { type: 'super', email: 'a@b.fr' }))).toEqual({ vacances: null });
	});

	it('ajoute, refuse clairement, retire, puis disponible tout l’été', async () => {
		const { base, alice, chef, annee, reglage } = await preparer();
		const prochain = Number(maintenantParis().slice(5, 7)) >= 9 ? annee + 1 : annee;
		await reglerEte(base, chef, prochain, periodeParDefaut(prochain, reglage), maintenantParis(), reglage);
		const l = locaux(base, alice);
		const a = String(prochain);
		expect(await envoyer(actions, 'ajouter', l, [['annee', a], ['debut', `${a}-07-10`], ['fin', `${a}-07-20`]])).toEqual({ succes: 'Période ajoutée.' });
		expect(await envoyer(actions, 'ajouter', l, [['annee', a], ['debut', `${a}-07-20`], ['fin', `${a}-07-10`]])).toMatchObject({ status: 400, data: { message: 'La fin est avant le début.' } });
		expect(await envoyer(actions, 'ajouter', l, [['annee', a], ['debut', ''], ['fin', `${a}-07-10`]])).toMatchObject({ status: 400, data: { message: 'Indiquez les deux dates.' } });
		const [p] = await base.select().from(vacancesAgent);
		expect(await envoyer(actions, 'retirer', l, [['id', String(p!.id)]])).toEqual({ succes: 'Période retirée.' });
		expect(await envoyer(actions, 'toutLete', l, [['annee', a]])).toEqual({ succes: 'C’est noté : disponible tout l’été.' });
		expect((await charger(load, l)).vacances).toMatchObject({ ete: { annee: prochain }, reponse: { toutEte: true }, periodes: [] });
	});
});
