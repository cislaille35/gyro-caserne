import { describe, expect, it } from 'vitest';
import { anomalie, engin } from '@gyro-caserne/socle';
import { eq } from 'drizzle-orm';
import { jpeg, requeteFormulaire } from '../../echanges/de-test.ts';
import { locaux, preparer } from '../de-test.ts';
import { load as liste } from './+page.server';
import { actions as actionsSignaler, load as pageSignaler } from './signaler/+page.server';
import { actions as actionsAnomalie, load as pageAnomalie } from './[id]/+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const signaler = async (locals: unknown, corps: [string, string | File][]) => (actionsSignaler as any).default({ locals, request: await requeteFormulaire(corps) });
const ouvrir = (locals: unknown, id: number) => (pageAnomalie as any)({ locals, params: { id: String(id) }, url: new URL('http://x/') });
const agir = async (locals: unknown, id: number, corps: [string, string][]) => (actionsAnomalie as any).default({ locals, params: { id: String(id) }, request: await requeteFormulaire(corps) });
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('/engins/anomalies', () => {
	it('signaler en deux gestes (engin choisi d’avance), avec photo ; la liste la montre ; l’engin reste disponible', async () => {
		const { base, alice, vsav } = await preparer();
		const moi = locaux(base, alice);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const page = await (pageSignaler as any)({ locals: moi, url: new URL(`http://x/engins/anomalies/signaler?engin=${vsav}`) });
		expect(page).toMatchObject({ enginId: vsav, peutSignaler: true });
		expect(page.engins.map((e: { nom: string }) => e.nom)).toEqual(['VSAV 1', 'VSAV 23']);
		await expect(signaler(moi, [['engin', String(vsav)], ['libelle', 'Brancard grippé'], ['genre', 'abime'], ['note', ''], ['photo', jpeg()]])).rejects.toMatchObject({ status: 303, location: expect.stringMatching(/^\/engins\/anomalies\/\d+\?signalee$/) });
		const [a] = await base.select().from(anomalie);
		expect(a).toMatchObject({ libelle: 'Brancard grippé', etape: 'signalee' });
		expect(a!.photoId).not.toBeNull();
		expect((await base.select({ etat: engin.etat }).from(engin).where(eq(engin.id, vsav)))[0]!.etat).toBe('disponible');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const l = await (liste as any)({ locals: moi, url: new URL(`http://x/engins/anomalies?engin=${vsav}`) });
		expect(l).toMatchObject({ enginId: vsav, ouvertes: [{ id: a!.id, engin: 'VSAV 1' }] });
	});

	it('refus dits sur la page : problème vide, sans le droit', async () => {
		const { base, alice, sans, vsav } = await preparer();
		expect(await signaler(locaux(base, alice), [['engin', String(vsav)], ['libelle', ' '], ['genre', 'abime']])).toMatchObject({ status: 400, data: { message: 'Dites en quelques mots quel est le problème.', libelle: ' ' } });
		await expect(signaler(locaux(base, sans), [['engin', String(vsav)], ['libelle', 'x'], ['genre', 'abime']])).rejects.toMatchObject({ status: 403 });
	});

	it('le suivi : l’agent la prend en charge et la répare ; seul le chef rend l’engin indisponible, puis le remet en service', async () => {
		const { base, alice, chef, vsav } = await preparer();
		await signaler(locaux(base, alice), [['engin', String(vsav)], ['libelle', 'Gyrophare HS'], ['genre', 'abime']]).catch(() => {});
		const [a] = await base.select().from(anomalie);
		const id = a!.id;
		expect((await ouvrir(locaux(base, alice), id)).anomalie.gestes).toEqual(['prendre', 'attente', 'reparee']);
		expect(await agir(locaux(base, alice), id, [['quoi', 'indisponible']])).toMatchObject({ status: 403, data: { message: expect.stringMatching(/^Seuls le référent engins/) } });
		expect(await agir(locaux(base, chef), id, [['quoi', 'indisponible']])).toMatchObject({ succes: 'L’engin est maintenant indisponible.' });
		expect(await agir(locaux(base, alice), id, [['quoi', 'prendre']])).toMatchObject({ succes: 'Vous l’avez prise en charge.' });
		expect(await agir(locaux(base, alice), id, [['quoi', 'attente'], ['motif', 'piece'], ['texte', 'ampoule commandée']])).toMatchObject({ succes: 'Mise en attente.' });
		expect(await agir(locaux(base, alice), id, [['quoi', 'reparee'], ['texte', 'ampoule changée']])).toMatchObject({ succes: 'Réparation enregistrée.' });
		expect(await agir(locaux(base, alice), id, [['quoi', 'nimporte']])).toMatchObject({ status: 400 });
		const vue = (await ouvrir(locaux(base, chef), id)).anomalie;
		expect(vue).toMatchObject({ gestes: ['remettre'], engin: { etat: 'indisponible' } });
		expect(await agir(locaux(base, chef), id, [['quoi', 'remettre']])).toMatchObject({ succes: 'L’engin est remis en service.' });
		expect(await agir(locaux(base, chef), id, [['quoi', 'remettre']])).toMatchObject({ status: 400, data: { message: 'Ce geste n’est plus possible : la page a été rechargée.' } });
		await expect(ouvrir(locaux(base, chef), 999)).rejects.toMatchObject({ status: 404 });
	});
});
