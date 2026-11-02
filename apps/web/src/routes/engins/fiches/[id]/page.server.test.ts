import { describe, expect, it } from 'vitest';
import { lireFiche } from '@gyro-caserne/socle';
import { actions, load } from './+page.server';
import { locaux, preparer } from '../../de-test.ts';
import { requeteFormulaire } from '../../../echanges/de-test.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, id: number, recherche = '') => (load as any)({ locals, params: { id: String(id) }, url: new URL(`http://x/engins/fiches/${id}${recherche}`) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geste = async (locals: unknown, id: number, corps: [string, string][]) => (actions.geste as any)({ locals, params: { id: String(id) }, request: await requeteFormulaire(corps) });

describe('/engins/fiches/[id]', () => {
	it('réservé à qui gère ; 404 pour un type inconnu ; la zone à confirmer', async () => {
		const { base, alice, chef, types } = await preparer();
		await expect(charger(locaux(base, alice), types.VTU)).rejects.toMatchObject({ status: 403 });
		await expect(charger(locaux(base, chef), 999)).rejects.toMatchObject({ status: 404 });
		expect(await charger(locaux(base, chef), types.VTU, '?retirer-zone=10')).toMatchObject({ retirerZone: 10, nouveau: false, fiche: { type: 'VTU' } });
		await expect(geste(locaux(base, alice), types.VTU, [['quoi', 'ajouter_zone'], ['nom', 'Toit']])).rejects.toMatchObject({ status: 403 });
	});

	it('chaque geste du formulaire arrive au socle ; la zone touchée reste ouverte', async () => {
		const { base, chef, types } = await preparer();
		const fiche = await lireFiche(base, types.VTU);
		const [cabine, epuisement] = fiche.zones;
		const radio = cabine!.elements[1]!;
		expect(await geste(locaux(base, chef), types.VTU, [['quoi', 'ajouter_element'], ['zone', String(cabine!.ref)], ['libelle', 'Extincteur'], ['quantite', '2'], ['cible', 'ajout:1']])).toEqual({ cible: 'ajout:1', zone: cabine!.ref, succes: 'Élément ajouté.' });
		await geste(locaux(base, chef), types.VTU, [['quoi', 'monter_element'], ['element', String(radio.ref)], ['zone', String(cabine!.ref)]]);
		await geste(locaux(base, chef), types.VTU, [['quoi', 'modifier_element'], ['element', String(radio.ref)], ['zone', String(epuisement!.ref)], ['libelle', 'Radio portative'], ['quantite', '']]);
		await geste(locaux(base, chef), types.VTU, [['quoi', 'descendre_zone'], ['zone', String(cabine!.ref)]]);
		expect(await geste(locaux(base, chef), types.VTU, [['quoi', 'ajouter_zone'], ['nom', 'Toit']])).toMatchObject({ zone: 'derniere' });
		const apres = await lireFiche(base, types.VTU);
		expect(apres.zones.map((z) => z.nom)).toEqual(['Épuisement', 'Cabine', 'Coffres', 'Toit']);
		expect(apres.zones[0]!.elements.at(-1)).toEqual({ ref: radio.ref, libelle: 'Radio portative', quantite: null });
		expect(apres.zones[1]!.elements.map((e) => e.libelle)).toEqual(['Niveau de carburant (au moins 3/4)', 'Gyrophares et deux-tons', 'Gilets haute visibilité', 'Extincteur']);
		await geste(locaux(base, chef), types.VTU, [['quoi', 'retirer_zone'], ['zone', String(cabine!.ref)]]);
		expect((await lireFiche(base, types.VTU)).zones.map((z) => z.nom)).toEqual(['Épuisement', 'Coffres', 'Toit']);
	});

	it('un refus est dit à côté du bon formulaire, avec la saisie', async () => {
		const { base, chef, types } = await preparer();
		const reponse = await geste(locaux(base, chef), types.VTU, [['quoi', 'ajouter_element'], ['zone', '999'], ['libelle', 'X'], ['quantite', 'deux'], ['cible', 'ajout:999']]);
		expect(reponse).toMatchObject({ status: 400, data: { cible: 'ajout:999', message: 'Cette zone n’existe plus : la page a été rechargée.' } });
		const quantite = await geste(locaux(base, chef), types.VTU, [['quoi', 'ajouter_element'], ['zone', String((await lireFiche(base, types.VTU)).zones[0]!.ref)], ['libelle', 'X'], ['quantite', 'deux'], ['cible', 'a']]);
		expect(quantite).toMatchObject({ status: 400, data: { message: expect.stringContaining('nombre entier de 1 à 999'), valeurs: { libelle: 'X', quantite: 'deux' } } });
		expect(await geste(locaux(base, chef), types.VTU, [['quoi', 'n_importe_quoi']])).toMatchObject({ status: 400 });
	});
});
