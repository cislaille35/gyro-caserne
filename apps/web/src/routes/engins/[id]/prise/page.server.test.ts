import { describe, expect, it } from 'vitest';
import { anomalie, lireFiche, priseGarde } from '@gyro-caserne/socle';
import { jpeg, requeteFormulaire } from '../../../echanges/de-test.ts';
import { locaux, preparer } from '../../de-test.ts';
import { actions, load } from './+page.server';
import { load as chargerFaite } from '../prises/[prise]/+page.server';
import { GET as photo } from '../../photo/[id]/+server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, id: number) => (load as any)({ locals, params: { id: String(id) } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const agir = async (nom: string, locals: unknown, id: number, corps: [string, string | File][]) => (actions as any)[nom]({ locals, params: { id: String(id) }, request: await requeteFormulaire(corps) });

describe('/engins/[id]/prise', () => {
	it('commencer, signaler un écart avec photo, voir chaque zone, valider : l’écart devient une anomalie', async () => {
		const { base, alice, chef, vsav, types } = await preparer();
		const moi = locaux(base, alice);
		expect((await charger(moi, vsav)).prise).toBeNull();
		expect(await agir('commencer', moi, vsav, [])).toMatchObject({ succes: 'Prise commencée.' });
		const page = await charger(locaux(base, chef), vsav);
		const id = String(page.prise.id);
		const fiche = await lireFiche(base, types.VSAV);
		const gilets = fiche.zones[0]!.elements.find((e) => e.quantite !== null)!;
		const ecart = await agir('geste', moi, vsav, [['prise', id], ['quoi', 'ecart'], ['element', String(gilets.ref)], ['zone', String(fiche.zones[0]!.ref)], ['genre', 'manquant'], ['manque', '1'], ['note', 'Sous le siège'], ['photo', jpeg()]]);
		expect(ecart).toMatchObject({ succes: 'Écart enregistré.', zone: fiche.zones[0]!.ref });
		expect(await agir('valider', moi, vsav, [['prise', id]])).toMatchObject({ status: 400, data: { message: expect.stringMatching(/zones à voir/) } });
		// Une zone vue : la page ouvre la suivante à voir (aucune zone gardée).
		for (const z of fiche.zones) expect(await agir('geste', moi, vsav, [['prise', id], ['quoi', 'zone'], ['zone', String(z.ref)], ['vue', '1']])).toMatchObject({ zone: null, succes: 'Zone enregistrée.' });
		await expect(agir('valider', moi, vsav, [['prise', id]])).rejects.toMatchObject({ status: 303, location: `/engins/${vsav}/prise?validee` });
		const [a] = await base.select().from(anomalie);
		expect(a).toMatchObject({ ref: gilets.ref, manque: 1, note: 'Sous le siège' });
		// La photo, servie à qui voit les engins.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const reponse: Response = await (photo as any)({ locals: moi, params: { id: String(a!.photoId) } });
		expect(reponse.headers.get('content-type')).toBe('image/jpeg');
		// La prise faite, lisible.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const faite = await (chargerFaite as any)({ locals: moi, params: { id: String(vsav), prise: id } });
		expect(faite.prise.signalees).toHaveLength(1);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((chargerFaite as any)({ locals: moi, params: { id: '999', prise: id } })).rejects.toMatchObject({ status: 404 });
	});

	it('sans le droit : refus dit sur la page ; abandonner efface le brouillon', async () => {
		const { base, alice, sans, vsav } = await preparer();
		await expect(agir('commencer', locaux(base, sans), vsav, [])).rejects.toMatchObject({ status: 403 });
		await agir('commencer', locaux(base, alice), vsav, []);
		const [p] = await base.select().from(priseGarde);
		await expect(agir('abandonner', locaux(base, alice), vsav, [['prise', String(p!.id)]])).rejects.toMatchObject({ status: 303, location: `/engins/${vsav}/prise` });
		expect(await base.select().from(priseGarde)).toHaveLength(0);
	});

	it('un geste inconnu ou une photo trop lourde : refusés avec un message', async () => {
		const { base, alice, vsav } = await preparer();
		await agir('commencer', locaux(base, alice), vsav, []);
		const [p] = await base.select().from(priseGarde);
		expect(await agir('geste', locaux(base, alice), vsav, [['prise', String(p!.id)], ['quoi', 'nimporte']])).toMatchObject({ status: 400 });
		expect(await agir('geste', locaux(base, alice), vsav, [['prise', String(p!.id)], ['quoi', 'ecart'], ['photo', jpeg(300 * 1024)]])).toMatchObject({ status: 400, data: { message: 'Photo trop lourde : 200 Ko au plus.' } });
	});
});
