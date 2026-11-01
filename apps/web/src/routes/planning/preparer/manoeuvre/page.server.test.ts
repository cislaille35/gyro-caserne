import { describe, expect, it } from 'vitest';
import { enregistrerManoeuvre, publierAnnee, reglerRoulement, manoeuvre, notification, planningDuMatin, publication } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { actions, load } from './+page.server';
import { charger, envoyer, locaux, preparer } from '../../de-test.ts';
import { heureDAnnoncer } from '#lib/server/planning.ts';

describe('/planning/preparer/manoeuvre', () => {
	it('des actions nommées seulement (SvelteKit refuse « default » à côté d’autres)', () => {
		expect(Object.keys(actions).sort()).toEqual(['enregistrer', 'supprimer']);
	});

	it('réservé à qui gère le planning (403)', async () => {
		const { base, alice } = await preparer();
		await expect(charger(load, locaux(base, alice))).rejects.toMatchObject({ status: 403 });
	});

	it('ajoute une manœuvre pour deux équipes, puis la modifie pour tout le centre', async () => {
		const { base, chef, ids, annee } = await preparer();
		const l = locaux(base, chef);
		const champs: [string, string][] = [['date', `${annee + 1}-03-07`], ['heure', '08:30'], ['theme', 'Feux de forêt'], ['lieu', 'Caserne'], ['pour', 'equipes'], ['equipes', String(ids[0])], ['equipes', String(ids[1])], ['petitDejeuner', 'oui']];
		await expect(envoyer(actions, 'enregistrer', l, champs)).rejects.toMatchObject({ status: 303, location: `/planning/preparer?annee=${annee + 1}#manoeuvres` });
		const [m] = await base.select().from(manoeuvre);
		expect(m).toMatchObject({ debut: `${annee + 1}-03-07T08:30`, convoques: JSON.stringify([ids[0], ids[1]]), petitDejeuner: 1 });
		const data = await charger(load, l, `?id=${m!.id}`);
		expect(data.manoeuvre).toMatchObject({ id: m!.id, theme: 'Feux de forêt' });
		await expect(envoyer(actions, 'enregistrer', l, [['id', String(m!.id)], ['date', `${annee + 1}-03-07`], ['heure', '09:00'], ['theme', 'Feux de forêt'], ['lieu', 'Bois'], ['pour', 'tous']])).rejects.toMatchObject({ status: 303 });
		expect((await base.select().from(manoeuvre))[0]).toMatchObject({ debut: `${annee + 1}-03-07T09:00`, lieu: 'Bois', convoques: '"tous"', petitDejeuner: 0 });
	});

	it('garde la saisie et dit l’erreur ; supprimer une manœuvre non annoncée', async () => {
		const { base, chef, annee } = await preparer();
		const l = locaux(base, chef);
		const r = await envoyer(actions, 'enregistrer', l, [['date', `${annee + 1}-03-07`], ['heure', '08:30'], ['theme', ''], ['lieu', 'Caserne'], ['pour', 'tous']]);
		expect(r).toMatchObject({ status: 400, data: { message: expect.any(String), valeurs: { lieu: 'Caserne' } } });
		expect(await envoyer(actions, 'enregistrer', l, [['date', `${annee + 1}-03-07`], ['heure', '08:30'], ['theme', 'X'], ['lieu', 'Caserne'], ['pour', 'equipes']])).toMatchObject({ status: 400 });
		await expect(envoyer(actions, 'enregistrer', l, [['date', `${annee + 1}-03-07`], ['heure', '08:30'], ['theme', 'X'], ['lieu', 'Caserne'], ['pour', 'tous']])).rejects.toMatchObject({ status: 303 });
		const [m] = await base.select().from(manoeuvre);
		await expect(envoyer(actions, 'supprimer', l, [['id', String(m!.id)]])).rejects.toMatchObject({ status: 303 });
		expect(await base.select().from(manoeuvre)).toHaveLength(0);
	});

	it('déjà annoncée : la modifier ou l’annuler prévient les convoqués, en arrière-plan', async () => {
		const { base, chef, alice, ids, annee } = await preparer();
		// Fin décembre, la manœuvre tombe l'an prochain : publié aussi.
		await reglerRoulement(base, chef, annee + 1, ids, maintenantParis());
		await publierAnnee(base, chef, annee + 1, maintenantParis());
		const debut = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
		const id = await enregistrerManoeuvre(base, chef, { debut: `${debut}T08:30`, theme: 'Sport', lieu: 'Caserne', convoques: [ids[0]!], petitDejeuner: false }, maintenantParis());
		expect((await planningDuMatin(base, maintenantParis())).publiees).toBe(1);
		await base.delete(notification);
		const taches: Promise<unknown>[] = [];
		const l = { ...locaux(base, chef), enArrierePlan: (t: Promise<unknown>) => taches.push(t) };
		await expect(envoyer(actions, 'enregistrer', l, [['id', String(id)], ['date', debut], ['heure', '09:00'], ['theme', 'Sport'], ['lieu', 'Stade'], ['pour', 'equipes'], ['equipes', String(ids[0])]])).rejects.toMatchObject({ status: 303 });
		await Promise.all(taches.splice(0));
		expect((await base.select().from(notification)).map((n) => n.personneId)).toEqual([alice.id]);
		expect((await base.select().from(publication))[0]!.lieu).toBe('Stade');
		await expect(envoyer(actions, 'supprimer', l, [['id', String(id)]])).rejects.toMatchObject({ status: 303 });
		await Promise.all(taches.splice(0));
		expect(await base.select().from(notification)).toHaveLength(2);
		expect((await base.select().from(publication))[0]!.annuleeLe).not.toBeNull();
	});

	it('à moins de deux semaines, annoncée tout de suite (de 8 h à 21 h), sans attendre le matin', async () => {
		const { base, chef, ids, annee } = await preparer();
		await reglerRoulement(base, chef, annee + 1, ids, maintenantParis());
		await publierAnnee(base, chef, annee + 1, maintenantParis());
		const taches: Promise<unknown>[] = [];
		const l = { ...locaux(base, chef), enArrierePlan: (t: Promise<unknown>) => taches.push(t) };
		const debut = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
		await expect(envoyer(actions, 'enregistrer', l, [['date', debut], ['heure', '09:00'], ['theme', 'Sport'], ['lieu', 'Stade'], ['pour', 'tous']])).rejects.toMatchObject({ status: 303 });
		await Promise.all(taches.splice(0));
		expect(await base.select().from(publication)).toHaveLength(heureDAnnoncer(maintenantParis()) ? 1 : 0);
	});

	it('heures d’annonce immédiate : de 8 h à 21 h', () => {
		expect(heureDAnnoncer('2026-11-15T07:59')).toBe(false);
		expect(heureDAnnoncer('2026-11-15T08:00')).toBe(true);
		expect(heureDAnnoncer('2026-11-15T20:59')).toBe(true);
		expect(heureDAnnoncer('2026-11-15T21:00')).toBe(false);
	});
});

