import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { aNePasManquer, anniversairesDuJour } from '../src/a-ne-pas-manquer.ts';
import { prendreConnaissance, repondreEvenement, voter } from '../src/actions/interactions.ts';
import { epingler, lireMur, publier } from '../src/actions/publications.ts';
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
const sondage = (texte = 'Repas') => ({ type: 'message' as const, texte, sondage: { question: 'Qui vient ?', reponses: ['Oui', 'Non'] } });
const ids = (liste: { id: number }[]) => liste.map((x) => x.id);

describe('à ne pas manquer', () => {
	it('annonces à prendre en compte : jusqu’au « Pris connaissance », jamais pour l’auteur', async () => {
		const { base, chef, agent } = await jeu();
		const id = await publier(base, acteur(chef), 'centre', annonce('  Réunion   de\ncentre ' + 'x'.repeat(100)), maintenant);
		await publier(base, acteur(chef), 'centre', { type: 'annonce', texte: 'Sans prise' }, maintenant);
		const vu = await aNePasManquer(base, acteur(agent), aujourdhui, maintenant);
		expect(vu.annonces).toEqual([{ id, cle: 'centre', nomMur: 'Le centre', titre: expect.stringMatching(/^Réunion de centre x+…$/) }]);
		expect(vu.annonces[0]!.titre).toHaveLength(80);
		expect((await aNePasManquer(base, acteur(chef), aujourdhui, maintenant)).annonces).toEqual([]);
		await prendreConnaissance(base, acteur(agent), id, maintenant);
		expect((await aNePasManquer(base, acteur(agent), aujourdhui, maintenant)).annonces).toEqual([]);
	});

	it('un agent de l’équipe 2 ne voit rien du mur de l’équipe 1 ; le chef de centre qui supervise n’est pas attendu', async () => {
		const { base, chef, agent, autre, affecter, e1, e2 } = await jeu();
		await affecter(agent, e1.id);
		await affecter(autre, e2.id);
		const cle = `equipe:${e1.id}`;
		await publier(base, acteur(chef), cle, annonce(), maintenant);
		await publier(base, acteur(chef), cle, evenement('2026-11-02T19:00'), maintenant);
		await publier(base, acteur(chef), cle, sondage(), maintenant);
		const p = await publier(base, acteur(chef), cle, { type: 'message', texte: 'Épinglé' }, maintenant);
		await epingler(base, acteur(chef), p, true, maintenant);

		const deE1 = await aNePasManquer(base, acteur(agent), aujourdhui, maintenant);
		expect([deE1.annonces.length, deE1.evenements.length, deE1.sondages.length, deE1.epinglees.length]).toEqual([1, 1, 1, 1]);
		expect(deE1.nouveautes).toEqual([{ cle, nom: e1.nom, nombre: 4 }]);

		const deE2 = await aNePasManquer(base, acteur(autre), aujourdhui, maintenant);
		expect(deE2).toEqual({ annonces: [], evenements: [], sondages: [], epinglees: [], nouveautes: [] });

		// Le chef de centre lit le mur, mais n'en est pas membre : ni annonce, ni événement, ni sondage à traiter.
		const duChef = await aNePasManquer(base, acteur(chef), aujourdhui, maintenant);
		expect([duChef.annonces.length, duChef.evenements.length, duChef.sondages.length, duChef.epinglees.length]).toEqual([0, 0, 0, 1]);
	});

	it('événements à venir où l’on est convoqué, « demain » la veille, avec sa réponse', async () => {
		const { base, chef, agent, affecter, e1, e2 } = await jeu();
		await affecter(agent, e1.id);
		const demain = await publier(base, acteur(chef), 'centre', evenement('2026-10-29T08:00'), maintenant);
		const plusTard = await publier(base, acteur(chef), 'centre', evenement('2026-11-05T19:00', [e1.id]), maintenant);
		await publier(base, acteur(chef), 'centre', evenement('2026-11-03T19:00', [e2.id]), maintenant);
		// Passé dans l'heure : plus à venir.
		await publier(base, acteur(chef), 'centre', evenement('2026-10-28T14:00'), '2026-10-28T08:00');
		await repondreEvenement(base, acteur(agent), plusTard, 'present', aujourdhui);

		const { evenements } = await aNePasManquer(base, acteur(agent), aujourdhui, maintenant);
		expect(evenements).toEqual([
			{ id: demain, cle: 'centre', nomMur: 'Le centre', titre: 'Manœuvre', debut: '2026-10-29T08:00', demain: true, reponse: null },
			{ id: plusTard, cle: 'centre', nomMur: 'Le centre', titre: 'Manœuvre', debut: '2026-11-05T19:00', demain: false, reponse: 'present' }
		]);
	});

	it('sondages ouverts (moins de 30 jours) et pas encore votés', async () => {
		const { base, chef, agent } = await jeu();
		const recent = await publier(base, acteur(chef), 'vie', sondage('Récent'), maintenant);
		const vote = await publier(base, acteur(chef), 'vie', sondage('Voté'), maintenant);
		await publier(base, acteur(chef), 'vie', sondage('Ancien'), '2026-09-27T10:00');
		const limite = await publier(base, acteur(chef), 'vie', sondage('Limite'), '2026-09-29T10:00');
		await voter(base, acteur(agent), vote, 0, aujourdhui);
		expect(ids((await aNePasManquer(base, acteur(agent), aujourdhui, maintenant)).sondages)).toEqual([recent, limite]);
	});

	it('épinglées de moins de 30 jours des murs lisibles', async () => {
		const { base, chef, agent } = await jeu();
		const recente = await publier(base, acteur(chef), 'centre', { type: 'message', texte: 'Récente' }, maintenant);
		const ancienne = await publier(base, acteur(chef), 'centre', { type: 'message', texte: 'Ancienne' }, '2026-09-01T10:00');
		await epingler(base, acteur(chef), recente, true, maintenant);
		await epingler(base, acteur(chef), ancienne, true, maintenant);
		expect((await aNePasManquer(base, acteur(agent), aujourdhui, maintenant)).epinglees).toEqual([{ id: recente, cle: 'centre', nomMur: 'Le centre', titre: 'Récente' }]);
	});

	it('nouveautés : depuis la dernière visite, sinon les 14 derniers jours ; pas les siennes', async () => {
		const { base, chef, agent } = await jeu();
		await publier(base, acteur(chef), 'centre', { type: 'message', texte: 'Vieux' }, '2026-10-10T10:00');
		await publier(base, acteur(chef), 'centre', { type: 'message', texte: 'Récent' }, '2026-10-20T10:00');
		await publier(base, acteur(agent), 'vie', { type: 'message', texte: 'Le mien' }, '2026-10-20T10:00');
		await publier(base, acteur(chef), 'vie', { type: 'message', texte: 'Avant visite' }, '2026-10-27T10:00');
		await lireMur(base, acteur(agent), 'vie', {}, '2026-10-27T12:00');
		await publier(base, acteur(chef), 'vie', { type: 'message', texte: 'Après visite' }, '2026-10-28T09:00');
		expect((await aNePasManquer(base, acteur(agent), aujourdhui, maintenant)).nouveautes).toEqual([
			{ cle: 'centre', nom: 'Le centre', nombre: 1 },
			{ cle: 'vie', nom: 'Vie du centre', nombre: 1 }
		]);
	});

	it('parti, extérieur : rien ; super administrateur : ni annonce, ni événement, ni sondage', async () => {
		const { base, chef, nouvelle } = await jeu();
		const parti = await nouvelle('Parti', { statut: 'parti' });
		const exterieur = await nouvelle('Exterieur', {}, 'exterieur');
		await publier(base, acteur(chef), 'centre', annonce(), maintenant);
		await publier(base, acteur(chef), 'centre', evenement('2026-11-02T19:00'), maintenant);
		const vide = { annonces: [], evenements: [], sondages: [], epinglees: [], nouveautes: [] };
		expect(await aNePasManquer(base, acteur(parti), aujourdhui, maintenant)).toEqual(vide);
		expect(await aNePasManquer(base, acteur(exterieur), aujourdhui, maintenant)).toEqual(vide);
		const duSuper = await aNePasManquer(base, superAdmin, aujourdhui, maintenant);
		expect([duSuper.annonces, duSuper.evenements, duSuper.sondages]).toEqual([[], [], []]);
	});

	it('mur d’équipe inactive (lecture seule) : rien à traiter', async () => {
		const { base, chef, agent, affecter, e1 } = await jeu();
		await affecter(agent, e1.id);
		await publier(base, acteur(chef), `equipe:${e1.id}`, annonce(), maintenant);
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
		const anniversaires = await anniversairesDuJour(base, aujourdhui);
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
		expect(await anniversairesDuJour(base, aujourdhui)).toEqual([
			{ prenom: 'Anne', nom: 'Bernard' },
			{ prenom: 'Zoe', nom: 'Bernard' }
		]);
	});

	it('29 février : fêté le 28 février les années non bissextiles', async () => {
		const { base, nouvelle } = await jeu();
		await nouvelle('Bissextile', { naissance: '2000-02-29' });
		await nouvelle('Veille', { naissance: '2000-02-28' });
		expect((await anniversairesDuJour(base, '2027-02-28')).map((p) => p.prenom).sort()).toEqual(['Bissextile', 'Veille']);
		expect((await anniversairesDuJour(base, '2028-02-28')).map((p) => p.prenom)).toEqual(['Veille']);
		expect((await anniversairesDuJour(base, '2028-02-29')).map((p) => p.prenom)).toEqual(['Bissextile']);
	});
});
