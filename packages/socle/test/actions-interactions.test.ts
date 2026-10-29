import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { aimer, commenter, lireCommentaires, prendreConnaissance, repondreEvenement, suiviPublication, supprimerCommentaire, voter } from '../src/actions/interactions.ts';
import { fermerCommentaires, lireMur, publier } from '../src/actions/publications.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { affectationEquipe, attribution, commentaire, comite, equipe, jaime, journal, personne, priseConnaissance, profil, publication, reponseEvenement, responsabilite, voteSondage } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-10-28T14:30';
const aujourdhui = '2026-10-28';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const acteur = (id: number): Acteur => ({ type: 'personne', id });
const dates = { ouverture: maintenant, cloture: '2026-11-04T14:30' };

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const responsabilites = await base.select().from(responsabilite);
	const role = (nom: string) => responsabilites.find((r) => r.nom === nom)!.id;
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);
	const nouvelle = async (prenom: string, nom = 'Test', statut: 'operationnel' | 'parti' = 'operationnel') => {
		const [p] = await base
			.insert(personne)
			.values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom, profilId: profils.find((x) => x.typePersonne === 'agent')!.id, statut })
			.returning();
		return p!.id;
	};
	const nommer = async (personneId: number, nom: string, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }) => {
		await base.insert(attribution).values({ personneId, responsabiliteId: role(nom), perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	};
	const affecter = async (personneId: number, equipeId: number, fin: string | null = null) => {
		await base.insert(affectationEquipe).values({ personneId, equipeId, debut: '2026-01-01', fin });
	};
	const chef = await nouvelle('Chef', 'Centre');
	await nommer(chef, 'Chef de centre', { type: 'centre' });
	const agent = await nouvelle('Agent');
	const autre = await nouvelle('Autre');
	return { base, nouvelle, nommer, affecter, chef, agent, autre, amicale: amicale!, e1: equipes[0]!, e2: equipes[1]! };
}

const message = (texte = 'Bonjour') => ({ type: 'message' as const, texte });
const evenement = (convoques: 'tous' | number[] = 'tous') => ({ type: 'evenement' as const, texte: 'Manœuvre', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques } });
const annonce = { type: 'annonce' as const, texte: 'Note de service', priseDeConnaissance: true };
const noms = (liste: { prenom: string; nom: string }[]) => liste.map((p) => p.nom);

describe('commentaires', () => {
	it('commenter : lecteur, 1 à 2 000 caractères ; lus du plus ancien au plus récent', async () => {
		const { base, agent, autre } = await jeu();
		const id = await publier(base, base.photos, acteur(agent), 'vie', message(), maintenant);
		await expect(commenter(base, acteur(autre), id, '  ', maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(commenter(base, acteur(autre), id, 'a'.repeat(2001), maintenant)).rejects.toThrow(DonneeInvalide);
		const avant = base.requetes;
		const premier = await commenter(base, acteur(autre), id, ' Bravo ', maintenant);
		expect(base.requetes - avant).toBeLessThanOrEqual(3);
		await commenter(base, superAdmin, id, 'a'.repeat(2000), '2026-10-28T15:00');
		const lus = await lireCommentaires(base, acteur(agent), id, aujourdhui);
		expect(lus.map((c) => [c.id === premier, c.auteur, c.creeLe])).toEqual([
			[true, { prenom: 'Autre', nom: 'Test' }, maintenant],
			[false, { prenom: 'Super', nom: 'administrateur' }, '2026-10-28T15:00']
		]);
		expect(lus[0]!.texte).toBe('Bravo');
		// L'auteur du commentaire et les modérateurs peuvent le supprimer.
		expect(lus.map((c) => c.supprimable)).toEqual([false, false]);
		expect((await lireCommentaires(base, acteur(autre), id, aujourdhui)).map((c) => c.supprimable)).toEqual([true, false]);
	});

	it('commenter : refusé à qui ne lit pas le mur, si les commentaires sont fermés, sur un mur en lecture seule', async () => {
		const { base, agent, autre, chef, affecter, e1 } = await jeu();
		const surEquipe = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, message(), maintenant);
		await expect(commenter(base, acteur(agent), surEquipe, 'Coucou', maintenant)).rejects.toThrow(RefusDroit);
		await expect(lireCommentaires(base, acteur(agent), surEquipe, aujourdhui)).rejects.toThrow(RefusDroit);
		await affecter(agent, e1.id);
		await commenter(base, acteur(agent), surEquipe, 'Coucou', maintenant);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await expect(commenter(base, acteur(agent), surEquipe, 'Encore', maintenant)).rejects.toThrow(RefusDroit);
		// Toujours lisible en lecture seule.
		expect(await lireCommentaires(base, acteur(agent), surEquipe, aujourdhui)).toHaveLength(1);

		const id = await publier(base, base.photos, acteur(agent), 'vie', message(), maintenant);
		await fermerCommentaires(base, acteur(agent), id, true, maintenant);
		await expect(commenter(base, acteur(autre), id, 'Coucou', maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(commenter(base, acteur(autre), 9999, 'Coucou', maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(commenter(base, acteur(autre), id, 'Coucou', '2026-10-28')).rejects.toThrow(DonneeInvalide);
	});

	it('supprimer un commentaire : son auteur ou un modérateur, journal sans le texte', async () => {
		const { base, agent, autre, chef } = await jeu();
		const id = await publier(base, base.photos, acteur(agent), 'vie', message(), maintenant);
		const c1 = await commenter(base, acteur(autre), id, 'Secret', maintenant);
		const c2 = await commenter(base, acteur(autre), id, 'Autre', maintenant);
		// L'auteur de la publication n'est pas modérateur.
		await expect(supprimerCommentaire(base, acteur(agent), c1, maintenant)).rejects.toThrow(RefusDroit);
		await supprimerCommentaire(base, acteur(autre), c1, maintenant);
		await supprimerCommentaire(base, acteur(chef), c2, maintenant);
		expect(await base.select().from(commentaire)).toHaveLength(0);
		const entrees = await base.select().from(journal).where(eq(journal.action, 'supprimer_commentaire'));
		expect(entrees.map((e) => [e.acteur, e.cibleType, e.cibleId])).toEqual([
			[`personne:${autre}`, 'commentaire', c1],
			[`personne:${chef}`, 'commentaire', c2]
		]);
		expect(entrees.every((e) => !e.details.includes('Secret'))).toBe(true);
		await expect(supprimerCommentaire(base, acteur(chef), c1, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('supprimer un commentaire : refusé à qui ne lit plus le mur', async () => {
		const { base, agent, chef, affecter, e1, e2 } = await jeu();
		await affecter(agent, e1.id);
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, message(), maintenant);
		const c = await commenter(base, acteur(agent), id, 'Coucou', maintenant);
		await base.update(affectationEquipe).set({ equipeId: e2.id }).where(eq(affectationEquipe.personneId, agent));
		await expect(supprimerCommentaire(base, acteur(agent), c, maintenant)).rejects.toThrow(RefusDroit);
	});
});

describe('j’aime', () => {
	it('aimer puis ne plus aimer ; deux fois sans effet', async () => {
		const { base, agent, autre } = await jeu();
		const id = await publier(base, base.photos, acteur(agent), 'vie', message(), maintenant);
		await aimer(base, acteur(autre), id, true, aujourdhui);
		await aimer(base, acteur(autre), id, true, aujourdhui);
		expect(await base.select().from(jaime)).toEqual([{ publicationId: id, personneId: autre }]);
		await aimer(base, acteur(autre), id, false, aujourdhui);
		await aimer(base, acteur(autre), id, false, aujourdhui);
		expect(await base.select().from(jaime)).toEqual([]);
	});

	it('refusé : non-lecteur, mur en lecture seule, super administrateur (sans fiche)', async () => {
		const { base, agent, chef, affecter, e1 } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, message(), maintenant);
		await expect(aimer(base, acteur(agent), id, true, aujourdhui)).rejects.toThrow(RefusDroit);
		await affecter(agent, e1.id);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await expect(aimer(base, acteur(agent), id, true, aujourdhui)).rejects.toThrow(RefusDroit);
		const vie = await publier(base, base.photos, acteur(chef), 'vie', message(), maintenant);
		await expect(aimer(base, superAdmin, vie, true, aujourdhui)).rejects.toThrow(DonneeInvalide);
		expect(await base.select().from(jaime)).toEqual([]);
	});
});

describe('réponses aux événements', () => {
	it('un convoqué répond et change sa réponse ; réponse inconnue refusée', async () => {
		const { base, agent, chef } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), 'vie', evenement(), maintenant);
		await repondreEvenement(base, acteur(agent), id, 'present', maintenant);
		await repondreEvenement(base, acteur(agent), id, 'incertain', maintenant);
		expect(await base.select().from(reponseEvenement)).toEqual([{ publicationId: id, personneId: agent, reponse: 'incertain' }]);
		await expect(repondreEvenement(base, acteur(agent), id, 'peut-etre' as never, maintenant)).rejects.toThrow(DonneeInvalide);
		const simple = await publier(base, base.photos, acteur(chef), 'vie', message(), maintenant);
		await expect(repondreEvenement(base, acteur(agent), simple, 'present', maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('seulement les convoqués (équipes en cours) ; jamais le super administrateur', async () => {
		const { base, agent, autre, chef, affecter, e1, e2 } = await jeu();
		await affecter(agent, e1.id);
		await affecter(autre, e2.id, '2026-10-01');
		const id = await publier(base, base.photos, acteur(chef), 'centre', evenement([e1.id, e2.id]), maintenant);
		// Lecteur non convoqué : un refus qui le dit.
		await expect(repondreEvenement(base, acteur(autre), id, 'present', maintenant)).rejects.toThrow(RefusDroit);
		await expect(repondreEvenement(base, acteur(chef), id, 'present', maintenant)).rejects.toThrow('Vous n’êtes pas convoqué à cet événement');
		await expect(repondreEvenement(base, superAdmin, id, 'present', maintenant)).rejects.toThrow(DonneeInvalide);
		await repondreEvenement(base, acteur(agent), id, 'absent', maintenant);
		expect(await base.select().from(reponseEvenement)).toHaveLength(1);
	});

	it('le chef d’équipe est convoqué sur le mur de son équipe et quand son équipe est convoquée ailleurs', async () => {
		const { base, agent, chef, nommer, e1, e2 } = await jeu();
		await nommer(agent, 'Chef d’équipe', { type: 'equipe', id: e1.id });
		const surEquipe = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, evenement(), maintenant);
		const surCentre = await publier(base, base.photos, acteur(chef), 'centre', evenement([e1.id]), maintenant);
		const autreEquipe = await publier(base, base.photos, acteur(chef), 'centre', evenement([e2.id]), maintenant);
		const convoque = async (cle: string) => (await lireMur(base, acteur(agent), cle, {}, maintenant)).publications[0]!.evenement!.convoque;
		expect(await convoque(`equipe:${e1.id}`)).toBe(true);
		expect((await lireMur(base, acteur(agent), 'centre', {}, maintenant)).publications.map((p) => p.evenement!.convoque)).toEqual([false, true]);
		expect(noms((await suiviPublication(base, acteur(chef), surEquipe, aujourdhui)).evenement!.sans_reponse)).toEqual(['Test']);
		expect((await suiviPublication(base, acteur(chef), surCentre, aujourdhui)).evenement!.sans_reponse.map((p) => p.id)).toEqual([agent]);
		await repondreEvenement(base, acteur(agent), surEquipe, 'present', maintenant);
		await repondreEvenement(base, acteur(agent), surCentre, 'absent', maintenant);
		await expect(repondreEvenement(base, acteur(agent), autreEquipe, 'present', maintenant)).rejects.toThrow('Vous n’êtes pas convoqué à cet événement');
	});

	it('refusé une fois l’événement commencé (date et heure)', async () => {
		const { base, agent, chef } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), 'vie', { ...evenement(), evenement: { ...evenement().evenement, debut: '2026-10-28T18:00' } }, maintenant);
		await repondreEvenement(base, acteur(agent), id, 'present', '2026-10-28T17:59');
		await expect(repondreEvenement(base, acteur(agent), id, 'absent', '2026-10-28T18:00')).rejects.toThrow('Cet événement est passé');
		await expect(repondreEvenement(base, acteur(agent), id, 'absent', '2026-10-29T08:00')).rejects.toThrow(DonneeInvalide);
		await expect(repondreEvenement(base, acteur(agent), id, 'absent', '2026-10-28')).rejects.toThrow(DonneeInvalide);
		expect(await base.select().from(reponseEvenement)).toEqual([{ publicationId: id, personneId: agent, reponse: 'present' }]);
	});

	it('refusé sur un mur en lecture seule', async () => {
		const { base, agent, chef, affecter, e1 } = await jeu();
		await affecter(agent, e1.id);
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, evenement(), maintenant);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await expect(repondreEvenement(base, acteur(agent), id, 'present', maintenant)).rejects.toThrow(RefusDroit);
	});
});

describe('sondages', () => {
	it('un vote par personne, qu’on peut changer ; rang contrôlé', async () => {
		const { base, agent, autre } = await jeu();
		const id = await publier(base, base.photos, acteur(agent), 'vie', { ...message(), sondage: { question: 'Pizza ?', reponses: ['Oui', 'Non', 'Peut-être'], ...dates } }, maintenant);
		await voter(base, acteur(autre), id, 0, maintenant);
		await voter(base, acteur(autre), id, 2, maintenant);
		expect(await base.select().from(voteSondage)).toEqual([{ publicationId: id, personneId: autre, reponse: 2 }]);
		await expect(voter(base, acteur(autre), id, 3, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(voter(base, acteur(autre), id, -1, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(voter(base, acteur(autre), id, 1.5, maintenant)).rejects.toThrow(DonneeInvalide);
		const sans = await publier(base, base.photos, acteur(agent), 'vie', message(), maintenant);
		await expect(voter(base, acteur(autre), sans, 0, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('refusé : non-lecteur, lecture seule, super administrateur', async () => {
		const { base, agent, chef, affecter, e1 } = await jeu();
		const sondage = { ...message(), sondage: { question: 'Pizza ?', reponses: ['Oui', 'Non'], ...dates } };
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, sondage, maintenant);
		await expect(voter(base, acteur(agent), id, 0, maintenant)).rejects.toThrow(RefusDroit);
		await affecter(agent, e1.id);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await expect(voter(base, acteur(agent), id, 0, maintenant)).rejects.toThrow(RefusDroit);
		const vie = await publier(base, base.photos, acteur(chef), 'vie', sondage, maintenant);
		await expect(voter(base, superAdmin, vie, 0, maintenant)).rejects.toThrow(DonneeInvalide);
	});
});

describe('sondages datés', () => {
	const ligne = (agent: number, dates: { sondageOuverture: string | null; sondageCloture: string | null }) => ({
		mur: 'vie',
		auteur: `personne:${agent}`,
		type: 'message' as const,
		texte: 'Sondage',
		creeLe: maintenant,
		sondageQuestion: 'Pizza ?',
		sondageReponses: '["Oui","Non"]',
		...dates
	});

	it('refusé avant l’ouverture, dès la minute de clôture ; accepté entre les deux', async () => {
		const { base, agent, autre } = await jeu();
		const id = await publier(base, base.photos, acteur(agent), 'vie', { ...message(), sondage: { question: 'Pizza ?', reponses: ['Oui', 'Non'], ouverture: '2026-10-30T08:00', cloture: '2026-11-04T14:30' } }, maintenant);
		await expect(voter(base, acteur(autre), id, 0, maintenant)).rejects.toThrow('Sondage pas encore ouvert');
		await expect(voter(base, acteur(autre), id, 0, '2026-10-30T07:59:59')).rejects.toThrow('Sondage pas encore ouvert');
		await voter(base, acteur(autre), id, 0, '2026-10-30T08:00');
		await voter(base, acteur(autre), id, 1, '2026-11-04T14:29:59');
		await expect(voter(base, acteur(autre), id, 0, '2026-11-04T14:30:00')).rejects.toThrow('Sondage fermé');
		await expect(voter(base, acteur(autre), id, 0, '2026-11-05T09:00')).rejects.toThrow('Sondage fermé');
		expect(await base.select().from(voteSondage)).toEqual([{ publicationId: id, personneId: autre, reponse: 1 }]);
	});

	it('sondage sans dates : vote accepté, même longtemps après', async () => {
		const { base, agent, autre } = await jeu();
		const [{ id }] = await base.insert(publication).values(ligne(agent, { sondageOuverture: null, sondageCloture: null })).returning({ id: publication.id });
		await voter(base, acteur(autre), id, 0, '2030-01-01T10:00');
		expect(await base.select().from(voteSondage)).toHaveLength(1);
	});
});

describe('prise de connaissance', () => {
	it('une fois : la seconde est sans effet (la date reste la première)', async () => {
		const { base, agent, chef } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), 'centre', annonce, maintenant);
		await prendreConnaissance(base, acteur(agent), id, maintenant);
		await prendreConnaissance(base, acteur(agent), id, '2026-10-29T08:00');
		expect(await base.select().from(priseConnaissance)).toEqual([{ publicationId: id, personneId: agent, le: maintenant }]);
	});

	it('refusé : publication sans prise de connaissance, non-lecteur, lecture seule, super administrateur', async () => {
		const { base, agent, chef, affecter, e1 } = await jeu();
		const simple = await publier(base, base.photos, acteur(chef), 'centre', { type: 'annonce', texte: 'Info' }, maintenant);
		await expect(prendreConnaissance(base, acteur(agent), simple, maintenant)).rejects.toThrow(DonneeInvalide);
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, annonce, maintenant);
		await expect(prendreConnaissance(base, acteur(agent), id, maintenant)).rejects.toThrow(RefusDroit);
		await affecter(agent, e1.id);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await expect(prendreConnaissance(base, acteur(agent), id, maintenant)).rejects.toThrow(RefusDroit);
		const centre = await publier(base, base.photos, acteur(chef), 'centre', annonce, maintenant);
		await expect(prendreConnaissance(base, superAdmin, centre, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(prendreConnaissance(base, acteur(agent), centre, '2026-10-28')).rejects.toThrow(DonneeInvalide);
	});
});

describe('suiviPublication', () => {
	// Une équipe de 8 ; le chef de centre publie sur son mur.
	async function equipeDeHuit() {
		const j = await jeu();
		const membres: number[] = [];
		for (const [i, nom] of ['Hoarau', 'Berger', 'Gautier', 'Durand', 'Morel', 'Fabre', 'Caron', 'Aubry'].entries()) {
			const id = await j.nouvelle(`Membre${i}`, nom);
			await j.affecter(id, j.e1.id);
			membres.push(id);
		}
		// Ni un ancien membre, ni un parti, ni une autre équipe ne sont attendus.
		const ancien = await j.nouvelle('Ancien');
		await j.affecter(ancien, j.e1.id, '2026-10-01');
		const parti = await j.nouvelle('Parti', 'Test', 'parti');
		await j.affecter(parti, j.e1.id);
		await j.affecter(j.autre, j.e2.id);
		return { ...j, membres };
	}

	it('prise de connaissance : 5 faites, 3 manquantes, en 3 requêtes', async () => {
		const { base, chef, membres, e1 } = await equipeDeHuit();
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, annonce, maintenant);
		for (const m of membres.slice(0, 5)) await prendreConnaissance(base, acteur(m), id, maintenant);
		const avant = base.requetes;
		const suivi = await suiviPublication(base, acteur(chef), id, aujourdhui);
		expect(base.requetes - avant).toBe(3);
		expect(noms(suivi.priseDeConnaissance!.faite)).toEqual(['Berger', 'Durand', 'Gautier', 'Hoarau', 'Morel']);
		expect(suivi.priseDeConnaissance!.manquante).toEqual([
			{ id: membres[7], prenom: 'Membre7', nom: 'Aubry' },
			{ id: membres[6], prenom: 'Membre6', nom: 'Caron' },
			{ id: membres[5], prenom: 'Membre5', nom: 'Fabre' }
		]);
		expect(suivi.evenement).toBeUndefined();
	});

	it('événement : réponses par sorte, et convoqués sans réponse', async () => {
		const { base, chef, membres, e1 } = await equipeDeHuit();
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, evenement(), maintenant);
		await repondreEvenement(base, acteur(membres[0]!), id, 'present', maintenant);
		await repondreEvenement(base, acteur(membres[1]!), id, 'present', maintenant);
		await repondreEvenement(base, acteur(membres[2]!), id, 'absent', maintenant);
		await repondreEvenement(base, acteur(membres[3]!), id, 'incertain', maintenant);
		await repondreEvenement(base, acteur(membres[4]!), id, 'incertain', maintenant);
		const suivi = await suiviPublication(base, acteur(chef), id, aujourdhui);
		expect(suivi.priseDeConnaissance).toBeUndefined();
		const ev = suivi.evenement!;
		expect(noms(ev.present)).toEqual(['Berger', 'Hoarau']);
		expect(noms(ev.absent)).toEqual(['Gautier']);
		expect(noms(ev.incertain)).toEqual(['Durand', 'Morel']);
		expect(noms(ev.sans_reponse)).toEqual(['Aubry', 'Caron', 'Fabre']);
	});

	it('convoqués « tous » d’un mur de comité : ses membres en cours et le rapporteur ; liste d’équipes : leurs membres qui lisent le mur', async () => {
		const { base, chef, agent, autre, nouvelle, nommer, affecter, amicale, e1 } = await jeu();
		const rapporteur = await nouvelle('Rapporteur', 'Zola');
		await nommer(agent, 'Membre de comité', { type: 'comite', id: amicale.id });
		await nommer(autre, 'Membre de comité', { type: 'comite', id: amicale.id });
		await nommer(rapporteur, 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		await affecter(agent, e1.id);
		const tous = await publier(base, base.photos, acteur(chef), `comite:${amicale.id}`, evenement(), maintenant);
		// Le chef de centre lit tous les murs mais n'est pas membre du comité : il n'est pas attendu.
		expect(noms((await suiviPublication(base, acteur(chef), tous, aujourdhui)).evenement!.sans_reponse)).toEqual(['Test', 'Test', 'Zola']);
		await expect(repondreEvenement(base, acteur(chef), tous, 'present', maintenant)).rejects.toThrow('Vous n’êtes pas convoqué à cet événement');
		const e1Seule = await publier(base, base.photos, acteur(chef), `comite:${amicale.id}`, evenement([e1.id]), maintenant);
		expect((await suiviPublication(base, acteur(chef), e1Seule, aujourdhui)).evenement!.sans_reponse.map((p) => p.id)).toEqual([agent]);
	});

	it('mur d’équipe : chef d’équipe attendu, chef de centre et adjoint qui supervisent non', async () => {
		const { base, chef, agent, autre, nouvelle, nommer, affecter, e1 } = await jeu();
		const chefEquipe = await nouvelle('Chefequipe', 'Bernard');
		const adjoint = await nouvelle('Adjoint', 'Roux');
		await nommer(chefEquipe, 'Chef d’équipe', { type: 'equipe', id: e1.id });
		await nommer(adjoint, 'Chef de centre adjoint', { type: 'centre' });
		await affecter(agent, e1.id);
		await affecter(autre, e1.id);
		const id = await publier(base, base.photos, acteur(chefEquipe), `equipe:${e1.id}`, annonce, maintenant);
		expect((await suiviPublication(base, acteur(chef), id, aujourdhui)).priseDeConnaissance!.manquante.map((p) => p.id).sort()).toEqual([agent, autre].sort());
		const parLeChef = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, annonce, maintenant);
		expect(noms((await suiviPublication(base, acteur(chefEquipe), parLeChef, aujourdhui)).priseDeConnaissance!.manquante)).toEqual(['Bernard', 'Test', 'Test']);
	});

	it('mur « Le centre » : tous les agents ; l’auteur n’est pas attendu pour sa propre annonce', async () => {
		const { base, chef, agent, autre } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), 'centre', annonce, maintenant);
		const suivi = await suiviPublication(base, acteur(chef), id, aujourdhui);
		expect(suivi.priseDeConnaissance!.manquante.map((p) => p.id).sort()).toEqual([agent, autre].sort());
	});

	it('réservé à l’auteur et aux modérateurs', async () => {
		const { base, chef, agent, autre } = await jeu();
		const id = await publier(base, base.photos, acteur(agent), 'vie', evenement(), maintenant);
		await expect(suiviPublication(base, acteur(autre), id, aujourdhui)).rejects.toThrow(RefusDroit);
		await expect(suiviPublication(base, acteur(agent), id, aujourdhui)).resolves.toBeDefined();
		await expect(suiviPublication(base, acteur(chef), id, aujourdhui)).resolves.toBeDefined();
		await expect(suiviPublication(base, superAdmin, id, aujourdhui)).resolves.toBeDefined();
	});
});

describe('budget de requêtes', () => {
	it('publication, mur (droits), écriture : 3 requêtes par geste', async () => {
		const { base, agent, autre, chef, affecter, e1 } = await jeu();
		await affecter(autre, e1.id);
		const sondage = await publier(base, base.photos, acteur(agent), 'vie', { ...message(), sondage: { question: 'Pizza ?', reponses: ['Oui', 'Non'], ...dates } }, maintenant);
		const tous = await publier(base, base.photos, acteur(chef), 'vie', evenement(), maintenant);
		const equipes = await publier(base, base.photos, acteur(chef), 'centre', evenement([e1.id]), maintenant);
		const note = await publier(base, base.photos, acteur(chef), 'centre', annonce, maintenant);
		const c = await commenter(base, acteur(autre), sondage, 'Oui !', maintenant);
		const requetes = async (geste: () => Promise<unknown>) => {
			const avant = base.requetes;
			await geste();
			return base.requetes - avant;
		};
		expect(await requetes(() => aimer(base, acteur(autre), sondage, true, aujourdhui))).toBe(3);
		expect(await requetes(() => aimer(base, acteur(autre), sondage, false, aujourdhui))).toBe(3);
		expect(await requetes(() => voter(base, acteur(autre), sondage, 1, maintenant))).toBe(3);
		expect(await requetes(() => prendreConnaissance(base, acteur(autre), note, maintenant))).toBe(3);
		expect(await requetes(() => repondreEvenement(base, acteur(autre), tous, 'present', maintenant))).toBe(3);
		expect(await requetes(() => repondreEvenement(base, acteur(autre), equipes, 'present', maintenant))).toBe(3);
		expect(await requetes(() => commenter(base, acteur(autre), sondage, 'Encore', maintenant))).toBe(3);
		expect(await requetes(() => lireCommentaires(base, acteur(autre), sondage, aujourdhui))).toBe(3);
		expect(await requetes(() => supprimerCommentaire(base, acteur(autre), c, maintenant))).toBe(3);
	});
});
