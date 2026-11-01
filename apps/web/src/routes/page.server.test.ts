import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../../centres/exemple/centre.ts';
import { attribution, chargerJeuDeDepart, equipe, grade, personne, priseConnaissance, publier, reponseEvenement, responsabilite } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { actions, load } from './+page.server';
import { aujourdhuiParis, maintenantParis, septJoursPlusTard } from '#lib/aujourdhui.ts';
import { requeteFormulaire, preparer } from './echanges/de-test.ts';

const datesSondage = (m: string) => ({ ouverture: m.slice(0, 16), cloture: septJoursPlusTard(m) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (locals: unknown, recherche = '') => (load as any)({ locals, url: new URL(`http://localhost/${recherche}`) });

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [sap] = await base.select().from(grade).limit(1);
	const [p] = await base.insert(personne).values({ email: 'alice@exemple.fr', prenom: 'Alice', nom: 'N', gradeId: sap!.id, entreeCentre: '2020-01-01' }).returning();
	const nommer = async (nom: string, perimetre: { type: 'centre' | 'equipe'; id?: number }) => {
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, nom));
		await base.insert(attribution).values({ personneId: p!.id, responsabiliteId: r!.id, perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: '2020-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2020-01-01' });
		return r!.id;
	};
	return { base, alice: { type: 'personne' as const, id: p!.id }, nommer };
}

describe('load de /', () => {
	it('renvoie vers la connexion si personne n\'est connecté', async () => {
		const base = await baseDeTest();
		await expect(appeler({ acteur: null, base })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('agent sans rôle : prénom et « Mon astreinte » seule', async () => {
		const { base, alice } = await jeu();
		expect(await appeler({ acteur: alice, base })).toEqual({
			prenom: 'Alice',
			casquettes: [{ id: 'astreinte', nom: 'Mon astreinte', icone: 'casque', compte: 0 }],
			choisie: 'astreinte',
			contenu: { type: 'astreinte' },
			aNePasManquer: { annonces: [], evenements: [], sondages: [], epinglees: [], nouveautes: [] },
			anniversaire: false,
			aujourdhui: aujourdhuiParis()
		});
	});

	it('dit si c’est l’anniversaire de l’agent, pour la fête du jour', async () => {
		const { base, alice } = await jeu();
		await base.update(personne).set({ naissance: `1990${aujourdhuiParis().slice(4)}` }).where(eq(personne.id, alice.id));
		expect(await appeler({ acteur: alice, base })).toMatchObject({ anniversaire: true, aujourdhui: aujourdhuiParis() });
	});

	it('super administrateur : pas de prénom, « Le centre »', async () => {
		const { base } = await jeu();
		expect(await appeler({ acteur: { type: 'super', email: 'admin@exemple.fr' }, base })).toMatchObject({ prenom: null, choisie: 'centre', contenu: { type: 'centre' } });
	});

	it('par défaut : la première casquette où quelque chose attend', async () => {
		const { base, alice, nommer } = await jeu();
		await nommer('Chef de centre', { type: 'centre' });
		expect(await appeler({ acteur: alice, base })).toMatchObject({ choisie: 'centre' });
	});

	it('par défaut, rien n’attend : la principale (chef d’équipe avant astreinte)', async () => {
		const { base, alice, nommer } = await jeu();
		const [equipe1] = await base.select().from(equipe).limit(1);
		await nommer('Chef d’équipe', { type: 'equipe', id: equipe1!.id });
		await nommer('Référent pharmacie', { type: 'centre' });
		expect(await appeler({ acteur: alice, base })).toMatchObject({ choisie: `equipe:${equipe1!.id}`, contenu: { type: 'equipe' } });
	});

	it('?casquette choisit parmi les casquettes tenues, sinon le défaut', async () => {
		const { base, alice, nommer } = await jeu();
		const pharmacie = await nommer('Référent pharmacie', { type: 'centre' });
		expect(await appeler({ acteur: alice, base }, `?casquette=role:${pharmacie}`)).toMatchObject({ choisie: `role:${pharmacie}`, contenu: { type: 'role', permet: ['Gérer le stock et la pharmacie.'] } });
		expect(await appeler({ acteur: alice, base }, '?casquette=centre')).toMatchObject({ choisie: 'astreinte' });
	});

	it('chef de centre avec 150 agents : 50 requêtes au plus', async () => {
		const { base, alice, nommer } = await jeu();
		await nommer('Chef de centre', { type: 'centre' });
		for (let i = 0; i < 150; i++) await base.insert(personne).values({ email: `agent${i}@exemple.fr`, prenom: `Agent${i}`, nom: 'N' });
		const avant = base.requetes;
		expect(await appeler({ acteur: alice, base })).toMatchObject({ choisie: 'centre' });
		expect(base.requetes - avant).toBeLessThanOrEqual(50);
	});
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geste = async (nom: string, locals: unknown, corps: [string, string][]) => (actions as any)[nom]({ locals, params: {}, url: new URL('http://localhost/'), request: await requeteFormulaire(corps) });

describe('« À ne pas manquer » sur l’accueil', () => {
	it('annonce à prendre en compte, événement et sondage ; « Pris connaissance » et réponse sur place', async () => {
		const { base, chef, alice } = await preparer();
		const maintenant = maintenantParis();
		const annonce = await publier(base, base.photos, chef, 'centre', { type: 'annonce', texte: 'Note de service', priseDeConnaissance: true }, maintenant);
		const evenement = await publier(base, base.photos, chef, 'centre', { type: 'evenement', texte: 'Manœuvre', evenement: { debut: '2099-01-01T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		const sondage = await publier(base, base.photos, chef, 'vie', { type: 'message', texte: 'Repas ?', sondage: { question: 'Venez-vous ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenant) } }, maintenant);
		const locals = { base, acteur: alice };
		const data = await appeler(locals);
		expect(data.aNePasManquer.annonces.map((a: { id: number }) => a.id)).toEqual([annonce]);
		expect(data.aNePasManquer.evenements).toMatchObject([{ id: evenement, reponse: null, demain: false }]);
		expect(data.aNePasManquer.sondages.map((a: { id: number }) => a.id)).toEqual([sondage]);
		// Les nouveautés portent la pastille de leur mur.
		expect(data.aNePasManquer.nouveautes).toEqual(
			expect.arrayContaining([
				{ cle: 'centre', nom: 'Le centre', nombre: 2, icone: 'maison', couleur: null, numero: null },
				{ cle: 'vie', nom: expect.any(String), nombre: 1, icone: 'ballon', couleur: null, numero: null }
			])
		);

		expect(await geste('repondre', locals, [['id', String(evenement)], ['reponse', 'present']])).toEqual({ cible: `publication:${evenement}`, succes: 'Réponse enregistrée : présent.' });
		expect(await base.select().from(reponseEvenement)).toMatchObject([{ publicationId: evenement, personneId: alice.id, reponse: 'present' }]);
		expect(await geste('prendreConnaissance', locals, [['id', String(annonce)]])).toEqual({ cible: `publication:${annonce}`, succes: 'Prise de connaissance enregistrée.' });
		expect(await base.select().from(priseConnaissance)).toMatchObject([{ publicationId: annonce, personneId: alice.id }]);

		const apres = await appeler(locals);
		expect(apres.aNePasManquer.annonces).toEqual([]);
		expect(apres.aNePasManquer.evenements).toMatchObject([{ id: evenement, reponse: 'present' }]);
	});

	it('gestes refusés : identifiant invalide, publication inconnue, non convoqué, mur illisible, sans connexion', async () => {
		const { base, chef, bruno, e1 } = await preparer();
		const evenement = await publier(base, base.photos, chef, `equipe:${e1.id}`, { type: 'evenement', texte: 'Réunion', evenement: { debut: '2099-01-01T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenantParis());
		const locals = { base, acteur: bruno };
		expect(await geste('repondre', locals, [['id', 'abc'], ['reponse', 'present']])).toMatchObject({ status: 400 });
		expect(await geste('repondre', locals, [['id', '9999'], ['reponse', 'present']])).toMatchObject({ status: 404 });
		expect(await geste('repondre', locals, [['id', String(evenement)], ['reponse', 'present']])).toMatchObject({ status: 403, data: { cible: `publication:${evenement}` } });
		const annonce = await publier(base, base.photos, chef, `equipe:${e1.id}`, { type: 'annonce', texte: 'Consigne', priseDeConnaissance: true }, maintenantParis());
		expect(await geste('prendreConnaissance', locals, [['id', String(annonce)]])).toMatchObject({ status: 403, data: { cible: `publication:${annonce}`, message: 'Vous n’avez pas le droit de faire cela.' } });
		expect(await base.select().from(priseConnaissance)).toEqual([]);
		await expect(geste('prendreConnaissance', { base, acteur: null }, [['id', String(evenement)]])).rejects.toMatchObject({ status: 303 });
		expect(await base.select().from(reponseEvenement)).toEqual([]);
	});
});
