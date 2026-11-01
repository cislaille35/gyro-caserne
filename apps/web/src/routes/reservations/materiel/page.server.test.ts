import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ressource } from '@gyro-caserne/socle';
import { requeteFormulaire } from '../../echanges/de-test.ts';
import { locaux, preparer } from '../de-test.ts';
import { actions, load } from './+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const charger = (locals: unknown, requete = '') => (load as any)({ locals, url: new URL(`http://x/reservations/materiel${requete}`) });
const agir = async (nom: 'ajouter' | 'modifier' | 'retirer', locals: unknown, champs: [string, string][]) => (actions[nom] as any)({ locals, request: await requeteFormulaire(champs) });

describe('/reservations/materiel', () => {
	it('ce que l’on gère, et les comités pour lesquels ajouter ; la confirmation de retrait demandée', async () => {
		const { base, bruno, alice, bancs, amicale } = await preparer();
		const data = await charger(locaux(base, bruno), `?retirer=${bancs}`);
		expect(data).toMatchObject({ comites: [{ id: amicale, nom: 'Amicale' }], ressources: [{ nom: 'Bancs' }], confirmer: bancs });
		expect(await charger(locaux(base, alice))).toMatchObject({ comites: [], ressources: [] });
	});

	it('ajouter, modifier, retirer', async () => {
		const { base, bruno, amicale, bancs } = await preparer();
		expect(await agir('ajouter', locaux(base, bruno), [['nom', 'Tables'], ['stock', '6'], ['icone', 'outil'], ['comite', String(amicale)]])).toEqual({ succes: 'Tables ajouté.' });
		const [tables] = await base.select().from(ressource).where(eq(ressource.nom, 'Tables'));
		expect(tables).toMatchObject({ stock: 6, icone: 'outil', gereeParComiteId: amicale });
		expect(await agir('modifier', locaux(base, bruno), [['id', String(tables!.id)], ['nom', 'Tables pliantes'], ['stock', '8'], ['icone', 'livre']])).toEqual({ succes: 'Tables pliantes enregistré.' });
		expect(await agir('retirer', locaux(base, bruno), [['id', String(bancs)]])).toEqual({ succes: 'Bancs retiré : ses réservations à venir sont annulées.' });
		expect((await charger(locaux(base, bruno))).ressources.map((r: { nom: string }) => r.nom)).toEqual(['Tables pliantes']);
	});

	it('un seul comité : il est choisi d’office ; un refus du socle est redit', async () => {
		const { base, bruno } = await preparer();
		expect(await agir('ajouter', locaux(base, bruno), [['nom', 'Barnum'], ['stock', '1'], ['icone', 'etoile']])).toEqual({ succes: 'Barnum ajouté.' });
		expect(await agir('ajouter', locaux(base, bruno), [['nom', 'barnum'], ['stock', '1'], ['icone', 'etoile']])).toMatchObject({ status: 400, data: { message: 'Nom déjà utilisé.', valeurs: { nom: 'barnum' } } });
		expect(await agir('ajouter', locaux(base, bruno), [['nom', 'Tentes'], ['stock', 'deux'], ['icone', 'etoile']])).toMatchObject({ status: 400, data: { message: 'Stock invalide.' } });
	});
});
