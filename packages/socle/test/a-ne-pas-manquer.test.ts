import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { aNePasManquer, anniversairesDuJour, monAnniversaire } from '../src/a-ne-pas-manquer.ts';
import { prendreConnaissance, repondreEvenement, voter } from '../src/actions/interactions.ts';
import { epingler, etatSondage, lireMur, publier } from '../src/actions/publications.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { affectationEquipe, attribution, equipe, personne, profil, publication, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-10-28T14:30';
const aujourdhui = '2026-10-28';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const acteur = (id: number): Acteur => ({ type: 'personne', id });

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const responsabilites = await base.select().from(responsabilite);
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);
	const nouvelle = async (prenom: string, champs: Partial<typeof personne.$inferInsert> = {}, type: 'agent' | 'exterieur' = 'agent') => {
		const [p] = await base
			.insert(personne)
			.values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: profils.find((x) => x.typePersonne === type)!.id, ...champs })
			.returning();
		return p!.id;
	};
	const nommer = async (personneId: number, nom: string, perimetre: { type: 'centre' | 'equipe'; id?: number }) => {
		const role = responsabilites.find((r) => r.nom === nom)!.id;
		await base.insert(attribution).values({ personneId, responsabiliteId: role, perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	};
	const affecter = async (personneId: number, equipeId: number) => {
		await base.insert(affectationEquipe).values({ personneId, equipeId, debut: '2026-01-01', fin: null });
	};
	const chef = await nouvelle('Chef');
	await nommer(chef, 'Chef de centre', { type: 'centre' });
	const agent = await nouvelle('Agent');
	const autre = await nouvelle('Autre');
	return { base, nouvelle, nommer, affecter, chef, agent, autre, e1: equipes[0]!, e2: equipes[1]! };
}

const annonce = (texte = 'Note de service') => ({ type: 'annonce' as const, texte, priseDeConnaissance: true });
const evenement = (debut: string, convoques: 'tous' | number[] = 'tous') => ({ type: 'evenement' as const, texte: 'Manœuvre', evenement: { debut, lieu: 'Caserne', convoques } });
const sondage = (texte = 'Repas', ouverture = '2026-09-01T00:00', cloture = '2026-12-31T00:00') => ({ type: 'message' as const, texte, sondage: { question: 'Qui vient ?', reponses: ['Oui', 'Non'], ouverture, cloture } });
const ids = (liste: { id: number }[]) => liste.map((x) => x.id);

describe('à ne pas manquer', () => {
	it('annonces à prendre en compte : jusqu’au « Pris connaissance », jamais pour l’auteur', async () => {
		const { base, chef, agent } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), 'centre', annonce('  Réunion   de\ncentre ' + 'x'.repeat(100)), maintenant);
		await publier(base, base.photos, acteur(chef), 'centre', { type: 'annonce', texte: 'Sans prise' }, maintenant);
		const vu = await aNePasManquer(base, acteur(agent), aujourdhui, maintenant);
		expect(vu.annonces).toEqual([{ id, cle: 'centre', nomMur: 'Le centre', titre: expect.stringMatching(/^Réunion de centre x+…$/) }]);
		expect(vu.annonces[0]!.titre).toHaveLength(80);
		expect((await aNePasManquer(base, acteur(chef), aujourdhui, maintenant)).annonces).toEqual([]);
		await prendreConnaissance(base, acteur(agent), id, maintenant);
		expect((await aNePasManquer(base, acteur(agent), aujourdhui, maintenant)).annonces).toEqual([]);
	});

	it('annonces : seulement celles des 90 derniers jours', async () => {
		const { base, chef, agent } = await jeu();
		await publier(base, base.photos, acteur(chef), 'centre', annonce('Il y a 91 jours'), '2026-07-29T10:00');
		const recente = await publier(base, base.photos, acteur(chef), 'centre', annonce('Il y a 89 jours'), '2026-07-31T10:00');
		const limite = await publier(base, base.photos, acteur(chef), 'centre', annonce('Il y a 90 jours'), '2026-07-30T00:00');
		expect(ids((await aNePasManquer(base, acteur(agent), aujourdhui, maintenant)).annonces)).toEqual([recente, limite]);
	});

	it('bornes : sondage et épinglée à J−30 inclus, J−31 exclus ; nouveautés dès J−14 sans visite', async () => {
		const { base, chef, agent } = await jeu();
		const s30 = await publier(base, base.photos, acteur(chef), 'vie', sondage('J−30'), '2026-09-28T00:00');
		await publier(base, base.photos, acteur(chef), 'vie', sondage('J−31'), '2026-09-27T23:59');
		const e30 = await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'J−30' }, '2026-09-28T00:00');
		const e31 = await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'J−31' }, '2026-09-27T23:59');
		await epingler(base, acteur(chef), e30, true, maintenant);
		await epingler(base, acteur(chef), e31, true, maintenant);
		await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'J−14' }, '2026-10-14T00:00');
		await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'J−15' }, '2026-10-13T23:59');
		const vu = await aNePasManquer(base, acteur(agent), aujourdhui, maintenant);
		expect(ids(vu.sondages)).toEqual([s30]);
		expect(ids(vu.epinglees)).toEqual([e30]);
		expect(vu.nouveautes).toEqual([{ cle: 'centre', nom: 'Le centre', nombre: 1 }]);
	});

	it('un agent de l’équipe 2 ne voit rien du mur de l’équipe 1 ; le chef de centre qui supervise n’est pas attendu', async () => {
		const { base, chef, agent, autre, affecter, e1, e2 } = await jeu();
		await affecter(agent, e1.id);
		await affecter(autre, e2.id);
		const cle = `equipe:${e1.id}`;
		await publier(base, base.photos, acteur(chef), cle, annonce(), maintenant);
		await publier(base, base.photos, acteur(chef), cle, evenement('2026-11-02T19:00'), maintenant);
		await publier(base, base.photos, acteur(chef), cle, sondage(), maintenant);
		const p = await publier(base, base.photos, acteur(chef), cle, { type: 'message', texte: 'Épinglé' }, maintenant);
		await epingler(base, acteur(chef), p, true, maintenant);

		const deE1 = await aNePasManquer(base, acteur(agent), aujourdhui, maintenant);
		expect([deE1.annonces.length, deE1.evenements.length, deE1.sondages.length, deE1.epinglees.length]).toEqual([1, 1, 1, 1]);
		expect(deE1.nouveautes).toEqual([{ cle, nom: e1.nom, nombre: 4 }]);

		const deE2 = await aNePasManquer(base, acteur(autre), aujourdhui, maintenant);
		expect(deE2).toEqual({ annonces: [], evenements: [], sondages: [], epinglees: [], nouveautes: [], remplacements: [] });

		// Le chef de centre lit le mur, mais n'en est pas membre : ni annonce, ni événement, ni sondage à traiter.
		const duChef = await aNePasManquer(base, acteur(chef), aujourdhui, maintenant);
		expect([duChef.annonces.length, duChef.evenements.length, duChef.sondages.length, duChef.epinglees.length]).toEqual([0, 0, 0, 1]);
	});

	it('événements à venir ou en cours (3 h après le début) où l’on est convoqué, « demain » la veille, avec sa réponse', async () => {
		const { base, chef, agent, affecter, e1, e2 } = await jeu();
		await affecter(agent, e1.id);
		const demain = await publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-29T08:00'), maintenant);
		const plusTard = await publier(base, base.photos, acteur(chef), 'centre', evenement('2026-11-05T19:00', [e1.id]), maintenant);
		await publier(base, base.photos, acteur(chef), 'centre', evenement('2026-11-03T19:00', [e2.id]), maintenant);
		// Commencé à 14 h : en cours jusqu'à 17 h (3 h, sans heure de fin), avant les suivants. Fini à 14 h 30 : plus listé.
		const enCours = await publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-28T14:00'), '2026-10-28T08:00');
		await publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-28T11:30'), '2026-10-28T08:00');
		await repondreEvenement(base, acteur(agent), plusTard, 'present', maintenant);

		const { evenements } = await aNePasManquer(base, acteur(agent), aujourdhui, maintenant);
		expect(evenements).toEqual([
			{ id: enCours, cle: 'centre', nomMur: 'Le centre', titre: 'Manœuvre', debut: '2026-10-28T14:00', demain: false, enCours: true, reponse: null },
			{ id: demain, cle: 'centre', nomMur: 'Le centre', titre: 'Manœuvre', debut: '2026-10-29T08:00', demain: true, enCours: false, reponse: null },
			{ id: plusTard, cle: 'centre', nomMur: 'Le centre', titre: 'Manœuvre', debut: '2026-11-05T19:00', demain: false, enCours: false, reponse: 'present' }
		]);
		// À 17 h, il est fini.
		expect(ids((await aNePasManquer(base, acteur(agent), aujourdhui, '2026-10-28T17:00')).evenements)).toEqual([demain, plusTard]);
	});

	it('sondages pas encore ouverts ou fermés : non listés ; même règle qu’etatSondage (sans dates, une seule date)', async () => {
		const { base, chef, agent } = await jeu();
		const ouvert = await publier(base, base.photos, acteur(chef), 'vie', sondage('Ouvert', maintenant, '2026-11-30T00:00'), maintenant);
		await publier(base, base.photos, acteur(chef), 'vie', sondage('À venir', '2026-10-29T00:00', '2026-11-30T00:00'), maintenant);
		await publier(base, base.photos, acteur(chef), 'vie', sondage('Fermé', '2026-10-01T00:00', maintenant), '2026-10-01T10:00');
		const [{ id: ancien }] = await base.insert(publication).values({ mur: 'vie', auteur: `personne:${chef}`, type: 'message', texte: 'Sans dates', creeLe: maintenant, sondageQuestion: 'Qui ?', sondageReponses: '["a","b"]' }).returning({ id: publication.id });
		// Une seule des deux dates : ouvert, comme etatSondage.
		const [{ id: ouvertureSeule }] = await base.insert(publication).values({ mur: 'vie', auteur: `personne:${chef}`, type: 'message', texte: 'Ouverture seule', creeLe: maintenant, sondageQuestion: 'Qui ?', sondageReponses: '["a","b"]', sondageOuverture: '2026-11-15T00:00' }).returning({ id: publication.id });
		const [{ id: clotureSeule }] = await base.insert(publication).values({ mur: 'vie', auteur: `personne:${chef}`, type: 'message', texte: 'Clôture seule', creeLe: maintenant, sondageQuestion: 'Qui ?', sondageReponses: '["a","b"]', sondageCloture: '2026-10-01T00:00' }).returning({ id: publication.id });
		expect(etatSondage('2026-11-15T00:00', null, maintenant)).toBe('ouvert');
		expect(ids((await aNePasManquer(base, acteur(agent), aujourdhui, maintenant)).sondages).sort()).toEqual([ouvert, ancien, ouvertureSeule, clotureSeule].sort());
	});

	it('sondages ouverts (moins de 30 jours) et pas encore votés', async () => {
		const { base, chef, agent } = await jeu();
		const recent = await publier(base, base.photos, acteur(chef), 'vie', sondage('Récent'), maintenant);
		const vote = await publier(base, base.photos, acteur(chef), 'vie', sondage('Voté'), maintenant);
		await publier(base, base.photos, acteur(chef), 'vie', sondage('Ancien'), '2026-09-27T10:00');
		const limite = await publier(base, base.photos, acteur(chef), 'vie', sondage('Limite'), '2026-09-29T10:00');
		await voter(base, acteur(agent), vote, 0, maintenant);
		expect(ids((await aNePasManquer(base, acteur(agent), aujourdhui, maintenant)).sondages)).toEqual([recent, limite]);
	});

	it('épinglées de moins de 30 jours des murs lisibles', async () => {
		const { base, chef, agent } = await jeu();
		const recente = await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Récente' }, maintenant);
		const ancienne = await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Ancienne' }, '2026-09-01T10:00');
		await epingler(base, acteur(chef), recente, true, maintenant);
		await epingler(base, acteur(chef), ancienne, true, maintenant);
		expect((await aNePasManquer(base, acteur(agent), aujourdhui, maintenant)).epinglees).toEqual([{ id: recente, cle: 'centre', nomMur: 'Le centre', titre: 'Récente' }]);
	});

	it('nouveautés : depuis la dernière visite, sinon les 14 derniers jours ; pas les siennes', async () => {
		const { base, chef, agent } = await jeu();
		await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Vieux' }, '2026-10-10T10:00');
		await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Récent' }, '2026-10-20T10:00');
		await publier(base, base.photos, acteur(agent), 'vie', { type: 'message', texte: 'Le mien' }, '2026-10-20T10:00');
		await publier(base, base.photos, acteur(chef), 'vie', { type: 'message', texte: 'Avant visite' }, '2026-10-27T10:00');
		await lireMur(base, acteur(agent), 'vie', {}, '2026-10-27T12:00');
		await publier(base, base.photos, acteur(chef), 'vie', { type: 'message', texte: 'Après visite' }, '2026-10-28T09:00');
		expect((await aNePasManquer(base, acteur(agent), aujourdhui, maintenant)).nouveautes).toEqual([
			{ cle: 'centre', nom: 'Le centre', nombre: 1 },
			{ cle: 'vie', nom: 'Vie du centre', nombre: 1 }
		]);
	});

	it('parti, extérieur : rien ; super administrateur : ni annonce, ni événement, ni sondage', async () => {
		const { base, chef, nouvelle } = await jeu();
		const parti = await nouvelle('Parti', { statut: 'parti' });
		const exterieur = await nouvelle('Exterieur', {}, 'exterieur');
		await publier(base, base.photos, acteur(chef), 'centre', annonce(), maintenant);
		await publier(base, base.photos, acteur(chef), 'centre', evenement('2026-11-02T19:00'), maintenant);
		const vide = { annonces: [], evenements: [], sondages: [], epinglees: [], nouveautes: [], remplacements: [] };
		expect(await aNePasManquer(base, acteur(parti), aujourdhui, maintenant)).toEqual(vide);
		expect(await aNePasManquer(base, acteur(exterieur), aujourdhui, maintenant)).toEqual(vide);
		const duSuper = await aNePasManquer(base, superAdmin, aujourdhui, maintenant);
		expect([duSuper.annonces, duSuper.evenements, duSuper.sondages]).toEqual([[], [], []]);
	});

	it('mur d’équipe inactive (lecture seule) : rien à traiter', async () => {
		const { base, chef, agent, affecter, e1 } = await jeu();
		await affecter(agent, e1.id);
		await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, annonce(), maintenant);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		expect((await aNePasManquer(base, acteur(agent), aujourdhui, maintenant)).annonces).toEqual([]);
	});

	it('150 agents, 300 publications : 12 requêtes au plus, 100 paramètres au plus', async () => {
		const { base, chef, agent, nouvelle, affecter, e1 } = await jeu();
		for (let i = 0; i < 150; i++) await affecter(await nouvelle(`Agent${i}`, { naissance: '1990-10-28' }), e1.id);
		await affecter(agent, e1.id);
		const lignes = Array.from({ length: 300 }, (_, i) => ({
			mur: i % 2 ? 'vie' : `equipe:${e1.id}`,
			auteur: `personne:${chef}`,
			type: (['message', 'annonce', 'evenement'] as const)[i % 3],
			texte: `Publication ${i}`,
			priseDeConnaissance: i % 3 === 1 ? 1 : 0,
			epinglee: i % 10 === 0 ? 1 : 0,
			creeLe: '2026-10-20T10:00',
			debut: i % 3 === 2 ? '2026-11-02T19:00' : null,
			convoques: i % 3 === 2 ? '"tous"' : null,
			sondageQuestion: i % 5 === 0 ? 'Qui ?' : null,
			sondageReponses: i % 5 === 0 ? '["a","b"]' : null
		}));
		for (let i = 0; i < 300; i += 20) await base.insert(publication).values(lignes.slice(i, i + 20));
		base.requetes = 0;
		base.parametresMax = 0;
		const vu = await aNePasManquer(base, acteur(agent), aujourdhui, maintenant);
		const anniversaires = await anniversairesDuJour(base, superAdmin, aujourdhui);
		// Deux requêtes pour « À ne pas manquer », une pour les anniversaires (12 permises).
		expect(base.requetes).toBe(3);
		expect(base.parametresMax).toBeLessThanOrEqual(100);
		expect([vu.annonces.length, vu.evenements.length, vu.nouveautes.reduce((n, x) => n + x.nombre, 0)]).toEqual([100, 100, 300]);
		expect(anniversaires).toHaveLength(150);
	});
});

describe('anniversaires du jour', () => {
	it('date inscrite et affichage activé seulement ; agents non partis ; jamais l’âge', async () => {
		const { base, nouvelle } = await jeu();
		await nouvelle('Zoe', { nom: 'Bernard', naissance: '1990-10-28' });
		await nouvelle('Anne', { nom: 'Bernard', naissance: '2001-10-28' });
		await nouvelle('Cache', { naissance: '1990-10-28', anniversaireVisible: 0 });
		await nouvelle('Autrejour', { naissance: '1990-10-27' });
		await nouvelle('Parti', { naissance: '1990-10-28', statut: 'parti' });
		await nouvelle('Suspendu', { naissance: '1990-10-28', statut: 'suspendu' });
		await nouvelle('Exterieur', { naissance: '1990-10-28' }, 'exterieur');
		expect((await anniversairesDuJour(base, superAdmin, aujourdhui)).map(({ prenom, nom }) => ({ prenom, nom }))).toEqual([
			{ prenom: 'Anne', nom: 'Bernard' },
			{ prenom: 'Zoe', nom: 'Bernard' }
		]);
	});

	it('29 février : fêté le 28 février les années non bissextiles', async () => {
		const { base, nouvelle } = await jeu();
		await nouvelle('Bissextile', { naissance: '2000-02-29' });
		await nouvelle('Veille', { naissance: '2000-02-28' });
		expect((await anniversairesDuJour(base, superAdmin, '2027-02-28')).map((p) => p.prenom).sort()).toEqual(['Bissextile', 'Veille']);
		expect((await anniversairesDuJour(base, superAdmin, '2028-02-28')).map((p) => p.prenom)).toEqual(['Veille']);
		expect((await anniversairesDuJour(base, superAdmin, '2028-02-29')).map((p) => p.prenom)).toEqual(['Bissextile']);
	});
});

describe('mon anniversaire', () => {
	it('vrai le jour même, si l’affichage est activé ; faux sans date, un autre jour ou pour le super administrateur', async () => {
		const { base, nouvelle } = await jeu();
		const fete = await nouvelle('Zoe', { naissance: '1990-10-28' });
		const cache = await nouvelle('Cache', { naissance: '1990-10-28', anniversaireVisible: 0 });
		const sansDate = await nouvelle('Sansdate');
		expect(await monAnniversaire(base, acteur(fete), aujourdhui)).toEqual({ souhaitePar: [] });
		expect(await monAnniversaire(base, acteur(fete), '2026-10-29')).toBeNull();
		expect(await monAnniversaire(base, acteur(cache), aujourdhui)).toBeNull();
		expect(await monAnniversaire(base, acteur(sansDate), aujourdhui)).toBeNull();
		expect(await monAnniversaire(base, superAdmin, aujourdhui)).toBeNull();
	});

	it('29 février : fêté le 28 février les années non bissextiles', async () => {
		const { base, nouvelle } = await jeu();
		const ne = await nouvelle('Bissextile', { naissance: '2000-02-29' });
		expect(await monAnniversaire(base, acteur(ne), '2027-02-28')).toEqual({ souhaitePar: [] });
		expect(await monAnniversaire(base, acteur(ne), '2028-02-28')).toBeNull();
		expect(await monAnniversaire(base, acteur(ne), '2028-02-29')).toEqual({ souhaitePar: [] });
	});
});
