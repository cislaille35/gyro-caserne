import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { anneePlanning, gardeFete, semaineChangee, vacancesScolaires } from '@gyro-caserne/socle';
import { actions, load } from './+page.server';
import { charger, envoyer, locaux, preparer } from '../de-test.ts';

describe('/planning/preparer', () => {
	it('réservé à qui gère le planning (403)', async () => {
		const { base, alice } = await preparer({ publiee: false });
		await expect(charger(load, locaux(base, alice))).rejects.toMatchObject({ status: 403 });
		expect(await envoyer(actions, 'roulement', locaux(base, alice), [['ordre', '1'], ['ordre', '2']])).toMatchObject({ status: 403 });
	});

	it('charge l’année demandée, la suivante proposée', async () => {
		const { base, chef, annee } = await preparer({ publiee: false });
		const data = await charger(load, locaux(base, chef), `?annee=${annee}`);
		expect(data.preparation).toMatchObject({ annee, publiee: null });
		expect(data.preparation.semaines.length).toBeGreaterThanOrEqual(52);
		expect(data.annees).toEqual([annee, annee + 1]);
	});

	it('règle le roulement, change une semaine, publie', async () => {
		const { base, chef, annee, ids } = await preparer({ publiee: false });
		const l = locaux(base, chef);
		const q = `?annee=${annee + 1}`;
		const ordre = [ids[3]!, ids[2]!, ids[1]!, ids[0]!].map((id): [string, string] => ['ordre', String(id)]);
		expect(await envoyer(actions, 'roulement', l, ordre, q)).toMatchObject({ cible: 'roulement', succes: expect.any(String) });
		const prep = (await charger(load, l, q)).preparation;
		const premiere = prep.semaines[0].debut;
		expect(await envoyer(actions, 'semaines', l, [[`semaine-${premiere}`, String(ids[0])]], q)).toMatchObject({ cible: 'semaines', succes: expect.any(String) });
		expect(await base.select().from(semaineChangee)).toEqual([{ debut: premiere, equipeId: ids[0] }]);
		expect(await envoyer(actions, 'publier', l, [], q)).toMatchObject({ cible: 'publier', succes: expect.any(String) });
		expect((await base.select().from(anneePlanning).where(eq(anneePlanning.annee, annee + 1)))[0]!.publieeLe).not.toBeNull();
	});

	it('l’étape et les panneaux viennent de l’adresse ; l’aperçu suit l’ordre proposé', async () => {
		const { base, chef, annee } = await preparer({ publiee: false });
		const l = locaux(base, chef);
		const q = `?annee=${annee + 1}`;
		const data = await charger(load, l, q);
		expect(data).toMatchObject({ etape: 'roulement', manoeuvre: null, semaine: null, proposer: null });
		expect(data.apercu).toHaveLength(6);
		expect(data.apercu.map((s: { equipeId: number }) => s.equipeId)).toEqual([...data.preparation.ordrePropose, ...data.preparation.ordrePropose].slice(0, 6));
		expect(await charger(load, l, `${q}&etape=fetes&proposer=noel`)).toMatchObject({ etape: 'fetes', proposer: 'noel' });
		expect(await charger(load, l, `${q}&etape=manoeuvres&manoeuvre=nouvelle`)).toMatchObject({ manoeuvre: 'nouvelle' });
		expect(await charger(load, l, `${q}&etape=manoeuvres&manoeuvre=12`)).toMatchObject({ manoeuvre: 12 });
	});

	it('monter une équipe enregistre le roulement', async () => {
		const { base, chef, annee, ids } = await preparer({ publiee: false });
		const q = `?annee=${annee + 1}`;
		const ordre = ids.map((id): [string, string] => ['ordre', String(id)]);
		expect(await envoyer(actions, 'deplacer', locaux(base, chef), [...ordre, ['deplacer', '1:monter']], q)).toMatchObject({ cible: 'roulement', succes: expect.any(String) });
		expect((await charger(load, locaux(base, chef), q)).preparation.ordre).toEqual([ids[1], ids[0], ids[2], ids[3]]);
		expect(await envoyer(actions, 'deplacer', locaux(base, chef), [...ordre, ['deplacer', '3:descendre']], q)).toMatchObject({ succes: expect.any(String) });
	});

	it('année publiée : déplacer une équipe est refusé ; accepter l’échange change deux semaines', async () => {
		const { base, chef, annee, ids } = await preparer();
		const l = locaux(base, chef);
		const q = `?annee=${annee}`;
		const ordre = ids.map((id): [string, string] => ['ordre', String(id)]);
		expect(await envoyer(actions, 'deplacer', l, [...ordre, ['deplacer', '1:monter']], q)).toMatchObject({ status: 400, data: { cible: 'roulement' } });
		// Les deux dernières semaines de l'année : à venir.
		const [a, b] = (await charger(load, l, q)).preparation.semaines.slice(-2);
		expect(await envoyer(actions, 'semaines', l, [[`semaine-${a.debut}`, String(b.equipeId)], [`semaine-${b.debut}`, String(a.equipeId)]], q)).toMatchObject({ succes: expect.any(String) });
		const [a2, b2] = (await charger(load, l, q)).preparation.semaines.slice(-2);
		expect((await charger(load, l, `${q}&etape=publier&semaine=${a.debut}`)).semaineTouche).toEqual({ commencee: false, remplacements: [] });
		const premiere = (await charger(load, l, q)).preparation.semaines[0];
		expect((await charger(load, l, `${q}&etape=publier&semaine=${premiere.debut}`)).semaineTouche).toMatchObject({ commencee: true });
		expect(await envoyer(actions, 'semaines', l, [[`semaine-${premiere.debut}`, String(ids.find((id) => id !== premiere.equipeId))]], q)).toMatchObject({ status: 400, data: { message: expect.stringMatching(/commencée : son équipe ne change plus/) } });
		expect([a2.equipeId, b2.equipeId]).toEqual([b.equipeId, a.equipeId]);
	});

	it('refuse un roulement avec une équipe en double, sur le bon formulaire', async () => {
		const { base, chef, ids } = await preparer({ publiee: false });
		expect(await envoyer(actions, 'roulement', locaux(base, chef), [['ordre', String(ids[0])], ['ordre', String(ids[0])]])).toMatchObject({ status: 400, data: { cible: 'roulement', message: expect.stringContaining('une fois') } });
	});

	it('historique des fêtes, vacances : ajout et retrait', async () => {
		const { base, chef, ids, annee } = await preparer();
		const l = locaux(base, chef);
		expect(await envoyer(actions, 'fete', l, [['annee', String(annee - 1)], ['fete', 'noel'], ['equipe', String(ids[1])]])).toMatchObject({ cible: 'fetes' });
		expect(await base.select().from(gardeFete)).toHaveLength(1);
		await envoyer(actions, 'fete', l, [['annee', String(annee - 1)], ['fete', 'noel'], ['equipe', '']]);
		expect(await base.select().from(gardeFete)).toHaveLength(0);
		expect(await envoyer(actions, 'vacances', l, [['nom', 'Hiver'], ['debut', `${annee}-02-14`], ['fin', `${annee}-03-02`]])).toMatchObject({ cible: 'vacances', succes: expect.any(String) });
		const [v] = await base.select().from(vacancesScolaires);
		expect(await envoyer(actions, 'vacances', l, [['nom', 'Hiver'], ['debut', `${annee}-03-14`], ['fin', `${annee}-03-02`]])).toMatchObject({ status: 400, data: { cible: 'vacances' } });
		await envoyer(actions, 'retirerVacances', l, [['id', String(v!.id)]]);
		expect(await base.select().from(vacancesScolaires)).toHaveLength(0);
	});

	it('la proposition : par l’adresse seulement, rien d’écrit ; réservée, sans objet une fois l’année préparée', async () => {
		const { base, chef, alice, annee } = await preparer();
		const l = locaux(base, chef);
		expect((await charger(load, l, `?annee=${annee + 1}`)).proposition).toBeNull();
		const data = await charger(load, l, `?annee=${annee + 1}&proposition=1`);
		expect(data.proposition).toMatchObject({ annee: annee + 1, precedente: true });
		expect((await base.select().from(anneePlanning).where(eq(anneePlanning.annee, annee + 1)))).toEqual([]);
		expect((await charger(load, l, `?annee=${annee}&proposition=1`)).proposition).toBeNull();
		await expect(charger(load, locaux(base, alice), `?annee=${annee + 1}&proposition=1`)).rejects.toMatchObject({ status: 403 });
	});

	it('accepter écrit le brouillon ; une seconde fois, refus sur le bon formulaire ; réservé', async () => {
		const { base, chef, alice, annee } = await preparer();
		const q = `?annee=${annee + 1}`;
		expect(await envoyer(actions, 'proposition', locaux(base, alice), [], q)).toMatchObject({ status: 403 });
		expect(await envoyer(actions, 'proposition', locaux(base, chef), [], q)).toMatchObject({ cible: 'proposition', succes: expect.any(String) });
		const prep = (await charger(load, locaux(base, chef), q)).preparation;
		expect(prep.ordre.length).toBeGreaterThan(0);
		expect(prep.publiee).toBeNull();
		expect(await envoyer(actions, 'proposition', locaux(base, chef), [], q)).toMatchObject({ status: 400, data: { cible: 'proposition', message: expect.stringMatching(/déjà un roulement/) } });
	});
});
