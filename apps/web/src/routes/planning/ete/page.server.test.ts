import { describe, expect, it } from 'vitest';
import { ete, plageEte, reglerRoulement } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { actions, load } from './+page.server';
import { charger, envoyer, locaux, preparer } from '../de-test.ts';

// L'été de l'an prochain, roulement réglé.
async function jeu() {
	const j = await preparer();
	await reglerRoulement(j.base, j.chef, j.annee + 1, j.ids, maintenantParis());
	return { ...j, q: `?annee=${j.annee + 1}` };
}
const envoyerEte = (nom: string, locals: unknown, corps: [string, string][], q: string) => envoyer(actions, nom, locals, corps, q);

describe('/planning/ete', () => {
	it('réservé à qui gère le planning', async () => {
		const { base, alice, q } = await jeu();
		await expect(charger(load, locaux(base, alice), q)).rejects.toMatchObject({ status: 403 });
		expect(await envoyerEte('proposer', locaux(base, alice), [], q)).toMatchObject({ status: 403 });
	});

	it('ouvrir, proposer, ouvrir une plage, ajuster, publier', async () => {
		const { base, chef, alice, annee, q } = await jeu();
		const l = locaux(base, chef);
		const a = annee + 1;
		const avant = (await charger(load, l, q)).ete;
		expect(avant).toMatchObject({ ete: null, proposee: false, defaut: { dateLimite: `${a}-05-15` } });
		expect(await envoyerEte('proposer', l, [], q)).toMatchObject({ status: 400, data: { message: 'Ouvrez d’abord l’été (période et date limite).' } });
		expect(await envoyerEte('regler', l, [['debut', `${a}-06-24`], ['fin', avant.defaut.fin], ['dateLimite', `${a}-05-15`]], q)).toMatchObject({ status: 400, data: { message: 'Le début et la fin de l’été sont des jours de relève.' } });
		expect(await envoyerEte('regler', l, [['debut', avant.defaut.debut], ['fin', avant.defaut.fin], ['dateLimite', `${a}-05-15`]], q)).toMatchObject({ succes: expect.stringContaining('vacances') });
		expect(await base.select().from(ete)).toHaveLength(1);
		expect(await envoyerEte('relancer', l, [], q)).toMatchObject({ cible: 'relancer', succes: expect.stringMatching(/^Rappel envoyé/) });
		expect(await envoyerEte('relancer', l, [], q)).toMatchObject({ status: 400, data: { message: 'Les agents sans réponse ont déjà été relancés aujourd’hui.' } });
		expect(await charger(load, l, `${q}&etape=vacances&panneau=periode`)).toMatchObject({ etape: 'vacances', panneau: 'periode' });
		expect(await charger(load, l, `${q}&panneau=autre`)).toMatchObject({ etape: 'vacances', panneau: null });
		// Personne n'a d'aptitude : le FPT n'est armé nulle part.
		expect(await envoyerEte('proposer', l, [], q)).toMatchObject({ cible: 'repartition', succes: expect.stringMatching(/plages restent impossibles/) });
		const [premiere] = await base.select().from(plageEte).orderBy(plageEte.debut);
		const ouverte = (await charger(load, l, `${q}&plage=${premiere!.debut}`)).ete;
		expect(ouverte.detail).toMatchObject({ debut: premiere!.debut, arme: false });
		expect(await envoyerEte('ajuster', l, [['debut', premiere!.debut], ['personne', String(alice.id)], ['present', 'oui']], q)).toEqual({ cible: 'plage', succes: 'Agent ajouté.' });
		expect(await envoyerEte('publier', l, [], q)).toMatchObject({ cible: 'publier', succes: expect.any(String) });
		expect((await base.select().from(ete))[0]!.publieeLe).not.toBeNull();
		expect(await envoyerEte('proposer', l, [], q)).toMatchObject({ status: 400, data: { message: 'L’été est déjà publié : ajustez plutôt plage par plage.' } });
	});
});
