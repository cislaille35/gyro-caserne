import { and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, ne, notExists, notInArray, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { ecussonDuCentre } from './ecusson.ts';
import type { Base } from './base.ts';
import { exigerDate, exigerDateHeure, heureDeParis } from './dates.ts';
import type { Acteur } from './droits.ts';
import { DonneeInvalide } from './erreurs.ts';
import { aLaMessagerie, nombreSignalements, nonLusPour, signalementsPour } from './messagerie.ts';
import { aTrancherPar } from './reservations-gestion.ts';
import { nombreAValider } from './reservations.ts';
import { agentsDuJour, estConvoque, type Convocation, estMembre, exigerMur, lecturesAgents, type CleMur } from './murs.ts';
import { periodeCourte } from './reservations-calcul.ts';
import { texteDemande } from './remplacements/tranches.ts';
import { aValiderPar } from './remplacements/compte.ts';
import { TITRES_AVIS } from './remplacements/titres.ts';
import type { AvisEte, AvisRemplacement } from './listes.ts';
import { abonnementPush, affectationEquipe, avisAnomalie, avisHabillement, avisEte, avisRemplacement, avisReservation, demandeRemplacement, comite, commentaire, conversation, coupure, ecusson, envoiPush, equipe, membreConversation, message, notification, personne, publication, reponseEvenement, reservation, ressource, souhaitAnniversaire } from './schema.ts';

// Les notifications : le fil de la cloche (publications et commentaires reçus), les appareils abonnés, ce que la personne a coupé,
// et la file des envois au téléphone. Les destinataires sont ceux qui peuvent lire au moment de l'envoi, jamais l'auteur.

const EXTRAIT = 100;
const FIL_MAX = 50;

// `lue` : la ligne de la cloche que la notification touchée marque lue (voir mettreEnFile) ; absente pour un message ou une vigilance.
export type DonneesPush = { titre: string; texte: string; url: string; tag: string; lue?: { genre: string; id: number | null } };
export type LigneFil = LigneMur | LigneReservation | LigneRemplacement | LigneEte | LigneAnomalie | LigneHabillement | LigneAnniversaire;
// Un collègue souhaite son anniversaire à la personne (décision 0033).
export type LigneAnniversaire = { id: number; type: 'anniversaire'; auteur: { prenom: string; nom: string; couleur: string | null }; creeLe: string; lue: boolean };
export type LigneAnomalie = { id: number; type: 'anomalie'; titre: string; texte: string; url: string; creeLe: string; lue: boolean };
export type LigneHabillement = Omit<LigneAnomalie, 'type'> & { type: 'habillement' };
export type LigneEte = { id: number; type: 'ete'; quoi: AvisEte; titre: string; texte: string; url: string; creeLe: string; lue: boolean };
export const TITRES_ETE: Record<AvisEte, string> = { rappel: 'Vos vacances d’été', repartition: 'Planning d’été', vacances_changees: 'Vacances changées', semaine: 'Planning' };
export type LigneRemplacement = { id: number; type: 'remplacement'; demandeId: number; quoi: AvisRemplacement; titre: string; texte: string; creeLe: string; lue: boolean };
export type LigneReservation = { id: number; type: 'reservation'; reservationId: number; quoi: 'acceptee' | 'refusee' | 'annulee'; ressource: string; periode: string; motif: string | null; creeLe: string; lue: boolean };
type LigneMur = {
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

// Les tables des lignes de la cloche, par genre.
const TABLES = { publication: notification, commentaire: notification, reservation: avisReservation, remplacement: avisRemplacement, ete: avisEte, anomalie: avisAnomalie, habillement: avisHabillement, anniversaire: souhaitAnniversaire };

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

// `ids` : une liste, ou une sous-requête d'identifiants de personnes. Lieu « reservations » : seul « tout » le coupe.
// `si` : une condition de plus, vérifiée au moment de l'écriture. `ligne` : le genre de la ligne de cloche écrite juste avant
// dans le même batch, quand la page d'arrivée ne la marque pas lue (avis d'été), ou pour plus de sûreté (anomalies, habillement) ; chaque envoi porte celle de sa
// personne (sa plus récente), pour que la toucher la marque lue. Les autres pages marquent déjà lu ce qu'elles montrent.
export function mettreEnFile(base: Base, ids: number[] | SQLWrapper, lieu: string, donnees: DonneesPush, maintenant: string, si?: SQL, ligne?: 'ete' | 'anomalie' | 'habillement' | 'anniversaire') {
	const coupe = base
		.select({ un: sql`1` })
		.from(coupure)
		.where(and(eq(coupure.personneId, abonnementPush.personneId), inArray(coupure.lieu, ['tout', lieu])));
	const json = JSON.stringify(donnees);
	const t = ligne === undefined ? null : TABLES[ligne];
	const contenu = t === null ? sql<string>`${json}` : sql<string>`json_set(${json}, '$.lue', json_object('genre', ${ligne}, 'id', (select max(${t.id}) from ${t} where ${t.personneId} = "abonnement_push"."personne_id")))`;
	return base.insert(envoiPush).select(
		base
			.select({ id: sql<number | null>`null`.as('id'), abonnementId: abonnementPush.id, donnees: contenu.as('donnees'), creeLe: sql<string>`${maintenant}`.as('cree_le'), jeton: sql<string | null>`null`.as('jeton'), reserveeLe: sql<string | null>`null`.as('reservee_le'), essais: sql<number>`0`.as('essais') })
			.from(abonnementPush)
			.where(and(inArray(abonnementPush.personneId, Array.isArray(ids) ? parmi(ids) : ids), notExists(coupe), si))
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

// Une publication du planning (manœuvre annoncée, changée, annulée ou relancée) : ses convoqués du jour seulement,
// ou ceux qui n'ont pas encore répondu. Une lecture, une écriture.
export async function notifierConvoques(base: Base, id: number, maintenant: string, message: { titre: string; texte: string; seulementSansReponse: boolean }): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const [lignes, agents, affectations, tenues, reponses] = await base.batch([
		base.select({ mur: publication.mur, convoques: publication.convoques }).from(publication).where(eq(publication.id, id)),
		...lecturesAgents(base, aujourdhui),
		base.select({ personneId: reponseEvenement.personneId }).from(reponseEvenement).where(eq(reponseEvenement.publicationId, id))
	]);
	const p = lignes[0];
	if (!p) return;
	const convoques = JSON.parse(p.convoques ?? '"tous"') as Convocation;
	const ids = agentsDuJour([agents, affectations, tenues], aujourdhui)
		.filter((x) => estConvoque(x.a, p.mur, convoques, x.id) && !(message.seulementSansReponse && reponses.some((r) => r.personneId === x.id)))
		.map((x) => x.id);
	if (ids.length === 0) return;
	const donnees = { titre: message.titre, texte: extrait(message.texte), url: `/echanges/${p.mur}/${id}`, tag: `publication:${id}` };
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

// Les non-lues de `qui` (un identifiant, ou la colonne d'une requête) : publications et commentaires, et les avis.
const nonLuesSql = (qui: number | SQL) =>
	sql<number>`(select count(*) from ${notification} where ${notification.personneId} = ${qui} and ${notification.lueLe} is null) + (select count(*) from ${avisReservation} where ${avisReservation.personneId} = ${qui} and ${avisReservation.lueLe} is null) + (select count(*) from ${avisRemplacement} where ${avisRemplacement.personneId} = ${qui} and ${avisRemplacement.lueLe} is null) + (select count(*) from ${avisEte} where ${avisEte.personneId} = ${qui} and ${avisEte.lueLe} is null) + (select count(*) from ${avisAnomalie} where ${avisAnomalie.personneId} = ${qui} and ${avisAnomalie.lueLe} is null) + (select count(*) from ${avisHabillement} where ${avisHabillement.personneId} = ${qui} and ${avisHabillement.lueLe} is null) + (select count(*) from ${souhaitAnniversaire} where ${souhaitAnniversaire.personneId} = ${qui} and ${souhaitAnniversaire.lueLe} is null)`;

// Le chiffre de la cloche d'une personne (la colonne d'une requête), comme l'en-tête des pages le compose (+layout.server.ts) :
// non lues, remplacements à valider, messages signalés pour qui modère, réservations à trancher.
const clocheSql = (qui: SQL, aujourdhui: string, maintenant: string) => sql<number>`${nonLuesSql(qui)} + ${aValiderPar(qui, aujourdhui, maintenant)} + ${signalementsPour(qui, aujourdhui)} + ${aTrancherPar(qui, aujourdhui)}`;

// Les non-lues, et les remplacements à valider. Une requête.
const nonLuesDe = (base: Base, moi: number, aValider: SQL<number> = sql<number>`0`) =>
	base
		.select({ aValider: aValider.as('a_valider'), n: nonLuesSql(moi) })
		.from(personne)
		.where(eq(personne.id, moi));

// Les avis de réservation reçus par la personne, les plus récents d'abord.
const avisDe = (base: Base, moi: number) =>
	base
		.select({ id: avisReservation.id, reservationId: avisReservation.reservationId, quoi: avisReservation.quoi, creeLe: avisReservation.creeLe, lueLe: avisReservation.lueLe, ressource: sql<string>`${ressource.nom}`.as('ressource'), forme: ressource.forme, debut: reservation.debut, fin: reservation.fin, motif: reservation.motif })
		.from(avisReservation)
		.innerJoin(reservation, eq(reservation.id, avisReservation.reservationId))
		.innerJoin(ressource, eq(ressource.id, reservation.ressourceId))
		.where(eq(avisReservation.personneId, moi))
		.orderBy(desc(avisReservation.id))
		.limit(FIL_MAX);

// Les avis de remplacement reçus par la personne, les plus récents d'abord.
const avisRemplacementsDe = (base: Base, moi: number) =>
	base
		.select({ id: avisRemplacement.id, demandeId: avisRemplacement.demandeId, quoi: avisRemplacement.quoi, creeLe: avisRemplacement.creeLe, lueLe: avisRemplacement.lueLe, genre: demandeRemplacement.genre, periodes: demandeRemplacement.periodes, prenom: personne.prenom, nom: personne.nom })
		.from(avisRemplacement)
		.innerJoin(demandeRemplacement, eq(demandeRemplacement.id, avisRemplacement.demandeId))
		.innerJoin(personne, eq(personne.id, demandeRemplacement.demandeurId))
		.where(eq(avisRemplacement.personneId, moi))
		.orderBy(desc(avisRemplacement.id))
		.limit(FIL_MAX);

const avisEteDe = (base: Base, moi: number) => base.select().from(avisEte).where(eq(avisEte.personneId, moi)).orderBy(desc(avisEte.id)).limit(FIL_MAX);
const avisAnomaliesDe = (base: Base, moi: number) => base.select().from(avisAnomalie).where(eq(avisAnomalie.personneId, moi)).orderBy(desc(avisAnomalie.id)).limit(FIL_MAX);
const avisHabillementDe = (base: Base, moi: number) => base.select().from(avisHabillement).where(eq(avisHabillement.personneId, moi)).orderBy(desc(avisHabillement.id)).limit(FIL_MAX);
const souhaitsDe = (base: Base, moi: number, aujourdhui: string) =>
	base
		.select({ id: souhaitAnniversaire.id, creeLe: souhaitAnniversaire.creeLe, lueLe: souhaitAnniversaire.lueLe, prenom: personne.prenom, nom: personne.nom, couleur: couleurDe(aujourdhui).as('couleur') })
		.from(souhaitAnniversaire)
		.innerJoin(personne, eq(personne.id, souhaitAnniversaire.auteurId))
		.where(eq(souhaitAnniversaire.personneId, moi))
		.orderBy(desc(souhaitAnniversaire.id))
		.limit(FIL_MAX);

// Écriture à placer dans le batch des écrans Remplacements : les avis sont vus.
export const marquerAvisRemplacementLus = (base: Base, moi: number, maintenant: string) => base.update(avisRemplacement).set({ lueLe: maintenant }).where(and(eq(avisRemplacement.personneId, moi), isNull(avisRemplacement.lueLe)));

// Écriture à placer dans le batch de « Mes réservations » : les avis sont vus.
export const marquerAvisLus = (base: Base, moi: number, maintenant: string) => base.update(avisReservation).set({ lueLe: maintenant }).where(and(eq(avisReservation.personneId, moi), isNull(avisReservation.lueLe)));

// Le fil de la cloche : les 50 plus récentes, et le nombre de non-lues. Une requête.
export async function filDeNotifications(base: Base, acteur: Acteur, maintenant: string): Promise<{ lignes: LigneFil[]; nonLues: number; remplacementsAValider: number }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') return { lignes: [], nonLues: 0, remplacementsAValider: 0 };
	const moi = acteur.id;
	const auteur = sql<string>`coalesce(${commentaire.auteur}, ${publication.auteur})`;
	const lesAuteurs = base.select({ auteur }).from(notification).innerJoin(publication, eq(publication.id, notification.publicationId)).leftJoin(commentaire, eq(commentaire.id, notification.commentaireId)).where(eq(notification.personneId, moi));
	const [lignes, [compte], equipes, comites, personnes, avis, remplacements, ete, anomalies, habillement, souhaits] = await base.batch([
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
		nonLuesDe(base, moi, aValiderPar(moi, aujourdhui, maintenant)),
		...nomsDesMurs(base),
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, couleur: couleurDe(aujourdhui).as('couleur') })
			.from(personne)
			.where(inArray(sql`'personne:' || ${personne.id}`, lesAuteurs)),
		avisDe(base, moi),
		avisRemplacementsDe(base, moi),
		avisEteDe(base, moi),
		avisAnomaliesDe(base, moi),
		avisHabillementDe(base, moi),
		souhaitsDe(base, moi, aujourdhui)
	]);
	const dAnomalies: LigneFil[] = anomalies.map((a) => ({ id: a.id, type: 'anomalie', titre: a.titre, texte: a.texte, url: a.url, creeLe: a.creeLe, lue: a.lueLe !== null }));
	const dHabillement: LigneFil[] = habillement.map((a) => ({ id: a.id, type: 'habillement', titre: a.titre, texte: a.texte, url: a.url, creeLe: a.creeLe, lue: a.lueLe !== null }));
	const dAnniversaire: LigneFil[] = souhaits.map((a) => ({ id: a.id, type: 'anniversaire', auteur: { prenom: a.prenom, nom: a.nom, couleur: a.couleur }, creeLe: a.creeLe, lue: a.lueLe !== null }));
	const dEte: LigneFil[] = ete.map((a) => ({ id: a.id, type: 'ete', quoi: a.quoi, titre: TITRES_ETE[a.quoi], texte: a.texte, url: a.url, creeLe: a.creeLe, lue: a.lueLe !== null }));
	const deRemplacements: LigneFil[] = remplacements.map((a) => ({
		id: a.id,
		type: 'remplacement',
		demandeId: a.demandeId,
		quoi: a.quoi,
		titre: TITRES_AVIS[a.quoi],
		texte: `${a.prenom} ${a.nom} · ${a.genre === 'manoeuvre' ? 'échange de manœuvre' : texteDemande(JSON.parse(a.periodes))}`,
		creeLe: a.creeLe,
		lue: a.lueLe !== null
	}));
	const deReservations: LigneFil[] = avis.map((a) => ({ id: a.id, type: 'reservation', reservationId: a.reservationId, quoi: a.quoi, ressource: a.ressource, periode: periodeCourte(a.forme, a.debut, a.fin), motif: a.motif, creeLe: a.creeLe, lue: a.lueLe !== null }));
	return {
		nonLues: compte?.n ?? 0,
		remplacementsAValider: compte?.aValider ?? 0,
		lignes: [...deMurs(lignes, personnes, equipes, comites), ...deReservations, ...deRemplacements, ...dEte, ...dAnomalies, ...dHabillement, ...dAnniversaire].sort((a, b) => b.creeLe.localeCompare(a.creeLe)).slice(0, FIL_MAX)
	};
}

function deMurs(
	lignes: { id: number; publicationId: number; commentaireId: number | null; creeLe: string; lueLe: string | null; mur: string; auteur: string; texte: string }[],
	personnes: { id: number; prenom: string; nom: string; couleur: string | null }[],
	equipes: { id: number; nom: string }[],
	comites: { id: number; nom: string }[]
): LigneFil[] {
	return lignes.map((l) => {
			const p = personnes.find((x) => x.id === idPersonne(l.auteur));
			return {
				id: l.id,
				type: l.commentaireId === null ? 'publication' : 'commentaire',
				cle: l.mur as CleMur,
				nomMur: nomDuMur(l.mur, equipes, comites),
				publicationId: l.publicationId,
				auteur: p ? { prenom: p.prenom, nom: p.nom, couleur: p.couleur } : l.auteur === 'planning' ? { prenom: 'Planning', nom: 'du centre', couleur: null } : l.auteur.startsWith('super:') ? { prenom: 'Super', nom: 'administrateur', couleur: null } : { prenom: '', nom: 'Personne inconnue', couleur: null },
				extrait: extrait(l.texte),
				creeLe: l.creeLe,
				lue: l.lueLe !== null
			};
		});
}

// L'en-tête de chaque page : de quoi composer la cloche (non-lues, remplacements à valider, messages signalés pour qui modère,
// réservations à trancher), les messages non lus (la pastille d'Échanges), le visage de la personne et la version de l'écusson
// du centre (null sans écusson). Une requête légère, les mêmes comptes en SQL que la pastille d'un envoi (prendreEnvois).
// Pour le super administrateur, sans visage ni messages : les signalements et réservations par ses droits, et l'écusson.
export async function enTeteDe(
	base: Base,
	acteur: Acteur,
	aujourdhui: string,
	maintenant = `${aujourdhui}T00:00`
): Promise<{ nonLues: number; remplacementsAValider: number; signalements: number; aTrancher: number; nonLus: number; visage: { prenom: string; nom: string; couleur: string | null } | null; ecusson: number | null }> {
	exigerDate(aujourdhui);
	if (acteur.type !== 'personne') {
		const [signalements, aTrancher, ecusson] = await Promise.all([nombreSignalements(base, acteur, aujourdhui), nombreAValider(base, acteur, aujourdhui), ecussonDuCentre(base)]);
		return { nonLues: 0, remplacementsAValider: 0, signalements, aTrancher, nonLus: 0, visage: null, ecusson };
	}
	const qui = sql`"personne"."id"`;
	const [l] = await base
		.select({
			prenom: personne.prenom,
			nom: personne.nom,
			couleur: couleurDe(aujourdhui),
			// Chaque compte dans un sql`…` de plus, comme dans prendreEnvois : sinon drizzle écrirait les colonnes de ses sous-requêtes
			// sans leur table (requête sur une seule table), et SQLite ne saurait pas de laquelle il s'agit.
			nonLues: sql<number>`${nonLuesSql(qui)}`,
			aValider: sql<number>`${aValiderPar(qui, aujourdhui, maintenant)}`,
			signalements: sql<number>`${signalementsPour(qui, aujourdhui)}`,
			aTrancher: sql<number>`${aTrancherPar(qui, aujourdhui)}`,
			nonLus: sql<number>`${nonLusPour(qui, aujourdhui)}`,
			ecusson: sql<number | null>`(select ${ecusson.photoId} from ${ecusson})`
		})
		.from(personne)
		.where(eq(personne.id, acteur.id));
	if (!l) return { nonLues: 0, remplacementsAValider: 0, signalements: 0, aTrancher: 0, nonLus: 0, visage: null, ecusson: await ecussonDuCentre(base) };
	return { nonLues: l.nonLues, remplacementsAValider: l.aValider, signalements: l.signalements, aTrancher: l.aTrancher, nonLus: l.nonLus, visage: { prenom: l.prenom, nom: l.nom, couleur: l.couleur }, ecusson: l.ecusson };
}

export async function toutMarquerLu(base: Base, acteur: Acteur, maintenant: string): Promise<void> {
	exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') return;
	await base.batch([base.update(notification).set({ lueLe: maintenant }).where(and(eq(notification.personneId, acteur.id), isNull(notification.lueLe))), marquerAvisLus(base, acteur.id, maintenant), marquerAvisRemplacementLus(base, acteur.id, maintenant), base.update(avisEte).set({ lueLe: maintenant }).where(and(eq(avisEte.personneId, acteur.id), isNull(avisEte.lueLe))), base.update(avisAnomalie).set({ lueLe: maintenant }).where(and(eq(avisAnomalie.personneId, acteur.id), isNull(avisAnomalie.lueLe))), base.update(avisHabillement).set({ lueLe: maintenant }).where(and(eq(avisHabillement.personneId, acteur.id), isNull(avisHabillement.lueLe))), base.update(souhaitAnniversaire).set({ lueLe: maintenant }).where(and(eq(souhaitAnniversaire.personneId, acteur.id), isNull(souhaitAnniversaire.lueLe)))]);
}

// Ouvrir une ligne de la cloche la marque lue, quelle que soit la page où elle mène. Une requête ; seulement les siennes.
export async function marquerLue(base: Base, acteur: Acteur, genre: string, id: number, maintenant: string): Promise<void> {
	exigerDateHeure(maintenant, 'Date');
	if (!Object.hasOwn(TABLES, genre)) throw new DonneeInvalide('Notification inconnue');
	if (acteur.type !== 'personne') return;
	const t = TABLES[genre as keyof typeof TABLES];
	await base.update(t).set({ lueLe: maintenant }).where(and(eq(t.id, id), eq(t.personneId, acteur.id), isNull(t.lueLe)));
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

// « Me déconnecter de tous mes appareils » : aucun ne reçoit plus ses notifications (envois en file compris, en cascade).
export async function desabonnerPartout(base: Base, acteur: Acteur): Promise<void> {
	if (acteur.type !== 'personne') return;
	await base.delete(abonnementPush).where(eq(abonnementPush.personneId, acteur.id));
}

// `essais` : 1 au premier envoi, plus après une coupure. `pastille` : le chiffre de la cloche de la personne et ses messages non lus, au moment du lot.
export type Envoi = { id: number; abonnementId: number; personneId: number; endpoint: string; p256dh: string; auth: string; essais: number; donnees: DonneesPush; pastille: number };

// Un lot réserve ses envois, puis ne les retire de la file qu'une fois partis (finirEnvois). Coupé en route (Cloudflare arrête
// la requête), il laisse ses envois réservés : un passage suivant les reprend, cinq minutes au moins après (5 à 15 minutes avec le réveil de dix minutes), trois fois au plus.
// Un envoi repris alors qu'il était déjà parti remplace la notification encore affichée (même `tag`), sans en ajouter une ;
// arrivé après un plus récent du même fil, il ne le remplace pas (voir notification-recue.ts de l'appli).
export const REPRISE_MINUTES = 5;
export const ESSAIS_MAX = 3;

// Les plus anciens envois libres, réservés d'un même bloc (`jeton`) : deux lots qui se croisent ne prennent jamais le même.
// Dans le même bloc, ceux coupés ESSAIS_MAX fois sont abandonnés, et le chiffre de la cloche de chaque personne du lot est compté,
// plus ses messages non lus (la pastille sur l'icône de l'appli). Une requête à la base. `ici` : l'heure de Paris.
export async function prendreEnvois(base: Base, max: number, maintenant = new Date(), ici = heureDeParis(maintenant)): Promise<{ jeton: string; envois: Envoi[] }> {
	const aujourdhui = exigerDateHeure(ici, 'Date');
	const jeton = crypto.randomUUID();
	const limite = new Date(maintenant.getTime() - REPRISE_MINUTES * 60_000).toISOString();
	const libres = or(isNull(envoiPush.reserveeLe), and(lte(envoiPush.reserveeLe, limite), lt(envoiPush.essais, ESSAIS_MAX)));
	const premiers = base.select({ id: envoiPush.id }).from(envoiPush).where(libres).orderBy(asc(envoiPush.id)).limit(max);
	const duLot = base.select({ id: abonnementPush.personneId }).from(envoiPush).innerJoin(abonnementPush, eq(abonnementPush.id, envoiPush.abonnementId)).where(eq(envoiPush.jeton, jeton));
	const [abandonnes, , lignes, cloches] = await base.batch([
		base
			.delete(envoiPush)
			.where(and(lte(envoiPush.reserveeLe, limite), gte(envoiPush.essais, ESSAIS_MAX)))
			.returning({ id: envoiPush.id }),
		base
			.update(envoiPush)
			.set({ jeton, reserveeLe: maintenant.toISOString(), essais: sql`${envoiPush.essais} + 1` })
			.where(inArray(envoiPush.id, premiers)),
		base
			.select({ id: envoiPush.id, abonnementId: envoiPush.abonnementId, personneId: abonnementPush.personneId, endpoint: abonnementPush.endpoint, p256dh: abonnementPush.p256dh, auth: abonnementPush.auth, essais: envoiPush.essais, donnees: envoiPush.donnees })
			.from(envoiPush)
			.innerJoin(abonnementPush, eq(abonnementPush.id, envoiPush.abonnementId))
			.where(eq(envoiPush.jeton, jeton))
			.orderBy(asc(envoiPush.id)),
		base
			.select({ id: personne.id, n: sql<number>`${clocheSql(sql`"personne"."id"`, aujourdhui, ici)} + ${nonLusPour(sql`"personne"."id"`, aujourdhui)}`.as('n') })
			.from(personne)
			.where(inArray(personne.id, duLot))
	]);
	if (abandonnes.length > 0) console.warn('Notifications abandonnées après des envois coupés', abandonnes.length);
	const pastille = new Map(cloches.map((c) => [c.id, c.n]));
	return { jeton, envois: lignes.map((l) => ({ ...l, donnees: JSON.parse(l.donnees) as DonneesPush, pastille: pastille.get(l.personneId) ?? 0 })) };
}

// Le lot est parti : ses envois sont retirés de la file, qu'ils aient été reçus ou refusés (jamais renvoyés), et les abonnements
// périmés (le service push répond 404 ou 410) supprimés, avec leurs envois. Une requête à la base.
export async function finirEnvois(base: Base, jeton: string, perimes: number[]): Promise<void> {
	const retires = base.delete(envoiPush).where(eq(envoiPush.jeton, jeton));
	if (perimes.length === 0) await retires;
	else await base.batch([retires, base.delete(abonnementPush).where(inArray(abonnementPush.id, parmi(perimes)))]);
}

// Ménage de nuit : notifications et envois restés en file créés avant `avant` (AAAA-MM-JJ).
export async function effacerVieillesNotifications(base: Base, avant: string): Promise<void> {
	exigerDate(avant);
	await base.batch([base.delete(notification).where(lt(notification.creeLe, avant)), base.delete(avisReservation).where(lt(avisReservation.creeLe, avant)), base.delete(avisRemplacement).where(lt(avisRemplacement.creeLe, avant)), base.delete(avisEte).where(lt(avisEte.creeLe, avant)), base.delete(avisAnomalie).where(lt(avisAnomalie.creeLe, avant)), base.delete(avisHabillement).where(lt(avisHabillement.creeLe, avant)), base.delete(envoiPush).where(lt(envoiPush.creeLe, avant))]);
}

// Au départ d'une personne : ses appareils, son fil et ses coupures. Écritures à placer dans un batch.
export const effacerNotificationsDe = (base: Base, personneId: number) =>
	[base.delete(abonnementPush).where(eq(abonnementPush.personneId, personneId)), base.delete(notification).where(eq(notification.personneId, personneId)), base.delete(avisReservation).where(eq(avisReservation.personneId, personneId)), base.delete(avisRemplacement).where(eq(avisRemplacement.personneId, personneId)), base.delete(avisEte).where(eq(avisEte.personneId, personneId)), base.delete(avisAnomalie).where(eq(avisAnomalie.personneId, personneId)), base.delete(avisHabillement).where(eq(avisHabillement.personneId, personneId)), base.delete(souhaitAnniversaire).where(or(eq(souhaitAnniversaire.personneId, personneId), eq(souhaitAnniversaire.auteurId, personneId))), base.delete(coupure).where(eq(coupure.personneId, personneId))] as const;
