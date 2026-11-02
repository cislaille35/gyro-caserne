import { describe, expect, it } from 'vitest';
import centre from '$centre';
import { gesteAnomalie, REGLAGE_ANOMALIES, signalerAnomalie } from '@gyro-caserne/socle';
import { load } from './+page.server';
import { load as chargerModifier, actions } from './modifier/+page.server';
import { locaux, preparer } from '../de-test.ts';
import { requeteFormulaire } from '../../echanges/de-test.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, id: number | string) => (load as any)({ locals, params: { id: String(id) } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modifier = async (locals: unknown, id: number, corps: [string, string][]) => (actions.default as any)({ locals, params: { id: String(id) }, request: await requeteFormulaire(corps) });

describe('/engins/[id]', () => {
	it('l’engin et la fiche de son type, pour tout agent', async () => {
		const { base, alice, prete } = await preparer();
		const page = await charger(locaux(base, alice), prete);
		expect(page.engin).toMatchObject({ nom: 'VSAV 23', situation: 'prete', provenance: 'CIS Exemple-Nord' });
		expect(page.gere).toBe(false);
		expect(page.fiche.type).toBe('VSAV');
		expect(page.fiche.zones.map((z: { nom: string }) => z.nom)).toEqual(['Cabine', 'Cellule sanitaire', 'Sac de premiers secours', 'Sac d’oxygénothérapie']);
	});

	it('ses anomalies ouvertes, « Signaler un problème » pour un agent ; indisponible et anomalie close : où le remettre en service', async () => {
		const { base, alice, chef, vsav } = await preparer();
		const id = await signalerAnomalie(base, base.photos, alice, { enginId: vsav, libelle: 'Phare', genre: 'abime', note: '' }, '2026-10-30T18:10', centre.astreinte);
		const page = await charger(locaux(base, alice), vsav);
		expect(page).toMatchObject({ peutSignaler: true, aRemettre: null, ouvertes: [{ id, libelle: 'Phare', etape: 'signalee' }] });
		await gesteAnomalie(base, chef, id, { quoi: 'indisponible' }, '2026-10-30T18:10', REGLAGE_ANOMALIES);
		await gesteAnomalie(base, chef, id, { quoi: 'clore', texte: '' }, '2026-10-30T18:10', REGLAGE_ANOMALIES);
		expect(await charger(locaux(base, alice), vsav)).toMatchObject({ aRemettre: id, ouvertes: [], engin: { etat: 'indisponible' } });
	});

	it('404 pour un engin inconnu', async () => {
		const { base, alice } = await preparer();
		await expect(charger(locaux(base, alice), 999)).rejects.toMatchObject({ status: 404 });
		await expect(charger(locaux(base, alice), 'abc')).rejects.toMatchObject({ status: 404 });
	});
});

describe('/engins/[id]/modifier', () => {
	it('réservé à qui gère', async () => {
		const { base, alice, vsav } = await preparer();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((chargerModifier as any)({ locals: locaux(base, alice), params: { id: String(vsav) } })).rejects.toMatchObject({ status: 403 });
		await expect(modifier(locaux(base, alice), vsav, [['nom', 'X']])).rejects.toMatchObject({ status: 403 });
	});

	it('un identifiant mal écrit : 404 à la page, refus à l’envoi', async () => {
		const { base, chef } = await preparer();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((chargerModifier as any)({ locals: locaux(base, chef), params: { id: 'abc' } })).rejects.toMatchObject({ status: 404 });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const reponse = await (actions.default as any)({ locals: locaux(base, chef), params: { id: 'abc' }, request: await requeteFormulaire([['nom', 'X'], ['type', '1'], ['situation', 'centre']]) });
		expect(reponse).toMatchObject({ status: 400, data: { message: 'Engin inconnu.' } });
	});

	it('enregistre puis revient sur l’engin ; un refus garde la saisie et le dit', async () => {
		const { base, chef, vsav, types } = await preparer();
		await expect(modifier(locaux(base, chef), vsav, [['nom', 'VSAV 1'], ['type', String(types.VSAV)], ['immatriculation', 'ab-1'], ['situation', 'parti'], ['provenance', '']])).rejects.toMatchObject({
			status: 303,
			location: `/engins/${vsav}`
		});
		expect((await charger(locaux(base, chef), vsav)).engin).toMatchObject({ situation: 'parti', immatriculation: 'AB-1' });
		const refus = await modifier(locaux(base, chef), vsav, [['nom', 'VSAV 1'], ['type', String(types.VSAV)], ['situation', 'prete'], ['provenance', ' ']]);
		expect(refus).toMatchObject({ status: 400, data: { message: 'Indiquez le centre qui prête l’engin.', valeurs: { nom: 'VSAV 1', situation: 'prete' } } });
	});
});
