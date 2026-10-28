import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { epingler, fermerCommentaires, lireMur, lirePublication, modifierPublication, photo, publier, supprimerPublication } from '../src/actions/publications.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { affectationEquipe, attribution, commentaire, comite, equipe, jaime, journal, personne, photoPublication, priseConnaissance, profil, publication, reponseEvenement, responsabilite, visiteMur, voteSondage } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-10-28T14:30';
const aujourdhui = '2026-10-28';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const acteur = (id: number): Acteur => ({ type: 'personne', id });

const jpeg = (taille = 1000) => {
	const octets = new Uint8Array(taille);
	octets.set([0xff, 0xd8, 0xff, 0xe0]);
	return { type: 'image/jpeg', donnees: octets };
};
const webp = () => {
	const octets = new Uint8Array(100);
	octets.set([...'RIFF'].map((c) => c.charCodeAt(0)));
	octets.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
	return { type: 'image/webp', donnees: octets };
};
const png = () => {
	const octets = new Uint8Array(100);
	octets.set([0x89, 0x50, 0x4e, 0x47]);
	return { type: 'image/png', donnees: octets };
};

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const responsabilites = await base.select().from(responsabilite);
	const role = (nom: string) => responsabilites.find((r) => r.nom === nom)!.id;
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);
	const nouvelle = async (prenom: string) => {
		const [p] = await base
			.insert(personne)
			.values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: profils.find((x) => x.typePersonne === 'agent')!.id, statut: 'operationnel' })
			.returning();
		return p!.id;
	};
	const nommer = async (personneId: number, nom: string, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }) => {
		await base.insert(attribution).values({ personneId, responsabiliteId: role(nom), perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	};
	const affecter = async (personneId: number, equipeId: number) => {
		await base.insert(affectationEquipe).values({ personneId, equipeId, debut: '2026-01-01' });
	};
	const chef = await nouvelle('Chef');
	await nommer(chef, 'Chef de centre', { type: 'centre' });
	const agent = await nouvelle('Agent');
	const autre = await nouvelle('Autre');
	return { base, nouvelle, nommer, affecter, chef, agent, autre, amicale: amicale!, e1: equipes[0]!, e2: equipes[1]! };
}

const message = (texte = 'Bonjour') => ({ type: 'message' as const, texte });

describe('publier', () => {
	it('enregistre la publication et ses photos en un seul batch, journal sans le texte', async () => {
		const { base, agent } = await jeu();
		const avant = base.requetes;
		const id = await publier(base, acteur(agent), 'vie', { ...message('Texte secret'), photos: [jpeg(), webp()] }, maintenant);
		// mursDe (1) + écriture (1).
		expect(base.requetes - avant).toBe(2);
		const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
		expect(ligne).toMatchObject({ mur: 'vie', auteur: `personne:${agent}`, type: 'message', texte: 'Texte secret', creeLe: maintenant, epinglee: 0 });
		const photos = await base.select().from(photoPublication).where(eq(photoPublication.publicationId, id));
		expect(photos.map((p) => [p.ordre, p.type])).toEqual([
			[0, 'image/jpeg'],
			[1, 'image/webp']
		]);
		const [entree] = await base.select().from(journal).where(eq(journal.action, 'publier'));
		expect(entree).toMatchObject({ acteur: `personne:${agent}`, cibleType: 'publication', cibleId: id });
		expect(entree!.details).not.toContain('Texte secret');
	});

	it('texte de 1 à 4 000 caractères', async () => {
		const { base, agent } = await jeu();
		await expect(publier(base, acteur(agent), 'vie', message('   '), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, acteur(agent), 'vie', message('a'.repeat(4001)), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, acteur(agent), 'vie', message('a'.repeat(4000)), maintenant)).resolves.toBeGreaterThan(0);
	});

	it('type inconnu refusé', async () => {
		const { base, agent } = await jeu();
		await expect(publier(base, acteur(agent), 'vie', { type: 'autre' as never, texte: 'x' }, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('refusé sans droit de publier (agent dans « Le centre ») ou sur un mur non lisible', async () => {
		const { base, agent, e1 } = await jeu();
		await expect(publier(base, acteur(agent), 'centre', message(), maintenant)).rejects.toThrow(RefusDroit);
		await expect(publier(base, acteur(agent), `equipe:${e1.id}`, message(), maintenant)).rejects.toThrow(RefusDroit);
	});

	it('annonce avec prise de connaissance : modérateurs seulement, annonce seulement', async () => {
		const { base, agent, chef } = await jeu();
		const annonce = { type: 'annonce' as const, texte: 'Lire', priseDeConnaissance: true };
		await expect(publier(base, acteur(agent), 'vie', annonce, maintenant)).rejects.toThrow(RefusDroit);
		await expect(publier(base, acteur(agent), 'vie', { type: 'annonce', texte: 'Lire' }, maintenant)).resolves.toBeGreaterThan(0);
		const id = await publier(base, acteur(chef), 'vie', annonce, maintenant);
		const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
		expect(ligne!.priseDeConnaissance).toBe(1);
		await expect(publier(base, acteur(chef), 'vie', { ...message(), priseDeConnaissance: true }, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('sondage : question de 1 à 200, 2 à 6 réponses de 1 à 100', async () => {
		const { base, agent } = await jeu();
		const avec = (question: string, reponses: string[]) => publier(base, acteur(agent), 'vie', { ...message(), sondage: { question, reponses } }, maintenant);
		await expect(avec('', ['Oui', 'Non'])).rejects.toThrow(DonneeInvalide);
		await expect(avec('q'.repeat(201), ['Oui', 'Non'])).rejects.toThrow('Question trop longue');
		await expect(avec('Pizza ?', ['Oui'])).rejects.toThrow(DonneeInvalide);
		await expect(avec('Pizza ?', ['1', '2', '3', '4', '5', '6', '7'])).rejects.toThrow(DonneeInvalide);
		await expect(avec('Pizza ?', ['Oui', ' '])).rejects.toThrow(DonneeInvalide);
		await expect(avec('Pizza ?', ['Oui', 'r'.repeat(101)])).rejects.toThrow('Réponse trop longue');
		await expect(publier(base, acteur(agent), 'vie', message('t'.repeat(4001)), maintenant)).rejects.toThrow('Texte trop long');
		const id = await avec(' Pizza ? ', ['Oui', 'Non']);
		const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
		expect(ligne).toMatchObject({ sondageQuestion: 'Pizza ?', sondageReponses: '["Oui","Non"]' });
	});

	it('événement : début du jour ou futur, lieu, convoqués ; seulement pour le type événement', async () => {
		const { base, chef, e1, e2 } = await jeu();
		const evenement = (debut: string, convoques: 'tous' | number[] = 'tous', lieu = 'Caserne') => ({ type: 'evenement' as const, texte: 'Manœuvre', evenement: { debut, lieu, convoques } });
		await expect(publier(base, acteur(chef), 'centre', evenement('2026-10-27T20:00'), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, acteur(chef), 'centre', evenement('2026-10-28T08:00'), maintenant)).resolves.toBeGreaterThan(0);
		await expect(publier(base, acteur(chef), 'centre', evenement('2026-10-30'), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, acteur(chef), 'centre', evenement('2026-10-30T25:00'), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, acteur(chef), 'centre', evenement('2026-10-30T20:00', 'tous', ' '), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, acteur(chef), 'centre', evenement('2026-10-30T20:00', [999]), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, acteur(chef), 'centre', evenement('2026-10-30T20:00', []), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, acteur(chef), 'centre', evenement('2026-10-30T20:00', Array.from({ length: 31 }, (_, i) => i + 1)), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, acteur(chef), 'centre', { type: 'evenement', texte: 'Sans détail' }, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, acteur(chef), 'centre', { ...message(), evenement: { debut: '2026-10-30T20:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant)).rejects.toThrow(DonneeInvalide);
		const id = await publier(base, acteur(chef), 'centre', evenement('2026-10-30T20:00', [e1.id, e2.id]), maintenant);
		const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
		expect(ligne).toMatchObject({ debut: '2026-10-30T20:00', lieu: 'Caserne', convoques: JSON.stringify([e1.id, e2.id]) });
	});

	it('mur d’équipe : les convoqués sont cette équipe', async () => {
		const { base, agent, affecter, e1, e2 } = await jeu();
		await affecter(agent, e1.id);
		const id = await publier(base, acteur(agent), `equipe:${e1.id}`, { type: 'evenement', texte: 'Repas', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: [e2.id] } }, maintenant);
		const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
		expect(ligne!.convoques).toBe(JSON.stringify([e1.id]));
	});

	it('photos : 4 au plus, JPEG ou WebP vérifiés sur les octets, 400 Ko au plus', async () => {
		const { base, agent } = await jeu();
		const avec = (photos: { type: string; donnees: Uint8Array }[]) => publier(base, acteur(agent), 'vie', { ...message(), photos }, maintenant);
		await expect(avec([jpeg(), jpeg(), jpeg(), jpeg(), jpeg()])).rejects.toThrow(DonneeInvalide);
		await expect(avec([png()])).rejects.toThrow(DonneeInvalide);
		await expect(avec([{ ...png(), type: 'image/jpeg' }])).rejects.toThrow(DonneeInvalide);
		await expect(avec([{ ...webp(), type: 'image/jpeg' }])).rejects.toThrow(DonneeInvalide);
		await expect(avec([jpeg(400 * 1024 + 1)])).rejects.toThrow(DonneeInvalide);
		await expect(avec([jpeg(400 * 1024), jpeg(), jpeg(), webp()])).resolves.toBeGreaterThan(0);
		expect(await base.select().from(photoPublication)).toHaveLength(4);
		// Absentes (null) : aucune photo ; autre chose qu'une liste : refus net, pas d'erreur de programme.
		await expect(publier(base, acteur(agent), 'vie', { ...message(), photos: null as never }, maintenant)).resolves.toBeGreaterThan(0);
		await expect(publier(base, acteur(agent), 'vie', { ...message(), photos: 'x' as never }, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, acteur(agent), 'vie', { ...message(), photos: [null] as never }, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('mur en lecture seule : publier refusé', async () => {
		const { base, agent, affecter, e1 } = await jeu();
		await affecter(agent, e1.id);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await expect(publier(base, acteur(agent), `equipe:${e1.id}`, message(), maintenant)).rejects.toThrow(RefusDroit);
	});

	it('maintenant mal formé refusé', async () => {
		const { base, agent } = await jeu();
		await expect(publier(base, acteur(agent), 'vie', message(), '2026-10-28')).rejects.toThrow(DonneeInvalide);
	});
});

describe('modifier, supprimer, épingler, fermer', () => {
	it('modifier : l’auteur seulement, texte contrôlé, date de modification, journal sans texte', async () => {
		const { base, agent, chef } = await jeu();
		const id = await publier(base, acteur(agent), 'vie', message(), maintenant);
		await expect(modifierPublication(base, acteur(chef), id, { texte: 'Pirate' }, maintenant)).rejects.toThrow(RefusDroit);
		await expect(modifierPublication(base, acteur(agent), id, { texte: '' }, maintenant)).rejects.toThrow(DonneeInvalide);
		await modifierPublication(base, acteur(agent), id, { texte: 'Corrigé' }, '2026-10-28T15:00');
		const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
		expect(ligne).toMatchObject({ texte: 'Corrigé', modifieeLe: '2026-10-28T15:00' });
		const [entree] = await base.select().from(journal).where(eq(journal.action, 'modifier_publication'));
		expect(entree!.details).not.toContain('Corrigé');
	});

	it('modifier : refusé sur un mur en lecture seule ou non lisible', async () => {
		const { base, agent, affecter, e1, e2 } = await jeu();
		await affecter(agent, e1.id);
		const id = await publier(base, acteur(agent), `equipe:${e1.id}`, message(), maintenant);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await expect(modifierPublication(base, acteur(agent), id, { texte: 'Corrigé' }, maintenant)).rejects.toThrow(RefusDroit);
		await base.update(equipe).set({ active: 1 }).where(eq(equipe.id, e1.id));
		await base.update(affectationEquipe).set({ equipeId: e2.id }).where(eq(affectationEquipe.personneId, agent));
		await expect(modifierPublication(base, acteur(agent), id, { texte: 'Corrigé' }, maintenant)).rejects.toThrow(RefusDroit);
		await expect(fermerCommentaires(base, acteur(agent), id, true, maintenant)).rejects.toThrow(RefusDroit);
	});

	it('supprimer : l’auteur ou un modérateur, refusé pour un autre agent ; photos et dépendances supprimées ; journal sans contenu', async () => {
		const { base, agent, autre, chef } = await jeu();
		const id = await publier(base, acteur(agent), 'vie', { ...message('Contenu'), photos: [jpeg()] }, maintenant);
		await base.insert(jaime).values({ publicationId: id, personneId: autre });
		await base.insert(commentaire).values({ publicationId: id, auteur: `personne:${autre}`, texte: 'Bravo', creeLe: maintenant });
		await base.insert(reponseEvenement).values({ publicationId: id, personneId: autre, reponse: 'present' });
		await base.insert(voteSondage).values({ publicationId: id, personneId: autre, reponse: 0 });
		await base.insert(priseConnaissance).values({ publicationId: id, personneId: autre, le: maintenant });
		await expect(supprimerPublication(base, acteur(autre), id, maintenant)).rejects.toThrow(RefusDroit);
		await supprimerPublication(base, acteur(chef), id, maintenant);
		expect(await base.select().from(publication)).toHaveLength(0);
		expect(await base.select().from(photoPublication)).toHaveLength(0);
		expect(await base.select().from(jaime)).toHaveLength(0);
		expect(await base.select().from(commentaire)).toHaveLength(0);
		expect(await base.select().from(reponseEvenement)).toHaveLength(0);
		expect(await base.select().from(voteSondage)).toHaveLength(0);
		expect(await base.select().from(priseConnaissance)).toHaveLength(0);
		const [entree] = await base.select().from(journal).where(eq(journal.action, 'supprimer_publication'));
		expect(entree).toMatchObject({ acteur: `personne:${chef}`, cibleId: id });
		expect(entree!.details).not.toContain('Contenu');

		const mien = await publier(base, acteur(agent), 'vie', message(), maintenant);
		await supprimerPublication(base, acteur(agent), mien, maintenant);
		await expect(supprimerPublication(base, acteur(agent), mien, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('mur en lecture seule : le modérateur supprime encore', async () => {
		const { base, chef, e1 } = await jeu();
		const id = await publier(base, acteur(chef), `equipe:${e1.id}`, message(), maintenant);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await supprimerPublication(base, acteur(chef), id, maintenant);
		expect(await base.select().from(publication)).toHaveLength(0);
	});

	it('publication d’un mur non lisible : refus', async () => {
		const { base, agent, chef, e1 } = await jeu();
		const id = await publier(base, acteur(chef), `equipe:${e1.id}`, message(), maintenant);
		await expect(supprimerPublication(base, acteur(agent), id, maintenant)).rejects.toThrow(RefusDroit);
		await expect(epingler(base, acteur(agent), id, true, maintenant)).rejects.toThrow(RefusDroit);
	});

	it('épingler : modérateurs seulement', async () => {
		const { base, agent, chef } = await jeu();
		const id = await publier(base, acteur(agent), 'vie', message(), maintenant);
		await expect(epingler(base, acteur(agent), id, true, maintenant)).rejects.toThrow(RefusDroit);
		await epingler(base, acteur(chef), id, true, maintenant);
		expect((await base.select().from(publication))[0]!.epinglee).toBe(1);
		await epingler(base, superAdmin, id, false, maintenant);
		expect((await base.select().from(publication))[0]!.epinglee).toBe(0);
	});

	it('commentaires : l’auteur ou un modérateur ferme, seul un modérateur rouvre', async () => {
		const { base, agent, autre, chef } = await jeu();
		const id = await publier(base, acteur(agent), 'vie', message(), maintenant);
		const fermes = async () => (await base.select().from(publication))[0]!.commentairesFermes;
		const droitFermer = async (qui: number) => (await lireMur(base, acteur(qui), 'vie', {}, maintenant)).publications[0]!.droits.fermer;
		await expect(fermerCommentaires(base, acteur(autre), id, true, maintenant)).rejects.toThrow(RefusDroit);
		await fermerCommentaires(base, acteur(agent), id, true, maintenant);
		expect(await fermes()).toBe(1);
		// L'auteur ne rouvre pas : il ne passe pas outre un modérateur.
		expect(await droitFermer(agent)).toBe(false);
		await expect(fermerCommentaires(base, acteur(agent), id, false, maintenant)).rejects.toThrow(RefusDroit);
		expect(await droitFermer(chef)).toBe(true);
		await fermerCommentaires(base, acteur(chef), id, false, maintenant);
		expect(await fermes()).toBe(0);
		await fermerCommentaires(base, acteur(chef), id, true, maintenant);
		expect(await fermes()).toBe(1);
		await fermerCommentaires(base, acteur(chef), id, false, maintenant);
		expect(await droitFermer(agent)).toBe(true);
	});
});

describe('lireMur', () => {
	it('épinglées en tête, puis ordre décroissant, pages de 20 avec suite', async () => {
		const { base, agent, chef } = await jeu();
		const ids: number[] = [];
		for (let i = 0; i < 45; i++) ids.push(await publier(base, acteur(agent), 'vie', message(`n° ${i}`), `2026-10-28T10:${String(i).padStart(2, '0')}`));
		await epingler(base, acteur(chef), ids[3]!, true, maintenant);

		const page1 = await lireMur(base, acteur(agent), 'vie', {}, maintenant);
		expect(page1.mur.cle).toBe('vie');
		expect(page1.epinglees.map((p) => p.id)).toEqual([ids[3]]);
		const attendus = ids.filter((id) => id !== ids[3]).reverse();
		expect(page1.publications.map((p) => p.id)).toEqual(attendus.slice(0, 20));
		expect(page1.suite).toBe(attendus[19]);

		const page2 = await lireMur(base, acteur(agent), 'vie', { avant: page1.suite! }, maintenant);
		expect(page2.epinglees).toEqual([]);
		expect(page2.publications.map((p) => p.id)).toEqual(attendus.slice(20, 40));
		const page3 = await lireMur(base, acteur(agent), 'vie', { avant: page2.suite! }, maintenant);
		expect(page3.publications.map((p) => p.id)).toEqual(attendus.slice(40));
		expect(page3.suite).toBeNull();

		const petite = await lireMur(base, acteur(agent), 'vie', { nombre: 5 }, maintenant);
		expect(petite.publications).toHaveLength(5);
	});

	it('vue complète d’une publication pour l’acteur', async () => {
		const { base, agent, autre, chef } = await jeu();
		const id = await publier(
			base,
			acteur(chef),
			'vie',
			{ type: 'evenement', texte: 'Repas', priseDeConnaissance: false, evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' }, sondage: { question: 'Dessert ?', reponses: ['Oui', 'Non', 'Peut-être'] }, photos: [jpeg(), webp()] },
			maintenant
		);
		await base.insert(jaime).values([
			{ publicationId: id, personneId: agent },
			{ publicationId: id, personneId: autre }
		]);
		await base.insert(commentaire).values({ publicationId: id, auteur: `personne:${autre}`, texte: 'Super', creeLe: maintenant });
		await base.insert(reponseEvenement).values([
			{ publicationId: id, personneId: agent, reponse: 'present' },
			{ publicationId: id, personneId: autre, reponse: 'present' },
			{ publicationId: id, personneId: chef, reponse: 'incertain' }
		]);
		await base.insert(voteSondage).values([
			{ publicationId: id, personneId: agent, reponse: 2 },
			{ publicationId: id, personneId: autre, reponse: 0 }
		]);
		const photos = (await base.select({ id: photoPublication.id }).from(photoPublication).orderBy(photoPublication.ordre)).map((p) => p.id);

		const { publications } = await lireMur(base, acteur(agent), 'vie', {}, maintenant);
		expect(publications[0]).toEqual({
			id,
			cle: 'vie',
			auteur: { prenom: 'Chef', nom: 'Test' },
			type: 'evenement',
			texte: 'Repas',
			creeLe: maintenant,
			modifieeLe: null,
			epinglee: false,
			commentairesFermes: false,
			photos,
			jaime: 2,
			commentaires: 1,
			jaimeParMoi: true,
			evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous', convoque: true, reponse: 'present', compte: { present: 2, absent: 0, incertain: 1 } },
			sondage: { question: 'Dessert ?', reponses: ['Oui', 'Non', 'Peut-être'], resultats: [1, 0, 1], vote: 2 },
			priseDeConnaissance: null,
			derniersCommentaires: [{ id: expect.any(Number), auteur: { prenom: 'Autre', nom: 'Test' }, texte: 'Super', creeLe: maintenant, supprimable: false }],
			droits: { modifier: false, supprimer: false, epingler: false, fermer: false }
		});
		const vueChef = (await lireMur(base, acteur(chef), 'vie', {}, maintenant)).publications[0]!;
		expect(vueChef.droits).toEqual({ modifier: true, supprimer: true, epingler: true, fermer: true });
		expect(vueChef.jaimeParMoi).toBe(false);
		expect(vueChef.sondage!.vote).toBeNull();
		expect(vueChef.evenement!.reponse).toBe('incertain');
	});

	it('convoqué : « tous » ou son équipe en cours ; jamais le super administrateur', async () => {
		const { base, agent, autre, chef, affecter, e1, e2 } = await jeu();
		await affecter(agent, e1.id);
		await affecter(autre, e2.id);
		await publier(base, acteur(chef), 'centre', { type: 'evenement', texte: 'Manœuvre', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: [e1.id] } }, maintenant);
		const convoque = async (qui: Acteur, cle = 'centre') => (await lireMur(base, qui, cle, {}, maintenant)).publications[0]!.evenement!.convoque;
		expect(await convoque(acteur(agent))).toBe(true);
		expect(await convoque(acteur(autre))).toBe(false);
		expect(await convoque(acteur(chef))).toBe(false);
		expect(await convoque(superAdmin)).toBe(false);
		await publier(base, acteur(chef), 'vie', { type: 'evenement', texte: 'Repas', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		expect(await convoque(acteur(autre), 'vie')).toBe(true);
		expect(await convoque(superAdmin, 'vie')).toBe(false);
	});

	it('limites D1 : 10 épinglées au plus, pages de 30 au plus, jamais plus de 90 paramètres par requête', async () => {
		const { base, agent, chef } = await jeu();
		const lignes = Array.from({ length: 60 }, (_, i) => ({ mur: 'vie', auteur: `personne:${i % 2 ? agent : chef}`, type: 'message' as const, texte: `n° ${i}`, creeLe: maintenant, epinglee: i < 15 ? 1 : 0 }));
		for (let i = 0; i < 60; i += 10) await base.insert(publication).values(lignes.slice(i, i + 10));
		const ids = (await base.select({ id: publication.id }).from(publication).orderBy(publication.id)).map((p) => p.id);
		await base.insert(jaime).values(ids.map((id) => ({ publicationId: id, personneId: chef })));
		base.parametresMax = 0;
		const page = await lireMur(base, acteur(agent), 'vie', { nombre: 100 }, maintenant);
		expect(page.epinglees.map((p) => p.id)).toEqual(ids.slice(5, 15).reverse());
		expect(page.publications).toHaveLength(30);
		expect(base.parametresMax).toBeGreaterThan(30);
		expect(base.parametresMax).toBeLessThanOrEqual(90);
	});

	it('prise de connaissance demandée, faite ou non par l’acteur ; auteur super administrateur', async () => {
		const { base, agent, autre } = await jeu();
		const id = await publier(base, superAdmin, 'centre', { type: 'annonce', texte: 'Lire', priseDeConnaissance: true }, maintenant);
		await base.insert(priseConnaissance).values({ publicationId: id, personneId: agent, le: maintenant });
		const vue = (await lireMur(base, acteur(agent), 'centre', {}, maintenant)).publications[0]!;
		expect(vue.priseDeConnaissance).toEqual({ le: maintenant });
		expect(vue.auteur).toEqual({ prenom: 'Super', nom: 'administrateur' });
		expect((await lireMur(base, acteur(autre), 'centre', {}, maintenant)).publications[0]!.priseDeConnaissance).toEqual({ le: null });
		const duSuper = (await lireMur(base, superAdmin, 'centre', {}, maintenant)).publications[0]!;
		expect(duSuper.droits).toEqual({ modifier: true, supprimer: true, epingler: true, fermer: true });
	});

	it('l’auteur d’un mur où il publie : modifier, supprimer, fermer, pas épingler', async () => {
		const { base, agent } = await jeu();
		await publier(base, acteur(agent), 'vie', message(), maintenant);
		const vue = (await lireMur(base, acteur(agent), 'vie', {}, maintenant)).publications[0]!;
		expect(vue.droits).toEqual({ modifier: true, supprimer: true, epingler: false, fermer: true });
	});

	it('marque la visite du mur (pas pour le super administrateur)', async () => {
		const { base, agent } = await jeu();
		await lireMur(base, acteur(agent), 'vie', {}, maintenant);
		await lireMur(base, acteur(agent), 'vie', {}, '2026-10-28T16:00');
		await lireMur(base, superAdmin, 'vie', {}, maintenant);
		expect(await base.select().from(visiteMur)).toEqual([{ personneId: agent, mur: 'vie', vueLe: '2026-10-28T16:00' }]);
	});

	it('les 2 derniers commentaires de chaque publication, du plus ancien au plus récent', async () => {
		const { base, agent, autre, chef } = await jeu();
		const a = await publier(base, acteur(agent), 'vie', message('A'), maintenant);
		const b = await publier(base, acteur(agent), 'vie', message('B'), maintenant);
		for (const [i, texte] of ['un', 'deux', 'trois'].entries())
			await base.insert(commentaire).values({ publicationId: a, auteur: `personne:${i === 2 ? agent : autre}`, texte, creeLe: `2026-10-28T15:0${i}` });
		await base.insert(commentaire).values({ publicationId: b, auteur: 'super:admin@exemple.fr', texte: 'seul', creeLe: maintenant });
		const vue = async (qui: Acteur) => (await lireMur(base, qui, 'vie', {}, maintenant)).publications;
		const [pb, pa] = await vue(acteur(agent));
		expect(pa!.commentaires).toBe(3);
		expect(pa!.derniersCommentaires.map((c) => [c.texte, c.auteur.prenom, c.supprimable])).toEqual([
			['deux', 'Autre', false],
			['trois', 'Agent', true]
		]);
		expect(pb!.derniersCommentaires.map((c) => [c.texte, c.auteur])).toEqual([['seul', { prenom: 'Super', nom: 'administrateur' }]]);
		// Le modérateur peut supprimer tout commentaire.
		expect((await vue(acteur(chef)))[1]!.derniersCommentaires.map((c) => c.supprimable)).toEqual([true, true]);
	});

	it('mur non lisible : refus', async () => {
		const { base, agent, e1 } = await jeu();
		await expect(lireMur(base, acteur(agent), `equipe:${e1.id}`, {}, maintenant)).rejects.toThrow(RefusDroit);
	});

	it('mur de 300 publications : 3 requêtes', async () => {
		const { base, agent, autre, chef } = await jeu();
		const lignes = Array.from({ length: 300 }, (_, i) => ({ mur: 'vie', auteur: `personne:${i % 2 ? agent : autre}`, type: 'message' as const, texte: `n° ${i}`, creeLe: `2026-10-${String(1 + (i % 27)).padStart(2, '0')}T10:00`, epinglee: i < 3 ? 1 : 0 }));
		for (let i = 0; i < 300; i += 50) await base.insert(publication).values(lignes.slice(i, i + 50));
		const ids = (await base.select({ id: publication.id }).from(publication).orderBy(publication.id)).map((p) => p.id);
		await base.insert(jaime).values(ids.map((id) => ({ publicationId: id, personneId: chef })));
		await base.insert(photoPublication).values(ids.slice(-10).map((id) => ({ publicationId: id, ordre: 0, type: 'image/jpeg' as const, donnees: jpeg().donnees })));
		const avant = base.requetes;
		const page = await lireMur(base, acteur(chef), 'vie', {}, maintenant);
		const requetes = base.requetes - avant;
		expect(requetes).toBe(3);
		expect(page.epinglees).toHaveLength(3);
		expect(page.publications).toHaveLength(20);
		expect(page.publications.every((p) => p.jaimeParMoi && p.jaime === 1)).toBe(true);
		expect(page.publications.filter((p) => p.photos.length === 1)).toHaveLength(10);
	});
});

describe('lirePublication', () => {
	it('la publication vue par l’acteur, tous ses commentaires, sans marquer la visite', async () => {
		const { base, agent, autre } = await jeu();
		const id = await publier(base, acteur(agent), 'vie', { type: 'annonce', texte: 'Lire' }, maintenant);
		for (const texte of ['un', 'deux', 'trois']) await base.insert(commentaire).values({ publicationId: id, auteur: `personne:${autre}`, texte, creeLe: maintenant });
		await base.insert(jaime).values({ publicationId: id, personneId: agent });
		const avant = base.requetes;
		const lu = await lirePublication(base, acteur(agent), id, maintenant);
		expect(base.requetes - avant).toBeLessThanOrEqual(4);
		expect(lu.mur).toMatchObject({ cle: 'vie', peutPublier: true });
		expect(lu.publication).toMatchObject({ id, texte: 'Lire', jaime: 1, jaimeParMoi: true, commentaires: 3 });
		expect(lu.publication.derniersCommentaires.map((c) => c.texte)).toEqual(['deux', 'trois']);
		expect(lu.commentaires.map((c) => c.texte)).toEqual(['un', 'deux', 'trois']);
		expect(await base.select().from(visiteMur)).toEqual([]);
	});

	it('refus : publication inconnue, mur non lisible ; le super administrateur lit', async () => {
		const { base, agent, chef, e1 } = await jeu();
		const id = await publier(base, acteur(chef), `equipe:${e1.id}`, message(), maintenant);
		await expect(lirePublication(base, acteur(agent), id, maintenant)).rejects.toThrow(RefusDroit);
		await expect(lirePublication(base, acteur(agent), 999, maintenant)).rejects.toThrow(DonneeInvalide);
		expect((await lirePublication(base, superAdmin, id, maintenant)).publication.droits.epingler).toBe(true);
	});
});

describe('photo', () => {
	it('rend la photo à qui lit le mur, refuse sinon', async () => {
		const { base, agent, chef, affecter, e1 } = await jeu();
		const id = await publier(base, acteur(chef), `equipe:${e1.id}`, { ...message(), photos: [webp()] }, maintenant);
		const [{ id: idPhoto }] = await base.select({ id: photoPublication.id }).from(photoPublication).where(eq(photoPublication.publicationId, id));
		await expect(photo(base, acteur(agent), idPhoto!, aujourdhui)).rejects.toThrow(RefusDroit);
		await affecter(agent, e1.id);
		const rendue = await photo(base, acteur(agent), idPhoto!, aujourdhui);
		expect(rendue.type).toBe('image/webp');
		expect(rendue.donnees).toBeInstanceOf(Uint8Array);
		expect(rendue.donnees).toEqual(webp().donnees);
		await expect(photo(base, acteur(agent), 9999, aujourdhui)).rejects.toThrow(DonneeInvalide);
	});
});
