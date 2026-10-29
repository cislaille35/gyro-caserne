import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { epingler, fermerCommentaires, lireMur, lirePublication, modifierPublication, photo, publier, remplissagePhotos, supprimerPublication, textePublication } from '../src/actions/publications.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { affectationEquipe, attribution, commentaire, comite, equipe, jaime, journal, personne, photoPublication, priseConnaissance, profil, publication, reponseEvenement, responsabilite, visiteMur, voteSondage } from '../src/schema.ts';
import { photo as photoOctets } from '../src/schema-photos.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-10-28T14:30';
const aujourdhui = '2026-10-28';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const acteur = (id: number): Acteur => ({ type: 'personne', id });
const dates = { ouverture: maintenant, cloture: '2026-11-04T14:30' };

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
	it('enregistre les octets dans la base des photos, puis la publication et ses références en un seul batch, journal sans le texte', async () => {
		const { base, agent } = await jeu();
		const avant = base.requetes;
		const id = await publier(base, base.photos, acteur(agent), 'vie', { ...message('Texte secret'), photos: [jpeg(), webp()] }, maintenant);
		// mursDe (1) + octets (1) + écriture (1).
		expect(base.requetes - avant).toBe(3);
		const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
		expect(ligne).toMatchObject({ mur: 'vie', auteur: `personne:${agent}`, type: 'message', texte: 'Texte secret', creeLe: maintenant, epinglee: 0 });
		const photos = await base.select().from(photoPublication).where(eq(photoPublication.publicationId, id));
		expect(photos.map((p) => [p.ordre, p.type])).toEqual([
			[0, 'image/jpeg'],
			[1, 'image/webp']
		]);
		const octets = await base.photos.select().from(photoOctets).orderBy(photoOctets.id);
		expect(photos.map((p) => p.photoId)).toEqual(octets.map((o) => o.id));
		expect(octets.map((o) => [o.type, o.taille, o.creeLe])).toEqual([
			['image/jpeg', 1000, maintenant],
			['image/webp', 100, maintenant]
		]);
		expect(octets[0]!.donnees).toEqual(jpeg().donnees);
		const [entree] = await base.select().from(journal).where(eq(journal.action, 'publier'));
		expect(entree).toMatchObject({ acteur: `personne:${agent}`, cibleType: 'publication', cibleId: id });
		expect(entree!.details).not.toContain('Texte secret');
	});

	it('texte de 1 à 4 000 caractères', async () => {
		const { base, agent } = await jeu();
		await expect(publier(base, base.photos, acteur(agent), 'vie', message('   '), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, base.photos, acteur(agent), 'vie', message('a'.repeat(4001)), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, base.photos, acteur(agent), 'vie', message('a'.repeat(4000)), maintenant)).resolves.toBeGreaterThan(0);
	});

	it('type inconnu refusé', async () => {
		const { base, agent } = await jeu();
		await expect(publier(base, base.photos, acteur(agent), 'vie', { type: 'autre' as never, texte: 'x' }, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('refusé sans droit de publier (agent dans « Le centre ») ou sur un mur non lisible', async () => {
		const { base, agent, e1 } = await jeu();
		await expect(publier(base, base.photos, acteur(agent), 'centre', message(), maintenant)).rejects.toThrow(RefusDroit);
		await expect(publier(base, base.photos, acteur(agent), `equipe:${e1.id}`, message(), maintenant)).rejects.toThrow(RefusDroit);
	});

	it('annonce avec prise de connaissance : modérateurs seulement, annonce seulement', async () => {
		const { base, agent, chef } = await jeu();
		const annonce = { type: 'annonce' as const, texte: 'Lire', priseDeConnaissance: true };
		await expect(publier(base, base.photos, acteur(agent), 'vie', annonce, maintenant)).rejects.toThrow(RefusDroit);
		await expect(publier(base, base.photos, acteur(agent), 'vie', { type: 'annonce', texte: 'Lire' }, maintenant)).resolves.toBeGreaterThan(0);
		const id = await publier(base, base.photos, acteur(chef), 'vie', annonce, maintenant);
		const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
		expect(ligne!.priseDeConnaissance).toBe(1);
		await expect(publier(base, base.photos, acteur(chef), 'vie', { ...message(), priseDeConnaissance: true }, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('sondage : question de 1 à 200, 2 à 6 réponses de 1 à 100', async () => {
		const { base, agent } = await jeu();
		const avec = (question: string, reponses: string[]) => publier(base, base.photos, acteur(agent), 'vie', { ...message(), sondage: { question, reponses, ...dates } }, maintenant);
		await expect(avec('', ['Oui', 'Non'])).rejects.toThrow(DonneeInvalide);
		await expect(avec('q'.repeat(201), ['Oui', 'Non'])).rejects.toThrow('Question trop longue');
		await expect(avec('Pizza ?', ['Oui'])).rejects.toThrow(DonneeInvalide);
		await expect(avec('Pizza ?', ['1', '2', '3', '4', '5', '6', '7'])).rejects.toThrow(DonneeInvalide);
		await expect(avec('Pizza ?', ['Oui', ' '])).rejects.toThrow(DonneeInvalide);
		await expect(avec('Pizza ?', ['Oui', 'r'.repeat(101)])).rejects.toThrow('Réponse trop longue');
		await expect(publier(base, base.photos, acteur(agent), 'vie', message('t'.repeat(4001)), maintenant)).rejects.toThrow('Texte trop long');
		const id = await avec(' Pizza ? ', ['Oui', 'Non']);
		const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
		expect(ligne).toMatchObject({ sondageQuestion: 'Pizza ?', sondageReponses: '["Oui","Non"]', sondageOuverture: dates.ouverture, sondageCloture: dates.cloture });
	});

	it('sondage : dates obligatoires, clôture après l’ouverture, à venir, dans l’année et avant l’événement', async () => {
		const { base, agent } = await jeu();
		const question = { question: 'Pizza ?', reponses: ['Oui', 'Non'] };
		const avec = (sondage: object, plus: object = message()) => publier(base, base.photos, acteur(agent), 'vie', { ...plus, sondage: { ...question, ...sondage } } as never, maintenant);
		await expect(avec({})).rejects.toThrow('Dates du sondage manquantes');
		await expect(avec({ ouverture: maintenant })).rejects.toThrow('Dates du sondage manquantes');
		await expect(avec({ cloture: '2026-11-04T14:30' })).rejects.toThrow('Dates du sondage manquantes');
		await expect(avec({ ouverture: maintenant, cloture: maintenant })).rejects.toThrow('Clôture avant l’ouverture');
		await expect(avec({ ouverture: maintenant, cloture: '2026-10-27T10:00' })).rejects.toThrow('Clôture avant l’ouverture');
		await expect(avec({ ouverture: maintenant, cloture: '2027-10-28T14:31' })).rejects.toThrow('Clôture dans plus d’un an');
		await expect(avec({ ouverture: maintenant, cloture: 'demain' })).rejects.toThrow(DonneeInvalide);
		await expect(avec({ ouverture: '2026-10-20T10:00', cloture: '2026-10-28T14:29' })).rejects.toThrow('Clôture déjà passée');
		await expect(avec({ ouverture: '2026-10-20T10:00', cloture: maintenant })).rejects.toThrow('Clôture déjà passée');
		await expect(publier(base, base.photos, acteur(agent), 'vie', { ...message(), sondage: { ...question, ouverture: '2026-10-20T10:00', cloture: maintenant } }, `${maintenant}:59`)).rejects.toThrow('Clôture déjà passée');
		await expect(avec({ ouverture: '2026-10-20T10:00', cloture: '2026-10-28T14:31' })).resolves.toBeGreaterThan(0);
		await expect(avec({ ouverture: maintenant, cloture: '2027-10-28T14:30' })).resolves.toBeGreaterThan(0);
		const evenement = { type: 'evenement' as const, texte: 'Manœuvre', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' as const } };
		await expect(avec({ ouverture: maintenant, cloture: '2026-11-02T19:01' }, evenement)).rejects.toThrow('Clôture après le début de l’événement');
		await expect(avec({ ouverture: maintenant, cloture: '2026-11-02T19:00' }, evenement)).resolves.toBeGreaterThan(0);
	});

	it('événement : début à venir (date et heure), lieu, convoqués ; seulement pour le type événement', async () => {
		const { base, chef, e1, e2 } = await jeu();
		const evenement = (debut: string, convoques: 'tous' | number[] = 'tous', lieu = 'Caserne') => ({ type: 'evenement' as const, texte: 'Manœuvre', evenement: { debut, lieu, convoques } });
		await expect(publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-27T20:00'), maintenant)).rejects.toThrow(DonneeInvalide);
		// Date et heure : plus tôt dans la journée, c'est passé.
		await expect(publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-28T14:29'), maintenant)).rejects.toThrow('Événement passé');
		await expect(publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-28T14:30'), maintenant)).resolves.toBeGreaterThan(0);
		await expect(publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-30'), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-30T25:00'), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-30T20:00', 'tous', ' '), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-30T20:00', [999]), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-30T20:00', []), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-30T20:00', Array.from({ length: 31 }, (_, i) => i + 1)), maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, base.photos, acteur(chef), 'centre', { type: 'evenement', texte: 'Sans détail' }, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, base.photos, acteur(chef), 'centre', { ...message(), evenement: { debut: '2026-10-30T20:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant)).rejects.toThrow(DonneeInvalide);
		const id = await publier(base, base.photos, acteur(chef), 'centre', evenement('2026-10-30T20:00', [e1.id, e2.id]), maintenant);
		const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
		expect(ligne).toMatchObject({ debut: '2026-10-30T20:00', lieu: 'Caserne', convoques: JSON.stringify([e1.id, e2.id]) });
	});

	it('mur d’équipe : les convoqués sont cette équipe', async () => {
		const { base, agent, affecter, e1, e2 } = await jeu();
		await affecter(agent, e1.id);
		const id = await publier(base, base.photos, acteur(agent), `equipe:${e1.id}`, { type: 'evenement', texte: 'Repas', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: [e2.id] } }, maintenant);
		const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
		expect(ligne!.convoques).toBe(JSON.stringify([e1.id]));
	});

	it('photos : 4 au plus, JPEG ou WebP vérifiés sur les octets, 200 Ko au plus', async () => {
		const { base, agent } = await jeu();
		const avec = (photos: { type: string; donnees: Uint8Array }[]) => publier(base, base.photos, acteur(agent), 'vie', { ...message(), photos }, maintenant);
		await expect(avec([jpeg(), jpeg(), jpeg(), jpeg(), jpeg()])).rejects.toThrow(DonneeInvalide);
		await expect(avec([png()])).rejects.toThrow(DonneeInvalide);
		await expect(avec([{ ...png(), type: 'image/jpeg' }])).rejects.toThrow(DonneeInvalide);
		await expect(avec([{ ...webp(), type: 'image/jpeg' }])).rejects.toThrow(DonneeInvalide);
		await expect(avec([jpeg(200 * 1024 + 1)])).rejects.toThrow('Photo trop lourde (200 Ko au plus)');
		await expect(avec([jpeg(200 * 1024), jpeg(), jpeg(), webp()])).resolves.toBeGreaterThan(0);
		expect(await base.select().from(photoPublication)).toHaveLength(4);
		// Un refus n'écrit rien dans la base des photos.
		expect(await base.photos.select().from(photoOctets)).toHaveLength(4);
		// Absentes (null) : aucune photo ; autre chose qu'une liste : refus net, pas d'erreur de programme.
		await expect(publier(base, base.photos, acteur(agent), 'vie', { ...message(), photos: null as never }, maintenant)).resolves.toBeGreaterThan(0);
		await expect(publier(base, base.photos, acteur(agent), 'vie', { ...message(), photos: 'x' as never }, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(publier(base, base.photos, acteur(agent), 'vie', { ...message(), photos: [null] as never }, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('échec de l’écriture de la publication : les octets déjà écrits sont effacés, l’erreur d’origine remonte', async () => {
		const { base, agent } = await jeu();
		await base.run(sql`create trigger panne before insert on publication begin select raise(abort, 'panne de la base'); end`);
		await expect(publier(base, base.photos, acteur(agent), 'vie', { ...message(), photos: [jpeg(), webp()] }, maintenant)).rejects.toThrow('panne de la base');
		expect(await base.photos.select().from(photoOctets)).toEqual([]);
		// Même si l'effacement échoue aussi : c'est la première erreur qui remonte.
		await base.photos.run(sql`create trigger panne before delete on photo begin select raise(abort, 'seconde panne'); end`);
		await expect(publier(base, base.photos, acteur(agent), 'vie', { ...message(), photos: [jpeg()] }, maintenant)).rejects.toThrow('panne de la base');
		expect(await base.select().from(publication)).toEqual([]);
	});

	it('mur en lecture seule : publier refusé', async () => {
		const { base, agent, affecter, e1 } = await jeu();
		await affecter(agent, e1.id);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await expect(publier(base, base.photos, acteur(agent), `equipe:${e1.id}`, message(), maintenant)).rejects.toThrow(RefusDroit);
	});

	it('maintenant mal formé refusé', async () => {
		const { base, agent } = await jeu();
		await expect(publier(base, base.photos, acteur(agent), 'vie', message(), '2026-10-28')).rejects.toThrow(DonneeInvalide);
	});
});

describe('modifier, supprimer, épingler, fermer', () => {
	it('modifier : l’auteur seulement, texte contrôlé, date de modification, journal sans texte', async () => {
		const { base, agent, chef } = await jeu();
		const id = await publier(base, base.photos, acteur(agent), 'vie', message(), maintenant);
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
		const id = await publier(base, base.photos, acteur(agent), `equipe:${e1.id}`, message(), maintenant);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await expect(modifierPublication(base, acteur(agent), id, { texte: 'Corrigé' }, maintenant)).rejects.toThrow(RefusDroit);
		await base.update(equipe).set({ active: 1 }).where(eq(equipe.id, e1.id));
		await base.update(affectationEquipe).set({ equipeId: e2.id }).where(eq(affectationEquipe.personneId, agent));
		await expect(modifierPublication(base, acteur(agent), id, { texte: 'Corrigé' }, maintenant)).rejects.toThrow(RefusDroit);
		await expect(fermerCommentaires(base, acteur(agent), id, true, maintenant)).rejects.toThrow(RefusDroit);
	});

	it('supprimer : l’auteur ou un modérateur, refusé pour un autre agent ; photos et dépendances supprimées ; journal sans contenu', async () => {
		const { base, agent, autre, chef } = await jeu();
		const id = await publier(base, base.photos, acteur(agent), 'vie', { ...message('Contenu'), photos: [jpeg()] }, maintenant);
		await base.insert(jaime).values({ publicationId: id, personneId: autre });
		await base.insert(commentaire).values({ publicationId: id, auteur: `personne:${autre}`, texte: 'Bravo', creeLe: maintenant });
		await base.insert(reponseEvenement).values({ publicationId: id, personneId: autre, reponse: 'present' });
		await base.insert(voteSondage).values({ publicationId: id, personneId: autre, reponse: 0 });
		await base.insert(priseConnaissance).values({ publicationId: id, personneId: autre, le: maintenant });
		await expect(supprimerPublication(base, base.photos, acteur(autre), id, maintenant)).rejects.toThrow(RefusDroit);
		await supprimerPublication(base, base.photos, acteur(chef), id, maintenant);
		expect(await base.select().from(publication)).toHaveLength(0);
		expect(await base.select().from(photoPublication)).toHaveLength(0);
		expect(await base.photos.select().from(photoOctets)).toHaveLength(0);
		expect(await base.select().from(jaime)).toHaveLength(0);
		expect(await base.select().from(commentaire)).toHaveLength(0);
		expect(await base.select().from(reponseEvenement)).toHaveLength(0);
		expect(await base.select().from(voteSondage)).toHaveLength(0);
		expect(await base.select().from(priseConnaissance)).toHaveLength(0);
		const [entree] = await base.select().from(journal).where(eq(journal.action, 'supprimer_publication'));
		expect(entree).toMatchObject({ acteur: `personne:${chef}`, cibleId: id });
		expect(entree!.details).not.toContain('Contenu');

		const mien = await publier(base, base.photos, acteur(agent), 'vie', message(), maintenant);
		await supprimerPublication(base, base.photos, acteur(agent), mien, maintenant);
		await expect(supprimerPublication(base, base.photos, acteur(agent), mien, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('supprimer : seules ses photos partent ; si la base des photos est en panne, la publication part quand même et ses photos restent orphelines', async () => {
		const { base, agent } = await jeu();
		const gardee = await publier(base, base.photos, acteur(agent), 'vie', { ...message(), photos: [webp()] }, maintenant);
		const id = await publier(base, base.photos, acteur(agent), 'vie', { ...message(), photos: [jpeg(), jpeg()] }, maintenant);
		const avant = base.requetes;
		await supprimerPublication(base, base.photos, acteur(agent), id, maintenant);
		// Droits (2) + suppression (1) + octets (1).
		expect(base.requetes - avant).toBeLessThanOrEqual(4);
		expect((await base.photos.select().from(photoOctets)).map((o) => o.type)).toEqual(['image/webp']);
		const encore = await publier(base, base.photos, acteur(agent), 'vie', { ...message(), photos: [jpeg()] }, maintenant);
		await base.photos.run(sql`create trigger panne before delete on photo begin select raise(abort, 'panne'); end`);
		await expect(supprimerPublication(base, base.photos, acteur(agent), encore, maintenant)).resolves.toBeUndefined();
		expect((await base.select().from(publication)).map((p) => p.id)).toEqual([gardee]);
		expect(await base.photos.select().from(photoOctets)).toHaveLength(2);
	});

	it('mur en lecture seule : le modérateur supprime encore', async () => {
		const { base, chef, e1 } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, message(), maintenant);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await supprimerPublication(base, base.photos, acteur(chef), id, maintenant);
		expect(await base.select().from(publication)).toHaveLength(0);
	});

	it('publication d’un mur non lisible : refus', async () => {
		const { base, agent, chef, e1 } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, message(), maintenant);
		await expect(supprimerPublication(base, base.photos, acteur(agent), id, maintenant)).rejects.toThrow(RefusDroit);
		await expect(epingler(base, acteur(agent), id, true, maintenant)).rejects.toThrow(RefusDroit);
	});

	it('épingler : modérateurs seulement', async () => {
		const { base, agent, chef } = await jeu();
		const id = await publier(base, base.photos, acteur(agent), 'vie', message(), maintenant);
		await expect(epingler(base, acteur(agent), id, true, maintenant)).rejects.toThrow(RefusDroit);
		await epingler(base, acteur(chef), id, true, maintenant);
		expect((await base.select().from(publication))[0]!.epinglee).toBe(1);
		await epingler(base, superAdmin, id, false, maintenant);
		expect((await base.select().from(publication))[0]!.epinglee).toBe(0);
	});

	it('épingler : dix épinglées au plus par mur, sinon refus', async () => {
		const { base, agent, chef } = await jeu();
		await base.insert(publication).values(Array.from({ length: 10 }, (_, i) => ({ mur: 'vie', auteur: `personne:${agent}`, type: 'message' as const, texte: `n° ${i}`, creeLe: maintenant, epinglee: 1 })));
		const [premiere] = await base.select().from(publication);
		const onzieme = await publier(base, base.photos, acteur(agent), 'vie', message(), maintenant);
		const ailleurs = await publier(base, base.photos, acteur(chef), 'centre', message(), maintenant);
		await expect(epingler(base, acteur(chef), onzieme, true, maintenant)).rejects.toThrow('Dix publications sont déjà épinglées : désépinglez-en une d’abord');
		// Une déjà épinglée le reste ; un autre mur n'est pas concerné.
		await epingler(base, acteur(chef), premiere!.id, true, maintenant);
		await epingler(base, acteur(chef), ailleurs, true, maintenant);
		await epingler(base, acteur(chef), premiere!.id, false, maintenant);
		await epingler(base, acteur(chef), onzieme, true, maintenant);
		expect((await base.select().from(publication).where(eq(publication.id, onzieme)))[0]!.epinglee).toBe(1);
	});

	it('commentaires : l’auteur ou un modérateur ferme, seul un modérateur rouvre', async () => {
		const { base, agent, autre, chef } = await jeu();
		const id = await publier(base, base.photos, acteur(agent), 'vie', message(), maintenant);
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
		for (let i = 0; i < 45; i++) ids.push(await publier(base, base.photos, acteur(agent), 'vie', message(`n° ${i}`), `2026-10-28T10:${String(i).padStart(2, '0')}`));
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
			base.photos,
			acteur(chef),
			'vie',
			{ type: 'evenement', texte: 'Repas', priseDeConnaissance: false, evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' }, sondage: { question: 'Dessert ?', reponses: ['Oui', 'Non', 'Peut-être'], ...dates, cloture: '2026-11-02T19:00' }, photos: [jpeg(), webp()] },
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
			auteur: { prenom: 'Chef', nom: 'Test', couleur: null, role: 'Chef de centre', ecrireA: chef },
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
			evenement: {
				debut: '2026-11-02T19:00',
				lieu: 'Caserne',
				convoques: 'tous',
				convoque: true,
				reponse: 'present',
				compte: { present: 2, absent: 0, incertain: 1 },
				presents: [
					{ prenom: 'Agent', nom: 'Test', couleur: null },
					{ prenom: 'Autre', nom: 'Test', couleur: null }
				]
			},
			sondage: { question: 'Dessert ?', reponses: ['Oui', 'Non', 'Peut-être'], ouverture: maintenant, cloture: '2026-11-02T19:00', etat: 'ouvert', resultats: [1, 0, 1], vote: 2 },
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

	it('résultats du sondage : seulement à qui a voté, à l’auteur et aux modérateurs', async () => {
		const { base, agent, autre, chef, nouvelle } = await jeu();
		const tiers = await nouvelle('Tiers');
		const id = await publier(base, base.photos, acteur(agent), 'vie', { ...message(), sondage: { question: 'Pizza ?', reponses: ['Oui', 'Non'], ...dates } }, maintenant);
		await base.insert(voteSondage).values({ publicationId: id, personneId: autre, reponse: 1 });
		const sondage = async (qui: Acteur) => (await lireMur(base, qui, 'vie', {}, maintenant)).publications[0]!.sondage!;
		expect(await sondage(acteur(autre))).toMatchObject({ resultats: [0, 1], vote: 1 });
		expect(await sondage(acteur(agent))).toMatchObject({ resultats: [0, 1], vote: null });
		expect(await sondage(acteur(chef))).toMatchObject({ resultats: [0, 1] });
		expect(await sondage(superAdmin)).toMatchObject({ resultats: [0, 1] });
		expect(await sondage(acteur(tiers))).toEqual({ question: 'Pizza ?', reponses: ['Oui', 'Non'], ...dates, etat: 'ouvert', resultats: null, vote: null });
		expect((await lirePublication(base, acteur(tiers), id, maintenant)).publication.sondage!.resultats).toBeNull();
	});

	it('état du sondage : à venir sans résultats, ouvert, fermé avec résultats pour tous', async () => {
		const { base, agent, autre, chef, nouvelle } = await jeu();
		const tiers = await nouvelle('Tiers');
		const id = await publier(base, base.photos, acteur(agent), 'vie', { ...message(), sondage: { question: 'Pizza ?', reponses: ['Oui', 'Non'], ouverture: '2026-10-30T08:00', cloture: '2026-11-04T14:30' } }, maintenant);
		const sondage = async (qui: Acteur, a: string) => (await lireMur(base, qui, 'vie', {}, a)).publications[0]!.sondage!;
		expect(await sondage(acteur(agent), maintenant)).toMatchObject({ etat: 'avenir', resultats: null });
		expect(await sondage(acteur(chef), maintenant)).toMatchObject({ etat: 'avenir', resultats: null });
		expect(await sondage(acteur(tiers), '2026-10-30T08:00')).toMatchObject({ etat: 'ouvert', resultats: null });
		await base.insert(voteSondage).values({ publicationId: id, personneId: autre, reponse: 1 });
		expect(await sondage(acteur(tiers), '2026-11-04T14:29')).toMatchObject({ etat: 'ouvert', resultats: null });
		expect(await sondage(acteur(tiers), '2026-11-04T14:30')).toMatchObject({ etat: 'ferme', resultats: [0, 1], vote: null });
		expect((await lirePublication(base, acteur(tiers), id, '2026-11-05T09:00')).publication.sondage).toMatchObject({ etat: 'ferme', resultats: [0, 1] });
	});

	it('sondage sans dates (publié avant les dates) : ouvert, sans dates, jamais fermé', async () => {
		const { base, agent, nouvelle } = await jeu();
		const tiers = await nouvelle('Tiers');
		const [{ id }] = await base.insert(publication).values({ mur: 'vie', auteur: `personne:${agent}`, type: 'message', texte: 'Ancien', creeLe: '2026-01-01T10:00', sondageQuestion: 'Pizza ?', sondageReponses: '["Oui","Non"]' }).returning({ id: publication.id });
		const vue = (await lireMur(base, acteur(tiers), 'vie', {}, '2030-01-01T10:00')).publications[0]!;
		expect(vue.id).toBe(id);
		expect(vue.sondage).toMatchObject({ ouverture: null, cloture: null, etat: 'ouvert', resultats: null });
	});

	it('convoqué : « tous » ou son équipe en cours ; jamais le super administrateur', async () => {
		const { base, agent, autre, chef, affecter, e1, e2 } = await jeu();
		await affecter(agent, e1.id);
		await affecter(autre, e2.id);
		await publier(base, base.photos, acteur(chef), 'centre', { type: 'evenement', texte: 'Manœuvre', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: [e1.id] } }, maintenant);
		const convoque = async (qui: Acteur, cle = 'centre') => (await lireMur(base, qui, cle, {}, maintenant)).publications[0]!.evenement!.convoque;
		expect(await convoque(acteur(agent))).toBe(true);
		expect(await convoque(acteur(autre))).toBe(false);
		expect(await convoque(acteur(chef))).toBe(false);
		expect(await convoque(superAdmin)).toBe(false);
		await publier(base, base.photos, acteur(chef), 'vie', { type: 'evenement', texte: 'Repas', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
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
		const id = await publier(base, base.photos, superAdmin, 'centre', { type: 'annonce', texte: 'Lire', priseDeConnaissance: true }, maintenant);
		await base.insert(priseConnaissance).values({ publicationId: id, personneId: agent, le: maintenant });
		const vue = (await lireMur(base, acteur(agent), 'centre', {}, maintenant)).publications[0]!;
		expect(vue.priseDeConnaissance).toEqual({ le: maintenant, faites: 1, attendues: 3 });
		expect(vue.auteur).toEqual({ prenom: 'Super', nom: 'administrateur', couleur: null, role: null, ecrireA: null });
		expect((await lireMur(base, acteur(autre), 'centre', {}, maintenant)).publications[0]!.priseDeConnaissance).toEqual({ le: null, faites: 1, attendues: 3 });
		const duSuper = (await lireMur(base, superAdmin, 'centre', {}, maintenant)).publications[0]!;
		expect(duSuper.droits).toEqual({ modifier: true, supprimer: true, epingler: true, fermer: true });
	});

	it('l’auteur d’un mur où il publie : modifier, supprimer, fermer, pas épingler', async () => {
		const { base, agent } = await jeu();
		await publier(base, base.photos, acteur(agent), 'vie', message(), maintenant);
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
		const a = await publier(base, base.photos, acteur(agent), 'vie', message('A'), maintenant);
		const b = await publier(base, base.photos, acteur(agent), 'vie', message('B'), maintenant);
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

	it('audience : membres naturels du mur ce jour-là (équipe : membres et chef ; Le centre : agents avec accès, sans les extérieurs)', async () => {
		const { base, agent, autre, chef, nouvelle, nommer, affecter, e1 } = await jeu();
		const chefEquipe = await nouvelle('Chefequipe');
		await nommer(chefEquipe, 'Chef d’équipe', { type: 'equipe', id: e1.id });
		await affecter(agent, e1.id);
		await affecter(autre, e1.id);
		const [reserve] = await base.select().from(profil).where(eq(profil.typePersonne, 'exterieur'));
		const [exterieur] = await base.insert(personne).values({ email: 'ext@exemple.fr', prenom: 'Ext', nom: 'Test', profilId: reserve!.id, statut: 'operationnel' }).returning();
		await affecter(exterieur!.id, e1.id);
		const parti = await nouvelle('Parti');
		await affecter(parti, e1.id);
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, parti));
		expect((await lireMur(base, acteur(chef), `equipe:${e1.id}`, {}, maintenant)).audience).toBe(3);
		expect((await lireMur(base, acteur(agent), 'centre', {}, maintenant)).audience).toBe(4);
	});

	it('auteur : couleur de son équipe en cours et premier rôle tenu ; auteur parti sans couleur ni rôle', async () => {
		const { base, agent, autre, chef, nouvelle, nommer, affecter, e1 } = await jeu();
		const adjoint = await nouvelle('Adjoint');
		await nommer(adjoint, 'Chef de centre adjoint', { type: 'centre' });
		const chefEquipe = await nouvelle('Chefequipe');
		await nommer(chefEquipe, 'Chef d’équipe', { type: 'equipe', id: e1.id });
		await nommer(chef, 'Chef d’équipe', { type: 'equipe', id: e1.id });
		await affecter(chef, e1.id);
		await affecter(autre, e1.id);
		for (const qui of [chef, adjoint, chefEquipe, agent, autre]) await publier(base, base.photos, acteur(qui), 'vie', message(), maintenant);
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, autre));
		const auteurs = (await lireMur(base, acteur(agent), 'vie', {}, maintenant)).publications.map((p) => p.auteur).reverse();
		// `ecrireA` : à qui répondre en privé ; ni soi-même, ni un agent parti.
		expect(auteurs).toEqual([
			{ prenom: 'Chef', nom: 'Test', couleur: e1.couleur, role: 'Chef de centre', ecrireA: chef },
			{ prenom: 'Adjoint', nom: 'Test', couleur: null, role: 'Adjoint', ecrireA: adjoint },
			{ prenom: 'Chefequipe', nom: 'Test', couleur: null, role: 'Chef d’équipe', ecrireA: chefEquipe },
			{ prenom: 'Agent', nom: 'Test', couleur: null, role: null, ecrireA: null },
			{ prenom: 'Autre', nom: 'Test', couleur: null, role: null, ecrireA: null }
		]);
	});

	it('prise de connaissance : faites parmi les membres naturels, sur les attendus ; l’auteur n’est pas attendu', async () => {
		const { base, agent, autre, chef, nouvelle, nommer, affecter, e1 } = await jeu();
		const chefEquipe = await nouvelle('Chefequipe');
		await nommer(chefEquipe, 'Chef d’équipe', { type: 'equipe', id: e1.id });
		await affecter(agent, e1.id);
		await affecter(autre, e1.id);
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, { type: 'annonce', texte: 'Lire', priseDeConnaissance: true }, maintenant);
		await base.insert(priseConnaissance).values([
			{ publicationId: id, personneId: agent, le: maintenant },
			// Le chef de centre supervise l'équipe sans en être membre : il ne compte pas.
			{ publicationId: id, personneId: chef, le: maintenant }
		]);
		expect((await lireMur(base, acteur(chef), `equipe:${e1.id}`, {}, maintenant)).publications[0]!.priseDeConnaissance).toEqual({ le: maintenant, faites: 1, attendues: 3 });
		const parLeChefEquipe = await publier(base, base.photos, acteur(chefEquipe), `equipe:${e1.id}`, { type: 'annonce', texte: 'Lire', priseDeConnaissance: true }, maintenant);
		const vue = (await lireMur(base, acteur(agent), `equipe:${e1.id}`, {}, maintenant)).publications.find((p) => p.id === parLeChefEquipe)!;
		expect(vue.priseDeConnaissance).toEqual({ le: null, faites: 0, attendues: 2 });
	});

	it('événement : les 3 premiers présents, avec la couleur de leur équipe', async () => {
		const { base, agent, chef, nouvelle, affecter, e1 } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), 'vie', { type: 'evenement', texte: 'Repas', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		const presents = [];
		for (const prenom of ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq']) presents.push(await nouvelle(prenom));
		await affecter(presents[0]!, e1.id);
		await base.insert(reponseEvenement).values({ publicationId: id, personneId: agent, reponse: 'absent' });
		for (const p of presents) await base.insert(reponseEvenement).values({ publicationId: id, personneId: p, reponse: 'present' });
		const ev = (await lireMur(base, acteur(agent), 'vie', {}, maintenant)).publications[0]!.evenement!;
		expect(ev.compte.present).toBe(5);
		expect(ev.presents).toEqual([
			{ prenom: 'Un', nom: 'Test', couleur: e1.couleur },
			{ prenom: 'Deux', nom: 'Test', couleur: null },
			{ prenom: 'Trois', nom: 'Test', couleur: null }
		]);
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
		await base.insert(photoPublication).values(ids.slice(-10).map((id, i) => ({ publicationId: id, ordre: 0, type: 'image/jpeg' as const, photoId: i + 1 })));
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
		const id = await publier(base, base.photos, acteur(agent), 'vie', { type: 'annonce', texte: 'Lire' }, maintenant);
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
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, message(), maintenant);
		await expect(lirePublication(base, acteur(agent), id, maintenant)).rejects.toThrow(RefusDroit);
		await expect(lirePublication(base, acteur(agent), 999, maintenant)).rejects.toThrow(DonneeInvalide);
		expect((await lirePublication(base, superAdmin, id, maintenant)).publication.droits.epingler).toBe(true);
	});
});

describe('textePublication', () => {
	it('le texte d’une publication dont l’acteur lit le mur, en 2 requêtes ; refus sinon', async () => {
		const { base, agent, chef, e1 } = await jeu();
		const vie = await publier(base, base.photos, acteur(chef), 'vie', message('Repas de Noël'), maintenant);
		const equipe = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, message('Réservé à l’équipe'), maintenant);
		const avant = base.requetes;
		expect(await textePublication(base, acteur(agent), vie, aujourdhui)).toBe('Repas de Noël');
		expect(base.requetes - avant).toBeLessThanOrEqual(2);
		await expect(textePublication(base, acteur(agent), equipe, aujourdhui)).rejects.toThrow(RefusDroit);
		await expect(textePublication(base, acteur(agent), 999, aujourdhui)).rejects.toThrow(DonneeInvalide);
	});
});

describe('photo', () => {
	it('rend la photo à qui lit le mur, refuse sinon', async () => {
		const { base, agent, chef, affecter, e1 } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, { ...message(), photos: [webp()] }, maintenant);
		const [{ id: idPhoto }] = await base.select({ id: photoPublication.id }).from(photoPublication).where(eq(photoPublication.publicationId, id));
		await expect(photo(base, base.photos, acteur(agent), idPhoto!, aujourdhui)).rejects.toThrow(RefusDroit);
		await affecter(agent, e1.id);
		const rendue = await photo(base, base.photos, acteur(agent), idPhoto!, aujourdhui);
		expect(rendue.type).toBe('image/webp');
		expect(rendue.donnees).toBeInstanceOf(Uint8Array);
		expect(rendue.donnees).toEqual(webp().donnees);
		await expect(photo(base, base.photos, acteur(agent), 9999, aujourdhui)).rejects.toThrow(DonneeInvalide);
	});

	it('vérifie l’accès dans la base principale avant de lire la base des photos ; octets absents : photo inconnue', async () => {
		const { base, agent, chef, e1 } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), `equipe:${e1.id}`, { ...message(), photos: [webp()] }, maintenant);
		const [{ id: idPhoto }] = await base.select({ id: photoPublication.id }).from(photoPublication).where(eq(photoPublication.publicationId, id));
		await base.photos.delete(photoOctets);
		await expect(photo(base, base.photos, acteur(agent), idPhoto!, aujourdhui)).rejects.toThrow(RefusDroit);
		await expect(photo(base, base.photos, acteur(chef), idPhoto!, aujourdhui)).rejects.toThrow('Photo inconnue');
	});
});

describe('remplissagePhotos', () => {
	// Prudent : 500 Mo comptés en millions d'octets, un peu moins que 500 × 1024 × 1024.
	const MO = 1000 * 1000;
	const ajouter = (base: Awaited<ReturnType<typeof baseDeTest>>, taille: number) =>
		base.photos.insert(photoOctets).values({ type: 'image/jpeg', donnees: jpeg(4).donnees, taille, creeLe: maintenant });

	it('somme des tailles en une requête, sur 500 Mo ; alerte à partir de 80 %', async () => {
		const base = await baseDeTest();
		const avant = base.requetes;
		expect(await remplissagePhotos(base.photos)).toEqual({ octets: 0, limite: 500 * MO, alerte: false });
		expect(base.requetes - avant).toBe(1);
		await ajouter(base, 120 * MO);
		await ajouter(base, 280 * MO - 1);
		expect(await remplissagePhotos(base.photos)).toEqual({ octets: 400 * MO - 1, limite: 500 * MO, alerte: false });
		await ajouter(base, 1);
		expect(await remplissagePhotos(base.photos)).toEqual({ octets: 400 * MO, limite: 500 * MO, alerte: true });
	});
});
