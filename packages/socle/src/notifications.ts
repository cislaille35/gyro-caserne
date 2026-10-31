import { and, asc, count, desc, eq, inArray, isNull, lt, ne, notExists, notInArray, sql, type SQL } from 'drizzle-orm';
import type { Base } from './base.ts';
import { exigerDate, exigerDateHeure } from './dates.ts';
import type { Acteur } from './droits.ts';
import { DonneeInvalide } from './erreurs.ts';
import { aLaMessagerie } from './messagerie.ts';
import { agentsDuJour, estMembre, exigerMur, lecturesAgents, type CleMur } from './murs.ts';
import { abonnementPush, affectationEquipe, comite, commentaire, conversation, coupure, envoiPush, equipe, membreConversation, message, notification, personne, publication } from './schema.ts';

// Les notifications : le fil de la cloche (publications et commentaires reçus), les appareils abonnés, ce que la personne a coupé,
// et la file des envois au téléphone. Les destinataires sont ceux qui peuvent lire au moment de l'envoi, jamais l'auteur.

const EXTRAIT = 100;
const FIL_MAX = 50;

export type DonneesPush = { titre: string; texte: string; url: string; tag: string };
export type LigneFil = {
	id: number;
	type: 'publication' | 'commentaire';
	cle: CleMur;
	nomMur: string;
	publicationId: number;
	auteur: { prenom: string; nom: string; couleur: string | null };
	extrait: string;
	creeLe: string;
	lue: boolean;
};

// Le début du texte, sur une ligne ; coupé, il finit par « … ».
function extrait(texte: string): string {
	const ligne = texte.replace(/\s+/g, ' ').trim();
	return ligne.length > EXTRAIT ? `${ligne.slice(0, EXTRAIT - 1).trimEnd()}…` : ligne;
}
const idPersonne = (auteur: string | null) => {
	const id = /^personne:(\d+)$/.exec(auteur ?? '')?.[1];
	return id === undefined ? null : Number(id);
};
// Une liste d'identifiants en un seul paramètre (D1 : 100 paramètres au plus).
const parmi = (ids: number[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;

const auteurDe = (texte: SQL | string) => sql`'personne:' || ${personne.id} = ${texte}`;

// Couleur de l'équipe en cours d'une personne (colonne écrite en entier : dans une sous-requête, drizzle ne la qualifierait pas).
const couleurDe = (aujourdhui: string) =>
	sql<string | null>`(select e.couleur from ${affectationEquipe} a join ${equipe} e on e.id = a.equipe_id where a.personne_id = "personne"."id" and a.debut <= ${aujourdhui} and (a.fin is null or a.fin >= ${aujourdhui}) order by a.debut desc limit 1)`;

function nomDuMur(cle: string, equipes: { id: number; nom: string }[], comites: { id: number; nom: string }[]): string {
	if (cle === 'centre') return 'Le centre';
	if (cle === 'vie') return 'Vie du centre';
	const [type, numero] = cle.split(':');
	const liste = type === 'equipe' ? equipes : comites;
	return liste.find((x) => x.id === Number(numero))?.nom ?? '';
}

const nomsDesMurs = (base: Base) => [base.select({ id: equipe.id, nom: equipe.nom }).from(equipe), base.select({ id: comite.id, nom: comite.nom }).from(comite)] as const;

const moiDe = (acteur: Acteur) => {
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux personnes ayant une fiche');
	return acteur.id;
};

// Écritures : le fil, puis un envoi par appareil des destinataires qui n'ont coupé ni tout, ni ce lieu.
function ecrireFil(base: Base, ids: number[], publicationId: number, commentaireId: number | null, maintenant: string) {
	return base.insert(notification).select(
		base
			.select({
				id: sql<number | null>`null`.as('id'),
				personneId: personne.id,
				publicationId: sql<number>`${publicationId}`.as('publication_id'),
				commentaireId: sql<number | null>`${commentaireId}`.as('commentaire_id'),
				creeLe: sql<string>`${maintenant}`.as('cree_le'),
				lueLe: sql<string | null>`null`.as('lue_le')
			})
			.from(personne)
			.where(inArray(personne.id, parmi(ids)))
	);
}

function mettreEnFile(base: Base, ids: number[], lieu: string, donnees: DonneesPush, maintenant: string) {
	const coupe = base
		.select({ un: sql`1` })
		.from(coupure)
		.where(and(eq(coupure.personneId, abonnementPush.personneId), inArray(coupure.lieu, ['tout', lieu])));
	return base.insert(envoiPush).select(
		base
			.select({ id: sql<number | null>`null`.as('id'), abonnementId: abonnementPush.id, donnees: sql<string>`${JSON.stringify(donnees)}`.as('donnees'), creeLe: sql<string>`${maintenant}`.as('cree_le') })
			.from(abonnementPush)
			.where(and(inArray(abonnementPush.personneId, parmi(ids)), notExists(coupe)))
	);
}

const nomComplet = (p: { prenom: string; nom: string } | undefined, auteur: string) => (auteur.startsWith('super:') ? 'Super administrateur' : `${p?.prenom ?? ''} ${p?.nom ?? ''}`.trim());

// Une publication : tous ses lecteurs du jour. Une lecture, une écriture.
export async function notifierPublication(base: Base, id: number, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const [lignes, agents, affectations, tenues, equipes, comites, auteurs] = await base.batch([
		base.select({ mur: publication.mur, auteur: publication.auteur, texte: publication.texte }).from(publication).where(eq(publication.id, id)),
		...lecturesAgents(base, aujourdhui),
		...nomsDesMurs(base),
		base
			.select({ prenom: personne.prenom, nom: personne.nom })
			.from(personne)
			.where(auteurDe(sql`(select ${publication.auteur} from ${publication} where ${publication.id} = ${id})`))
	]);
	const p = lignes[0];
	if (!p) return;
	const auteur = idPersonne(p.auteur);
	const ids = agentsDuJour([agents, affectations, tenues], aujourdhui)
		.filter((x) => x.id !== auteur && (x.a.tous || estMembre(x.a, p.mur)))
		.map((x) => x.id);
	if (ids.length === 0) return;
	const donnees = { titre: `${nomDuMur(p.mur, equipes, comites)} · ${nomComplet(auteurs[0], p.auteur)}`, texte: extrait(p.texte), url: `/echanges/${p.mur}/${id}`, tag: `publication:${id}` };
	await base.batch([ecrireFil(base, ids, id, null, maintenant), mettreEnFile(base, ids, `mur:${p.mur}`, donnees, maintenant)]);
}

// Un commentaire : l'auteur de la publication, s'il lit encore le mur et n'a pas commenté lui-même. Une lecture, une écriture.
export async function notifierCommentaire(base: Base, id: number, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const [lignes, agents, affectations, tenues, auteurs] = await base.batch([
		base
			.select({ publicationId: commentaire.publicationId, mur: publication.mur, destinataire: sql<string>`${publication.auteur}`.as('destinataire'), auteur: commentaire.auteur, texte: commentaire.texte })
			.from(commentaire)
			.innerJoin(publication, eq(publication.id, commentaire.publicationId))
			.where(eq(commentaire.id, id)),
		...lecturesAgents(base, aujourdhui),
		base
			.select({ prenom: personne.prenom, nom: personne.nom })
			.from(personne)
			.where(auteurDe(sql`(select ${commentaire.auteur} from ${commentaire} where ${commentaire.id} = ${id})`))
	]);
	const c = lignes[0];
	const destinataire = idPersonne(c?.destinataire ?? null);
	if (!c || destinataire === null || c.auteur === c.destinataire) return;
	const lecteur = agentsDuJour([agents, affectations, tenues], aujourdhui).find((x) => x.id === destinataire);
	if (!lecteur || !(lecteur.a.tous || estMembre(lecteur.a, c.mur))) return;
	const donnees = { titre: `${nomComplet(auteurs[0], c.auteur)} a commenté votre publication`, texte: extrait(c.texte), url: `/echanges/${c.mur}/${c.publicationId}`, tag: `commentaires:${c.publicationId}` };
	await base.batch([ecrireFil(base, [destinataire], c.publicationId, id, maintenant), mettreEnFile(base, [destinataire], `mur:${c.mur}`, donnees, maintenant)]);
}

// Un message : les autres membres qui ont la messagerie, au téléphone seulement (les messages ont leur pastille). Une lecture, une écriture.
export async function notifierMessage(base: Base, id: number, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const leMessage = base.select({ conversationId: message.conversationId }).from(message).where(eq(message.id, id));
	const [lignes, membres] = await base.batch([
		base
			.select({ conversationId: message.conversationId, auteur: message.auteur, texte: message.texte, type: conversation.type, nomGroupe: conversation.nom, prenom: personne.prenom })
			.from(message)
			.innerJoin(conversation, eq(conversation.id, message.conversationId))
			.innerJoin(personne, eq(personne.id, message.auteur))
			.where(and(eq(message.id, id), isNull(message.supprime))),
		base
			.select({ id: membreConversation.personneId })
			.from(membreConversation)
			.where(
				and(
					inArray(membreConversation.conversationId, leMessage),
					ne(membreConversation.personneId, sql`(select ${message.auteur} from ${message} where ${message.id} = ${id})`),
					aLaMessagerie(membreConversation.personneId, aujourdhui)
				)
			)
	]);
	const m = lignes[0];
	const ids = membres.map((x) => x.id);
	if (!m || ids.length === 0) return;
	const donnees = {
		titre: m.type === 'deux' ? `Message de ${m.prenom}` : `${m.nomGroupe ?? ''} · ${m.prenom}`,
		texte: extrait(m.texte) || 'Photo',
		url: `/echanges/messages/${m.conversationId}`,
		tag: `conversation:${m.conversationId}`
	};
	await base.batch([mettreEnFile(base, ids, `conversation:${m.conversationId}`, donnees, maintenant)]);
}

const nonLuesDe = (base: Base, moi: number) => base.select({ n: count() }).from(notification).where(and(eq(notification.personneId, moi), isNull(notification.lueLe)));

// Le fil de la cloche : les 50 plus récentes, et le nombre de non-lues. Une requête.
export async function filDeNotifications(base: Base, acteur: Acteur, maintenant: string): Promise<{ lignes: LigneFil[]; nonLues: number }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') return { lignes: [], nonLues: 0 };
	const moi = acteur.id;
	const auteur = sql<string>`coalesce(${commentaire.auteur}, ${publication.auteur})`;
	const lesAuteurs = base.select({ auteur }).from(notification).innerJoin(publication, eq(publication.id, notification.publicationId)).leftJoin(commentaire, eq(commentaire.id, notification.commentaireId)).where(eq(notification.personneId, moi));
	const [lignes, [compte], equipes, comites, personnes] = await base.batch([
		base
			.select({
				id: notification.id,
				publicationId: notification.publicationId,
				commentaireId: notification.commentaireId,
				creeLe: notification.creeLe,
				lueLe: notification.lueLe,
				mur: publication.mur,
				auteur: auteur.as('auteur'),
				texte: sql<string>`substr(coalesce(${commentaire.texte}, ${publication.texte}), 1, 400)`.as('texte')
			})
			.from(notification)
			.innerJoin(publication, eq(publication.id, notification.publicationId))
			.leftJoin(commentaire, eq(commentaire.id, notification.commentaireId))
			.where(eq(notification.personneId, moi))
			.orderBy(desc(notification.id))
			.limit(FIL_MAX),
		nonLuesDe(base, moi),
		...nomsDesMurs(base),
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, couleur: couleurDe(aujourdhui).as('couleur') })
			.from(personne)
			.where(inArray(sql`'personne:' || ${personne.id}`, lesAuteurs))
	]);
	return {
		nonLues: compte?.n ?? 0,
		lignes: lignes.map((l) => {
			const p = personnes.find((x) => x.id === idPersonne(l.auteur));
			return {
				id: l.id,
				type: l.commentaireId === null ? 'publication' : 'commentaire',
				cle: l.mur as CleMur,
				nomMur: nomDuMur(l.mur, equipes, comites),
				publicationId: l.publicationId,
				auteur: p ? { prenom: p.prenom, nom: p.nom, couleur: p.couleur } : l.auteur.startsWith('super:') ? { prenom: 'Super', nom: 'administrateur', couleur: null } : { prenom: '', nom: 'Personne inconnue', couleur: null },
				extrait: extrait(l.texte),
				creeLe: l.creeLe,
				lue: l.lueLe !== null
			};
		})
	};
}

// L'en-tête de chaque page : le nombre de non-lues et le visage de la personne. Une requête ; aucune pour le super administrateur.
export async function enTeteDe(base: Base, acteur: Acteur, aujourdhui: string): Promise<{ nonLues: number; visage: { prenom: string; nom: string; couleur: string | null } | null }> {
	exigerDate(aujourdhui);
	if (acteur.type !== 'personne') return { nonLues: 0, visage: null };
	const [[compte], [visage]] = await base.batch([
		nonLuesDe(base, acteur.id),
		base
			.select({ prenom: personne.prenom, nom: personne.nom, couleur: couleurDe(aujourdhui).as('couleur') })
			.from(personne)
			.where(eq(personne.id, acteur.id))
	]);
	return { nonLues: compte?.n ?? 0, visage: visage ?? null };
}

export async function toutMarquerLu(base: Base, acteur: Acteur, maintenant: string): Promise<void> {
	exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') return;
	await base.update(notification).set({ lueLe: maintenant }).where(and(eq(notification.personneId, acteur.id), isNull(notification.lueLe)));
}

// Écritures à placer dans un batch de lecture : ouvrir un mur marque lues ses publications ; ouvrir une publication, elle et ses commentaires.
export const marquerLuesDuMur = (base: Base, moi: number, cle: string, maintenant: string) =>
	base
		.update(notification)
		.set({ lueLe: maintenant })
		.where(and(eq(notification.personneId, moi), isNull(notification.lueLe), isNull(notification.commentaireId), inArray(notification.publicationId, base.select({ id: publication.id }).from(publication).where(eq(publication.mur, cle)))));

export const marquerLueLaPublication = (base: Base, moi: number, id: number, maintenant: string) =>
	base
		.update(notification)
		.set({ lueLe: maintenant })
		.where(and(eq(notification.personneId, moi), isNull(notification.lueLe), eq(notification.publicationId, id)));

// Couper (oui) ou réactiver un lieu : « tout », « mur:<clé> » (un mur que la personne lit) ou « conversation:<id> » (dont elle est membre).
// Réactiver ne vérifie que la forme : on peut toujours retirer une coupure.
export async function couper(base: Base, acteur: Acteur, lieu: string, oui: boolean, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	const mur = /^mur:(.+)$/.exec(lieu)?.[1];
	const conv = /^conversation:([1-9]\d*)$/.exec(lieu)?.[1];
	if (lieu !== 'tout' && mur === undefined && conv === undefined) throw new DonneeInvalide('Lieu inconnu');
	if (!oui) {
		await base.delete(coupure).where(and(eq(coupure.personneId, moi), eq(coupure.lieu, lieu)));
		return;
	}
	if (mur !== undefined) await exigerMur(base, acteur, mur, aujourdhui, 'lire');
	if (conv !== undefined) {
		const membre = await base
			.select({ id: membreConversation.personneId })
			.from(membreConversation)
			.where(and(eq(membreConversation.conversationId, Number(conv)), eq(membreConversation.personneId, moi)));
		if (membre.length === 0) throw new DonneeInvalide('Conversation inconnue');
	}
	await base.insert(coupure).values({ personneId: moi, lieu }).onConflictDoNothing();
}

export async function estCoupe(base: Base, acteur: Acteur, lieu: string): Promise<boolean> {
	if (acteur.type !== 'personne') return false;
	const lignes = await base
		.select({ lieu: coupure.lieu })
		.from(coupure)
		.where(and(eq(coupure.personneId, acteur.id), eq(coupure.lieu, lieu)));
	return lignes.length > 0;
}

const RANG_MUR: Record<string, number> = { centre: 0, vie: 1, equipe: 2, comite: 3 };

// Moi → Notifications : « tout » coupé ou non, les lieux coupés (murs puis conversations, nommés), le nombre d'appareils. Une requête.
export async function mesNotifications(base: Base, acteur: Acteur, aujourdhui: string): Promise<{ tout: boolean; coupes: { lieu: string; nom: string }[]; appareils: number }> {
	exigerDate(aujourdhui);
	if (acteur.type !== 'personne') return { tout: false, coupes: [], appareils: 0 };
	const moi = acteur.id;
	const conversationsCoupees = base
		.select({ id: sql<number>`cast(substr(${coupure.lieu}, 14) as integer)` })
		.from(coupure)
		.where(and(eq(coupure.personneId, moi), sql`${coupure.lieu} like 'conversation:%'`));
	const [lieux, [appareils], equipes, comites, conversations, autres] = await base.batch([
		base.select({ lieu: coupure.lieu }).from(coupure).where(eq(coupure.personneId, moi)),
		base.select({ n: count() }).from(abonnementPush).where(eq(abonnementPush.personneId, moi)),
		...nomsDesMurs(base),
		base.select({ id: conversation.id, type: conversation.type, nom: conversation.nom }).from(conversation).where(inArray(conversation.id, conversationsCoupees)),
		base
			.select({ conversationId: membreConversation.conversationId, prenom: personne.prenom, nom: personne.nom })
			.from(membreConversation)
			.innerJoin(personne, eq(personne.id, membreConversation.personneId))
			.where(and(inArray(membreConversation.conversationId, conversationsCoupees), ne(membreConversation.personneId, moi)))
	]);
	const murs = lieux
		.filter((l) => l.lieu.startsWith('mur:'))
		.map((l) => ({ lieu: l.lieu, cle: l.lieu.slice(4) }))
		.map((l) => ({ lieu: l.lieu, nom: nomDuMur(l.cle, equipes, comites), rang: RANG_MUR[l.cle.split(':')[0]!] ?? 9 }))
		.sort((a, b) => a.rang - b.rang || a.nom.localeCompare(b.nom, 'fr'))
		.map(({ lieu, nom }) => ({ lieu, nom }));
	const convs = conversations
		.map((c) => {
			const autre = autres.find((x) => x.conversationId === c.id);
			return { lieu: `conversation:${c.id}`, nom: c.type === 'deux' ? `${autre?.prenom ?? ''} ${autre?.nom ?? ''}`.trim() : (c.nom ?? '') };
		})
		.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
	return { tout: lieux.some((l) => l.lieu === 'tout'), coupes: [...murs, ...convs], appareils: appareils?.n ?? 0 };
}

export type Abonnement = { endpoint: string; p256dh: string; auth: string; appareil: string };

const CLE = /^[A-Za-z0-9_-]{1,200}$/;
const APPAREILS_MAX = 10;
// Les services push des navigateurs (Chrome et Edge, Firefox, Safari, anciens Edge) : le Worker ne poste jamais ailleurs.
const SERVICES_PUSH = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

function servicePushConnu(endpoint: string): boolean {
	if (endpoint.length > 1000) return false;
	try {
		const url = new URL(endpoint);
		return url.protocol === 'https:' && url.username === '' && url.port === '' && SERVICES_PUSH.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
	} catch {
		return false;
	}
}

// Un appareil abonné : s'il l'était déjà (même adresse), il passe à cette personne, sans les envois encore en file pour l'ancienne.
// Dix appareils au plus par personne : le plus ancien laisse sa place.
export async function abonner(base: Base, acteur: Acteur, a: Abonnement, maintenant: string): Promise<void> {
	exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	const endpoint = typeof a.endpoint === 'string' ? a.endpoint : '';
	if (!servicePushConnu(endpoint) || typeof a.p256dh !== 'string' || !CLE.test(a.p256dh) || typeof a.auth !== 'string' || !CLE.test(a.auth)) throw new DonneeInvalide('Abonnement invalide');
	const appareil = typeof a.appareil === 'string' ? a.appareil.slice(0, 80) : '';
	const lAbonnement = base.select({ id: abonnementPush.id }).from(abonnementPush).where(eq(abonnementPush.endpoint, endpoint));
	const recents = base.select({ id: abonnementPush.id }).from(abonnementPush).where(eq(abonnementPush.personneId, moi)).orderBy(desc(abonnementPush.creeLe), desc(abonnementPush.id)).limit(APPAREILS_MAX);
	await base.batch([
		base.delete(envoiPush).where(inArray(envoiPush.abonnementId, lAbonnement)),
		base
			.insert(abonnementPush)
			.values({ personneId: moi, endpoint, p256dh: a.p256dh, auth: a.auth, appareil, creeLe: maintenant })
			.onConflictDoUpdate({ target: abonnementPush.endpoint, set: { personneId: moi, p256dh: a.p256dh, auth: a.auth, appareil, creeLe: maintenant } }),
		base.delete(abonnementPush).where(and(eq(abonnementPush.personneId, moi), notInArray(abonnementPush.id, recents)))
	]);
}

export async function desabonner(base: Base, acteur: Acteur, endpoint: string): Promise<void> {
	if (acteur.type !== 'personne') return;
	await base.delete(abonnementPush).where(and(eq(abonnementPush.personneId, acteur.id), eq(abonnementPush.endpoint, endpoint)));
}

export type Envoi = { id: number; abonnementId: number; endpoint: string; p256dh: string; auth: string; donnees: DonneesPush };

// Les plus anciens envois en file, retirés d'un même bloc : deux lots qui se croisent ne prennent jamais le même.
export async function prendreEnvois(base: Base, max: number): Promise<Envoi[]> {
	const premiers = base.select({ id: envoiPush.id }).from(envoiPush).orderBy(asc(envoiPush.id)).limit(max);
	const [lignes] = await base.batch([
		base
			.select({ id: envoiPush.id, abonnementId: envoiPush.abonnementId, endpoint: abonnementPush.endpoint, p256dh: abonnementPush.p256dh, auth: abonnementPush.auth, donnees: envoiPush.donnees })
			.from(envoiPush)
			.innerJoin(abonnementPush, eq(abonnementPush.id, envoiPush.abonnementId))
			.orderBy(asc(envoiPush.id))
			.limit(max),
		base.delete(envoiPush).where(inArray(envoiPush.id, premiers))
	]);
	return lignes.map((l) => ({ ...l, donnees: JSON.parse(l.donnees) as DonneesPush }));
}

// Abonnements périmés (le service push répond 404 ou 410) : supprimés, avec leurs envois.
export async function oublierAbonnements(base: Base, ids: number[]): Promise<void> {
	if (ids.length === 0) return;
	await base.delete(abonnementPush).where(inArray(abonnementPush.id, parmi(ids)));
}

// Ménage de nuit : notifications et envois restés en file créés avant `avant` (AAAA-MM-JJ).
export async function effacerVieillesNotifications(base: Base, avant: string): Promise<void> {
	exigerDate(avant);
	await base.batch([base.delete(notification).where(lt(notification.creeLe, avant)), base.delete(envoiPush).where(lt(envoiPush.creeLe, avant))]);
}

// Au départ d'une personne : ses appareils, son fil et ses coupures. Écritures à placer dans un batch.
export const effacerNotificationsDe = (base: Base, personneId: number) =>
	[base.delete(abonnementPush).where(eq(abonnementPush.personneId, personneId)), base.delete(notification).where(eq(notification.personneId, personneId)), base.delete(coupure).where(eq(coupure.personneId, personneId))] as const;
