import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { aLeDroit, type Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { annuaire, conversationAvec, envoyer, exigerMessagerie, lireConversation, mesConversations, nonLusTotal } from '../src/messagerie.ts';
import { affectationEquipe, attribution, conversation, equipe, journal, membreConversation, message, personne, profil, profilDroit, responsabilite, responsabiliteDroit } from '../src/schema.ts';
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
	const nommer = async (personneId: number, nom: string, perimetre: { type: 'centre' | 'equipe'; id?: number }) => {
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

	it('refuse un texte vide ou trop long, des photos (pas encore), une réponse hors de la conversation, soi-même et une personne hors de l’annuaire', async () => {
		const { base, nouvelle, manon, romain, chef } = await jeu();
		const parti = await nouvelle('Parti', 'Test', { statut: 'parti' });
		const ailleurs = await envoyer(base, base.photos, acteur(chef), { personne: romain }, { texte: 'Ailleurs' }, minute(0));
		const essais = [
			envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: '   ' }, minute(1)),
			envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'x'.repeat(4001) }, minute(1)),
			envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Photo', photos: [{ type: 'image/jpeg', donnees: new Uint8Array([0xff, 0xd8, 0xff]) }] }, minute(1)),
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

	it('coche « envoyé » tant que l’autre n’a pas lu, et si l’un des deux a coupé ses coches', async () => {
		const { base, manon, romain } = await jeu();
		const { conversation: id } = await envoyer(base, base.photos, acteur(manon), { personne: romain }, { texte: 'Salut' }, minute(0));
		expect((await lireConversation(base, acteur(manon), id, {}, minute(1))).messages[0]!.coche).toBe('envoye');
		await lireConversation(base, acteur(romain), id, {}, minute(1));
		expect((await lireConversation(base, acteur(manon), id, {}, minute(1))).messages[0]!.coche).toBe('lu');
		await base.update(personne).set({ cochesLecture: 0 }).where(eq(personne.id, romain));
		expect((await lireConversation(base, acteur(manon), id, {}, minute(1))).messages[0]!.coche).toBe('envoye');
		await base.update(personne).set({ cochesLecture: 1 }).where(eq(personne.id, romain));
		await base.update(personne).set({ cochesLecture: 0 }).where(eq(personne.id, manon));
		expect((await lireConversation(base, acteur(manon), id, {}, minute(1))).messages[0]!.coche).toBe('envoye');
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
		await base.insert(message).values({ conversationId: m.conversation, auteur: null, texte: '', systeme: 'Romain a renommé le groupe', creeLe: minute(2), majLe: minute(2) });
		expect((await mesConversations(base, acteur(manon), minute(3)))[0]!.apercu).toBe('Romain a renommé le groupe');
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
