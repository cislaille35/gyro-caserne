import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { commenter } from '../src/actions/interactions.ts';
import { changerStatut } from '../src/actions/personnes.ts';
import { lireMur, lirePublication, publier, supprimerPublication } from '../src/actions/publications.ts';
import { creerGroupe, envoyer, nombreSignalements } from '../src/messagerie.ts';
import { nombreAValider } from '../src/reservations.ts';
import { avis as avisDEte } from '../src/planning/avis.ts';
import { avisAnomalies } from '../src/anomalies-avis.ts';
import {
	abonner,
	couper,
	desabonner,
	effacerVieillesNotifications,
	enTeteDe,
	filDeNotifications,
	mesNotifications,
	estCoupe,
	marquerLue,
	notifierCommentaire,
	notifierMessage,
	notifierPublication,
	ESSAIS_MAX,
	finirEnvois,
	prendreEnvois,
	toutMarquerLu
} from '../src/notifications.ts';
import { abonnementPush, affectationEquipe, attribution, avisAnomalie, avisEte, coupure, demandeRemplacement, envoiPush, equipe, notification, personne, profil, reservation, responsabilite, ressource, signalementMessage } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-10-31T10:00';
const aujourdhui = '2026-10-31';
const acteur = (id: number): Acteur => ({ type: 'personne', id });
const heure = (hm: string) => new Date(`2026-10-31T${hm}:00Z`);
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

// Chef de centre (sans équipe), Alice (équipe 1), Bruno et Chloé (équipe 2). Chacun a un téléphone abonné.
async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);
	const e1 = equipes[0]!;
	const e2 = equipes[1]!;
	const nouvelle = async (prenom: string, equipeId?: number) => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning();
		if (equipeId) await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId, debut: '2026-01-01' });
		await abonner(base, acteur(p!.id), { endpoint: `https://fcm.googleapis.com/fcm/send/${prenom}`, p256dh: 'BCle', auth: 'secret', appareil: 'Téléphone' }, maintenant);
		return p!.id;
	};
	const chef = await nouvelle('Chef');
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: chef, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const alice = await nouvelle('Alice', e1.id);
	const bruno = await nouvelle('Bruno', e2.id);
	const chloe = await nouvelle('Chloe', e2.id);
	// Les notifications de qui, et les envois en file vers quels téléphones.
	const fil = async () => (await base.select({ personneId: notification.personneId }).from(notification)).map((n) => n.personneId).sort((a, b) => a - b);
	const file = async () => {
		const lignes = await base.select({ endpoint: abonnementPush.endpoint, donnees: envoiPush.donnees }).from(envoiPush).innerJoin(abonnementPush, eq(abonnementPush.id, envoiPush.abonnementId));
		return lignes.map((l) => ({ a: l.endpoint.split('/').pop(), ...JSON.parse(l.donnees) })).sort((x, y) => x.a.localeCompare(y.a));
	};
	const vider = () => base.batch([base.delete(notification), base.delete(envoiPush)]);
	return { base, e1, e2, chef, alice, bruno, chloe, fil, file, vider, nouvelle };
}

const tri = (...ids: number[]) => ids.sort((a, b) => a - b);

describe('notifierPublication', () => {
	it('mur d’équipe : ses membres et le chef de centre, jamais l’auteur ; titre, début du texte, adresse', async () => {
		const { base, e2, chef, bruno, chloe, fil, file } = await jeu();
		const id = await publier(base, base.photos, acteur(bruno), `equipe:${e2.id}`, { type: 'message', texte: `Manœuvre samedi ${'x'.repeat(200)}` }, maintenant);
		await notifierPublication(base, id, maintenant);
		expect(await fil()).toEqual(tri(chef, chloe));
		const envois = await file();
		expect(envois.map((e) => e.a)).toEqual(['Chef', 'Chloe']);
		expect(envois[0]).toMatchObject({ titre: `${e2.nom} · Bruno Test`, url: `/echanges/equipe:${e2.id}/${id}`, tag: `publication:${id}` });
		expect(envois[0].texte).toHaveLength(100);
		expect(envois[0].texte.startsWith('Manœuvre samedi')).toBe(true);
		expect(envois[0].texte.endsWith('…')).toBe(true);
	});

	it('« Le centre » : tous les agents sauf l’auteur ; publication du super administrateur : tout le monde', async () => {
		const { base, chef, alice, bruno, chloe, fil, vider } = await jeu();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note' }, maintenant), maintenant);
		expect(await fil()).toEqual(tri(alice, bruno, chloe));
		await vider();
		await notifierPublication(base, await publier(base, base.photos, superAdmin, 'centre', { type: 'message', texte: 'Note' }, maintenant), maintenant);
		expect(await fil()).toEqual(tri(chef, alice, bruno, chloe));
	});

	it('150 agents : 2 appels à la base, 100 paramètres au plus', async () => {
		const { base, chef, nouvelle, fil } = await jeu();
		for (let i = 0; i < 146; i++) await nouvelle(`Agent${i}`);
		const id = await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note' }, maintenant);
		const avant = base.requetes;
		base.parametresMax = 0;
		await notifierPublication(base, id, maintenant);
		expect(base.requetes - avant).toBe(2);
		expect(base.parametresMax).toBeLessThanOrEqual(100);
		expect(await fil()).toHaveLength(149);
	});

	it('publication inconnue : rien', async () => {
		const { base, fil } = await jeu();
		await notifierPublication(base, 999, maintenant);
		expect(await fil()).toEqual([]);
	});
});

describe('notifierCommentaire', () => {
	it('l’auteur de la publication seulement, jamais s’il commente lui-même', async () => {
		const { base, e2, bruno, chloe, fil, file, vider } = await jeu();
		const id = await publier(base, base.photos, acteur(bruno), `equipe:${e2.id}`, { type: 'message', texte: 'Manœuvre' }, maintenant);
		await notifierCommentaire(base, await commenter(base, acteur(chloe), id, 'J’y serai', maintenant), maintenant);
		expect(await fil()).toEqual([bruno]);
		expect(await file()).toMatchObject([{ a: 'Bruno', titre: 'Chloe Test a commenté votre publication', texte: 'J’y serai', url: `/echanges/equipe:${e2.id}/${id}`, tag: `commentaires:${id}` }]);
		await vider();
		await notifierCommentaire(base, await commenter(base, acteur(bruno), id, 'Merci', maintenant), maintenant);
		expect(await fil()).toEqual([]);
	});

	it('publication du super administrateur ou d’un auteur qui ne lit plus le mur : personne', async () => {
		const { base, e2, alice, bruno, chloe, fil } = await jeu();
		const sup = await publier(base, base.photos, superAdmin, 'vie', { type: 'message', texte: 'Bonjour' }, maintenant);
		await notifierCommentaire(base, await commenter(base, acteur(alice), sup, 'Bonjour', maintenant), maintenant);
		const id = await publier(base, base.photos, acteur(bruno), `equipe:${e2.id}`, { type: 'message', texte: 'Manœuvre' }, maintenant);
		await base.update(affectationEquipe).set({ fin: '2026-10-30' }).where(eq(affectationEquipe.personneId, bruno));
		await notifierCommentaire(base, await commenter(base, acteur(chloe), id, 'Oui', maintenant), maintenant);
		expect(await fil()).toEqual([]);
	});
});

describe('notifierMessage', () => {
	it('à deux : l’autre au téléphone, rien dans le fil ; en groupe : les autres membres', async () => {
		const { base, alice, bruno, chloe, fil, file, vider } = await jeu();
		const envoi = await envoyer(base, base.photos, acteur(alice), { personne: bruno }, { texte: 'Salut Bruno' }, maintenant);
		await notifierMessage(base, envoi.message, maintenant);
		expect(await fil()).toEqual([]);
		expect(await file()).toMatchObject([{ a: 'Bruno', titre: 'Message de Alice', texte: 'Salut Bruno', url: `/echanges/messages/${envoi.conversation}`, tag: `conversation:${envoi.conversation}` }]);
		await vider();
		const groupe = await creerGroupe(base, acteur(alice), { nom: 'Départ de Thomas', membres: [bruno, chloe] }, maintenant);
		const m = await envoyer(base, base.photos, acteur(chloe), { conversation: groupe }, { texte: 'On fait un pot' }, maintenant);
		await notifierMessage(base, m.message, maintenant);
		expect((await file()).map((e) => [e.a, e.titre])).toEqual([
			['Alice', 'Départ de Thomas · Chloe'],
			['Bruno', 'Départ de Thomas · Chloe']
		]);
	});

	it('message avec photo seule : « Photo »', async () => {
		const { base, alice, bruno, file } = await jeu();
		const photo = new Uint8Array(100);
		photo.set([0xff, 0xd8, 0xff, 0xe0]);
		const envoi = await envoyer(base, base.photos, acteur(alice), { personne: bruno }, { texte: '', photos: [{ type: 'image/jpeg', donnees: photo }] }, maintenant);
		await notifierMessage(base, envoi.message, maintenant);
		expect(await file()).toMatchObject([{ texte: 'Photo' }]);
	});
});

describe('couper', () => {
	it('« tout » et un mur retirent du téléphone, pas du fil ; réactiver', async () => {
		const { base, e2, chef, bruno, chloe, fil, file, vider } = await jeu();
		await couper(base, acteur(chloe), 'tout', true, maintenant);
		await couper(base, acteur(chef), `mur:equipe:${e2.id}`, true, maintenant);
		const publierEtNotifier = async () => notifierPublication(base, await publier(base, base.photos, acteur(bruno), `equipe:${e2.id}`, { type: 'message', texte: 'Manœuvre' }, maintenant), maintenant);
		await publierEtNotifier();
		expect(await fil()).toEqual(tri(chef, chloe));
		expect(await file()).toEqual([]);
		expect(await estCoupe(base, acteur(chef), `mur:equipe:${e2.id}`)).toBe(true);
		await vider();
		await couper(base, acteur(chloe), 'tout', false, maintenant);
		await publierEtNotifier();
		expect((await file()).map((e) => e.a)).toEqual(['Chloe']);
	});

	it('un mur coupé coupe aussi les commentaires sous ses propres publications', async () => {
		const { base, e2, bruno, chloe, fil, file } = await jeu();
		await couper(base, acteur(bruno), `mur:equipe:${e2.id}`, true, maintenant);
		const id = await publier(base, base.photos, acteur(bruno), `equipe:${e2.id}`, { type: 'message', texte: 'Manœuvre' }, maintenant);
		await notifierCommentaire(base, await commenter(base, acteur(chloe), id, 'Oui', maintenant), maintenant);
		expect(await fil()).toEqual([bruno]);
		expect(await file()).toEqual([]);
	});

	it('une conversation coupée : celle-là seulement', async () => {
		const { base, alice, bruno, chloe, file } = await jeu();
		const groupe = await creerGroupe(base, acteur(alice), { nom: 'Pot', membres: [bruno, chloe] }, maintenant);
		await couper(base, acteur(bruno), `conversation:${groupe}`, true, maintenant);
		await notifierMessage(base, (await envoyer(base, base.photos, acteur(alice), { conversation: groupe }, { texte: 'Vendredi' }, maintenant)).message, maintenant);
		await notifierMessage(base, (await envoyer(base, base.photos, acteur(alice), { personne: bruno }, { texte: 'Et toi ?' }, maintenant)).message, maintenant);
		expect((await file()).map((e) => [e.a, e.texte])).toEqual([
			['Bruno', 'Et toi ?'],
			['Chloe', 'Vendredi']
		]);
	});

	it('refuse un lieu inconnu, un mur illisible, une conversation dont on n’est pas membre, le super administrateur', async () => {
		const { base, e1, alice, bruno, chloe } = await jeu();
		const groupe = await creerGroupe(base, acteur(alice), { nom: 'Pot', membres: [bruno] }, maintenant);
		await expect(couper(base, acteur(bruno), 'ailleurs', true, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(couper(base, acteur(bruno), `mur:equipe:${e1.id}`, true, maintenant)).rejects.toThrow(RefusDroit);
		await expect(couper(base, acteur(chloe), `conversation:${groupe}`, true, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(couper(base, superAdmin, 'tout', true, maintenant)).rejects.toThrow(DonneeInvalide);
		expect(await base.select().from(coupure)).toEqual([]);
	});

	it('mesNotifications : « tout », les lieux coupés nommés, les appareils', async () => {
		const { base, e2, alice, bruno } = await jeu();
		const groupe = await creerGroupe(base, acteur(alice), { nom: 'Pot', membres: [bruno] }, maintenant);
		const deux = await envoyer(base, base.photos, acteur(alice), { personne: bruno }, { texte: 'Salut' }, maintenant);
		for (const lieu of [`mur:equipe:${e2.id}`, 'mur:vie', `conversation:${groupe}`, `conversation:${deux.conversation}`]) await couper(base, acteur(bruno), lieu, true, maintenant);
		await abonner(base, acteur(bruno), { endpoint: 'https://fcm.googleapis.com/fcm/send/Bruno-tablette', p256dh: 'BCle', auth: 'secret', appareil: 'Tablette' }, maintenant);
		expect(await mesNotifications(base, acteur(bruno), aujourdhui)).toEqual({
			tout: false,
			appareils: 2,
			coupes: [
				{ lieu: 'mur:vie', nom: 'Vie du centre' },
				{ lieu: `mur:equipe:${e2.id}`, nom: e2.nom },
				{ lieu: `conversation:${deux.conversation}`, nom: 'Alice Test' },
				{ lieu: `conversation:${groupe}`, nom: 'Pot' }
			]
		});
	});
});

describe('le fil et la cloche', () => {
	it('filDeNotifications : publication et commentaire, plus récent d’abord, auteur, mur, extrait ; en 1 requête', async () => {
		const { base, e2, bruno, chloe } = await jeu();
		const id = await publier(base, base.photos, acteur(bruno), `equipe:${e2.id}`, { type: 'message', texte: 'Manœuvre samedi' }, '2026-10-31T09:00');
		await notifierPublication(base, id, '2026-10-31T09:00');
		const sous = await publier(base, base.photos, acteur(chloe), 'vie', { type: 'message', texte: 'Gâteau' }, '2026-10-31T09:30');
		await notifierPublication(base, sous, '2026-10-31T09:30');
		await notifierCommentaire(base, await commenter(base, acteur(bruno), sous, 'Merci !', '2026-10-31T09:45'), '2026-10-31T09:45');
		const avant = base.requetes;
		const { lignes, nonLues } = await filDeNotifications(base, acteur(chloe), maintenant);
		expect(base.requetes - avant).toBe(1);
		expect(nonLues).toBe(2);
		expect(lignes).toEqual([
			{ id: expect.any(Number), type: 'commentaire', cle: 'vie', nomMur: 'Vie du centre', publicationId: sous, auteur: { prenom: 'Bruno', nom: 'Test', couleur: e2.couleur }, extrait: 'Merci !', creeLe: '2026-10-31T09:45', lue: false },
			{ id: expect.any(Number), type: 'publication', cle: `equipe:${e2.id}`, nomMur: e2.nom, publicationId: id, auteur: { prenom: 'Bruno', nom: 'Test', couleur: e2.couleur }, extrait: 'Manœuvre samedi', creeLe: '2026-10-31T09:00', lue: false }
		]);
	});

	it('enTeteDe : non-lues et visage en 1 requête ; super administrateur sans requête', async () => {
		const { base, e2, chef, bruno } = await jeu();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note' }, maintenant), maintenant);
		const avant = base.requetes;
		expect(await enTeteDe(base, acteur(bruno), aujourdhui)).toEqual({ nonLues: 1, remplacementsAValider: 0, visage: { prenom: 'Bruno', nom: 'Test', couleur: e2.couleur } });
		expect(base.requetes - avant).toBe(1);
		expect(await enTeteDe(base, acteur(chef), aujourdhui)).toEqual({ nonLues: 0, remplacementsAValider: 0, visage: { prenom: 'Chef', nom: 'Test', couleur: null } });
		const ensuite = base.requetes;
		expect(await enTeteDe(base, superAdmin, aujourdhui)).toEqual({ nonLues: 0, remplacementsAValider: 0, visage: null });
		expect(base.requetes).toBe(ensuite);
	});

	it('ouvrir le mur marque lues ses publications, pas les commentaires ; ouvrir la publication marque tout', async () => {
		const { base, e2, bruno, chloe } = await jeu();
		const id = await publier(base, base.photos, acteur(bruno), `equipe:${e2.id}`, { type: 'message', texte: 'Manœuvre' }, maintenant);
		await notifierPublication(base, id, maintenant);
		await notifierPublication(base, await publier(base, base.photos, acteur(bruno), 'vie', { type: 'message', texte: 'Vie' }, maintenant), maintenant);
		await notifierCommentaire(base, await commenter(base, acteur(bruno), await publier(base, base.photos, acteur(chloe), 'vie', { type: 'message', texte: 'Moi' }, maintenant), 'Oui', maintenant), maintenant);
		const nonLues = async () => (await enTeteDe(base, acteur(chloe), aujourdhui)).nonLues;
		expect(await nonLues()).toBe(3);
		const avant = base.requetes;
		await lireMur(base, acteur(chloe), `equipe:${e2.id}`, {}, maintenant);
		expect(base.requetes - avant).toBe(3);
		expect(await nonLues()).toBe(2);
		await lirePublication(base, acteur(chloe), id, maintenant);
		expect(await nonLues()).toBe(2);
		const [commentee] = await base.select({ publicationId: notification.publicationId }).from(notification).where(eq(notification.personneId, chloe)).orderBy(notification.id).limit(10).offset(2);
		await lirePublication(base, acteur(chloe), commentee!.publicationId, maintenant);
		expect(await nonLues()).toBe(1);
		await toutMarquerLu(base, acteur(chloe), maintenant);
		expect(await nonLues()).toBe(0);
		expect((await filDeNotifications(base, acteur(chloe), maintenant)).lignes.every((l) => l.lue)).toBe(true);
	});

	it('une publication supprimée part du fil', async () => {
		const { base, chef, bruno } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note' }, maintenant);
		await notifierPublication(base, id, maintenant);
		await supprimerPublication(base, base.photos, acteur(chef), id, maintenant);
		expect((await filDeNotifications(base, acteur(bruno), maintenant)).lignes).toEqual([]);
	});

	it('marquerLue : ouvrir une ligne de la cloche la marque lue, quel que soit son genre, pour soi seul, en 1 requête', async () => {
		const { base, chef, bruno, chloe } = await jeu();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note' }, maintenant), maintenant);
		// L'avis d'été mène au planning, qui ne marque rien : seule la cloche peut le marquer.
		await base.insert(avisEte).values([bruno, chloe].map((personneId) => ({ personneId, quoi: 'repartition' as const, texte: 'Planning d’été : renfort', url: '/planning', creeLe: maintenant })));
		await base.insert(avisAnomalie).values({ personneId: chloe, titre: 'Prise de garde · VSAV', texte: '1 anomalie', url: '/engins/anomalies?engin=1', creeLe: maintenant });
		const nonLues = async (id: number) => (await enTeteDe(base, acteur(id), aujourdhui)).nonLues;
		expect([await nonLues(bruno), await nonLues(chloe)]).toEqual([2, 3]);
		const lignes = (await filDeNotifications(base, acteur(chloe), maintenant)).lignes;
		const avant = base.requetes;
		for (const l of lignes) await marquerLue(base, acteur(chloe), l.type, l.id, maintenant);
		expect(base.requetes - avant).toBe(3);
		expect([await nonLues(bruno), await nonLues(chloe)]).toEqual([2, 0]);
		// La ligne d'un autre n'est pas touchée, même avec son identifiant.
		const deBruno = (await filDeNotifications(base, acteur(bruno), maintenant)).lignes.find((l) => l.type === 'ete')!;
		await marquerLue(base, acteur(chloe), 'ete', deBruno.id, maintenant);
		expect(await nonLues(bruno)).toBe(2);
		for (const genre of ['reservation', 'remplacement', 'commentaire']) await marquerLue(base, acteur(chloe), genre, 999, maintenant);
		await expect(marquerLue(base, acteur(chloe), 'inconnu', 1, maintenant)).rejects.toThrow(DonneeInvalide);
		const ensuite = base.requetes;
		await marquerLue(base, superAdmin, 'ete', deBruno.id, maintenant);
		expect(base.requetes).toBe(ensuite);
	});

	it('le fil garde les 50 plus récentes', async () => {
		const { base, chef, bruno } = await jeu();
		for (let i = 0; i < 52; i++) await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: `Note ${i}` }, maintenant), maintenant);
		const { lignes, nonLues } = await filDeNotifications(base, acteur(bruno), maintenant);
		expect(lignes).toHaveLength(50);
		expect(lignes[0]).toMatchObject({ extrait: 'Note 51' });
		expect(nonLues).toBe(52);
	});
});

describe('abonnements et file d’envoi', () => {
	it('un même appareil n’est abonné qu’une fois, au dernier agent ; adresse non https refusée ; désabonner', async () => {
		const { base, alice, bruno } = await jeu();
		await abonner(base, acteur(bruno), { endpoint: 'https://fcm.googleapis.com/fcm/send/Alice', p256dh: 'BAutre', auth: 'autre', appareil: 'Prêté' }, maintenant);
		const lignes = await base.select().from(abonnementPush).where(eq(abonnementPush.endpoint, 'https://fcm.googleapis.com/fcm/send/Alice'));
		expect(lignes).toMatchObject([{ personneId: bruno, p256dh: 'BAutre', auth: 'autre' }]);
		await expect(abonner(base, acteur(alice), { endpoint: 'http://push.exemple/x', p256dh: 'B', auth: 'a', appareil: '' }, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(abonner(base, acteur(alice), { endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: '', auth: 'a', appareil: '' }, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(abonner(base, superAdmin, { endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: 'B', auth: 'a', appareil: '' }, maintenant)).rejects.toThrow(DonneeInvalide);
		// On ne désabonne que les siens.
		await desabonner(base, acteur(alice), 'https://fcm.googleapis.com/fcm/send/Bruno');
		await desabonner(base, acteur(bruno), 'https://fcm.googleapis.com/fcm/send/Bruno');
		expect((await base.select().from(abonnementPush)).map((a) => a.endpoint.split('/').pop()).sort()).toEqual(['Alice', 'Chef', 'Chloe']);
	});

	it('seuls les services push connus sont acceptés : le Worker ne poste jamais ailleurs', async () => {
		const { base, alice } = await jeu();
		for (const endpoint of ['https://exemple.org/n', 'https://fcm.googleapis.com.exemple.org/x', 'https://push.apple.com@exemple.org/x', `https://fcm.googleapis.com/${'x'.repeat(1000)}`])
			await expect(abonner(base, acteur(alice), { endpoint, p256dh: 'BCle', auth: 'secret', appareil: '' }, maintenant)).rejects.toThrow(DonneeInvalide);
		for (const endpoint of ['https://fcm.googleapis.com/fcm/send/a', 'https://updates.push.services.mozilla.com/wpush/v2/b', 'https://web.push.apple.com/c', 'https://wns2-par02p.notify.windows.com/w/?token=d'])
			await abonner(base, acteur(alice), { endpoint, p256dh: 'BCle', auth: 'secret', appareil: '' }, maintenant);
		await expect(abonner(base, acteur(alice), { endpoint: 'https://fcm.googleapis.com/fcm/send/z', p256dh: 'B+/', auth: 'secret', appareil: '' }, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('dix appareils au plus par agent : le plus ancien laisse sa place', async () => {
		const { base, bruno } = await jeu();
		for (let i = 0; i < 11; i++) await abonner(base, acteur(bruno), { endpoint: `https://fcm.googleapis.com/fcm/send/b${i}`, p256dh: 'BCle', auth: 'secret', appareil: '' }, maintenant);
		const siens = (await base.select().from(abonnementPush).where(eq(abonnementPush.personneId, bruno))).map((a) => a.endpoint.split('/').pop());
		expect(siens).toHaveLength(10);
		expect(siens).not.toContain('Bruno');
		expect(siens).toContain('b10');
	});

	it('un appareil repris par un autre agent ne reçoit pas les envois encore en file pour le premier', async () => {
		const { base, chef, bruno, file } = await jeu();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Pour Alice' }, maintenant), maintenant);
		await abonner(base, acteur(bruno), { endpoint: 'https://fcm.googleapis.com/fcm/send/Alice', p256dh: 'BCle', auth: 'secret', appareil: '' }, maintenant);
		expect((await file()).map((e) => e.a)).toEqual(['Bruno', 'Chloe']);
	});

	it('prendreEnvois : les plus anciens d’abord, réservés sans être retirés ; finirEnvois les retire, avec les abonnements périmés', async () => {
		const { base, chef, file } = await jeu();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note' }, maintenant), maintenant);
		const lot = await prendreEnvois(base, 2, heure('10:00'));
		expect(lot.envois).toHaveLength(2);
		expect(lot.envois[0]).toMatchObject({ endpoint: 'https://fcm.googleapis.com/fcm/send/Alice', p256dh: 'BCle', auth: 'secret', essais: 1, donnees: { titre: 'Le centre · Chef Test', tag: expect.any(String) } });
		expect(await file()).toHaveLength(3);
		const suivant = await prendreEnvois(base, 2, heure('10:00'));
		expect(suivant.envois.map((e) => e.endpoint.split('/').pop())).toEqual(['Chloe']);
		await finirEnvois(base, lot.jeton, [lot.envois[0]!.abonnementId]);
		expect((await file()).map((e) => e.a)).toEqual(['Chloe']);
		expect(await base.select().from(abonnementPush).where(eq(abonnementPush.endpoint, 'https://fcm.googleapis.com/fcm/send/Alice'))).toEqual([]);
		await finirEnvois(base, suivant.jeton, []);
		expect(await file()).toEqual([]);
		expect((await prendreEnvois(base, 2, heure('10:00'))).envois).toEqual([]);
	});

	it('envoi coupé (lot jamais fini) : repris au passage suivant, cinq minutes après la réservation, jamais avant', async () => {
		const { base, chef } = await jeu();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note' }, maintenant), maintenant);
		const coupe = await prendreEnvois(base, 2, heure('10:00'));
		expect((await prendreEnvois(base, 40, heure('10:04'))).envois.map((e) => e.id)).not.toContain(coupe.envois[0]!.id);
		const repris = await prendreEnvois(base, 40, heure('10:05'));
		expect(repris.envois.map((e) => e.id)).toEqual(coupe.envois.map((e) => e.id));
		expect(repris.envois.map((e) => e.essais)).toEqual([2, 2]);
		await finirEnvois(base, coupe.jeton, []);
		expect(await base.select().from(envoiPush).where(eq(envoiPush.jeton, repris.jeton))).toHaveLength(2);
	});

	// La base de test est synchrone : les deux passages s'enchaînent. Sur D1, la réservation est une transaction.
	it('deux passages en même temps ne prennent jamais les mêmes envois', async () => {
		const { base, chef } = await jeu();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note' }, maintenant), maintenant);
		const [a, b] = await Promise.all([prendreEnvois(base, 2, heure('10:00')), prendreEnvois(base, 2, heure('10:00'))]);
		const ids = [...a!.envois, ...b!.envois].map((e) => e.id);
		expect(ids).toHaveLength(3);
		expect(new Set(ids).size).toBe(3);
	});

	it('prendreEnvois : chaque envoi porte la pastille de sa personne, le nombre de sa cloche, compté pour tout le lot dans la même requête', async () => {
		const { base, e2, chef, alice, bruno, chloe } = await jeu();
		// Le chef : un message signalé à traiter, une réservation à trancher, un remplacement à valider. Alice : un avis d'été. Bruno : tout lu.
		await base.insert(signalementMessage).values({ par: alice, le: maintenant, auteur: bruno, envoyeLe: maintenant, texteCopie: 'x' });
		const [chefCentre] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
		const [salle] = await base.insert(ressource).values({ nom: 'Salle', forme: 'creneau', icone: 'cle', gereeParResponsabiliteId: chefCentre!.id, creeLe: maintenant }).returning();
		await base.insert(reservation).values({ ressourceId: salle!.id, personneId: alice, debut: '2026-11-02T10:00', fin: '2026-11-02T12:00', etat: 'attente', creeLe: maintenant });
		await base.insert(avisEte).values({ personneId: alice, quoi: 'rappel', texte: 'Donnez vos vacances', url: '/moi/vacances', creeLe: maintenant });
		// Un remplacement à valider : l'équipe 2 n'a pas de chef de garde, c'est au chef de centre.
		await base.insert(demandeRemplacement).values({ genre: 'remplacement', demandeurId: bruno, remplacantId: chloe, equipeId: e2.id, periodes: '[]', debut: '2026-11-02T08:00', etat: 'a_valider', creeLe: maintenant });
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Un' }, maintenant), maintenant);
		await notifierPublication(base, await publier(base, base.photos, acteur(alice), 'vie', { type: 'message', texte: 'Deux' }, maintenant), maintenant);
		await toutMarquerLu(base, acteur(bruno), maintenant);
		const avant = base.requetes;
		const lot = await prendreEnvois(base, 40, heure('10:00'), maintenant);
		expect(base.requetes - avant).toBe(1);
		// La cloche de l'en-tête des pages (+layout.server.ts) : non lues, remplacements à valider, signalements, réservations à trancher.
		const cloche = async (id: number) => {
			const e = await enTeteDe(base, acteur(id), aujourdhui, maintenant);
			return e.nonLues + e.remplacementsAValider + (await nombreSignalements(base, acteur(id), aujourdhui)) + (await nombreAValider(base, acteur(id), aujourdhui));
		};
		const pastilles = Object.fromEntries(lot.envois.map((e) => [e.personneId, e.pastille]));
		expect(pastilles).toEqual({ [chef]: 4, [alice]: 2, [bruno]: 0, [chloe]: 2 });
		for (const id of [chef, alice, bruno, chloe]) expect(pastilles[id], `personne ${id}`).toBe(await cloche(id));
	});

	it('avis d’été et d’anomalie (leur page ne les marque pas lus) : l’envoi porte la ligne de la cloche de sa personne ; ailleurs, rien', async () => {
		const { base, chef, alice, bruno, file, vider } = await jeu();
		const lignes = async (t: typeof avisEte | typeof avisAnomalie) => (await base.select({ id: t.id, personneId: t.personneId }).from(t).orderBy(t.id)).map((l) => l.id);
		await base.batch(avisDEte(base, [alice, bruno], 'rappel', 'Donnez vos vacances', '/moi/vacances', maintenant) as never);
		const [deAlice, deBruno] = await lignes(avisEte);
		expect((await file()).map((e) => [e.a, e.lue])).toEqual([['Alice', { genre: 'ete', id: deAlice }], ['Bruno', { genre: 'ete', id: deBruno }]]);
		// Deux avis à la même personne dans un même batch : chaque envoi porte le sien.
		await vider();
		await base.batch([...avisDEte(base, [alice], 'rappel', 'Un', '/moi/vacances', maintenant), ...avisDEte(base, [alice], 'repartition', 'Deux', '/planning', maintenant)] as never);
		const [, , un, deux] = await lignes(avisEte);
		expect((await file()).map((e) => [e.texte, e.lue.id])).toEqual([['Un', un], ['Deux', deux]]);
		await vider();
		await base.batch(avisAnomalies(base, [alice], { titre: 'FPT · Phare', texte: 'Signalée', url: '/engins/anomalies/1' }, maintenant) as never);
		expect((await file()).map((e) => e.lue)).toEqual([{ genre: 'anomalie', id: (await lignes(avisAnomalie))[0] }]);
		// Une publication (sa page la marque lue) ou un message (sans ligne de cloche) : l'adresse directe.
		await vider();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note' }, maintenant), maintenant);
		const envoi = await envoyer(base, base.photos, acteur(alice), { personne: bruno }, { texte: 'Salut' }, maintenant);
		await notifierMessage(base, envoi.message, maintenant);
		expect((await file()).every((e) => e.lue === undefined)).toBe(true);
	});

	it(`coupé ${ESSAIS_MAX} fois : l’envoi est abandonné, retiré de la file`, async () => {
		const { base, chef } = await jeu();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note' }, maintenant), maintenant);
		for (let i = 0; i < ESSAIS_MAX; i++) expect((await prendreEnvois(base, 1, heure(`1${i}:00`))).envois).toHaveLength(1);
		// Son dernier essai est peut-être encore en cours : rien n'est abandonné avant cinq minutes.
		await prendreEnvois(base, 1, heure('12:04'));
		expect(await base.select().from(envoiPush)).toHaveLength(3);
		const avertir = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const apres = await prendreEnvois(base, 1, heure('19:00'));
		expect(avertir).toHaveBeenCalledWith('Notifications abandonnées après des envois coupés', 1);
		avertir.mockRestore();
		expect(apres.envois).toHaveLength(1);
		expect(await base.select().from(envoiPush)).toHaveLength(2);
	});
});

describe('départ et ménage', () => {
	it('au départ : abonnements, notifications et coupures effacés', async () => {
		const { base, chef, bruno } = await jeu();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note' }, maintenant), maintenant);
		await couper(base, acteur(bruno), 'tout', true, maintenant);
		await changerStatut(base, base.photos, acteur(chef), bruno, 'parti', maintenant);
		expect(await base.select().from(abonnementPush).where(eq(abonnementPush.personneId, bruno))).toEqual([]);
		expect(await base.select().from(notification).where(eq(notification.personneId, bruno))).toEqual([]);
		expect(await base.select().from(coupure).where(eq(coupure.personneId, bruno))).toEqual([]);
	});

	it('effacerVieillesNotifications : avant la date, notifications et envois en file effacés ; après, gardés', async () => {
		const { base, chef, fil } = await jeu();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Vieille' }, '2026-09-01T10:00'), '2026-09-01T10:00');
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Neuve' }, maintenant), maintenant);
		await effacerVieillesNotifications(base, '2026-10-01');
		expect(await fil()).toHaveLength(3);
		expect(await base.select().from(envoiPush)).toHaveLength(3);
	});
});
