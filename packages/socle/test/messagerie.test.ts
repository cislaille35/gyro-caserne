import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { aLeDroit, type Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { changerStatut } from '../src/actions/personnes.ts';
import { ajouterMembres, annuaire, classerSignalement, conversationAvec, creerGroupe, effacerAnciens, envoyer, exigerMessagerie, infosConversation, lireConversation, membresPourGroupe, mesConversations, modifierMessage, nommerAnimateur, nonLusTotal, phraseSysteme, photoMessage, pourVous, quitterGroupe, reagir, renommerGroupe, retirerMembre, retirerParModeration, signalements, signaler, suiteConversation, supprimerMessage } from '../src/messagerie.ts';
import { modifierMonProfil } from '../src/actions/personnes.ts';
import { REACTIONS } from '../src/listes.ts';
import { affectationEquipe, attribution, comite, conversation, equipe, journal, membreConversation, message, personne, photoMessage as photoDeMessage, profil, profilDroit, reactionMessage, responsabilite, responsabiliteDroit, signalementMessage } from '../src/schema.ts';
import { photo as octetsPhoto } from '../src/schema-photos.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-10-29T10:00';
const aujourdhui = '2026-10-29';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const acteur = (id: number): Acteur => ({ type: 'personne', id });
const minute = (n: number) => `2026-10-29T${String(10 + Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const agentId = profils.find((x) => x.nom === 'Agent')!.id;
	const exterieurId = profils.find((x) => x.typePersonne === 'exterieur')!.id;
	const responsabilites = await base.select().from(responsabilite);
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);
	const nouvelle = async (prenom: string, nom = 'Test', champs: Partial<typeof personne.$inferInsert> = {}) => {
		const [p] = await base
			.insert(personne)
			.values({ email: `${prenom.toLowerCase()}.${nom.toLowerCase()}@exemple.fr`, prenom, nom, profilId: agentId, statut: 'operationnel', ...champs })
			.returning();
		return p!.id;
	};
	const nommer = async (personneId: number, nom: string, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }) => {
		const r = responsabilites.find((x) => x.nom === nom)!.id;
		await base.insert(attribution).values({ personneId, responsabiliteId: r, perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	};
	const affecter = (personneId: number, equipeId: number) => base.insert(affectationEquipe).values({ personneId, equipeId, debut: '2026-01-01' });
	const chef = await nouvelle('Chef', 'Centre');
	await nommer(chef, 'Chef de centre', { type: 'centre' });
	const manon = await nouvelle('Manon', 'Durand');
	const romain = await nouvelle('Romain', 'Bernard');
	return { base, nouvelle, nommer, affecter, agentId, exterieurId, chef, manon, romain, e1: equipes[0]!, e2: equipes[1]! };
}

// Remplit une conversation de `n` messages de `auteur`, d'un seul coup.
async function remplir(base: Awaited<ReturnType<typeof baseDeTest>>, conversationId: number, auteur: number, n: number) {
	await base.run(
		sql`with recursive n(i) as (select 1 union all select i + 1 from n where i < ${n})
			insert into message (conversation_id, auteur, texte, cree_le, maj_le) select ${conversationId}, ${auteur}, 'Message ' || i, ${maintenant}, ${maintenant} from n`
	);
}

describe('exigerMessagerie', () => {
	it('rend l’id de l’agent qui a UTILISER_MESSAGERIE', async () => {
		const { base, manon } = await jeu();
		expect(await exigerMessagerie(base, acteur(manon), aujourdhui)).toBe(manon);
	});

	it('refuse le super administrateur, un extérieur, un agent parti, suspendu ou sans le droit', async () => {
		const { base, nouvelle, exterieurId } = await jeu();
		const [sansDroit] = await base.insert(profil).values({ nom: 'Sans messagerie', typePersonne: 'agent' }).returning();
		const ids = [
			await nouvelle('Ext', 'Rieur', { profilId: exterieurId }),
			await nouvelle('Parti', 'Test', { statut: 'parti' }),
			await nouvelle('Suspendu', 'Test', { statut: 'suspendu' }),
			await nouvelle('Sans', 'Droit', { profilId: sansDroit!.id })
		];
		for (const a of [superAdmin, ...ids.map(acteur)]) {
			const refus = await exigerMessagerie(base, a, aujourdhui).catch((e) => e);
			expect(refus).toBeInstanceOf(RefusDroit);
			expect(refus.droit).toBe('UTILISER_MESSAGERIE');
		}
	});

	it('suit la règle des droits : même réponse que aLeDroit sur le centre, cas par cas', async () => {
		const { base, nouvelle } = await jeu();
		const [sansDroit] = await base.insert(profil).values({ nom: 'Sans messagerie', typePersonne: 'agent' }).returning();
		const [parEquipe] = await base.insert(profil).values({ nom: 'Messagerie d’équipe', typePersonne: 'agent' }).returning();
		await base.insert(profilDroit).values({ profilId: parEquipe!.id, droit: 'UTILISER_MESSAGERIE', perimetreType: 'equipe', perimetreId: 1 });
		const [r] = await base.insert(responsabilite).values({ nom: 'Messager', nature: 'mission', typePerimetre: 'centre' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: r!.id, droit: 'UTILISER_MESSAGERIE' });
		const responsable = async (prenom: string, champs: Partial<typeof attribution.$inferInsert> = {}, fiche: Partial<typeof personne.$inferInsert> = { profilId: sansDroit!.id }) => {
			const id = await nouvelle(prenom, 'Test', fiche);
			await base.insert(attribution).values({ personneId: id, responsabiliteId: r!.id, perimetreType: 'centre', debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01', ...champs });
			return id;
		};
		const cas: [string, number, boolean][] = [
			['responsabilité en cours', await responsable('Encours'), true],
			['responsabilité finie hier', await responsable('Finie', { fin: '2026-10-28' }), false],
			['responsabilité finie aujourd’hui', await responsable('Finitaujourdhui', { fin: aujourdhui }), true],
			['responsabilité qui commence demain', await responsable('Demain', { debut: '2026-10-30' }), false],
			// Hors du type de périmètre de la responsabilité : ne donne rien.
			['responsabilité hors portée', await responsable('Hors', { perimetreType: 'equipe', perimetreId: 1 }), false],
			['sans profil, avec la responsabilité', await responsable('Sansprofil', {}, { profilId: null }), true],
			['stagiaire', await nouvelle('Stagiaire', 'Test', { statut: 'stagiaire' }), true],
			['inapte temporaire', await nouvelle('Inapte', 'Test', { statut: 'inapte_temporaire' }), true],
			['droit de profil limité à une équipe', await nouvelle('Equipe', 'Test', { profilId: parEquipe!.id }), false]
		];
		for (const [libelle, id, attendu] of cas) {
			expect([libelle, await aLeDroit(base, acteur(id), 'UTILISER_MESSAGERIE', { type: 'centre' }, aujourdhui)]).toEqual([libelle, attendu]);
			expect([libelle, await exigerMessagerie(base, acteur(id), aujourdhui).then(() => true, () => false)]).toEqual([libelle, attendu]);
		}
	});

	it('un extérieur à qui l’on donne UTILISER_MESSAGERIE : aLeDroit dit oui, la messagerie reste fermée', async () => {
		const { base, nouvelle, exterieurId } = await jeu();
		await base.insert(profilDroit).values({ profilId: exterieurId, droit: 'UTILISER_MESSAGERIE', perimetreType: 'centre', perimetreId: null });
		const ext = await nouvelle('Ext', 'Rieur', { profilId: exterieurId });
		expect(await aLeDroit(base, acteur(ext), 'UTILISER_MESSAGERIE', { type: 'centre' }, aujourdhui)).toBe(true);
		await expect(exigerMessagerie(base, acteur(ext), aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});
});

describe('annuaire', () => {
	it('les agents qui ont accès, sans l’acteur, triés par nom, avec leur équipe et leur rôle', async () => {
		const { base, nouvelle, nommer, affecter, exterieurId, chef, manon, romain, e1, e2 } = await jeu();
		await nouvelle('Parti', 'Aaa', { statut: 'parti' });
		await nouvelle('Suspendu', 'Aab', { statut: 'suspendu' });
		await nouvelle('Ext', 'Aac', { profilId: exterieurId });
		const eloise = await nouvelle('Éloïse', 'Émery', { surnom: 'Lolo' });
		await affecter(manon, e1.id);
		await affecter(romain, e2.id);
		await nommer(romain, 'Chef d’équipe', { type: 'equipe', id: e2.id });
		const avant = base.requetes;
		const liste = await annuaire(base, acteur(manon), aujourdhui);
		expect(base.requetes - avant).toBe(1);
		expect(liste).toEqual([
			{ id: romain, prenom: 'Romain', nom: 'Bernard', surnom: null, equipe: { numero: e2.ordreRotation, couleur: e2.couleur }, role: 'Chef d’équipe' },
			{ id: chef, prenom: 'Chef', nom: 'Centre', surnom: null, equipe: null, role: 'Chef de centre' },
			{ id: eloise, prenom: 'Éloïse', nom: 'Émery', surnom: 'Lolo', equipe: null, role: null }
		]);
	});

	it('refuse qui n’a pas la messagerie', async () => {
		const { base } = await jeu();
		await expect(annuaire(base, superAdmin, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});
});

describe('envoyer, conversation à deux', () => {
	it('crée la conversation au premier envoi, puis la réutilise ; journal sans texte', async () => {
		const { base, manon, romain } = await jeu();
		expect(await conversationAvec(base, acteur(manon), romain, aujourdhui)).toBeNull();
		const avant = base.requetes;
		const premier = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: '  Salut Romain  ' }, minute(0));
		expect(base.requetes - avant).toBe(2);
		expect(await conversationAvec(base, acteur(manon), romain, aujourdhui)).toBe(premier.conversation);
		expect(await conversationAvec(base, acteur(romain), manon, aujourdhui)).toBe(premier.conversation);

		const second = await envoyer(base, base.photos, acteur(romain), { personne: manon }, { texte: 'Salut Manon' }, minute(1));
		const troisieme = await envoyer(base, base.photos, acteur(manon), { conversation: premier.conversation }, { texte: 'Ça va ?', reponseA: second.message }, minute(2));
		expect(second.conversation).toBe(premier.conversation);
		expect(troisieme.conversation).toBe(premier.conversation);

		const [c] = await base.select().from(conversation);
		expect(c).toMatchObject({ type: 'deux', clePaire: `${Math.min(manon, romain)}:${Math.max(manon, romain)}`, creePar: manon, creeLe: minute(0), dernierLe: minute(2) });
		expect(await base.select().from(conversation)).toHaveLength(1);
		const membres = await base.select().from(membreConversation).orderBy(membreConversation.personneId);
		expect(membres.map((m) => [m.personneId, m.animateur, m.entreLe])).toEqual([
			[manon, 0, minute(0)],
			[romain, 0, minute(0)]
		]);
		const messages = await base.select().from(message).orderBy(message.id);
		expect(messages.map((m) => [m.auteur, m.texte, m.reponseA, m.creeLe, m.majLe])).toEqual([
			[manon, 'Salut Romain', null, minute(0), minute(0)],
			[romain, 'Salut Manon', null, minute(1), minute(1)],
			[manon, 'Ça va ?', second.message, minute(2), minute(2)]
		]);
		const lignes = await base.select().from(journal).where(eq(journal.cibleType, 'conversation'));
		expect(lignes).toHaveLength(1);
		expect(lignes[0]).toMatchObject({ acteur: `personne:${manon}`, action: 'creer_conversation', cibleId: premier.conversation });
		const tout = JSON.stringify(await base.select().from(journal));
		expect(tout).not.toContain('Salut');
	});

	it('deux premiers envois simultanés : une seule conversation, le second la rejoint', async () => {
		const { base, manon, romain } = await jeu();
		// Manon écrit juste après les contrôles de Romain, qui n'ont donc pas vu de conversation.
		const batch = base.batch.bind(base);
		let a: { conversation: number } | undefined;
		let fait = false;
		base.batch = (async (requetes: Parameters<typeof batch>[0]) => {
			const resultats = await batch(requetes);
			if (fait) return resultats;
			fait = true;
			a = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(0));
			return resultats;
		}) as unknown as typeof base.batch;
		const b = await envoyer(base, base.photos, acteur(romain), { personne: manon }, { texte: 'Coucou' }, minute(0));
		expect(a!.conversation).toBe(b.conversation);
		expect(await base.select().from(conversation)).toHaveLength(1);
		expect(await base.select().from(membreConversation)).toHaveLength(2);
		expect(await base.select().from(message)).toHaveLength(2);
		expect(await base.select().from(journal).where(eq(journal.action, 'creer_conversation'))).toHaveLength(1);
	});

	it('refuse un texte vide ou trop long, une réponse hors de la conversation, soi-même et une personne hors de l’annuaire', async () => {
		const { base, nouvelle, manon, romain, chef } = await jeu();
		const parti = await nouvelle('Parti', 'Test', { statut: 'parti' });
		const ailleurs = await envoyer(base, base.photos, acteur(chef), { personne: romain }, { texte: 'Ailleurs' }, minute(0));
		const essais = [
			envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: '   ' }, minute(1)),
			envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'x'.repeat(4001) }, minute(1)),
			envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Réponse', reponseA: ailleurs.message }, minute(1)),
			envoyer(base, base.photos, acteur(manon), { personne: manon }, { texte: 'Moi' }, minute(1)),
			envoyer(base, base.photos, acteur(manon), { personne: parti }, { texte: 'Parti' }, minute(1)),
			envoyer(base, base.photos, acteur(manon), { personne: 9999 }, { texte: 'Personne' }, minute(1))
		];
		for (const essai of essais) await expect(essai).rejects.toBeInstanceOf(DonneeInvalide);
		expect(await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'x'.repeat(4000) }, minute(1))).toBeTruthy();
		expect(await base.select().from(message)).toHaveLength(2);
	});

	it('un non-membre, chef de centre compris, ne peut ni lire ni écrire ; le super administrateur et un agent sans messagerie non plus', async () => {
		const { base, chef, manon, romain } = await jeu();
		const { conversation: id } = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Privé' }, minute(0));
		for (const a of [acteur(chef), superAdmin]) {
			await expect(lireConversation(base, a, id, {}, minute(1))).rejects.toBeInstanceOf(RefusDroit);
			await expect(envoyer(base, base.photos, a, { conversation: id }, { texte: 'Intrus' }, minute(1))).rejects.toBeInstanceOf(RefusDroit);
		}
		await expect(lireConversation(base, acteur(manon), 9999, {}, minute(1))).rejects.toBeInstanceOf(RefusDroit);
		// Membre qui perd la messagerie : plus rien.
		await base.update(personne).set({ statut: 'suspendu' }).where(eq(personne.id, manon));
		await expect(lireConversation(base, acteur(manon), id, {}, minute(1))).rejects.toBeInstanceOf(RefusDroit);
		await expect(envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Encore' }, minute(1))).rejects.toBeInstanceOf(RefusDroit);
		await expect(mesConversations(base, acteur(manon), minute(1))).rejects.toBeInstanceOf(RefusDroit);
		expect(await nonLusTotal(base, acteur(manon), aujourdhui)).toBe(0);
		await expect(envoyer(base, base.photos, superAdmin, { personne: romain }, { texte: 'Super' }, minute(1))).rejects.toBeInstanceOf(RefusDroit);
		expect(await base.select().from(message)).toHaveLength(1);
	});

	it('l’autre parti ou suspendu : lecture seule, plus d’envoi', async () => {
		const { base, manon, romain } = await jeu();
		const { conversation: id } = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(0));
		expect((await lireConversation(base, acteur(manon), id, {}, minute(1))).lectureSeule).toBe(false);
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, romain));
		const vue = await lireConversation(base, acteur(manon), id, {}, minute(1));
		expect(vue.lectureSeule).toBe(true);
		expect(vue.messages.map((m) => m.texte)).toEqual(['Salut']);
		await expect(envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Tu es là ?' }, minute(2))).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('lireConversation', () => {
	it('les messages du plus ancien au plus récent, réponse citée, coches, premier non-lu ; en 2 requêtes au plus', async () => {
		const { base, affecter, manon, romain, e1 } = await jeu();
		await affecter(romain, e1.id);
		const m1 = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(0));
		const id = m1.conversation;
		const m2 = await envoyer(base, base.photos, acteur(romain), { conversation: id }, { texte: 'Salut Manon, comment vas-tu ?', reponseA: m1.message }, minute(1));
		const m3 = await envoyer(base, base.photos, acteur(romain), { conversation: id }, { texte: 'Tu es de garde ?' }, minute(2));

		const avant = base.requetes;
		const vue = await lireConversation(base, acteur(manon), id, {}, minute(3));
		expect(base.requetes - avant).toBe(2);
		expect(vue).toMatchObject({ id, type: 'deux', nom: 'Romain Bernard', lectureSeule: false, premierNonLu: m2.message, plusAnciens: false });
		expect(vue.messages).toEqual([
			{ id: m1.message, auteur: { id: manon, prenom: 'Manon', nom: 'Durand', couleur: null }, texte: 'Salut', cree_le: minute(0), modifie: false, supprime: null, systeme: null, reponse: null, photos: [], reactions: [], moi: true, coche: 'lu' },
			{
				id: m2.message,
				auteur: { id: romain, prenom: 'Romain', nom: 'Bernard', couleur: e1.couleur },
				texte: 'Salut Manon, comment vas-tu ?',
				cree_le: minute(1),
				modifie: false,
				supprime: null,
				systeme: null,
				reponse: { id: m1.message, auteur: { id: manon, prenom: 'Manon', nom: 'Durand', couleur: null }, extrait: 'Salut' },
				photos: [],
				reactions: [],
				moi: false,
				coche: null
			},
			expect.objectContaining({ id: m3.message, moi: false })
		]);
		// Tout est lu : plus de premier non-lu ; côté Romain, ses messages passent à « lu ».
		expect((await lireConversation(base, acteur(manon), id, {}, minute(4))).premierNonLu).toBeNull();
		const chezRomain = await lireConversation(base, acteur(romain), id, {}, minute(4));
		expect(chezRomain.nom).toBe('Manon Durand');
		expect(chezRomain.messages.map((m) => m.coche)).toEqual([null, 'lu', 'lu']);
	});

	it('coche « envoyé » tant que l’autre n’a pas lu ou s’il a coupé ses coches ; aucune si l’acteur a coupé les siennes', async () => {
		const { base, manon, romain } = await jeu();
		const { conversation: id } = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(0));
		expect((await lireConversation(base, acteur(manon), id, {}, minute(1))).messages[0]!.coche).toBe('envoye');
		await lireConversation(base, acteur(romain), id, {}, minute(1));
		expect((await lireConversation(base, acteur(manon), id, {}, minute(1))).messages[0]!.coche).toBe('lu');
		await base.update(personne).set({ cochesLecture: 0 }).where(eq(personne.id, romain));
		expect((await lireConversation(base, acteur(manon), id, {}, minute(1))).messages[0]!.coche).toBe('envoye');
		await base.update(personne).set({ cochesLecture: 1 }).where(eq(personne.id, romain));
		await base.update(personne).set({ cochesLecture: 0 }).where(eq(personne.id, manon));
		expect((await lireConversation(base, acteur(manon), id, {}, minute(1))).messages[0]!.coche).toBeNull();
	});

	it('ne montre pas le texte d’un message supprimé', async () => {
		const { base, manon, romain } = await jeu();
		const m = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Oups' }, minute(0));
		await envoyer(base, base.photos, acteur(romain), { conversation: m.conversation }, { texte: 'Quoi ?', reponseA: m.message }, minute(1));
		await base.update(message).set({ supprime: 'auteur' }).where(eq(message.id, m.message));
		const vue = await lireConversation(base, acteur(romain), m.conversation, {}, minute(2));
		expect(vue.messages[0]).toMatchObject({ texte: '', supprime: 'auteur' });
		expect(vue.messages[1]!.reponse).toMatchObject({ id: m.message, extrait: '' });
	});

	it('2 000 messages : pages de 40, `avant` remonte, budget et paramètres tenus', async () => {
		const { base, manon, romain } = await jeu();
		const { conversation: id } = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Premier' }, minute(0));
		await remplir(base, id, romain, 1999);
		base.parametresMax = 0;
		const avant = base.requetes;
		const page = await lireConversation(base, acteur(manon), id, {}, minute(5));
		expect(base.requetes - avant).toBe(2);
		expect(page.messages).toHaveLength(40);
		expect(page.messages.at(-1)!.texte).toBe('Message 1999');
		expect(page.messages[0]!.texte).toBe('Message 1960');
		expect(page.plusAnciens).toBe(true);
		const precedente = await lireConversation(base, acteur(manon), id, { avant: page.messages[0]!.id }, minute(5));
		expect(precedente.messages.map((m) => m.texte)).toEqual(Array.from({ length: 40 }, (_, i) => `Message ${1920 + i}`));
		const debut = await lireConversation(base, acteur(manon), id, { avant: precedente.messages[0]!.id - 1918 }, minute(5));
		expect(debut.messages.map((m) => m.texte)).toEqual(['Premier', 'Message 1']);
		expect(debut.plusAnciens).toBe(false);
		expect(base.parametresMax).toBeLessThanOrEqual(100);
	});
});

describe('non-lus et liste des conversations', () => {
	it('nonLus et nonLusTotal justes, à 0 après lecture ; nonLusTotal en une requête', async () => {
		const { base, chef, manon, romain } = await jeu();
		const avecRomain = await envoyer(base, base.photos, acteur(romain), { personne: manon }, { texte: 'Un' }, minute(0));
		await envoyer(base, base.photos, acteur(romain), { conversation: avecRomain.conversation }, { texte: 'Deux' }, minute(1));
		const avecChef = await envoyer(base, base.photos, acteur(chef), { personne: manon }, { texte: 'Trois' }, minute(2));
		await envoyer(base, base.photos, acteur(manon), { conversation: avecChef.conversation }, { texte: 'Ma réponse' }, minute(3));
		await envoyer(base, base.photos, acteur(chef), { conversation: avecChef.conversation }, { texte: 'Quatre' }, minute(4));

		const avant = base.requetes;
		expect(await nonLusTotal(base, acteur(manon), aujourdhui)).toBe(3);
		expect(base.requetes - avant).toBe(1);
		expect(await nonLusTotal(base, acteur(romain), aujourdhui)).toBe(0);
		expect(await nonLusTotal(base, superAdmin, aujourdhui)).toBe(0);

		const liste = await mesConversations(base, acteur(manon), minute(5));
		expect(liste.map((c) => [c.id, c.nom, c.nonLus, c.apercu, c.dernier_le])).toEqual([
			[avecChef.conversation, 'Chef Centre', 1, 'Chef : Quatre', minute(4)],
			[avecRomain.conversation, 'Romain Bernard', 2, 'Romain : Deux', minute(1)]
		]);
		expect(liste[0]).toMatchObject({ type: 'deux', personne: { id: chef, prenom: 'Chef', nom: 'Centre', couleur: null } });

		await lireConversation(base, acteur(manon), avecRomain.conversation, {}, minute(6));
		expect(await nonLusTotal(base, acteur(manon), aujourdhui)).toBe(1);
		await lireConversation(base, acteur(manon), avecChef.conversation, {}, minute(6));
		expect(await nonLusTotal(base, acteur(manon), aujourdhui)).toBe(0);
		const apres = await mesConversations(base, acteur(manon), minute(6));
		expect(apres.map((c) => c.nonLus)).toEqual([0, 0]);

		await envoyer(base, base.photos, acteur(manon), { conversation: avecRomain.conversation }, { texte: 'Lu, merci' }, minute(7));
		const ensuite = await mesConversations(base, acteur(manon), minute(8));
		expect(ensuite.map((c) => [c.id, c.apercu])).toEqual([
			[avecRomain.conversation, 'Vous : Lu, merci'],
			[avecChef.conversation, 'Chef : Quatre']
		]);
		expect(await nonLusTotal(base, acteur(romain), aujourdhui)).toBe(1);
	});

	it('aperçu d’un message supprimé, puis d’un message système', async () => {
		const { base, manon, romain } = await jeu();
		const m = await envoyer(base, base.photos, acteur(romain), { personne: manon }, { texte: 'Secret' }, minute(0));
		await base.update(message).set({ supprime: 'auteur' }).where(eq(message.id, m.message));
		expect((await mesConversations(base, acteur(manon), minute(1)))[0]!.apercu).toBe('Message supprimé');
		await base.insert(message).values({ conversationId: m.conversation, auteur: null, texte: '', systeme: JSON.stringify({ type: 'renommage', par: romain, nom: 'Garde' }), creeLe: minute(2), majLe: minute(2) });
		expect((await mesConversations(base, acteur(manon), minute(3)))[0]!.apercu).toBe('Romain a renommé le groupe en « Garde »');
	});

	it('envoyer marque la conversation comme lue, messages reçus avant compris (voulu, comme WhatsApp)', async () => {
		const { base, manon, romain } = await jeu();
		const { conversation: id } = await envoyer(base, base.photos, acteur(romain), { personne: manon }, { texte: 'Un' }, minute(0));
		await envoyer(base, base.photos, acteur(romain), { conversation: id }, { texte: 'Deux' }, minute(1));
		expect(await nonLusTotal(base, acteur(manon), aujourdhui)).toBe(2);
		await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Réponse' }, minute(2));
		expect(await nonLusTotal(base, acteur(manon), aujourdhui)).toBe(0);
		expect((await mesConversations(base, acteur(manon), minute(3)))[0]!.nonLus).toBe(0);
		expect((await lireConversation(base, acteur(romain), id, {}, minute(3))).messages.map((x) => x.coche)).toEqual(['lu', 'lu', null]);
	});

	it('mesConversations ne montre que les conversations de l’acteur', async () => {
		const { base, chef, manon, romain } = await jeu();
		await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Privé' }, minute(0));
		expect(await mesConversations(base, acteur(chef), minute(1))).toEqual([]);
		await expect(mesConversations(base, superAdmin, minute(1))).rejects.toBeInstanceOf(RefusDroit);
	});
});

describe('phraseSysteme', () => {
	const noms = new Map([
		[1, 'Romain'],
		[2, 'Manon'],
		[3, 'Claire'],
		[4, 'Léa'],
		[5, 'Hugo']
	]);
	const phrase = (contenu: object) => phraseSysteme(JSON.stringify(contenu), noms);

	it('une phrase lisible par type de message', () => {
		expect(phrase({ type: 'creation', par: 1, membres: [2, 3] })).toBe('Romain a créé le groupe');
		expect(phrase({ type: 'ajout', par: 1, cibles: [2] })).toBe('Romain a ajouté Manon');
		expect(phrase({ type: 'retrait', par: 1, cibles: [2] })).toBe('Romain a retiré Manon');
		expect(phrase({ type: 'depart', par: 2 })).toBe('Manon a quitté le groupe');
		expect(phrase({ type: 'renommage', par: 3, nom: 'Garde de nuit' })).toBe('Claire a renommé le groupe en « Garde de nuit »');
		expect(phrase({ type: 'animateur', par: 1, cibles: [2] })).toBe('Romain a confié l’animation du groupe à Manon');
		// Sans `par` : le plus ancien membre prend le relais.
		expect(phrase({ type: 'animateur', cibles: [2] })).toBe('Manon anime désormais le groupe');
	});

	it('liste les personnes, trois au plus, et nomme « un ancien membre » qu’on ne connaît plus', () => {
		expect(phrase({ type: 'ajout', par: 1, cibles: [2, 3] })).toBe('Romain a ajouté Manon et Claire');
		expect(phrase({ type: 'ajout', par: 1, cibles: [2, 3, 4] })).toBe('Romain a ajouté Manon, Claire et Léa');
		expect(phrase({ type: 'ajout', par: 1, cibles: [2, 3, 4, 5] })).toBe('Romain a ajouté Manon, Claire et 2 autres personnes');
		expect(phrase({ type: 'depart', par: 99 })).toBe('Un ancien membre a quitté le groupe');
		expect(phrase({ type: 'retrait', par: 1, cibles: [99] })).toBe('Romain a retiré un ancien membre');
	});
});

describe('groupes', () => {
	async function jeuGroupe() {
		const j = await jeu();
		const claire = await j.nouvelle('Claire', 'Martin');
		const lea = await j.nouvelle('Léa', 'Petit');
		return { ...j, claire, lea };
	}
	const systemes = async (base: Awaited<ReturnType<typeof baseDeTest>>, id: number) =>
		(await base.select().from(message).where(eq(message.conversationId, id)).orderBy(message.id)).filter((m) => m.systeme !== null).map((m) => JSON.parse(m.systeme!));
	const membresDuGroupe = async (base: Awaited<ReturnType<typeof baseDeTest>>, id: number) =>
		(await base.select().from(membreConversation).where(eq(membreConversation.conversationId, id)).orderBy(membreConversation.personneId)).map((m) => [m.personneId, m.animateur]);

	it('creerGroupe : le créateur anime, message de création, journal ; en 2 requêtes', async () => {
		const { base, manon, romain, claire } = await jeuGroupe();
		const avant = base.requetes;
		const id = await creerGroupe(base, acteur(romain), { nom: '  Garde de nuit  ', membres: [manon, claire, manon, romain] }, minute(0));
		expect(base.requetes - avant).toBe(2);
		const [c] = await base.select().from(conversation).where(eq(conversation.id, id));
		expect(c).toMatchObject({
			type: 'groupe',
			nom: 'Garde de nuit',
			icone: 'groupe',
			clePaire: null,
			creePar: romain,
			creeLe: minute(0),
			dernierLe: minute(0)
		});
		expect(await membresDuGroupe(base, id)).toEqual([
			[manon, 0],
			[romain, 1],
			[claire, 0]
		]);
		expect(await systemes(base, id)).toEqual([{ type: 'creation', par: romain, membres: [manon, claire] }]);
		expect(await base.select().from(journal).where(eq(journal.action, 'creer_conversation'))).toMatchObject([
			{
				acteur: `personne:${romain}`,
				cibleId: id,
				details: JSON.stringify({ type: 'groupe' })
			}
		]);

		const liste = await mesConversations(base, acteur(manon), minute(1));
		expect(liste).toMatchObject([
			{
				id,
				type: 'groupe',
				nom: 'Garde de nuit',
				icone: 'groupe',
				personne: null,
				apercu: 'Romain a créé le groupe',
				nonLus: 0
			}
		]);
		const vue = await lireConversation(base, acteur(claire), id, {}, minute(1));
		expect(vue).toMatchObject({
			type: 'groupe',
			nom: 'Garde de nuit',
			lectureSeule: false
		});
		expect(vue.messages).toMatchObject([{ auteur: null, systeme: 'Romain a créé le groupe', coche: null }]);
		expect(await creerGroupe(base, acteur(manon), { nom: 'Camion', icone: 'camion', membres: [romain] }, minute(2))).toBeGreaterThan(id);
		expect((await base.select().from(conversation).where(eq(conversation.nom, 'Camion')))[0]!.icone).toBe('camion');
	});

	it('creerGroupe : nom de 1 à 60 caractères, icône connue, 2 à 60 membres de l’annuaire', async () => {
		const { base, nouvelle, manon, romain } = await jeuGroupe();
		const parti = await nouvelle('Parti', 'Test', { statut: 'parti' });
		const autres: number[] = [];
		for (let i = 0; i < 60; i++) autres.push(await nouvelle(`Agent${i}`, 'Nombreux'));
		const essais = [
			creerGroupe(base, acteur(romain), { nom: '  ', membres: [manon] }, minute(0)),
			creerGroupe(base, acteur(romain), { nom: 'x'.repeat(61), membres: [manon] }, minute(0)),
			creerGroupe(base, acteur(romain), { nom: 'Garde', icone: 'fusee', membres: [manon] }, minute(0)),
			creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [] }, minute(0)),
			creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [romain] }, minute(0)),
			creerGroupe(base, acteur(romain), { nom: 'Garde', membres: autres }, minute(0)),
			creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon, parti] }, minute(0)),
			creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon, 9999] }, minute(0)),
			creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon, 0] }, minute(0))
		];
		for (const essai of essais) await expect(essai).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(creerGroupe(base, superAdmin, { nom: 'Garde', membres: [manon] }, minute(0))).rejects.toBeInstanceOf(RefusDroit);
		expect(await base.select().from(conversation)).toHaveLength(0);
		base.parametresMax = 0;
		const id = await creerGroupe(base, acteur(romain), { nom: 'x'.repeat(60), membres: autres.slice(0, 59) }, minute(0));
		expect(base.parametresMax).toBeLessThanOrEqual(100);
		expect(await membresDuGroupe(base, id)).toHaveLength(60);
	});

	it('ajouterMembres : réservé aux animateurs, 60 au plus ; le nouvel arrivant voit l’historique, sans non-lus', async () => {
		const { base, nouvelle, manon, romain, claire, lea } = await jeuGroupe();
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon] }, minute(0));
		await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Avant Claire' }, minute(1));
		await expect(ajouterMembres(base, acteur(manon), id, [claire], minute(2))).rejects.toBeInstanceOf(RefusDroit);
		await expect(ajouterMembres(base, acteur(claire), id, [lea], minute(2))).rejects.toBeInstanceOf(RefusDroit);
		await expect(ajouterMembres(base, acteur(romain), id, [manon], minute(2))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(ajouterMembres(base, acteur(romain), id, [], minute(2))).rejects.toBeInstanceOf(DonneeInvalide);

		await ajouterMembres(base, acteur(romain), id, [claire, lea], minute(2));
		expect(await membresDuGroupe(base, id)).toEqual([
			[manon, 0],
			[romain, 1],
			[claire, 0],
			[lea, 0]
		]);
		expect((await systemes(base, id)).at(-1)).toEqual({
			type: 'ajout',
			par: romain,
			cibles: [claire, lea]
		});
		expect(await nonLusTotal(base, acteur(claire), aujourdhui)).toBe(0);
		const vue = await lireConversation(base, acteur(claire), id, {}, minute(3));
		expect(vue.messages.map((m) => m.systeme ?? m.texte)).toEqual(['Romain a créé le groupe', 'Avant Claire', 'Romain a ajouté Claire et Léa']);
		expect((await mesConversations(base, acteur(lea), minute(3)))[0]).toMatchObject({
			apercu: 'Romain a ajouté Claire et Léa',
			dernier_le: minute(2)
		});

		const autres: number[] = [];
		for (let i = 0; i < 57; i++) autres.push(await nouvelle(`Agent${i}`, 'Nombreux'));
		await expect(ajouterMembres(base, acteur(romain), id, autres, minute(4))).rejects.toBeInstanceOf(DonneeInvalide);
		// Trop d'ids : refus avant toute lecture.
		const avantCent = base.requetes;
		await expect(ajouterMembres(base, acteur(romain), id, Array.from({ length: 100 }, (_, i) => 1000 + i), minute(4))).rejects.toThrow('60 membres au plus');
		expect(base.requetes).toBe(avantCent);
		base.parametresMax = 0;
		await ajouterMembres(base, acteur(romain), id, autres.slice(0, 56), minute(4));
		expect(base.parametresMax).toBeLessThanOrEqual(100);
		expect(await membresDuGroupe(base, id)).toHaveLength(60);
	});

	it('retirerMembre : réservé aux animateurs ; le membre retiré perd tout l’accès, historique compris', async () => {
		const { base, manon, romain, claire, lea } = await jeuGroupe();
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon, claire] }, minute(0));
		await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Bonjour' }, minute(1));
		await expect(retirerMembre(base, acteur(manon), id, claire, minute(2))).rejects.toBeInstanceOf(RefusDroit);
		await expect(retirerMembre(base, acteur(romain), id, lea, minute(2))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(retirerMembre(base, acteur(romain), id, romain, minute(2))).rejects.toBeInstanceOf(DonneeInvalide);

		await retirerMembre(base, acteur(romain), id, claire, minute(2));
		expect(await membresDuGroupe(base, id)).toEqual([
			[manon, 0],
			[romain, 1]
		]);
		expect((await systemes(base, id)).at(-1)).toEqual({
			type: 'retrait',
			par: romain,
			cibles: [claire]
		});
		expect((await lireConversation(base, acteur(manon), id, {}, minute(3))).messages.at(-1)!.systeme).toBe('Romain a retiré Claire');
		await expect(lireConversation(base, acteur(claire), id, {}, minute(3))).rejects.toBeInstanceOf(RefusDroit);
		await expect(envoyer(base, base.photos, acteur(claire), { conversation: id }, { texte: 'Encore là ?' }, minute(3))).rejects.toBeInstanceOf(RefusDroit);
		await expect(infosConversation(base, acteur(claire), id, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(renommerGroupe(base, acteur(claire), id, 'Pirate', minute(3))).rejects.toBeInstanceOf(RefusDroit);
		expect(await mesConversations(base, acteur(claire), minute(3))).toEqual([]);
		expect(await nonLusTotal(base, acteur(claire), aujourdhui)).toBe(0);
	});

	it('un animateur peut retirer un autre animateur', async () => {
		const { base, manon, romain, claire } = await jeuGroupe();
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon, claire] }, minute(0));
		await nommerAnimateur(base, acteur(romain), id, manon, minute(1));
		await retirerMembre(base, acteur(manon), id, romain, minute(2));
		expect(await membresDuGroupe(base, id)).toEqual([
			[manon, 1],
			[claire, 0]
		]);
		expect((await systemes(base, id)).at(-1)).toEqual({ type: 'retrait', par: manon, cibles: [romain] });
		await expect(lireConversation(base, acteur(romain), id, {}, minute(3))).rejects.toBeInstanceOf(RefusDroit);
	});

	it('nommerAnimateur : réservé aux animateurs, pour un membre qui n’anime pas encore', async () => {
		const { base, manon, romain, claire, lea } = await jeuGroupe();
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon, claire] }, minute(0));
		await expect(nommerAnimateur(base, acteur(manon), id, claire, minute(1))).rejects.toBeInstanceOf(RefusDroit);
		await expect(nommerAnimateur(base, acteur(romain), id, lea, minute(1))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(nommerAnimateur(base, acteur(romain), id, romain, minute(1))).rejects.toBeInstanceOf(DonneeInvalide);
		await nommerAnimateur(base, acteur(romain), id, manon, minute(1));
		expect(await membresDuGroupe(base, id)).toEqual([
			[manon, 1],
			[romain, 1],
			[claire, 0]
		]);
		expect((await systemes(base, id)).at(-1)).toEqual({
			type: 'animateur',
			par: romain,
			cibles: [manon]
		});
		// Le nouvel animateur peut à son tour ajouter.
		await ajouterMembres(base, acteur(manon), id, [lea], minute(2));
		expect(await membresDuGroupe(base, id)).toHaveLength(4);
	});

	it('renommerGroupe : par tout membre, nom de 1 à 60 caractères, pas pour une conversation à deux', async () => {
		const { base, manon, romain, claire } = await jeuGroupe();
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon] }, minute(0));
		await expect(renommerGroupe(base, acteur(manon), id, ' ', minute(1))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(renommerGroupe(base, acteur(manon), id, 'x'.repeat(61), minute(1))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(renommerGroupe(base, acteur(claire), id, 'Intrus', minute(1))).rejects.toBeInstanceOf(RefusDroit);
		await renommerGroupe(base, acteur(manon), id, ' Garde de nuit ', minute(1));
		expect((await base.select().from(conversation).where(eq(conversation.id, id)))[0]).toMatchObject({ nom: 'Garde de nuit', dernierLe: minute(1) });
		expect((await systemes(base, id)).at(-1)).toEqual({
			type: 'renommage',
			par: manon,
			nom: 'Garde de nuit'
		});
		expect((await mesConversations(base, acteur(romain), minute(2)))[0]!.apercu).toBe('Manon a renommé le groupe en « Garde de nuit »');

		const { conversation: aDeux } = await envoyer(base, base.photos, acteur(manon), { personne: claire }, { texte: 'Salut' }, minute(2));
		await expect(renommerGroupe(base, acteur(manon), aDeux, 'Nous deux', minute(3))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(quitterGroupe(base, base.photos, acteur(manon), aDeux, minute(3))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(ajouterMembres(base, acteur(manon), aDeux, [romain], minute(3))).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('quitterGroupe : message de départ ; le dernier animateur parti, le plus ancien membre prend le relais', async () => {
		const { base, manon, romain, claire, lea } = await jeuGroupe();
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [claire] }, minute(0));
		await ajouterMembres(base, acteur(romain), id, [lea], minute(1));
		await ajouterMembres(base, acteur(romain), id, [manon], minute(2));
		await quitterGroupe(base, base.photos, acteur(lea), id, minute(3));
		expect((await systemes(base, id)).at(-1)).toEqual({
			type: 'depart',
			par: lea
		});
		await expect(lireConversation(base, acteur(lea), id, {}, minute(4))).rejects.toBeInstanceOf(RefusDroit);

		// Claire est la plus ancienne (entrée à la création), devant Manon, dont l'id est plus petit.
		await quitterGroupe(base, base.photos, acteur(romain), id, minute(4));
		expect(await membresDuGroupe(base, id)).toEqual([
			[manon, 0],
			[claire, 1]
		]);
		expect((await systemes(base, id)).slice(-2)).toEqual([
			{ type: 'depart', par: romain },
			{ type: 'animateur', cibles: [claire] }
		]);
		expect((await lireConversation(base, acteur(manon), id, {}, minute(5))).messages.at(-1)!.systeme).toBe('Claire anime désormais le groupe');
		expect((await infosConversation(base, acteur(claire), id, aujourdhui)).moiAnimateur).toBe(true);
	});

	it('le groupe reste utilisable avec un membre, puis est effacé, messages compris, quand le dernier s’en va', async () => {
		const { base, manon, romain, claire } = await jeuGroupe();
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon] }, minute(0));
		await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Bonjour' }, minute(1));
		await quitterGroupe(base, base.photos, acteur(manon), id, minute(2));
		await ajouterMembres(base, acteur(romain), id, [claire], minute(3));
		await quitterGroupe(base, base.photos, acteur(claire), id, minute(4));
		await quitterGroupe(base, base.photos, acteur(romain), id, minute(5));
		expect(await base.select().from(conversation)).toEqual([]);
		expect(await base.select().from(membreConversation)).toEqual([]);
		expect(await base.select().from(message)).toEqual([]);
	});

	it('infosConversation : membres avec équipe, rôle et animation ; en une requête ; membres seulement', async () => {
		const { base, nommer, affecter, manon, romain, claire, chef, e1 } = await jeuGroupe();
		await affecter(manon, e1.id);
		await nommer(romain, 'Chef d’équipe', { type: 'equipe', id: e1.id });
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', icone: 'camion', membres: [manon, claire] }, minute(0));
		const avant = base.requetes;
		const infos = await infosConversation(base, acteur(manon), id, aujourdhui);
		expect(base.requetes - avant).toBe(1);
		expect(infos).toEqual({
			type: 'groupe',
			nom: 'Garde',
			icone: 'camion',
			creePar: romain,
			membres: [
				{
					id: romain,
					prenom: 'Romain',
					nom: 'Bernard',
					animateur: true,
					equipe: null,
					role: 'Chef d’équipe'
				},
				{
					id: manon,
					prenom: 'Manon',
					nom: 'Durand',
					animateur: false,
					equipe: { numero: e1.ordreRotation, couleur: e1.couleur },
					role: null
				},
				{
					id: claire,
					prenom: 'Claire',
					nom: 'Martin',
					animateur: false,
					equipe: null,
					role: null
				}
			],
			moiAnimateur: false
		});
		expect((await infosConversation(base, acteur(romain), id, aujourdhui)).moiAnimateur).toBe(true);
		for (const a of [acteur(chef), superAdmin]) await expect(infosConversation(base, a, id, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		const { conversation: aDeux } = await envoyer(base, base.photos, acteur(manon), { personne: claire }, { texte: 'Salut' }, minute(1));
		expect(await infosConversation(base, acteur(manon), aDeux, aujourdhui)).toMatchObject({
			type: 'deux',
			nom: 'Claire Martin',
			icone: null,
			moiAnimateur: false
		});
	});

	it('un agent qui part quitte ses groupes (message, relais d’animation, groupe vide effacé) ; sa conversation à deux passe en lecture seule', async () => {
		const { base, nouvelle, manon, romain, claire } = await jeuGroupe();
		const garde = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon, claire] }, minute(0));
		const seul = await creerGroupe(base, acteur(romain), { nom: 'Seul', membres: [manon] }, minute(1));
		await quitterGroupe(base, base.photos, acteur(manon), seul, minute(2));
		const { conversation: aDeux } = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(3));
		const suspendue = await nouvelle('Suspendue', 'Test');
		const autre = await creerGroupe(base, acteur(suspendue), { nom: 'Autre', membres: [manon] }, minute(4));

		await changerStatut(base, base.photos, superAdmin, suspendue, 'suspendu', minute(5));
		expect(await membresDuGroupe(base, autre)).toEqual([
			[manon, 0],
			[suspendue, 1]
		]);

		await changerStatut(base, base.photos, superAdmin, romain, 'parti', minute(6));
		expect(await membresDuGroupe(base, garde)).toEqual([
			[manon, 1],
			[claire, 0]
		]);
		expect((await systemes(base, garde)).slice(-2)).toEqual([
			{ type: 'depart', par: romain },
			{ type: 'animateur', cibles: [manon] }
		]);
		// Daté de l'heure du départ : le rafraîchissement (maj_le) le voit.
		const derniers = (await base.select().from(message).where(eq(message.conversationId, garde)).orderBy(message.id)).slice(-2);
		expect(derniers.map((m) => [m.creeLe, m.majLe])).toEqual([
			[minute(6), minute(6)],
			[minute(6), minute(6)]
		]);
		expect((await base.select().from(conversation).where(eq(conversation.id, garde)))[0]!.dernierLe).toBe(minute(6));
		expect(await base.select().from(conversation).where(eq(conversation.id, seul))).toEqual([]);
		const vue = await lireConversation(base, acteur(manon), aDeux, {}, minute(5));
		expect(vue.lectureSeule).toBe(true);
		expect(vue.messages.map((m) => m.texte)).toEqual(['Salut']);
		expect((await lireConversation(base, acteur(manon), garde, {}, minute(5))).lectureSeule).toBe(false);
	});

	it('membresPourGroupe : les membres du jour d’une équipe ou d’un comité, sans l’acteur ni ceux qui n’ont pas la messagerie', async () => {
		const { base, nouvelle, nommer, affecter, manon, romain, claire, lea, e1, e2 } = await jeuGroupe();
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		const partie = await nouvelle('Partie', 'Test', { statut: 'parti' });
		await affecter(manon, e1.id);
		await affecter(claire, e1.id);
		await affecter(partie, e1.id);
		await affecter(lea, e2.id);
		await nommer(romain, 'Chef d’équipe', { type: 'equipe', id: e1.id });
		await nommer(lea, 'Membre de comité', { type: 'comite', id: amicale!.id });
		await nommer(claire, 'Rapporteur de comité', {
			type: 'comite',
			id: amicale!.id
		});
		const avant = base.requetes;
		const equipe1 = await membresPourGroupe(base, acteur(manon), { equipe: e1.id }, aujourdhui);
		expect(base.requetes - avant).toBe(1);
		expect({ ...equipe1, membres: equipe1.membres.sort() }).toEqual({ nom: e1.nom, icone: 'groupe', membres: [romain, claire].sort() });
		const deRomain = await membresPourGroupe(base, acteur(romain), { comite: amicale!.id }, aujourdhui);
		expect({ ...deRomain, membres: deRomain.membres.sort() }).toEqual({ nom: 'Amicale', icone: 'coeur', membres: [claire, lea].sort() });
		expect((await membresPourGroupe(base, acteur(lea), { comite: amicale!.id }, aujourdhui)).membres).toEqual([claire]);
		await expect(membresPourGroupe(base, superAdmin, { equipe: e1.id }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('membresPourGroupe : sans en être membre, on préremplit quand même (l’annuaire est public) ; équipe inconnue ou inactive, comité inconnu ou dissous refusés', async () => {
		const { base, affecter, manon, claire, e1, e2 } = await jeuGroupe();
		await affecter(claire, e2.id);
		expect(await membresPourGroupe(base, acteur(manon), { equipe: e2.id }, aujourdhui)).toEqual({ nom: e2.nom, icone: 'groupe', membres: [claire] });
		const [dissous] = await base.insert(comite).values({ nom: 'Ancien', theme: 'centre', dissousLe: '2026-01-01' }).returning();
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		for (const source of [{ equipe: 9999 }, { equipe: e1.id }, { comite: 9999 }, { comite: dissous!.id }]) {
			const refus = await membresPourGroupe(base, acteur(manon), source, aujourdhui).catch((e) => e);
			expect(refus, JSON.stringify(source)).toBeInstanceOf(DonneeInvalide);
		}
	});

	it('pourVous : mon chef d’équipe, mon équipe et mes comités en cours, seulement s’ils ont du sens ; en 1 requête', async () => {
		const { base, nouvelle, nommer, affecter, manon, romain, claire, lea, e1, e2 } = await jeuGroupe();
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		const [dissous] = await base.insert(comite).values({ nom: 'Ancien', theme: 'centre', dissousLe: '2026-01-01' }).returning();
		const [seul] = await base.insert(comite).values({ nom: 'Seul', theme: 'centre' }).returning();
		const suspendu = await nouvelle('Suspendu', 'Test', { statut: 'suspendu' });
		await affecter(manon, e1.id);
		await affecter(claire, e1.id);
		await affecter(lea, e2.id);
		await nommer(romain, 'Chef d’équipe', { type: 'equipe', id: e1.id });
		await nommer(suspendu, 'Chef d’équipe', { type: 'equipe', id: e1.id });
		for (const p of [manon, lea]) await nommer(p, 'Membre de comité', { type: 'comite', id: amicale!.id });
		await nommer(manon, 'Membre de comité', { type: 'comite', id: dissous!.id });
		await nommer(lea, 'Membre de comité', { type: 'comite', id: dissous!.id });
		await nommer(manon, 'Membre de comité', { type: 'comite', id: seul!.id });

		const avant = base.requetes;
		const vus = await pourVous(base, acteur(manon), aujourdhui);
		expect(base.requetes - avant).toBe(1);
		expect(vus).toEqual({
			chefs: [romain],
			equipes: [{ id: e1.id, numero: e1.ordreRotation, nom: e1.nom, couleur: e1.couleur, membres: 2 }],
			comites: [{ id: amicale!.id, nom: 'Amicale', icone: 'coeur', membres: 1 }]
		});
		// Le chef d'équipe : son équipe, sans chef au-dessus de lui.
		expect(await pourVous(base, acteur(romain), aujourdhui)).toMatchObject({ chefs: [], equipes: [{ id: e1.id, membres: 2 }], comites: [] });
		// Seul dans son équipe : rien.
		expect(await pourVous(base, acteur(lea), aujourdhui)).toMatchObject({ chefs: [], equipes: [], comites: [{ id: amicale!.id, membres: 1 }] });
		await expect(pourVous(base, superAdmin, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});
});

// Une photo JPEG ou WebP reconnue à ses premiers octets.
const jpeg = (taille = 10, n = 1) => {
	const o = new Uint8Array(taille);
	o.set([0xff, 0xd8, 0xff, n]);
	return { type: 'image/jpeg', donnees: o };
};
const webp = () => ({ type: 'image/webp', donnees: new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ') });

describe('photos', () => {
	it('un message de photos seules : octets dans PHOTOS d’abord, références dans l’ordre, lues par lireConversation', async () => {
		const { base, manon, romain } = await jeu();
		const avant = base.requetes;
		const m = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: '  ', photos: [jpeg(10, 1), webp()] }, minute(0));
		// Contrôles, octets, puis le message.
		expect(base.requetes - avant).toBe(3);
		const octets = await base.photos.select().from(octetsPhoto).orderBy(octetsPhoto.id);
		expect(octets.map((o) => [o.type, o.taille, o.creeLe])).toEqual([
			['image/jpeg', 10, minute(0)],
			['image/webp', 16, minute(0)]
		]);
		const refs = await base.select().from(photoDeMessage).orderBy(photoDeMessage.ordre);
		expect(refs.map((r) => [r.messageId, r.ordre, r.type, r.photoId])).toEqual([
			[m.message, 0, 'image/jpeg', octets[0]!.id],
			[m.message, 1, 'image/webp', octets[1]!.id]
		]);
		const vue = await lireConversation(base, acteur(romain), m.conversation, {}, minute(1));
		expect(vue.messages[0]).toMatchObject({ texte: '', photos: refs.map((r) => r.id) });
		expect((await mesConversations(base, acteur(manon), minute(1)))[0]!.apercu).toBe('Vous : Photo');

		const texteEtPhoto = await envoyer(base, base.photos, acteur(romain), { conversation: m.conversation }, { texte: 'Regarde', photos: [jpeg()] }, minute(2));
		expect((await lireConversation(base, acteur(manon), m.conversation, {}, minute(3))).messages.at(-1)).toMatchObject({ id: texteEtPhoto.message, texte: 'Regarde' });
	});

	it('refuse sans texte ni photo, plus de 4 photos, une photo de plus de 200 Ko, un autre format ou de faux octets ; rien n’est écrit', async () => {
		const { base, manon, romain } = await jeu();
		const png = { type: 'image/png', donnees: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) };
		const faux = { type: 'image/jpeg', donnees: new Uint8Array([1, 2, 3, 4]) };
		const essais = [
			{ texte: '' },
			{ texte: '', photos: [] },
			{ texte: 'Cinq', photos: [jpeg(), jpeg(), jpeg(), jpeg(), jpeg()] },
			{ texte: 'Lourde', photos: [jpeg(200 * 1024 + 1)] },
			{ texte: 'PNG', photos: [png] },
			{ texte: 'Faux', photos: [faux] }
		];
		const avant = base.requetes;
		for (const donnees of essais) await expect(envoyer(base, base.photos, acteur(manon), { personne: romain }, donnees, minute(0))).rejects.toBeInstanceOf(DonneeInvalide);
		expect(base.requetes - avant).toBe(0);
		expect(await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: '', photos: [jpeg(200 * 1024), jpeg(), jpeg(), webp()] }, minute(0))).toBeTruthy();
		expect(await base.photos.select().from(octetsPhoto)).toHaveLength(4);
	});

	it('message non enregistré : ses photos sont effacées de PHOTOS ; refus de lecture : rien n’est écrit', async () => {
		const { base, chef, manon, romain } = await jeu();
		const { conversation: id } = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(0));
		await expect(envoyer(base, base.photos, acteur(chef), { conversation: id }, { texte: 'Intrus', photos: [jpeg()] }, minute(1))).rejects.toBeInstanceOf(RefusDroit);
		expect(await base.photos.select().from(octetsPhoto)).toEqual([]);

		const batch = base.batch.bind(base);
		let appels = 0;
		base.batch = (async (requetes: Parameters<typeof batch>[0]) => {
			if (++appels === 2) throw new Error('D1 indisponible');
			return batch(requetes);
		}) as unknown as typeof base.batch;
		await expect(envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Photo', photos: [jpeg(), webp()] }, minute(1))).rejects.toThrow('D1 indisponible');
		expect(await base.photos.select().from(octetsPhoto)).toEqual([]);
		expect(await base.select().from(photoDeMessage)).toEqual([]);
	});

	it('deux premiers envois simultanés avec photo : une seule copie des octets', async () => {
		const { base, manon, romain } = await jeu();
		const batch = base.batch.bind(base);
		let fait = false;
		base.batch = (async (requetes: Parameters<typeof batch>[0]) => {
			const resultats = await batch(requetes);
			if (fait) return resultats;
			fait = true;
			await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(0));
			return resultats;
		}) as unknown as typeof base.batch;
		await envoyer(base, base.photos, acteur(romain), { personne: manon }, { texte: '', photos: [jpeg()] }, minute(0));
		expect(await base.select().from(conversation)).toHaveLength(1);
		const octets = await base.photos.select().from(octetsPhoto);
		expect(octets).toHaveLength(1);
		expect((await base.select().from(photoDeMessage)).map((r) => r.photoId)).toEqual([octets[0]!.id]);
	});

	it('photoMessage : servie aux membres seulement ; en 2 requêtes', async () => {
		const { base, chef, manon, romain } = await jeu();
		const photoEnvoyee = jpeg(12, 7);
		const m = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: '', photos: [photoEnvoyee] }, minute(0));
		const [ref] = await base.select().from(photoDeMessage);
		const avant = base.requetes;
		const lue = await photoMessage(base, base.photos, acteur(romain), ref!.id, aujourdhui);
		expect(base.requetes - avant).toBe(2);
		expect(lue.type).toBe('image/jpeg');
		expect([...lue.donnees]).toEqual([...photoEnvoyee.donnees]);
		for (const a of [acteur(chef), superAdmin]) await expect(photoMessage(base, base.photos, a, ref!.id, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(photoMessage(base, base.photos, acteur(romain), 9999, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(photoMessage(base, base.photos, acteur(romain), ref!.id, 'hier')).rejects.toBeInstanceOf(DonneeInvalide);
		await base.update(personne).set({ statut: 'suspendu' }).where(eq(personne.id, romain));
		await expect(photoMessage(base, base.photos, acteur(romain), ref!.id, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		expect(m).toBeTruthy();
	});

	it('photoMessage : refusée au membre retiré d’un groupe', async () => {
		const { base, nouvelle, manon, romain } = await jeu();
		const claire = await nouvelle('Claire', 'Martin');
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon, claire] }, minute(0));
		await envoyer(base, base.photos, acteur(romain), { conversation: id }, { texte: '', photos: [jpeg()] }, minute(1));
		const [ref] = await base.select().from(photoDeMessage);
		expect((await photoMessage(base, base.photos, acteur(claire), ref!.id, aujourdhui)).type).toBe('image/jpeg');
		await retirerMembre(base, acteur(romain), id, claire, minute(2));
		await expect(photoMessage(base, base.photos, acteur(claire), ref!.id, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});
});

describe('réactions', () => {
	it('six réactions fixes', () => {
		expect(REACTIONS).toEqual(['👍', '❤️', '😂', '😮', '😢', '👏']);
	});

	it('une par personne : ajoutée, changée, retirée en renvoyant la même ou null ; maj_le avance ; en 2 requêtes', async () => {
		const { base, manon, romain } = await jeu();
		const m = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(0));
		const reactions = async (qui: number) => (await lireConversation(base, acteur(qui), m.conversation, {}, minute(9))).messages[0]!.reactions;
		const avant = base.requetes;
		await reagir(base, acteur(romain), m.message, '👍', minute(1));
		expect(base.requetes - avant).toBe(2);
		await reagir(base, acteur(manon), m.message, '👍', minute(2));
		expect(await reactions(manon)).toEqual([{ emoji: '👍', nombre: 2, deMoi: true }]);
		expect((await base.select().from(message).where(eq(message.id, m.message)))[0]!.majLe).toBe(minute(2));

		await reagir(base, acteur(romain), m.message, '😂', minute(3));
		expect(await reactions(romain)).toEqual([
			{ emoji: '👍', nombre: 1, deMoi: false },
			{ emoji: '😂', nombre: 1, deMoi: true }
		]);
		await reagir(base, acteur(romain), m.message, '😂', minute(4));
		expect(await reactions(romain)).toEqual([{ emoji: '👍', nombre: 1, deMoi: false }]);
		await reagir(base, acteur(manon), m.message, null, minute(5));
		expect(await reactions(romain)).toEqual([]);
		expect(await base.select().from(reactionMessage)).toEqual([]);
		expect((await base.select().from(message).where(eq(message.id, m.message)))[0]!.majLe).toBe(minute(5));
	});

	it('refuse une réaction inconnue, un non-membre, un message supprimé ou système, une conversation en lecture seule', async () => {
		const { base, chef, manon, romain } = await jeu();
		const m = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(0));
		await expect(reagir(base, acteur(romain), m.message, '🔥' as never, minute(1))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(reagir(base, acteur(chef), m.message, '👍', minute(1))).rejects.toBeInstanceOf(RefusDroit);
		await expect(reagir(base, acteur(romain), 9999, '👍', minute(1))).rejects.toBeInstanceOf(RefusDroit);
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon] }, minute(1));
		const [creation] = await base.select().from(message).where(eq(message.conversationId, id));
		await expect(reagir(base, acteur(manon), creation!.id, '👍', minute(2))).rejects.toBeInstanceOf(DonneeInvalide);
		await supprimerMessage(base, base.photos, acteur(manon), m.message, minute(2));
		await expect(reagir(base, acteur(romain), m.message, '👍', minute(3))).rejects.toBeInstanceOf(DonneeInvalide);
		const autre = await envoyer(base, base.photos, acteur(manon), { conversation: m.conversation }, { texte: 'Encore' }, minute(3));
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, romain));
		await expect(reagir(base, acteur(manon), autre.message, '👍', minute(4))).rejects.toBeInstanceOf(DonneeInvalide);
		expect(await base.select().from(reactionMessage)).toEqual([]);
	});
});

describe('modifier et supprimer', () => {
	it('modifierMessage : l’auteur seul, 15 minutes au plus ; « modifié » et maj_le', async () => {
		const { base, manon, romain } = await jeu();
		const m = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Rdv 18 h' }, minute(0));
		await expect(modifierMessage(base, acteur(romain), m.message, 'Pirate', minute(1))).rejects.toBeInstanceOf(RefusDroit);
		const avant = base.requetes;
		await modifierMessage(base, acteur(manon), m.message, '  Rdv 19 h  ', minute(15));
		expect(base.requetes - avant).toBe(2);
		const [ligne] = await base.select().from(message).where(eq(message.id, m.message));
		expect(ligne).toMatchObject({ texte: 'Rdv 19 h', modifie: 1, majLe: minute(15), creeLe: minute(0) });
		expect((await lireConversation(base, acteur(romain), m.conversation, {}, minute(15))).messages[0]).toMatchObject({ texte: 'Rdv 19 h', modifie: true });
		await expect(modifierMessage(base, acteur(manon), m.message, 'Trop tard', minute(16))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(modifierMessage(base, acteur(manon), m.message, '  ', minute(2))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(modifierMessage(base, acteur(manon), m.message, 'x'.repeat(4001), minute(2))).rejects.toBeInstanceOf(DonneeInvalide);
		expect((await base.select().from(message).where(eq(message.id, m.message)))[0]!.texte).toBe('Rdv 19 h');
		expect(JSON.stringify(await base.select().from(journal))).not.toContain('Rdv');
	});

	it('modifierMessage : texte vidé permis s’il reste une photo ; jamais un message supprimé, système, ou d’une conversation en lecture seule', async () => {
		const { base, manon, romain } = await jeu();
		const avecPhoto = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Légende', photos: [jpeg()] }, minute(0));
		await modifierMessage(base, acteur(manon), avecPhoto.message, '', minute(1));
		expect((await base.select().from(message).where(eq(message.id, avecPhoto.message)))[0]!.texte).toBe('');
		await supprimerMessage(base, base.photos, acteur(manon), avecPhoto.message, minute(2));
		await expect(modifierMessage(base, acteur(manon), avecPhoto.message, 'Revenu', minute(3))).rejects.toBeInstanceOf(DonneeInvalide);
		const id = await creerGroupe(base, acteur(manon), { nom: 'Garde', membres: [romain] }, minute(3));
		const [creation] = await base.select().from(message).where(eq(message.conversationId, id));
		await expect(modifierMessage(base, acteur(manon), creation!.id, 'Système', minute(4))).rejects.toBeInstanceOf(RefusDroit);
		const dernier = await envoyer(base, base.photos, acteur(manon), { conversation: avecPhoto.conversation }, { texte: 'Salut' }, minute(4));
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, romain));
		await expect(modifierMessage(base, acteur(manon), dernier.message, 'Re', minute(5))).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('supprimerMessage : l’auteur seul ; texte vidé, « auteur », photos effacées dans PHOTOS, réactions retirées', async () => {
		const { base, chef, manon, romain } = await jeu();
		const garde = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Gardée', photos: [webp()] }, minute(0));
		const m = await envoyer(base, base.photos, acteur(manon), { conversation: garde.conversation }, { texte: 'Oups', photos: [jpeg(), jpeg()] }, minute(1));
		await reagir(base, acteur(romain), m.message, '😮', minute(2));
		await expect(supprimerMessage(base, base.photos, acteur(romain), m.message, minute(3))).rejects.toBeInstanceOf(RefusDroit);
		await expect(supprimerMessage(base, base.photos, acteur(chef), m.message, minute(3))).rejects.toBeInstanceOf(RefusDroit);

		await supprimerMessage(base, base.photos, acteur(manon), m.message, minute(30));
		const [ligne] = await base.select().from(message).where(eq(message.id, m.message));
		expect(ligne).toMatchObject({ texte: '', supprime: 'auteur', majLe: minute(30) });
		const octets = await base.photos.select().from(octetsPhoto);
		expect(octets.map((o) => o.type)).toEqual(['image/webp']);
		expect((await base.select().from(photoDeMessage)).map((r) => r.messageId)).toEqual([garde.message]);
		expect(await base.select().from(reactionMessage)).toEqual([]);
		const vue = await lireConversation(base, acteur(romain), m.conversation, {}, minute(31));
		expect(vue.messages.at(-1)).toMatchObject({ texte: '', supprime: 'auteur', photos: [], reactions: [] });
		await expect(supprimerMessage(base, base.photos, acteur(manon), m.message, minute(31))).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('supprimer en lecture seule', () => {
	it('l’autre est parti : on supprime encore son message, photos comprises', async () => {
		const { base, manon, romain } = await jeu();
		const m = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'À effacer', photos: [jpeg()] }, minute(0));
		await changerStatut(base, base.photos, superAdmin, romain, 'parti', minute(1));
		expect((await lireConversation(base, acteur(manon), m.conversation, {}, minute(2))).lectureSeule).toBe(true);
		await supprimerMessage(base, base.photos, acteur(manon), m.message, minute(3));
		const [ligne] = await base.select().from(message).where(eq(message.id, m.message));
		expect(ligne).toMatchObject({ texte: '', supprime: 'auteur', majLe: minute(3) });
		expect(await base.select().from(photoDeMessage)).toEqual([]);
		expect(await base.photos.select().from(octetsPhoto)).toEqual([]);
	});
});

describe('coches', () => {
	it('dans un groupe : « lu » quand tous les présents à l’envoi qui ont leurs coches l’ont lu ; aucune si l’acteur a coupé les siennes', async () => {
		const { base, nouvelle, manon, romain } = await jeu();
		const claire = await nouvelle('Claire', 'Martin');
		const lea = await nouvelle('Léa', 'Petit');
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon, claire] }, minute(0));
		const m = await envoyer(base, base.photos, acteur(romain), { conversation: id }, { texte: 'Qui est dispo ?' }, minute(1));
		const coche = async () => (await lireConversation(base, acteur(romain), id, {}, minute(9))).messages.find((x) => x.id === m.message)!.coche;
		expect(await coche()).toBe('envoye');
		await lireConversation(base, acteur(manon), id, {}, minute(2));
		expect(await coche()).toBe('envoye');
		// Claire a coupé ses coches : elle ne compte pas.
		await modifierMonProfil(base, acteur(claire), { cochesLecture: false }, aujourdhui);
		expect(await coche()).toBe('lu');
		// Léa, arrivée après l'envoi, ne compte pas non plus.
		await ajouterMembres(base, acteur(romain), id, [lea], minute(3));
		await base.update(membreConversation).set({ luJusquA: 0 }).where(eq(membreConversation.personneId, lea));
		expect(await coche()).toBe('lu');
		await modifierMonProfil(base, acteur(claire), { cochesLecture: true }, aujourdhui);
		expect(await coche()).toBe('envoye');
		await lireConversation(base, acteur(claire), id, {}, minute(4));
		expect(await coche()).toBe('lu');
		// Les messages des autres et les messages système n'ont pas de coche.
		const vue = await lireConversation(base, acteur(romain), id, {}, minute(9));
		expect(vue.messages.filter((x) => x.id !== m.message).map((x) => x.coche)).toEqual([null, null]);
		await modifierMonProfil(base, acteur(romain), { cochesLecture: false }, aujourdhui);
		expect(await coche()).toBeNull();
	});
});

describe('lireConversation avec réactions et photos', () => {
	it('tout dans la même page, sans requête de plus ; paramètres tenus', async () => {
		const { base, manon, romain } = await jeu();
		const premier = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Premier', photos: [jpeg()] }, minute(0));
		await remplir(base, premier.conversation, romain, 60);
		const [dernier] = await base.select().from(message).orderBy(sql`${message.id} desc`).limit(1);
		await reagir(base, acteur(manon), dernier!.id, '❤️', minute(1));
		await reagir(base, acteur(romain), premier.message, '👏', minute(1));
		const recent = await envoyer(base, base.photos, acteur(romain), { conversation: premier.conversation }, { texte: '', photos: [jpeg(), webp()] }, minute(2));
		base.parametresMax = 0;
		const avant = base.requetes;
		const page = await lireConversation(base, acteur(manon), premier.conversation, {}, minute(3));
		expect(base.requetes - avant).toBe(2);
		expect(base.parametresMax).toBeLessThanOrEqual(100);
		expect(page.messages.at(-1)!.photos).toHaveLength(2);
		expect(page.messages.at(-1)!.id).toBe(recent.message);
		expect(page.messages.at(-2)!.reactions).toEqual([{ emoji: '❤️', nombre: 1, deMoi: true }]);
		// Hors de la page : ni ses photos ni ses réactions ne sont lues.
		expect(page.messages.some((x) => x.id === premier.message)).toBe(false);
		const debut = await lireConversation(base, acteur(manon), premier.conversation, { avant: page.messages[0]!.id }, minute(3));
		expect(debut.messages[0]).toMatchObject({ id: premier.message, reactions: [{ emoji: '👏', nombre: 1, deMoi: false }] });
		expect(debut.messages[0]!.photos).toHaveLength(1);
	});
});

describe('groupe effacé et départ', () => {
	it('le dernier membre qui quitte efface aussi les photos (dans PHOTOS) et les réactions', async () => {
		const { base, manon, romain } = await jeu();
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon] }, minute(0));
		const m = await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: '', photos: [jpeg(), webp()] }, minute(1));
		await reagir(base, acteur(romain), m.message, '👍', minute(2));
		const ailleurs = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: '', photos: [jpeg()] }, minute(2));
		await quitterGroupe(base, base.photos, acteur(manon), id, minute(3));
		expect(await base.photos.select().from(octetsPhoto)).toHaveLength(3);
		await quitterGroupe(base, base.photos, acteur(romain), id, minute(4));
		expect(await base.select().from(conversation).where(eq(conversation.id, id))).toEqual([]);
		expect(await base.select().from(reactionMessage)).toEqual([]);
		expect((await base.select().from(photoDeMessage)).map((r) => r.messageId)).toEqual([ailleurs.message]);
		expect(await base.photos.select().from(octetsPhoto)).toHaveLength(1);
	});

	it('un parti, dernier membre de son groupe : photos et réactions effacées avec le groupe', async () => {
		const { base, manon, romain } = await jeu();
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon] }, minute(0));
		const m = await envoyer(base, base.photos, acteur(romain), { conversation: id }, { texte: 'Photo', photos: [jpeg()] }, minute(1));
		await reagir(base, acteur(manon), m.message, '👍', minute(2));
		await quitterGroupe(base, base.photos, acteur(manon), id, minute(3));
		// Un groupe qui garde un membre garde ses photos.
		const reste = await creerGroupe(base, acteur(romain), { nom: 'Reste', membres: [manon] }, minute(3));
		await envoyer(base, base.photos, acteur(romain), { conversation: reste }, { texte: '', photos: [webp()] }, minute(3));
		await changerStatut(base, base.photos, superAdmin, romain, 'parti', minute(4));
		expect((await base.select().from(conversation)).map((c) => c.id)).toEqual([reste]);
		expect(await base.select().from(reactionMessage)).toEqual([]);
		expect(await base.select().from(photoDeMessage)).toHaveLength(1);
		expect((await base.photos.select().from(octetsPhoto)).map((o) => o.type)).toEqual(['image/webp']);
	});
});

describe('suiteConversation', () => {
	it('renvoie les nouveaux et les modifiés depuis le dernier passage, en 3 requêtes au plus ; l’acteur a lu', async () => {
		const { base, manon, romain } = await jeu();
		const m1 = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(0));
		const id = m1.conversation;
		const vue = await lireConversation(base, acteur(romain), id, {}, minute(1));
		// Le repère part 10 secondes avant : une écriture en cours au même instant n'est pas perdue.
		expect(vue.majLe).toBe('2026-10-29T10:00:50');
		await modifierMessage(base, acteur(manon), m1.message, 'Salut Romain', minute(2));
		const m2 = await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Tu es là ?' }, minute(3));
		const groupe = await creerGroupe(base, acteur(manon), { nom: 'Garde', membres: [romain] }, minute(3));
		await envoyer(base, base.photos, acteur(manon), { conversation: groupe }, { texte: 'Ailleurs' }, minute(3));

		base.parametresMax = 0;
		const avant = base.requetes;
		const suite = await suiteConversation(base, acteur(romain), id, { dernierId: m1.message, majLe: vue.majLe }, minute(4));
		expect(base.requetes - avant).toBeLessThanOrEqual(3);
		expect(base.parametresMax).toBeLessThanOrEqual(100);
		expect(suite.nouveaux.map((m) => [m.id, m.texte, m.moi])).toEqual([[m2.message, 'Tu es là ?', false]]);
		expect(suite.modifies.map((m) => [m.id, m.texte, m.modifie])).toEqual([[m1.message, 'Salut Romain', true]]);
		expect(suite.majLe).toBe('2026-10-29T10:03:50');
		// Lu jusqu'au dernier : seul le message du groupe reste à lire.
		expect(suite.nonLusTotal).toBe(1);
		const [lu] = await base
			.select()
			.from(membreConversation)
			.where(and(eq(membreConversation.conversationId, id), eq(membreConversation.personneId, romain)));
		expect(lu!.luJusquA).toBe(m2.message);

		// Rien de neuf : rien ne revient, rien n'est écrit, une requête.
		const avantVide = base.requetes;
		const vide = await suiteConversation(base, acteur(romain), id, { dernierId: m2.message, majLe: suite.majLe }, minute(5));
		expect(base.requetes - avantVide).toBe(1);
		expect(vide).toMatchObject({ nouveaux: [], modifies: [], nonLusTotal: 1 });

		// Supprimé pendant que Romain lit (vigilance 3).
		await supprimerMessage(base, base.photos, acteur(manon), m2.message, minute(6));
		const apres = await suiteConversation(base, acteur(romain), id, { dernierId: m2.message, majLe: vide.majLe }, minute(7));
		expect(apres.modifies).toEqual([expect.objectContaining({ id: m2.message, texte: '', supprime: 'auteur' })]);
	});

	it('la coche passe à « lu » chez l’auteur au passage suivant, que l’autre ouvre la conversation ou réponde', async () => {
		const { base, manon, romain } = await jeu();
		const m = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(0));
		const id = m.conversation;
		const vue = await lireConversation(base, acteur(manon), id, {}, minute(1));
		expect(vue.messages[0]!.coche).toBe('envoye');
		await lireConversation(base, acteur(romain), id, {}, minute(2));
		const suite = await suiteConversation(base, acteur(manon), id, { dernierId: m.message, majLe: vue.majLe }, minute(3));
		expect(suite.modifies.map((x) => [x.id, x.coche])).toEqual([[m.message, 'lu']]);

		const m2 = await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Tu viens ?' }, minute(4));
		const reponse = await envoyer(base, base.photos, acteur(romain), { conversation: id }, { texte: 'Oui' }, minute(5));
		const apres = await suiteConversation(base, acteur(manon), id, { dernierId: m2.message, majLe: suite.majLe }, minute(6));
		expect(apres.nouveaux.map((x) => x.id)).toEqual([reponse.message]);
		expect(apres.modifies.map((x) => [x.id, x.coche])).toEqual([[m2.message, 'lu']]);
	});

	it('plus de 40 nouveaux : les 40 plus anciens, puis la suite au passage suivant', async () => {
		const { base, manon, romain } = await jeu();
		const m = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Premier' }, minute(0));
		const vue = await lireConversation(base, acteur(romain), m.conversation, {}, minute(1));
		await remplir(base, m.conversation, manon, 50);
		const suite = await suiteConversation(base, acteur(romain), m.conversation, { dernierId: m.message, majLe: vue.majLe }, minute(2));
		expect(suite.nouveaux.map((x) => x.texte)).toEqual(Array.from({ length: 40 }, (_, i) => `Message ${i + 1}`));
		expect(suite.nonLusTotal).toBe(10);
		const fin = await suiteConversation(base, acteur(romain), m.conversation, { dernierId: suite.nouveaux.at(-1)!.id, majLe: suite.majLe }, minute(3));
		expect(fin.nouveaux.map((x) => x.texte)).toEqual(Array.from({ length: 10 }, (_, i) => `Message ${i + 41}`));
		expect(fin.nonLusTotal).toBe(0);
	});

	it('refuse un membre retiré, un non-membre, le super administrateur et un repère invalide', async () => {
		const { base, chef, manon, romain } = await jeu();
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon] }, minute(0));
		const vue = await lireConversation(base, acteur(manon), id, {}, minute(1));
		const depuis = { dernierId: vue.messages.at(-1)!.id, majLe: vue.majLe };
		await suiteConversation(base, acteur(manon), id, depuis, minute(2));
		await retirerMembre(base, acteur(romain), id, manon, minute(3));
		for (const a of [acteur(manon), acteur(chef), superAdmin]) await expect(suiteConversation(base, a, id, depuis, minute(4))).rejects.toBeInstanceOf(RefusDroit);
		await expect(suiteConversation(base, acteur(romain), id, { dernierId: -1, majLe: vue.majLe }, minute(4))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(suiteConversation(base, acteur(romain), id, { dernierId: 1, majLe: 'hier' }, minute(4))).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('signalements', () => {
	it('signaler : un membre, une fois, ni son propre message, ni un message système ou supprimé ; journal sans texte ; en 2 requêtes', async () => {
		const { base, chef, manon, romain } = await jeu();
		const m = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Texte grave', photos: [jpeg()] }, minute(0));
		const supprime = await envoyer(base, base.photos, acteur(manon), { conversation: m.conversation }, { texte: 'Oups' }, minute(0));
		await supprimerMessage(base, base.photos, acteur(manon), supprime.message, minute(0));
		await expect(signaler(base, acteur(manon), m.message, minute(1))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(signaler(base, acteur(chef), m.message, minute(1))).rejects.toBeInstanceOf(RefusDroit);
		await expect(signaler(base, acteur(romain), supprime.message, minute(1))).rejects.toBeInstanceOf(DonneeInvalide);
		const avant = base.requetes;
		await signaler(base, acteur(romain), m.message, minute(1));
		expect(base.requetes - avant).toBe(2);
		await expect(signaler(base, acteur(romain), m.message, minute(2))).rejects.toBeInstanceOf(DonneeInvalide);
		const groupe = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon] }, minute(2));
		const [systeme] = await base.select().from(message).where(eq(message.conversationId, groupe));
		await expect(signaler(base, acteur(manon), systeme!.id, minute(3))).rejects.toBeInstanceOf(DonneeInvalide);

		const [photoId] = (await base.select().from(photoDeMessage)).map((p) => p.photoId);
		expect(await base.select().from(signalementMessage)).toEqual([
			expect.objectContaining({ messageId: m.message, par: romain, le: minute(1), auteur: manon, envoyeLe: minute(0), texteCopie: 'Texte grave', photosCopie: JSON.stringify([photoId]), classeLe: null })
		]);
		const lignes = await base.select().from(journal).where(eq(journal.action, 'signaler_message'));
		expect(lignes).toEqual([expect.objectContaining({ acteur: `personne:${romain}`, cibleType: 'message', cibleId: m.message })]);
		expect(JSON.stringify(await base.select().from(journal))).not.toContain('grave');
	});

	it('la copie survit à la suppression par l’auteur, photos comprises ; seul le modérateur la voit', async () => {
		const { base, chef, manon, romain } = await jeu();
		const m = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Texte grave', photos: [jpeg()] }, minute(0));
		await signaler(base, acteur(romain), m.message, minute(1));
		await supprimerMessage(base, base.photos, acteur(manon), m.message, minute(2));
		expect(await base.photos.select().from(octetsPhoto)).toHaveLength(1);
		const [ligne] = await base.select().from(signalementMessage);
		expect(await signalements(base, acteur(chef), aujourdhui)).toEqual([
			{
				id: ligne!.id,
				le: minute(1),
				par: { id: romain, prenom: 'Romain', nom: 'Bernard' },
				auteur: { id: manon, prenom: 'Manon', nom: 'Durand' },
				envoye_le: minute(0),
				texte: 'Texte grave',
				photos: JSON.parse(ligne!.photosCopie),
				retirable: false
			}
		]);
		for (const a of [manon, romain]) await expect(signalements(base, acteur(a), aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('un modérateur non membre n’obtient que le message signalé', async () => {
		const { base, chef, manon, romain } = await jeu();
		const bonjour = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Bonjour Romain' }, minute(0));
		const id = bonjour.conversation;
		const m = await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Texte grave', photos: [jpeg()] }, minute(1));
		await envoyer(base, base.photos, acteur(romain), { conversation: id }, { texte: 'Réponse privée' }, minute(2));
		await signaler(base, acteur(romain), m.message, minute(3));
		const tout = JSON.stringify(await signalements(base, acteur(chef), aujourdhui));
		expect(tout).toContain('Texte grave');
		expect(tout).toContain('"retirable":true');
		expect(tout).not.toContain('Bonjour');
		expect(tout).not.toContain('privée');
		await expect(lireConversation(base, acteur(chef), id, {}, minute(4))).rejects.toBeInstanceOf(RefusDroit);
		await expect(suiteConversation(base, acteur(chef), id, { dernierId: m.message, majLe: minute(0) }, minute(4))).rejects.toBeInstanceOf(RefusDroit);
		const [p] = await base.select().from(photoDeMessage);
		await expect(photoMessage(base, base.photos, acteur(chef), p!.id, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('retirerParModeration : « retiré par la modération », signalements du message classés, copie et photos effacées ; journal sans texte', async () => {
		const { base, nouvelle, chef, manon, romain } = await jeu();
		const claire = await nouvelle('Claire', 'Martin');
		const id = await creerGroupe(base, acteur(manon), { nom: 'Garde', membres: [romain, claire] }, minute(0));
		const m = await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Texte grave', photos: [jpeg()] }, minute(1));
		await reagir(base, acteur(romain), m.message, '😮', minute(1));
		const garde = await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Autre', photos: [webp()] }, minute(1));
		await signaler(base, acteur(romain), m.message, minute(2));
		await signaler(base, acteur(claire), m.message, minute(2));
		const [s1, s2] = await signalements(base, acteur(chef), aujourdhui);
		expect(s2!.par.id).toBe(claire);
		await expect(retirerParModeration(base, base.photos, acteur(romain), s1!.id, minute(3))).rejects.toBeInstanceOf(RefusDroit);

		await retirerParModeration(base, base.photos, acteur(chef), s1!.id, minute(3));
		const [ligne] = await base.select().from(message).where(eq(message.id, m.message));
		expect(ligne).toMatchObject({ texte: '', supprime: 'moderation', majLe: minute(3) });
		expect(await base.select().from(reactionMessage)).toEqual([]);
		expect((await base.select().from(photoDeMessage)).map((p) => p.messageId)).toEqual([garde.message]);
		expect((await base.photos.select().from(octetsPhoto)).map((o) => o.type)).toEqual(['image/webp']);
		expect((await base.select().from(signalementMessage)).map((s) => [s.classeLe, s.texteCopie, s.photosCopie])).toEqual([
			[minute(3), '', '[]'],
			[minute(3), '', '[]']
		]);
		expect(await signalements(base, acteur(chef), aujourdhui)).toEqual([]);
		const vue = await lireConversation(base, acteur(romain), id, {}, minute(4));
		expect(vue.messages.find((x) => x.id === m.message)).toMatchObject({ texte: '', supprime: 'moderation', photos: [], reactions: [] });
		const lignes = await base.select().from(journal).where(eq(journal.action, 'retirer_message'));
		expect(lignes).toEqual([expect.objectContaining({ acteur: `personne:${chef}`, cibleType: 'message', cibleId: m.message })]);
		expect(JSON.stringify(await base.select().from(journal))).not.toContain('grave');
		await expect(retirerParModeration(base, base.photos, acteur(chef), s1!.id, minute(5))).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('classerSignalement : copie effacée ; les photos restent tant que le message les montre, sinon elles partent', async () => {
		const { base, chef, manon, romain } = await jeu();
		const garde = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Gardé', photos: [jpeg()] }, minute(0));
		const efface = await envoyer(base, base.photos, acteur(manon), { conversation: garde.conversation }, { texte: 'Effacé', photos: [webp()] }, minute(1));
		await signaler(base, acteur(romain), garde.message, minute(2));
		await signaler(base, acteur(romain), efface.message, minute(2));
		await supprimerMessage(base, base.photos, acteur(manon), efface.message, minute(3));
		expect(await base.photos.select().from(octetsPhoto)).toHaveLength(2);
		const [s1, s2] = await signalements(base, acteur(chef), aujourdhui);
		await expect(classerSignalement(base, base.photos, acteur(manon), s1!.id, minute(4))).rejects.toBeInstanceOf(RefusDroit);

		await classerSignalement(base, base.photos, acteur(chef), s1!.id, minute(4));
		await classerSignalement(base, base.photos, acteur(chef), s2!.id, minute(4));
		expect((await base.photos.select().from(octetsPhoto)).map((o) => o.type)).toEqual(['image/jpeg']);
		expect((await base.select().from(signalementMessage)).map((s) => [s.classeLe, s.texteCopie, s.photosCopie])).toEqual([
			[minute(4), '', '[]'],
			[minute(4), '', '[]']
		]);
		expect((await base.select().from(message).where(eq(message.id, garde.message)))[0]).toMatchObject({ texte: 'Gardé', supprime: null });
		expect(await signalements(base, acteur(chef), aujourdhui)).toEqual([]);
		const lignes = await base.select().from(journal).where(eq(journal.action, 'classer_signalement'));
		expect(lignes.map((l) => [l.acteur, l.cibleType, l.cibleId])).toEqual([
			[`personne:${chef}`, 'signalement', s1!.id],
			[`personne:${chef}`, 'signalement', s2!.id]
		]);
		const tout = JSON.stringify(await base.select().from(journal));
		expect(tout).not.toContain('Gardé');
		expect(tout).not.toContain('Effacé');
		await expect(classerSignalement(base, base.photos, acteur(chef), s1!.id, minute(5))).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(classerSignalement(base, base.photos, acteur(chef), 9999, minute(5))).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('groupe vidé : le signalement survit, avec sa copie et ses photos, jusqu’au classement', async () => {
		const { base, chef, manon, romain } = await jeu();
		const id = await creerGroupe(base, acteur(romain), { nom: 'Garde', membres: [manon] }, minute(0));
		const m = await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Texte grave', photos: [jpeg()] }, minute(1));
		await signaler(base, acteur(romain), m.message, minute(2));
		await quitterGroupe(base, base.photos, acteur(manon), id, minute(3));
		await quitterGroupe(base, base.photos, acteur(romain), id, minute(4));
		expect(await base.select().from(conversation)).toEqual([]);
		expect(await base.photos.select().from(octetsPhoto)).toHaveLength(1);
		expect((await base.select().from(signalementMessage))[0]!.messageId).toBeNull();
		const [s] = await signalements(base, acteur(chef), aujourdhui);
		expect(s).toMatchObject({ texte: 'Texte grave', retirable: false, photos: [expect.any(Number)] });
		await expect(retirerParModeration(base, base.photos, acteur(chef), s!.id, minute(5))).rejects.toBeInstanceOf(DonneeInvalide);
		await classerSignalement(base, base.photos, acteur(chef), s!.id, minute(5));
		expect(await base.photos.select().from(octetsPhoto)).toEqual([]);
	});
});

describe('effacerAnciens', () => {
	it('efface messages, réactions et photos d’avant la date, sauf les signalements non classés ; la conversation reste', async () => {
		const { base, chef, manon, romain } = await jeu();
		const vieux = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Vieux', photos: [jpeg()] }, '2026-10-28T23:59');
		const id = vieux.conversation;
		await reagir(base, acteur(romain), vieux.message, '👍', '2026-10-29T08:00');
		const signale = await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Vieux signalé', photos: [webp()] }, '2026-10-28T10:00');
		await signaler(base, acteur(romain), signale.message, '2026-10-28T11:00');
		// Un vieux signalement classé part aussi.
		const classe = await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Classé' }, '2026-10-01T10:00');
		await signaler(base, acteur(romain), classe.message, '2026-10-01T11:00');
		const aClasser = (await signalements(base, acteur(chef), aujourdhui)).find((s) => s.texte === 'Classé')!;
		await classerSignalement(base, base.photos, acteur(chef), aClasser.id, '2026-10-02T10:00');
		const recent = await envoyer(base, base.photos, acteur(manon), { conversation: id }, { texte: 'Récent', photos: [jpeg(12)] }, '2026-10-29T00:00');

		await expect(effacerAnciens(base, base.photos, 'hier')).rejects.toBeInstanceOf(DonneeInvalide);
		await effacerAnciens(base, base.photos, '2026-10-29');
		expect((await base.select().from(message)).map((m) => m.texte)).toEqual(['Récent']);
		expect(await base.select().from(reactionMessage)).toEqual([]);
		expect((await base.select().from(photoDeMessage)).map((p) => p.messageId)).toEqual([recent.message]);
		expect((await base.photos.select().from(octetsPhoto)).map((o) => [o.type, o.taille]).sort()).toEqual([
			['image/jpeg', 12],
			['image/webp', 16]
		]);
		expect((await base.select().from(signalementMessage)).map((s) => s.texteCopie)).toEqual(['Vieux signalé']);
		expect((await signalements(base, acteur(chef), aujourdhui)).map((s) => s.texte)).toEqual(['Vieux signalé']);
		expect((await lireConversation(base, acteur(manon), id, {}, maintenant)).messages.map((m) => m.texte)).toEqual(['Récent']);

		// Une conversation vidée reste.
		await effacerAnciens(base, base.photos, '2026-12-01');
		expect((await mesConversations(base, acteur(manon), maintenant)).map((c) => c.id)).toEqual([id]);
		expect((await lireConversation(base, acteur(manon), id, {}, maintenant)).messages).toEqual([]);
	});
});
