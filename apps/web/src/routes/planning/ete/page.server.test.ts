import { describe, expect, it } from 'vitest';
import { ete, plageEte, reglerRoulement } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { load as chargerEte } from './+layout.server';
import { actions, load as chargerPlage } from './+page.server';
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
		await expect(charger(chargerEte, locaux(base, alice), q)).rejects.toMatchObject({ status: 403 });
		await expect(charger(chargerPlage, locaux(base, alice), `${q}&plage=2027-06-25T18:00`)).rejects.toMatchObject({ status: 403 });
		expect(await envoyerEte('proposer', locaux(base, alice), [], q)).toMatchObject({ status: 403 });
	});

	it('ouvrir, proposer, ouvrir une plage, ajuster, publier', async () => {
		const { base, chef, alice, annee, q } = await jeu();
		const l = locaux(base, chef);
		const a = annee + 1;
		const avant = (await charger(chargerEte, l, q)).ete;
		expect(avant).toMatchObject({ ete: null, proposee: false, defaut: { dateLimite: `${a}-05-15` } });
		expect(await envoyerEte('proposer', l, [], q)).toMatchObject({ status: 400, data: { message: 'Ouvrez d’abord l’été (période et date limite).' } });
		expect(await envoyerEte('regler', l, [['debut', `${a}-06-24`], ['fin', avant.defaut.fin], ['dateLimite', `${a}-05-15`]], q)).toMatchObject({ status: 400, data: { message: 'Le début et la fin de l’été sont des jours de relève.' } });
		expect(await envoyerEte('regler', l, [['debut', avant.defaut.debut], ['fin', avant.defaut.fin], ['dateLimite', `${a}-05-15`]], q)).toMatchObject({ succes: expect.stringContaining('vacances') });
		expect(await base.select().from(ete)).toHaveLength(1);
		expect(await envoyerEte('relancer', l, [], q)).toMatchObject({ cible: 'relancer', succes: expect.stringMatching(/^Rappel envoyé/) });
		expect(await envoyerEte('relancer', l, [], q)).toMatchObject({ status: 400, data: { message: 'Les agents sans réponse ont déjà été relancés aujourd’hui.' } });
		expect(await charger(chargerEte, l, `${q}&etape=vacances`)).toMatchObject({ etape: 'vacances' });
		expect(await charger(chargerPlage, l, `${q}&panneau=periode`)).toEqual({ panneau: 'periode', detail: null });
		expect(await charger(chargerPlage, l, `${q}&panneau=autre`)).toEqual({ panneau: null, detail: null });
		// Personne n'a d'aptitude : le FPT n'est armé nulle part.
		expect(await envoyerEte('proposer', l, [], q)).toMatchObject({ cible: 'repartition', succes: expect.stringMatching(/plages restent impossibles/) });
		const [premiere] = await base.select().from(plageEte).orderBy(plageEte.debut);
		// Ouvrir une plage ne recalcule que son panneau : le reste de l'été (la mise en page) n'en dépend pas.
		const { detail } = await charger(chargerPlage, l, `${q}&plage=${premiere!.debut}`);
		expect(detail).toMatchObject({ debut: premiere!.debut, arme: false });
		// SvelteKit ne relance la mise en page que si l'adresse qu'elle lit change : elle ne lit ni la plage ni le panneau.
		const url = new URL(`http://x/planning${q}&plage=${premiere!.debut}&panneau=periode`);
		const lus: string[] = [];
		const lire = url.searchParams.get.bind(url.searchParams);
		url.searchParams.get = (cle: string) => (lus.push(cle), lire(cle));
		for (const tout of ['search', 'href'] as const) Object.defineProperty(url, tout, { get: () => expect.fail(`url.${tout} lu`) });
		await (chargerEte as (e: unknown) => Promise<unknown>)({ locals: l, url });
		expect([...new Set(lus)].sort()).toEqual(['annee', 'etape']);
		expect(await envoyerEte('ajuster', l, [['debut', premiere!.debut], ['personne', String(alice.id)], ['present', 'oui']], q)).toEqual({ cible: 'plage', succes: 'Agent ajouté.' });
		expect(await envoyerEte('publier', l, [], q)).toMatchObject({ cible: 'publier', succes: expect.any(String) });
		expect((await base.select().from(ete))[0]!.publieeLe).not.toBeNull();
		expect(await envoyerEte('proposer', l, [], q)).toMatchObject({ status: 400, data: { message: 'L’été est déjà publié : ajustez plutôt plage par plage.' } });
	});
});
