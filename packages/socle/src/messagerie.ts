import { and, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, max, ne, notInArray, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Base, BasePhotos } from './base.ts';
import { requeteTenues } from './casquettes.ts';
import { nomActeur } from './actions/personnes.ts';
import { avecPhotos, effacerPhotos, exigerPhotos, lireOctets, roleDe, texte, type Photo } from './commun.ts';
import { exigerDate, exigerDateHeure } from './dates.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { iconeDuComite, NOMS_ICONES, type NomIcone } from './icones.ts';
import { ligneJournal } from './journal.ts';
import { REACTIONS, STATUTS_AVEC_ACCES, type Reaction, type TypeConversation } from './listes.ts';
import { agentsDuJour, lecturesAgents, membresDe, type AgentDuJour } from './murs.ts';
import { affectationEquipe, comite, conversation, equipe, membreConversation, message, personne, photoMessage as photoDeMessage, reactionMessage, signalementMessage } from './schema.ts';

const PAGE = 40;
const EXTRAIT = 100;
const TAILLE_GROUPE = 60;

type Ecriture = BatchItem<'sqlite'>;

type Visage = { id: number; prenom: string; nom: string; couleur: string | null };

export type VueMessage = {
	id: number;
	auteur: Visage | null;
	texte: string;
	cree_le: string;
	modifie: boolean;
	supprime: 'auteur' | 'moderation' | null;
	// La phrase d'un message système (« Romain a ajouté Manon »).
	systeme: string | null;
	reponse: { id: number; auteur: Visage | null; extrait: string } | null;
	photos: number[];
	reactions: { emoji: Reaction; nombre: number; deMoi: boolean }[];
	moi: boolean;
	coche: 'envoye' | 'lu' | null;
};

// `messages` : du plus ancien au plus récent. `plusAnciens` : il en reste avant la page.
export type VueConversation = {
	id: number;
	type: TypeConversation;
	nom: string;
	icone: string | null;
	membres: Visage[];
	messages: VueMessage[];
	premierNonLu: number | null;
	lectureSeule: boolean;
	plusAnciens: boolean;
	// Repère à rendre à suiteConversation.
	majLe: string;
};

// `personne` : l'autre, pour une conversation à deux.
export type ApercuConversation = {
	id: number;
	type: TypeConversation;
	nom: string;
	icone: string | null;
	personne: Visage | null;
	apercu: string;
	dernier_le: string;
	nonLus: number;
};

const refus = (raison = 'Messagerie non accessible') => new RefusDroit('UTILISER_MESSAGERIE', { type: 'centre' }, raison);

// Le super administrateur n'a pas de fiche, donc pas de messagerie.
function idDe(acteur: Acteur): number {
	if (acteur.type !== 'personne') throw refus('Le super administrateur n’a pas de messagerie');
	return acteur.id;
}

// Contenu d'un message système, en JSON dans `message.systeme`. Sans `par`, le relais d'animation est automatique.
type Systeme =
	| { type: 'creation'; par: number; membres: number[] }
	| { type: 'ajout' | 'retrait'; par: number; cibles: number[] }
	| { type: 'animateur'; par?: number; cibles: number[] }
	| { type: 'depart'; par: number }
	| { type: 'renommage'; par: number; nom: string };

const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// « Manon », « Manon et Claire », « Manon, Claire et Léa », puis « Manon, Claire et 2 autres personnes ».
function enumerer(noms: string[]): string {
	if (noms.length > 3) return `${noms.slice(0, 2).join(', ')} et ${noms.length - 2} autres personnes`;
	return noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}` : (noms[0] ?? '');
}

// La phrase d'un message système. `noms` : prénom de chaque personne citée.
export function phraseSysteme(systeme: string, noms: Map<number, string>): string {
	const s = JSON.parse(systeme) as Systeme;
	const nom = (id: number) => noms.get(id) ?? 'un ancien membre';
	const qui = s.par === undefined ? '' : majuscule(nom(s.par));
	const cibles = 'cibles' in s ? enumerer(s.cibles.map(nom)) : '';
	switch (s.type) {
		case 'creation':
			return `${qui} a créé le groupe`;
		case 'ajout':
			return `${qui} a ajouté ${cibles}`;
		case 'retrait':
			return `${qui} a retiré ${cibles}`;
		case 'depart':
			return `${qui} a quitté le groupe`;
		case 'renommage':
			return `${qui} a renommé le groupe en « ${s.nom} »`;
		case 'animateur':
			return s.par === undefined ? `${majuscule(cibles)} anime désormais le groupe` : `${qui} a confié l’animation du groupe à ${cibles}`;
	}
}

// Les personnes citées par les messages système retenus par `filtre`.
const citesParSysteme = (filtre: SQL | undefined) => sql`(select j.value from ${message}, json_tree(${message.systeme}) j where ${and(isNotNull(message.systeme), filtre)} and j.type = 'integer')`;

const STATUTS = sql.raw(STATUTS_AVEC_ACCES.map((s) => `'${s}'`).join(', '));

// Seule règle d'accès à la messagerie, en SQL pour l'appliquer à beaucoup de personnes en une requête : un agent qui a accès
// (ni parti, ni suspendu, ni extérieur) et qui tient UTILISER_MESSAGERIE sur le centre ce jour-là, par son profil ou par une
// responsabilité en cours (même calcul que droitsDe, vérifié par les tests).
export function aLaMessagerie(id: SQLWrapper | number, aujourdhui: string): SQL {
	return sql`exists (select 1 from personne p left join profil pr on pr.id = p.profil_id
		where p.id = ${id} and p.statut in (${STATUTS}) and (pr.type_personne is null or pr.type_personne <> 'exterieur')
		and (exists (select 1 from profil_droit pd where pd.profil_id = p.profil_id and pd.droit = 'UTILISER_MESSAGERIE' and pd.perimetre_type = 'centre')
			or exists (select 1 from attribution a
				join responsabilite_droit rd on rd.responsabilite_id = a.responsabilite_id and rd.droit = 'UTILISER_MESSAGERIE'
				join responsabilite r on r.id = a.responsabilite_id
				where a.personne_id = p.id and a.perimetre_type = 'centre' and r.type_perimetre = 'centre' and a.debut <= ${aujourdhui} and (a.fin is null or a.fin >= ${aujourdhui}))))`;
}

const lireAcces = (base: Base, id: number, aujourdhui: string) => base.select({ id: personne.id }).from(personne).where(and(eq(personne.id, id), aLaMessagerie(id, aujourdhui)));

export async function exigerMessagerie(base: Base, acteur: Acteur, aujourdhui: string): Promise<number> {
	const moi = idDe(acteur);
	if ((await lireAcces(base, moi, aujourdhui)).length === 0) throw refus();
	return moi;
}

// Équipe en cours de chaque agent (la première trouvée).
const affectationsDuJour = (base: Base, aujourdhui: string) =>
	base
		.select({ personneId: affectationEquipe.personneId, numero: equipe.ordreRotation, couleur: equipe.couleur })
		.from(affectationEquipe)
		.innerJoin(equipe, eq(equipe.id, affectationEquipe.equipeId))
		.where(and(lte(affectationEquipe.debut, aujourdhui), or(isNull(affectationEquipe.fin), gte(affectationEquipe.fin, aujourdhui))));

function equipesDe(lignes: { personneId: number; numero: number; couleur: string }[]): Map<number, { numero: number; couleur: string }> {
	const parPersonne = new Map<number, { numero: number; couleur: string }>();
	for (const l of lignes) if (!parPersonne.has(l.personneId)) parPersonne.set(l.personneId, { numero: l.numero, couleur: l.couleur });
	return parPersonne;
}

const parNom = (a: { nom: string; prenom: string }, b: { nom: string; prenom: string }) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr');

// Les agents à qui l'acteur peut écrire, triés par nom. Une requête (un batch).
export async function annuaire(base: Base, acteur: Acteur, aujourdhui: string) {
	const moi = idDe(acteur);
	const [acces, agents, affectations, tenues] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, surnom: personne.surnom })
			.from(personne)
			.where(and(ne(personne.id, moi), aLaMessagerie(personne.id, aujourdhui))),
		affectationsDuJour(base, aujourdhui),
		requeteTenues(base, null, aujourdhui)
	]);
	if (acces.length === 0) throw refus();
	const equipes = equipesDe(affectations);
	return agents.map((a) => ({ ...a, equipe: equipes.get(a.id) ?? null, role: roleDe(tenues, a.id) })).sort(parNom);
}

// Une conversation à deux dont l'autre n'a plus la messagerie (parti, suspendu) ne sert plus qu'à relire.
const enLectureSeule = (type: TypeConversation, autres: { acces: number }[]) => type === 'deux' && (autres.length === 0 || autres.some((a) => !a.acces));

// Sans texte, au moins une photo.
function corpsDe(valeur: unknown, photos: number): string {
	if (photos > 0 && (typeof valeur !== 'string' || !valeur.trim())) return '';
	return texte(valeur, 'Message', 4000);
}

const dernierMessage = sql`(select max(${message.id}) from ${message})`;

const clePaire = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

function exigerId(valeur: unknown, libelle: string): number {
	if (!Number.isInteger(valeur) || (valeur as number) <= 0) throw new DonneeInvalide(`${libelle} invalide`);
	return valeur as number;
}

// La conversation à deux entre l'acteur et cette personne, si elle existe. Une requête (un batch).
export async function conversationAvec(base: Base, acteur: Acteur, personneId: number, aujourdhui: string): Promise<number | null> {
	const moi = idDe(acteur);
	const [acces, lignes] = await base.batch([lireAcces(base, moi, aujourdhui), base.select({ id: conversation.id }).from(conversation).where(eq(conversation.clePaire, clePaire(moi, exigerId(personneId, 'Personne'))))]);
	if (acces.length === 0) throw refus();
	return lignes[0]?.id ?? null;
}

// Envoie un message à une conversation, ou à une personne : la conversation à deux est alors créée au premier envoi.
// Deux requêtes : les contrôles, puis l'écriture ; une de plus pour les photos, écrites d'abord dans PHOTOS.
// Le texte n'est jamais écrit au journal.
export async function envoyer(
	base: Base,
	basePhotos: BasePhotos,
	acteur: Acteur,
	cible: { conversation: number } | { personne: number },
	donnees: { texte: string; reponseA?: number; photos?: Photo[] },
	maintenant: string
): Promise<{ conversation: number; message: number }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = idDe(acteur);
	const photos = exigerPhotos(donnees.photos);
	const corps = corpsDe(donnees.texte, photos.length);
	const reponseA = donnees.reponseA === undefined ? null : exigerId(donnees.reponseA, 'Réponse');

	const aDeux = 'personne' in cible;
	const autre = aDeux ? exigerId(cible.personne, 'Personne') : null;
	if (autre === moi) throw new DonneeInvalide('Écrivez à quelqu’un d’autre');
	const cle = autre === null ? null : clePaire(moi, autre);
	const laConversation = cle === null ? sql`${exigerId((cible as { conversation: number }).conversation, 'Conversation')}` : sql`(select ${conversation.id} from ${conversation} where ${conversation.clePaire} = ${cle})`;

	const [acces, place, autres, cite] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		base
			.select({ id: conversation.id, type: conversation.type })
			.from(conversation)
			.innerJoin(membreConversation, and(eq(membreConversation.conversationId, conversation.id), eq(membreConversation.personneId, moi)))
			.where(eq(conversation.id, laConversation)),
		// La personne visée ou, pour une conversation, les autres membres : ont-ils encore la messagerie ?
		base
			.select({ id: personne.id, acces: sql<number>`${aLaMessagerie(personne.id, aujourdhui)}`.as('acces') })
			.from(personne)
			.where(autre !== null ? eq(personne.id, autre) : inArray(personne.id, base.select({ id: membreConversation.personneId }).from(membreConversation).where(and(eq(membreConversation.conversationId, laConversation), ne(membreConversation.personneId, moi))))),
		base
			.select({ id: message.id })
			.from(message)
			.where(and(eq(message.id, reponseA ?? 0), eq(message.conversationId, laConversation)))
	]);
	if (acces.length === 0) throw refus();
	const existante = place[0];
	if (autre !== null && !autres[0]?.acces) throw new DonneeInvalide('Cette personne n’est pas dans l’annuaire');
	if (autre === null && !existante) throw refus('Conversation non accessible');
	if (existante && enLectureSeule(existante.type, autres)) throw new DonneeInvalide('Conversation en lecture seule');
	if (reponseA !== null && cite.length === 0) throw new DonneeInvalide('Message cité introuvable');

	const id = existante ? sql`${existante.id}` : laConversation;
	const nouveau = base
		.insert(message)
		.values({ conversationId: id, auteur: moi, texte: corps, reponseA, creeLe: maintenant, majLe: maintenant })
		.returning({ id: message.id, conversation: message.conversationId });
	// Voulu, comme WhatsApp : envoyer marque la conversation comme lue, messages reçus avant compris.
	const lu = marquerLu(base, id, moi, sql`(select max(${message.id}) from ${message} where ${message.conversationId} = ${id})`, maintenant);

	// Après l'insertion du message : dans le batch, le plus grand id de message est le sien.
	const references = (ids: number[]) => (ids.length === 0 ? [] : [base.insert(photoDeMessage).values(photos.map((p, ordre) => ({ messageId: dernierMessage, ordre, type: p.type, photoId: ids[ordre]! })))]);

	if (existante)
		return avecPhotos(basePhotos, photos, maintenant, async (ids) => {
			const [lignes] = await base.batch([nouveau, base.update(conversation).set({ dernierLe: maintenant }).where(eq(conversation.id, id)), ...lu, ...references(ids)]);
			return { conversation: lignes[0]!.conversation, message: lignes[0]!.id };
		});
	try {
		return await avecPhotos(basePhotos, photos, maintenant, async (ids) => {
			const [, , , lignes] = await base.batch([
				base.insert(conversation).values({ type: 'deux', clePaire: cle, creePar: moi, creeLe: maintenant, dernierLe: maintenant }),
				ligneJournal(base, { acteur: `personne:${moi}`, action: 'creer_conversation', cibleType: 'conversation', cibleId: id, details: { type: 'deux' } }, maintenant),
				base.insert(membreConversation).values([moi, autre!].map((personneId) => ({ conversationId: id, personneId, entreLe: maintenant }))),
				nouveau,
				...lu,
				...references(ids)
			]);
			return { conversation: lignes[0]!.conversation, message: lignes[0]!.id };
		});
	} catch (erreur) {
		// Créée entre-temps par l’autre : on la rejoint (les photos, effacées, sont réécrites).
		for (let e: unknown = erreur; e instanceof Error; e = e.cause)
			if (/UNIQUE constraint failed: conversation\.cle_paire/.test(e.message)) {
				const [trouvee] = await base.select({ id: conversation.id }).from(conversation).where(eq(conversation.clePaire, cle!));
				return envoyer(base, basePhotos, acteur, { conversation: trouvee!.id }, donnees, maintenant);
			}
		throw erreur;
	}
}

const extrait = sql<string>`case when ${message.supprime} is null then substr(${message.texte}, 1, ${EXTRAIT}) else '' end`;

// Repère du rafraîchissement : 10 secondes avant maintenant, pour ne pas perdre une écriture finie juste après la lecture
// (un message déjà vu peut alors revenir une fois de plus, sans gêne).
function repere(maintenant: string): string {
	return new Date(Date.parse(`${maintenant.length === 16 ? `${maintenant}:00` : maintenant}Z`) - 10_000).toISOString().slice(0, 19);
}

// La conversation, si l'acteur en est membre.
const placeDe = (base: Base, id: number, moi: number) =>
	base
		.select({ id: conversation.id, type: conversation.type, nom: conversation.nom, icone: conversation.icone })
		.from(conversation)
		.innerJoin(membreConversation, and(eq(membreConversation.conversationId, conversation.id), eq(membreConversation.personneId, moi)))
		.where(eq(conversation.id, id));

// Lectures, à placer dans un batch, pour montrer les messages retenus par `choisis` (une condition sur `message`) :
// membres, messages (du plus récent au plus ancien), messages cités, personnes, équipes, réactions et photos.
function lecturesDuFil(base: Base, id: number, moi: number, aujourdhui: string, choisis: SQL) {
	const idsChoisis = base.select({ id: message.id }).from(message).where(choisis);
	return [
		base
			.select({
				id: membreConversation.personneId,
				luJusquA: membreConversation.luJusquA,
				entreLe: membreConversation.entreLe,
				coches: personne.cochesLecture,
				acces: sql<number>`${aLaMessagerie(membreConversation.personneId, aujourdhui)}`.as('acces')
			})
			.from(membreConversation)
			.innerJoin(personne, eq(personne.id, membreConversation.personneId))
			.where(eq(membreConversation.conversationId, id)),
		base.select().from(message).where(choisis).orderBy(desc(message.id)),
		base
			.select({ id: message.id, auteur: message.auteur, extrait })
			.from(message)
			.where(and(eq(message.conversationId, id), inArray(message.id, base.select({ id: message.reponseA }).from(message).where(choisis)))),
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom })
			.from(personne)
			.where(
				or(
					inArray(personne.id, base.select({ id: membreConversation.personneId }).from(membreConversation).where(eq(membreConversation.conversationId, id))),
					inArray(personne.id, base.selectDistinct({ id: message.auteur }).from(message).where(and(eq(message.conversationId, id), isNotNull(message.auteur)))),
					inArray(personne.id, citesParSysteme(eq(message.conversationId, id)))
				)
			),
		affectationsDuJour(base, aujourdhui),
		base
			.select({ messageId: reactionMessage.messageId, emoji: reactionMessage.emoji, nombre: count(), deMoi: sql<number>`max(${reactionMessage.personneId} = ${moi})`.as('de_moi') })
			.from(reactionMessage)
			.where(inArray(reactionMessage.messageId, idsChoisis))
			.groupBy(reactionMessage.messageId, reactionMessage.emoji),
		base.select({ id: photoDeMessage.id, messageId: photoDeMessage.messageId }).from(photoDeMessage).where(inArray(photoDeMessage.messageId, idsChoisis)).orderBy(photoDeMessage.messageId, photoDeMessage.ordre)
	] as const;
}

type Resultats<T extends readonly unknown[]> = { -readonly [K in keyof T]: Awaited<T[K]> };
type LuDuFil = Resultats<ReturnType<typeof lecturesDuFil>>;

// Ce que lecturesDuFil a lu, mis en forme pour l'acteur.
function filDe(moi: number, [membres, messages, cites, auteurs, affectations, reactions, photos]: LuDuFil) {
	const equipes = equipesDe(affectations);
	const visages = new Map(auteurs.map((a) => [a.id, { id: a.id, prenom: a.prenom, nom: a.nom, couleur: equipes.get(a.id)?.couleur ?? null }]));
	const visage = (pid: number | null) => (pid === null ? null : (visages.get(pid) ?? null));
	const prenoms = new Map(auteurs.map((a) => [a.id, a.prenom]));
	const autres = membres.filter((m) => m.id !== moi);
	const mesCoches = membres.find((m) => m.id === moi)?.coches === 1;
	const citesParId = new Map(cites.map((c) => [c.id, { id: c.id, auteur: visage(c.auteur), extrait: c.extrait }]));

	// « lu » quand tous les autres présents à l'envoi, coches ouvertes, l'ont lu ; aucune coche si l'acteur a coupé les siennes.
	const coche = (m: (typeof messages)[number]): VueMessage['coche'] => {
		if (m.auteur !== moi || m.systeme !== null || !mesCoches) return null;
		const lecteurs = autres.filter((a) => a.coches === 1 && a.entreLe <= m.creeLe);
		return lecteurs.length > 0 && lecteurs.every((a) => a.luJusquA >= m.id) ? 'lu' : 'envoye';
	};
	const reactionsDe = (idMessage: number) =>
		reactions
			.filter((r) => r.messageId === idMessage)
			.sort((a, b) => REACTIONS.indexOf(a.emoji) - REACTIONS.indexOf(b.emoji))
			.map((r) => ({ emoji: r.emoji, nombre: r.nombre, deMoi: r.deMoi === 1 }));
	const vue = (m: (typeof messages)[number]): VueMessage => ({
		id: m.id,
		auteur: visage(m.auteur),
		texte: m.supprime === null ? m.texte : '',
		cree_le: m.creeLe,
		modifie: m.modifie === 1,
		supprime: m.supprime,
		systeme: m.systeme === null ? null : phraseSysteme(m.systeme, prenoms),
		reponse: m.reponseA === null ? null : (citesParId.get(m.reponseA) ?? null),
		photos: m.supprime === null ? photos.filter((p) => p.messageId === m.id).map((p) => p.id) : [],
		reactions: m.supprime === null ? reactionsDe(m.id) : [],
		moi: m.auteur === moi,
		coche: coche(m)
	});
	return { membres, messages, autres, visage, vue, monLu: membres.find((m) => m.id === moi)?.luJusquA ?? 0 };
}

// L'acteur a lu jusqu'au message `jusqua`. Chez les auteurs des messages qu'il découvre, la coche peut changer : `lu_le` avance,
// sauf s'il a coupé ses coches. À placer dans un batch.
function marquerLu(base: Base, id: number | SQL, moi: number, jusqua: number | SQL, maintenant: string): [Ecriture, Ecriture] {
	const monLu = sql`(select ${membreConversation.luJusquA} from ${membreConversation} where ${membreConversation.conversationId} = ${id} and ${membreConversation.personneId} = ${moi})`;
	return [
		base
			.update(message)
			.set({ luLe: maintenant })
			.where(
				and(
					eq(message.conversationId, id),
					isNotNull(message.auteur),
					ne(message.auteur, moi),
					gt(message.id, monLu),
					lte(message.id, jusqua),
					sql`exists (select 1 from ${personne} where ${personne.id} = ${moi} and ${personne.cochesLecture} = 1)`
				)
			),
		base
			.update(membreConversation)
			.set({ luJusquA: sql`max(${membreConversation.luJusquA}, ${jusqua})` })
			.where(and(eq(membreConversation.conversationId, id), eq(membreConversation.personneId, moi)))
	];
}

// Une page de 40 messages au plus (les plus récents, ou ceux d'avant `page.avant`). Sur la dernière page, l'acteur a lu
// jusqu'au dernier message. Deux requêtes au plus, réactions et photos comprises. Seuls les membres lisent, chef de centre compris.
export async function lireConversation(base: Base, acteur: Acteur, id: number, page: { avant?: number }, maintenant: string): Promise<VueConversation> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = idDe(acteur);
	exigerId(id, 'Conversation');
	const avant = page.avant === undefined ? null : exigerId(page.avant, 'Page');
	const dansLaPage = and(eq(message.conversationId, id), avant === null ? undefined : lt(message.id, avant));
	const idsDeLaPage = base.select({ id: message.id }).from(message).where(dansLaPage).orderBy(desc(message.id)).limit(PAGE + 1);
	const luParMoi = sql`(select ${membreConversation.luJusquA} from ${membreConversation} where ${membreConversation.conversationId} = ${id} and ${membreConversation.personneId} = ${moi})`;

	const [acces, place, nonLu, ...lus] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		placeDe(base, id, moi),
		base
			.select({ premier: sql<number | null>`min(${message.id})`.as('premier') })
			.from(message)
			.where(and(eq(message.conversationId, id), gt(message.id, luParMoi), ne(message.auteur, moi), isNull(message.supprime))),
		...lecturesDuFil(base, id, moi, aujourdhui, inArray(message.id, idsDeLaPage))
	]);
	if (acces.length === 0) throw refus();
	const conv = place[0];
	if (!conv) throw refus('Conversation non accessible');

	const fil = filDe(moi, lus);
	const vues = fil.messages.slice(0, PAGE).reverse().map(fil.vue);
	const dernier = vues.at(-1)?.id;
	if (avant === null && dernier !== undefined && dernier > fil.monLu) await base.batch(marquerLu(base, id, moi, dernier, maintenant));

	const autre = fil.visage(fil.autres[0]?.id ?? null);
	return {
		id: conv.id,
		type: conv.type,
		nom: conv.type === 'deux' ? (autre ? `${autre.prenom} ${autre.nom}` : '') : (conv.nom ?? ''),
		icone: conv.icone,
		membres: fil.membres.map((m) => fil.visage(m.id)).filter((v) => v !== null),
		messages: vues,
		premierNonLu: nonLu[0]?.premier ?? null,
		lectureSeule: enLectureSeule(conv.type, fil.autres),
		plusAnciens: fil.messages.length > PAGE,
		majLe: repere(maintenant)
	};
}

// Rafraîchissement d'une conversation ouverte : les messages arrivés après `depuis.dernierId` (40 au plus, les plus anciens
// d'abord ; le reste au passage suivant) et ceux d'avant qui ont changé depuis `depuis.majLe` (modifiés, supprimés, réactions,
// ou coche de l'acteur). L'acteur a lu les nouveaux. Deux requêtes au plus, une s'il n'y a rien de nouveau.
export async function suiteConversation(
	base: Base,
	acteur: Acteur,
	id: number,
	depuis: { dernierId: number; majLe: string },
	maintenant: string
): Promise<{ nouveaux: VueMessage[]; modifies: VueMessage[]; majLe: string; nonLusTotal: number }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = idDe(acteur);
	exigerId(id, 'Conversation');
	const dernierId = depuis.dernierId;
	if (!Number.isInteger(dernierId) || dernierId < 0) throw new DonneeInvalide('Repère invalide');
	exigerDateHeure(depuis.majLe, 'Repère');
	const nouveauxIds = base
		.select({ id: message.id })
		.from(message)
		.where(and(eq(message.conversationId, id), gt(message.id, dernierId)))
		.orderBy(message.id)
		.limit(PAGE);
	const changes = and(lte(message.id, dernierId), or(gt(message.majLe, depuis.majLe), and(eq(message.auteur, moi), gt(message.luLe, depuis.majLe))));
	const choisis = and(eq(message.conversationId, id), or(inArray(message.id, nouveauxIds), changes))!;

	const [acces, place, total, ...lus] = await base.batch([lireAcces(base, moi, aujourdhui), placeDe(base, id, moi), totalNonLus(base, moi), ...lecturesDuFil(base, id, moi, aujourdhui, choisis)]);
	if (acces.length === 0) throw refus();
	if (!place[0]) throw refus('Conversation non accessible');

	const fil = filDe(moi, lus);
	const vues = fil.messages.toReversed().map(fil.vue);
	const nouveaux = vues.filter((m) => m.id > dernierId);
	let nonLus = total[0]?.n ?? 0;
	const dernier = nouveaux.at(-1)?.id;
	if (dernier !== undefined && dernier > fil.monLu) {
		const [, , recompte] = await base.batch([...marquerLu(base, id, moi, dernier, maintenant), totalNonLus(base, moi)]);
		nonLus = recompte[0]?.n ?? 0;
	}
	return { nouveaux, modifies: vues.filter((m) => m.id <= dernierId), majLe: repere(maintenant), nonLusTotal: nonLus };
}

// Messages non lus de l'acteur dans ses conversations : ni les siens, ni les messages système ou supprimés.
const nonLusDe = (moi: number) =>
	and(
		eq(message.conversationId, membreConversation.conversationId),
		eq(membreConversation.personneId, moi),
		gt(message.id, membreConversation.luJusquA),
		isNotNull(message.auteur),
		ne(message.auteur, moi),
		isNull(message.supprime)
	);

// Les conversations de l'acteur, la plus récente d'abord. Une requête (un batch).
export async function mesConversations(base: Base, acteur: Acteur, maintenant: string): Promise<ApercuConversation[]> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = idDe(acteur);
	const miennes = base.select({ id: membreConversation.conversationId }).from(membreConversation).where(eq(membreConversation.personneId, moi));
	const derniersIds = base.select({ id: max(message.id) }).from(message).where(inArray(message.conversationId, miennes)).groupBy(message.conversationId);

	const [acces, conversations, derniers, nonLus, autres, affectations, cites] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		base
			.select({ id: conversation.id, type: conversation.type, nom: conversation.nom, icone: conversation.icone, dernierLe: conversation.dernierLe })
			.from(conversation)
			.where(inArray(conversation.id, miennes))
			.orderBy(desc(conversation.dernierLe), desc(conversation.id)),
		base
			.select({ conversationId: message.conversationId, auteur: message.auteur, systeme: message.systeme, supprime: message.supprime, extrait, prenom: personne.prenom })
			.from(message)
			.leftJoin(personne, eq(personne.id, message.auteur))
			.where(inArray(message.id, derniersIds)),
		base.select({ conversationId: message.conversationId, n: count() }).from(message).innerJoin(membreConversation, nonLusDe(moi)).groupBy(message.conversationId),
		base
			.select({ conversationId: membreConversation.conversationId, id: personne.id, prenom: personne.prenom, nom: personne.nom })
			.from(membreConversation)
			.innerJoin(personne, eq(personne.id, membreConversation.personneId))
			.innerJoin(conversation, eq(conversation.id, membreConversation.conversationId))
			.where(and(inArray(membreConversation.conversationId, miennes), ne(membreConversation.personneId, moi), eq(conversation.type, 'deux'))),
		affectationsDuJour(base, aujourdhui),
		base
			.select({ id: personne.id, prenom: personne.prenom })
			.from(personne)
			.where(inArray(personne.id, citesParSysteme(inArray(message.id, derniersIds))))
	]);
	if (acces.length === 0) throw refus();
	const equipes = equipesDe(affectations);
	const prenoms = new Map(cites.map((c) => [c.id, c.prenom]));

	return conversations.map((c) => {
		const d = derniers.find((x) => x.conversationId === c.id);
		const l = autres.find((x) => x.conversationId === c.id);
		const personneVue = c.type === 'deux' && l ? { id: l.id, prenom: l.prenom, nom: l.nom, couleur: equipes.get(l.id)?.couleur ?? null } : null;
		let apercu = '';
		if (d?.systeme) apercu = phraseSysteme(d.systeme, prenoms);
		else if (d?.supprime) apercu = 'Message supprimé';
		else if (d) apercu = `${d.auteur === moi ? 'Vous' : (d.prenom ?? '')} : ${d.extrait || 'Photo'}`;
		return {
			id: c.id,
			type: c.type,
			nom: personneVue ? `${personneVue.prenom} ${personneVue.nom}` : (c.nom ?? ''),
			icone: c.icone,
			personne: personneVue,
			apercu,
			dernier_le: c.dernierLe,
			nonLus: nonLus.find((x) => x.conversationId === c.id)?.n ?? 0
		};
	});
}

const totalNonLus = (base: Base, moi: number) => base.select({ n: count() }).from(message).innerJoin(membreConversation, nonLusDe(moi));

// Total des non-lus de l'acteur (pastille d'Échanges), en une requête ; 0 sans messagerie.
export async function nonLusTotal(base: Base, acteur: Acteur, aujourdhui: string): Promise<number> {
	if (acteur.type !== 'personne') return 0;
	const [ligne] = await totalNonLus(base, acteur.id).where(aLaMessagerie(acteur.id, aujourdhui));
	return ligne?.n ?? 0;
}

// Gestes sur un message

const MODIFIABLE_MINUTES = 15;

const plusMinutes = (dateHeure: string, minutes: number) => new Date(new Date(`${dateHeure.slice(0, 16)}:00Z`).getTime() + minutes * 60_000).toISOString().slice(0, 16);

// Les photos copiées par un signalement non classé : elles restent dans PHOTOS jusqu'au classement.
const photosSignalees = sql`(select j.value from ${signalementMessage}, json_each(${signalementMessage.photosCopie}) j where ${signalementMessage.classeLe} is null)`;

// Contrôles d'un geste sur un message, en une requête : l'acteur est membre de sa conversation (sinon refus, que le message
// existe ou non). `photos` : ses photos dans PHOTOS, dans l'ordre ; `libres` : celles qu'aucun signalement ne garde ;
// `maReaction` : celle de l'acteur.
async function lireMessage(base: Base, acteur: Acteur, id: number, maintenant: string) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = idDe(acteur);
	exigerId(id, 'Message');
	const saConversation = base.select({ id: message.conversationId }).from(message).where(eq(message.id, id));
	const [acces, lignes, autres, photos, reaction] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		base
			.select({ auteur: message.auteur, texte: message.texte, supprime: message.supprime, creeLe: message.creeLe, type: conversation.type })
			.from(message)
			.innerJoin(conversation, eq(conversation.id, message.conversationId))
			.innerJoin(membreConversation, and(eq(membreConversation.conversationId, message.conversationId), eq(membreConversation.personneId, moi)))
			.where(eq(message.id, id)),
		base
			.select({ acces: sql<number>`${aLaMessagerie(membreConversation.personneId, aujourdhui)}`.as('acces') })
			.from(membreConversation)
			.where(and(inArray(membreConversation.conversationId, saConversation), ne(membreConversation.personneId, moi))),
		base
			.select({ photoId: photoDeMessage.photoId, signalee: sql<number>`${photoDeMessage.photoId} in ${photosSignalees}`.as('signalee') })
			.from(photoDeMessage)
			.where(eq(photoDeMessage.messageId, id))
			.orderBy(photoDeMessage.ordre),
		base
			.select({ emoji: reactionMessage.emoji })
			.from(reactionMessage)
			.where(and(eq(reactionMessage.messageId, id), eq(reactionMessage.personneId, moi)))
	]);
	if (acces.length === 0) throw refus();
	const m = lignes[0];
	if (!m) throw refus('Conversation non accessible');
	return { moi, ...m, lectureSeule: enLectureSeule(m.type, autres), photos: photos.map((p) => p.photoId), libres: photos.filter((p) => !p.signalee).map((p) => p.photoId), maReaction: reaction[0]?.emoji ?? null };
}

const reserveALAuteur = () => refus('Réservé à l’auteur du message');

// Une réaction par personne : en choisir une autre la remplace, renvoyer la même ou null la retire. Deux requêtes.
export async function reagir(base: Base, acteur: Acteur, idMessage: number, emoji: Reaction | null, maintenant: string): Promise<void> {
	if (emoji !== null && !(REACTIONS as readonly string[]).includes(emoji)) throw new DonneeInvalide('Réaction inconnue');
	const m = await lireMessage(base, acteur, idMessage, maintenant);
	if (m.auteur === null || m.supprime !== null) throw new DonneeInvalide('Pas de réaction sur ce message');
	if (m.lectureSeule) throw new DonneeInvalide('Conversation en lecture seule');
	const sienne = and(eq(reactionMessage.messageId, idMessage), eq(reactionMessage.personneId, m.moi));
	await base.batch([
		emoji === null || emoji === m.maReaction
			? base.delete(reactionMessage).where(sienne)
			: base
					.insert(reactionMessage)
					.values({ messageId: idMessage, personneId: m.moi, emoji })
					.onConflictDoUpdate({ target: [reactionMessage.messageId, reactionMessage.personneId], set: { emoji } }),
		// Le rafraîchissement voit le changement.
		base.update(message).set({ majLe: maintenant }).where(eq(message.id, idMessage))
	]);
}

// Par l'auteur, dans les 15 minutes après l'envoi. Deux requêtes. Le texte n'est jamais écrit au journal.
export async function modifierMessage(base: Base, acteur: Acteur, id: number, nouveau: string, maintenant: string): Promise<void> {
	const m = await lireMessage(base, acteur, id, maintenant);
	if (m.auteur !== m.moi) throw reserveALAuteur();
	if (m.supprime !== null) throw new DonneeInvalide('Message supprimé');
	if (m.lectureSeule) throw new DonneeInvalide('Conversation en lecture seule');
	if (maintenant.slice(0, 16) > plusMinutes(m.creeLe, MODIFIABLE_MINUTES)) throw new DonneeInvalide(`Modifiable ${MODIFIABLE_MINUTES} minutes après l’envoi`);
	const corps = corpsDe(nouveau, m.photos.length);
	await base.update(message).set({ texte: corps, modifie: 1, majLe: maintenant }).where(eq(message.id, id));
}

// Par l'auteur : « Message supprimé » reste à sa place, sans texte, photos ni réactions. Les octets des photos sont effacés
// ensuite, sauf ceux qu'un signalement garde.
export async function supprimerMessage(base: Base, basePhotos: BasePhotos, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	const m = await lireMessage(base, acteur, id, maintenant);
	if (m.auteur !== m.moi) throw reserveALAuteur();
	if (m.supprime !== null) throw new DonneeInvalide('Message déjà supprimé');
	await base.batch([
		base.delete(reactionMessage).where(eq(reactionMessage.messageId, id)),
		base.delete(photoDeMessage).where(eq(photoDeMessage.messageId, id)),
		base.update(message).set({ texte: '', supprime: 'auteur', majLe: maintenant }).where(eq(message.id, id))
	]);
	await effacerPhotos(basePhotos, m.libres);
}

// Une photo de message, aux membres de sa conversation seulement : l'accès se vérifie dans la base principale (une requête),
// les octets se lisent ensuite dans PHOTOS. `conversation` : celle par laquelle on la demande, qui doit être la sienne.
export async function photoMessage(base: Base, basePhotos: BasePhotos, acteur: Acteur, idPhoto: number, aujourdhui: string, conversation?: number): Promise<Photo> {
	exigerDate(aujourdhui);
	const moi = idDe(acteur);
	exigerId(idPhoto, 'Photo');
	const [acces, lignes] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		base
			.select({ photoId: photoDeMessage.photoId })
			.from(photoDeMessage)
			.innerJoin(message, eq(message.id, photoDeMessage.messageId))
			.innerJoin(membreConversation, and(eq(membreConversation.conversationId, message.conversationId), eq(membreConversation.personneId, moi)))
			.where(and(eq(photoDeMessage.id, idPhoto), conversation === undefined ? undefined : eq(message.conversationId, conversation)))
	]);
	if (acces.length === 0) throw refus();
	if (!lignes[0]) throw refus('Photo non accessible');
	return lireOctets(basePhotos, lignes[0].photoId);
}

// Groupes

const nouveauxMembres = (base: Base, id: number | SQL, ids: number[], animateur: number | null, maintenant: string) =>
	base.insert(membreConversation).select(
		base
			.select({
				conversationId: sql`${id}`.as('conversation_id'),
				personneId: personne.id,
				animateur: sql`case when ${personne.id} = ${animateur ?? 0} then 1 else 0 end`.as('animateur'),
				entreLe: sql`${maintenant}`.as('entre_le'),
				// L'historique se lit, mais ne compte pas comme non lu.
				luJusquA: sql`(select coalesce(max(${message.id}), 0) from ${message} where ${message.conversationId} = ${id})`.as('lu_jusqu_a')
			})
			.from(personne)
			.where(inArray(personne.id, ids))
	);

function ecrireSysteme(base: Base, id: number, contenu: Systeme, maintenant: string): Ecriture[] {
	return [
		base.insert(message).values({ conversationId: id, auteur: null, texte: '', systeme: JSON.stringify(contenu), creeLe: maintenant, majLe: maintenant }),
		base
			.update(conversation)
			.set({ dernierLe: sql`max(${conversation.dernierLe}, ${maintenant})` })
			.where(eq(conversation.id, id))
	];
}

type MembreGroupe = { id: number; animateur: number; entreLe: string };

// Un membre s'en va (départ ou retrait). Sans membre, le groupe est effacé avec ses messages, réactions et références de photos
// (les octets, dans PHOTOS, sont effacés ensuite par l'appelant : photosDesDerniers) ; sans animateur, le plus ancien membre
// (puis le plus petit id) le devient.
function sortie(base: Base, id: number, personneId: number, membres: MembreGroupe[], contenu: Systeme, maintenant: string): Ecriture[] {
	const restants = membres.filter((m) => m.id !== personneId).sort((a, b) => a.entreLe.localeCompare(b.entreLe) || a.id - b.id);
	const sesMessages = base.select({ id: message.id }).from(message).where(eq(message.conversationId, id));
	if (restants.length === 0)
		return [
			base.delete(reactionMessage).where(inArray(reactionMessage.messageId, sesMessages)),
			base.delete(photoDeMessage).where(inArray(photoDeMessage.messageId, sesMessages)),
			base.delete(message).where(eq(message.conversationId, id)),
			base.delete(membreConversation).where(eq(membreConversation.conversationId, id)),
			base.delete(conversation).where(eq(conversation.id, id))
		];
	const relais = restants.some((m) => m.animateur === 1) ? null : restants[0]!;
	return [
		base.delete(membreConversation).where(and(eq(membreConversation.conversationId, id), eq(membreConversation.personneId, personneId))),
		...ecrireSysteme(base, id, contenu, maintenant),
		...(relais === null
			? []
			: [
					base
						.update(membreConversation)
						.set({ animateur: 1 })
						.where(and(eq(membreConversation.conversationId, id), eq(membreConversation.personneId, relais.id))),
					...ecrireSysteme(base, id, { type: 'animateur', cibles: [relais.id] }, maintenant)
				])
	];
}

// Les photos des groupes retenus qui n'ont plus qu'un membre : si celui-ci s'en va, elles partent avec le groupe, sauf celles
// qu'un signalement garde.
const photosDesDerniers = (base: Base, groupes: SQL | undefined) =>
	base
		.select({ photoId: photoDeMessage.photoId })
		.from(photoDeMessage)
		.innerJoin(message, eq(message.id, photoDeMessage.messageId))
		.where(
			and(groupes, sql`(select count(*) from ${membreConversation} where ${membreConversation.conversationId} = ${message.conversationId}) = 1`, notInArray(photoDeMessage.photoId, photosSignalees))
		);

const executer = (base: Base, ecritures: Ecriture[]) => base.batch(ecritures as [Ecriture, ...Ecriture[]]);

function idsDe(ids: unknown): number[] {
	if (!Array.isArray(ids)) throw new DonneeInvalide('Membres invalides');
	return [...new Set(ids.map((id) => exigerId(id, 'Membre')))];
}

// Contrôles d'un geste sur un groupe, en une requête : l'acteur en est membre ; `cibles` : celles qui ont la messagerie ;
// `photos` (pour quitter seulement) : celles du groupe si l'acteur en est le dernier membre.
async function lireGroupe(base: Base, acteur: Acteur, id: number, maintenant: string, cibles: number[] = [], pourQuitter = false) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = idDe(acteur);
	exigerId(id, 'Conversation');
	const [acces, place, membres, joignables, photos = []] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		base.select({ type: conversation.type }).from(conversation).where(eq(conversation.id, id)),
		base
			.select({ id: membreConversation.personneId, animateur: membreConversation.animateur, entreLe: membreConversation.entreLe })
			.from(membreConversation)
			.where(eq(membreConversation.conversationId, id)),
		base
			.select({ id: personne.id })
			.from(personne)
			.where(and(inArray(personne.id, cibles), aLaMessagerie(personne.id, aujourdhui))),
		...(pourQuitter ? [photosDesDerniers(base, eq(message.conversationId, id))] : [])
	]);
	if (acces.length === 0) throw refus();
	const mien = membres.find((m) => m.id === moi);
	if (!place[0] || !mien) throw refus('Conversation non accessible');
	if (place[0].type !== 'groupe') throw new DonneeInvalide('Ce n’est pas un groupe');
	const estMembre = (pid: number) => membres.some((m) => m.id === pid);
	return { moi, membres, animateur: mien.animateur === 1, estMembre, joignables: new Set(joignables.map((j) => j.id)), photos: photos.map((p) => p.photoId) };
}

const reserveAuxAnimateurs = () => refus('Réservé aux animateurs du groupe');

// Crée un groupe de 2 à 60 membres, créateur compris, qui l'anime. Deux requêtes.
export async function creerGroupe(base: Base, acteur: Acteur, donnees: { nom: string; icone?: string; membres: number[] }, maintenant: string): Promise<number> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = idDe(acteur);
	const nom = texte(donnees.nom, 'Nom du groupe', 60);
	const icone = donnees.icone ?? 'groupe';
	if (!(NOMS_ICONES as readonly string[]).includes(icone)) throw new DonneeInvalide('Icône inconnue');
	const autres = idsDe(donnees.membres).filter((id) => id !== moi);
	if (autres.length === 0) throw new DonneeInvalide('Choisissez au moins une personne');
	if (autres.length + 1 > TAILLE_GROUPE) throw new DonneeInvalide(`${TAILLE_GROUPE} membres au plus`);

	const [acces, joignables] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		base
			.select({ id: personne.id })
			.from(personne)
			.where(and(inArray(personne.id, autres), aLaMessagerie(personne.id, aujourdhui)))
	]);
	if (acces.length === 0) throw refus();
	if (joignables.length !== autres.length) throw new DonneeInvalide('Une personne n’est pas dans l’annuaire');

	// Le batch est une transaction : la plus grande conversation est celle qu'on vient de créer.
	const id = sql`(select max(${conversation.id}) from ${conversation})`;
	const contenu: Systeme = { type: 'creation', par: moi, membres: autres };
	const [, , , lignes] = await base.batch([
		base.insert(conversation).values({ type: 'groupe', nom, icone, creePar: moi, creeLe: maintenant, dernierLe: maintenant }),
		ligneJournal(base, { acteur: `personne:${moi}`, action: 'creer_conversation', cibleType: 'conversation', cibleId: id, details: { type: 'groupe' } }, maintenant),
		nouveauxMembres(base, id, [moi, ...autres], moi, maintenant),
		base
			.insert(message)
			.values({ conversationId: id, auteur: null, texte: '', systeme: JSON.stringify(contenu), creeLe: maintenant, majLe: maintenant })
			.returning({ conversation: message.conversationId })
	]);
	return lignes[0]!.conversation;
}

export async function ajouterMembres(base: Base, acteur: Acteur, id: number, ids: number[], maintenant: string): Promise<void> {
	const cibles = idsDe(ids);
	if (cibles.length === 0) throw new DonneeInvalide('Choisissez au moins une personne');
	// L'acteur en est : au plus 59 de plus, contrôlé avant de lire (et de lier trop de paramètres).
	if (cibles.length + 1 > TAILLE_GROUPE) throw new DonneeInvalide(`${TAILLE_GROUPE} membres au plus`);
	const g = await lireGroupe(base, acteur, id, maintenant, cibles);
	if (!g.animateur) throw reserveAuxAnimateurs();
	if (cibles.some(g.estMembre)) throw new DonneeInvalide('Déjà membre du groupe');
	if (cibles.some((c) => !g.joignables.has(c))) throw new DonneeInvalide('Une personne n’est pas dans l’annuaire');
	if (g.membres.length + cibles.length > TAILLE_GROUPE) throw new DonneeInvalide(`${TAILLE_GROUPE} membres au plus`);
	await executer(base, [nouveauxMembres(base, id, cibles, null, maintenant), ...ecrireSysteme(base, id, { type: 'ajout', par: g.moi, cibles }, maintenant)]);
}

// Le membre retiré perd tout l'accès, historique compris.
export async function retirerMembre(base: Base, acteur: Acteur, id: number, personneId: number, maintenant: string): Promise<void> {
	const cible = exigerId(personneId, 'Membre');
	const g = await lireGroupe(base, acteur, id, maintenant);
	if (!g.animateur) throw reserveAuxAnimateurs();
	if (cible === g.moi) throw new DonneeInvalide('Pour partir, quittez le groupe');
	if (!g.estMembre(cible)) throw new DonneeInvalide('Pas membre du groupe');
	await executer(base, sortie(base, id, cible, g.membres, { type: 'retrait', par: g.moi, cibles: [cible] }, maintenant));
}

export async function nommerAnimateur(base: Base, acteur: Acteur, id: number, personneId: number, maintenant: string): Promise<void> {
	const cible = exigerId(personneId, 'Membre');
	const g = await lireGroupe(base, acteur, id, maintenant);
	if (!g.animateur) throw reserveAuxAnimateurs();
	if (!g.estMembre(cible)) throw new DonneeInvalide('Pas membre du groupe');
	if (g.membres.some((m) => m.id === cible && m.animateur === 1)) throw new DonneeInvalide('Anime déjà le groupe');
	await executer(base, [
		base
			.update(membreConversation)
			.set({ animateur: 1 })
			.where(and(eq(membreConversation.conversationId, id), eq(membreConversation.personneId, cible))),
		...ecrireSysteme(base, id, { type: 'animateur', par: g.moi, cibles: [cible] }, maintenant)
	]);
}

export async function renommerGroupe(base: Base, acteur: Acteur, id: number, nom: string, maintenant: string): Promise<void> {
	const propre = texte(nom, 'Nom du groupe', 60);
	const g = await lireGroupe(base, acteur, id, maintenant);
	await executer(base, [base.update(conversation).set({ nom: propre }).where(eq(conversation.id, id)), ...ecrireSysteme(base, id, { type: 'renommage', par: g.moi, nom: propre }, maintenant)]);
}

// Le dernier membre qui s'en va efface le groupe, et ses photos dans PHOTOS.
export async function quitterGroupe(base: Base, basePhotos: BasePhotos, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	const g = await lireGroupe(base, acteur, id, maintenant, [], true);
	await executer(base, sortie(base, id, g.moi, g.membres, { type: 'depart', par: g.moi }, maintenant));
	await effacerPhotos(basePhotos, g.photos);
}

// Départ d'un agent qui quitte le centre : il quitte tous ses groupes. Une requête. `ecritures` : à passer dans le batch du
// départ ; `photos` : à effacer ensuite dans PHOTOS, celles des groupes dont il était le dernier membre.
export async function departDesGroupes(base: Base, personneId: number, maintenant: string): Promise<{ ecritures: Ecriture[]; photos: number[] }> {
	const sesGroupes = base
		.select({ id: membreConversation.conversationId })
		.from(membreConversation)
		.innerJoin(conversation, eq(conversation.id, membreConversation.conversationId))
		.where(and(eq(membreConversation.personneId, personneId), eq(conversation.type, 'groupe')));
	const [lignes, photos] = await base.batch([
		base
			.select({ conversationId: membreConversation.conversationId, id: membreConversation.personneId, animateur: membreConversation.animateur, entreLe: membreConversation.entreLe })
			.from(membreConversation)
			.where(inArray(membreConversation.conversationId, sesGroupes)),
		photosDesDerniers(base, inArray(message.conversationId, sesGroupes))
	]);
	const parGroupe = new Map<number, MembreGroupe[]>();
	for (const l of lignes) parGroupe.set(l.conversationId, [...(parGroupe.get(l.conversationId) ?? []), l]);
	return {
		ecritures: [...parGroupe].flatMap(([id, membres]) => sortie(base, id, personneId, membres, { type: 'depart', par: personneId }, maintenant)),
		photos: photos.map((p) => p.photoId)
	};
}

// Les infos d'une conversation (écran « Infos ») : membres triés par nom. Une requête (un batch). Membres seulement.
export type InfosConversation = {
	type: TypeConversation;
	nom: string;
	icone: string | null;
	creePar: number;
	// Même s'il a quitté le groupe ; null s'il n'est plus dans la base.
	creeParPrenom: string | null;
	// `telephone` : seulement si la personne le montre.
	membres: { id: number; prenom: string; nom: string; animateur: boolean; equipe: { numero: number; couleur: string } | null; role: string | null; telephone: string | null }[];
	moiAnimateur: boolean;
};

export async function infosConversation(base: Base, acteur: Acteur, id: number, aujourdhui: string): Promise<InfosConversation> {
	exigerDate(aujourdhui);
	const moi = idDe(acteur);
	exigerId(id, 'Conversation');
	const [acces, place, membres, affectations, tenues] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		base
			.select({
				type: conversation.type,
				nom: conversation.nom,
				icone: conversation.icone,
				creePar: conversation.creePar,
				creeParPrenom: sql<string | null>`(select p.prenom from personne p where p.id = ${conversation.creePar})`
			})
			.from(conversation)
			.innerJoin(membreConversation, and(eq(membreConversation.conversationId, conversation.id), eq(membreConversation.personneId, moi)))
			.where(eq(conversation.id, id)),
		base
			.select({
				id: personne.id,
				prenom: personne.prenom,
				nom: personne.nom,
				animateur: membreConversation.animateur,
				telephone: sql<string | null>`case when ${personne.telephoneVisible} = 1 then ${personne.telephone} end`
			})
			.from(membreConversation)
			.innerJoin(personne, eq(personne.id, membreConversation.personneId))
			.where(eq(membreConversation.conversationId, id)),
		affectationsDuJour(base, aujourdhui),
		requeteTenues(base, null, aujourdhui)
	]);
	if (acces.length === 0) throw refus();
	const conv = place[0];
	if (!conv) throw refus('Conversation non accessible');
	const equipes = equipesDe(affectations);
	const autre = membres.find((m) => m.id !== moi);
	return {
		type: conv.type,
		nom: conv.type === 'deux' ? (autre ? `${autre.prenom} ${autre.nom}` : '') : (conv.nom ?? ''),
		icone: conv.icone,
		creePar: conv.creePar,
		creeParPrenom: conv.creeParPrenom,
		membres: membres
			.map((m) => ({ id: m.id, prenom: m.prenom, nom: m.nom, animateur: m.animateur === 1, equipe: equipes.get(m.id) ?? null, role: roleDe(tenues, m.id), telephone: m.telephone }))
			.sort(parNom),
		moiAnimateur: membres.some((m) => m.id === moi && m.animateur === 1)
	};
}

// Raccourcis « Groupe avec l'équipe N » et « Groupe avec <comité> » : le nom et l'icône à proposer, et les membres du jour
// (règle des murs) qui ont la messagerie, sans l'acteur. Une équipe inactive ou un comité dissous ne se proposent plus. L'acteur
// n'a pas à en être membre : l'annuaire est public. Une requête (un batch).
export async function membresPourGroupe(base: Base, acteur: Acteur, source: { equipe: number } | { comite: number }, aujourdhui: string): Promise<{ nom: string; icone: NomIcone; membres: number[] }> {
	exigerDate(aujourdhui);
	const moi = idDe(acteur);
	const pourEquipe = 'equipe' in source;
	const id = pourEquipe ? exigerId(source.equipe, 'Équipe') : exigerId(source.comite, 'Comité');
	const [acces, avecMessagerie, agents, affectations, tenues, lignes] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		base.select({ id: personne.id }).from(personne).where(aLaMessagerie(personne.id, aujourdhui)),
		...lecturesAgents(base, aujourdhui),
		pourEquipe
			? base.select({ nom: equipe.nom }).from(equipe).where(and(eq(equipe.id, id), eq(equipe.active, 1)))
			: base.select({ nom: comite.nom, theme: comite.theme, icone: comite.icone }).from(comite).where(and(eq(comite.id, id), isNull(comite.dissousLe)))
	]);
	if (acces.length === 0) throw refus();
	const trouve = lignes[0];
	if (!trouve) throw new DonneeInvalide(pourEquipe ? 'Équipe inconnue' : 'Comité inconnu');
	const membres = autresMembres(agentsDuJour([agents, affectations, tenues], aujourdhui), `${pourEquipe ? 'equipe' : 'comite'}:${id}`, moi, avecMessagerie);
	return { nom: trouve.nom, icone: 'theme' in trouve ? iconeDuComite(trouve) : 'groupe', membres };
}

const autresMembres = (agents: AgentDuJour[], cle: string, moi: number, avecMessagerie: { id: number }[]) => {
	const ouverts = new Set(avecMessagerie.map((p) => p.id));
	return membresDe(agents, cle)
		.map((a) => a.id)
		.filter((pid) => pid !== moi && ouverts.has(pid));
};

export type PourVous = {
	chefs: number[];
	equipes: { id: number; numero: number; nom: string; couleur: string; membres: number }[];
	comites: { id: number; nom: string; icone: NomIcone; membres: number }[];
};

// Raccourcis de « Nouveau message » : les chefs de mes équipes, mes équipes actives et mes comités en cours, chacun seulement
// s'il y a quelqu'un d'autre à qui écrire (mêmes membres que membresPourGroupe). Une requête (un batch).
export async function pourVous(base: Base, acteur: Acteur, aujourdhui: string): Promise<PourVous> {
	exigerDate(aujourdhui);
	const moi = idDe(acteur);
	const [acces, avecMessagerie, agents, affectations, tenues, equipes, comites] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		base.select({ id: personne.id }).from(personne).where(aLaMessagerie(personne.id, aujourdhui)),
		...lecturesAgents(base, aujourdhui),
		base.select({ id: equipe.id, numero: equipe.ordreRotation, nom: equipe.nom, couleur: equipe.couleur }).from(equipe).where(eq(equipe.active, 1)).orderBy(equipe.ordreRotation),
		base.select({ id: comite.id, nom: comite.nom, theme: comite.theme, icone: comite.icone }).from(comite).where(isNull(comite.dissousLe)).orderBy(comite.nom)
	]);
	if (acces.length === 0) throw refus();
	const tous = agentsDuJour([agents, affectations, tenues], aujourdhui);
	const a = tous.find((x) => x.id === moi)?.a;
	if (!a) return { chefs: [], equipes: [], comites: [] };
	const ouverts = new Set(avecMessagerie.map((p) => p.id));
	const compter = (cle: string) => autresMembres(tous, cle, moi, avecMessagerie).length;
	return {
		chefs: tous.filter((x) => x.id !== moi && ouverts.has(x.id) && [...a.membreEquipe].some((e) => x.a.chefEquipe.has(e))).map((x) => x.id),
		equipes: equipes
			.filter((e) => a.membreEquipe.has(e.id) || a.chefEquipe.has(e.id))
			.map((e) => ({ ...e, membres: compter(`equipe:${e.id}`) }))
			.filter((e) => e.membres > 0),
		comites: comites
			.filter((c) => a.membreComite.has(c.id))
			.map((c) => ({ id: c.id, nom: c.nom, icone: iconeDuComite(c), membres: compter(`comite:${c.id}`) }))
			.filter((c) => c.membres > 0)
	};
}

// Signalements

const MODERATION = { type: 'centre' } as const;

async function exigerModeration(base: Base, acteur: Acteur, aujourdhui: string): Promise<void> {
	if (!(await aLeDroit(base, acteur, 'MODERER_MESSAGERIE', MODERATION, aujourdhui))) throw new RefusDroit('MODERER_MESSAGERIE', MODERATION);
}

// Un membre signale le message d'un autre, une fois. Le signalement en garde une copie (texte et photos), au cas où l'auteur
// le supprime. Deux requêtes. Le texte n'est jamais écrit au journal.
export async function signaler(base: Base, acteur: Acteur, idMessage: number, maintenant: string): Promise<void> {
	const m = await lireMessage(base, acteur, idMessage, maintenant);
	if (m.auteur === null || m.supprime !== null) throw new DonneeInvalide('Ce message ne peut pas être signalé');
	if (m.auteur === m.moi) throw new DonneeInvalide('Vous ne pouvez pas signaler votre propre message');
	try {
		await base.batch([
			base.insert(signalementMessage).values({ messageId: idMessage, par: m.moi, le: maintenant, auteur: m.auteur, envoyeLe: m.creeLe, texteCopie: m.texte, photosCopie: JSON.stringify(m.photos) }),
			ligneJournal(base, { acteur: `personne:${m.moi}`, action: 'signaler_message', cibleType: 'message', cibleId: idMessage }, maintenant)
		]);
	} catch (erreur) {
		for (let e: unknown = erreur; e instanceof Error; e = e.cause) if (/UNIQUE constraint failed: signalement_message/.test(e.message)) throw new DonneeInvalide('Message déjà signalé');
		throw erreur;
	}
}

type Personne = { id: number; prenom: string; nom: string };

// `photos` : identifiants dans PHOTOS. `retirable` : le message est encore là, non supprimé.
export type Signalement = { id: number; le: string; par: Personne; auteur: Personne; envoye_le: string; texte: string; photos: number[]; retirable: boolean };

// Les signalements non classés, du plus ancien au plus récent, pour qui a MODERER_MESSAGERIE : le message signalé seul,
// jamais le reste de la conversation.
export async function signalements(base: Base, acteur: Acteur, aujourdhui: string): Promise<Signalement[]> {
	exigerDate(aujourdhui);
	await exigerModeration(base, acteur, aujourdhui);
	const enCours = isNull(signalementMessage.classeLe);
	const [lignes, personnes] = await base.batch([
		base
			.select({
				id: signalementMessage.id,
				le: signalementMessage.le,
				par: signalementMessage.par,
				auteur: signalementMessage.auteur,
				envoyeLe: signalementMessage.envoyeLe,
				texte: signalementMessage.texteCopie,
				photos: signalementMessage.photosCopie,
				retirable: sql<number>`${message.id} is not null and ${message.supprime} is null`.as('retirable')
			})
			.from(signalementMessage)
			.leftJoin(message, eq(message.id, signalementMessage.messageId))
			.where(enCours)
			.orderBy(signalementMessage.le, signalementMessage.id),
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom })
			.from(personne)
			.where(
				or(
					inArray(personne.id, base.select({ id: signalementMessage.par }).from(signalementMessage).where(enCours)),
					inArray(personne.id, base.select({ id: signalementMessage.auteur }).from(signalementMessage).where(enCours))
				)
			)
	]);
	const qui = (id: number) => personnes.find((p) => p.id === id) ?? { id, prenom: '', nom: '' };
	return lignes.map((l) => ({ id: l.id, le: l.le, par: qui(l.par), auteur: qui(l.auteur), envoye_le: l.envoyeLe, texte: l.texte, photos: JSON.parse(l.photos) as number[], retirable: l.retirable === 1 }));
}

// Un signalement non classé, en une requête. `photos` : celles de sa copie et celles que le message montre encore.
async function lireSignalement(base: Base, id: number) {
	exigerId(id, 'Signalement');
	const [lignes, montrees] = await base.batch([
		base
			.select({ messageId: signalementMessage.messageId, photos: signalementMessage.photosCopie, classeLe: signalementMessage.classeLe, supprime: message.supprime })
			.from(signalementMessage)
			.leftJoin(message, eq(message.id, signalementMessage.messageId))
			.where(eq(signalementMessage.id, id)),
		base
			.select({ photoId: photoDeMessage.photoId })
			.from(photoDeMessage)
			.where(inArray(photoDeMessage.messageId, base.select({ id: signalementMessage.messageId }).from(signalementMessage).where(eq(signalementMessage.id, id))))
	]);
	const s = lignes[0];
	if (!s || s.classeLe !== null) throw new DonneeInvalide('Signalement introuvable ou déjà classé');
	const photos = [...new Set([...(JSON.parse(s.photos) as number[]), ...montrees.map((p) => p.photoId)])];
	return { messageId: s.messageId !== null && s.supprime === null ? s.messageId : null, photos };
}

// Classer : la copie est effacée.
const classer = (base: Base, quels: SQL | undefined, maintenant: string) => base.update(signalementMessage).set({ classeLe: maintenant, texteCopie: '', photosCopie: '[]' }).where(quels);

// Lectures, à placer en fin de batch (après les effacements) : parmi `ids`, les photos encore montrées par un message, et
// les copies des signalements non classés. `orphelines` en déduit les photos à effacer de PHOTOS.
const copiesEnCours = (base: Base) => base.select({ photos: signalementMessage.photosCopie }).from(signalementMessage).where(isNull(signalementMessage.classeLe));
const photosEnUsage = (base: Base, ids: number[]) => [base.select({ id: photoDeMessage.photoId }).from(photoDeMessage).where(inArray(photoDeMessage.photoId, ids)), copiesEnCours(base)] as const;

function orphelines(ids: number[], montrees: { id: number }[], copies: { photos: string }[]): number[] {
	const gardees = new Set([...montrees.map((m) => m.id), ...copies.flatMap((c) => JSON.parse(c.photos) as number[])]);
	return ids.filter((id) => !gardees.has(id));
}

// Le modérateur retire le message pour tous (« Message retiré par la modération ») : ses signalements sont classés, ses
// photos effacées. Journal sans le texte.
export async function retirerParModeration(base: Base, basePhotos: BasePhotos, acteur: Acteur, idSignalement: number, maintenant: string): Promise<void> {
	await exigerModeration(base, acteur, exigerDateHeure(maintenant, 'Date'));
	const s = await lireSignalement(base, idSignalement);
	if (s.messageId === null) throw new DonneeInvalide('Message déjà effacé : classez le signalement');
	const id = s.messageId;
	const [, , , , , montrees, copies] = await base.batch([
		base.delete(reactionMessage).where(eq(reactionMessage.messageId, id)),
		base.delete(photoDeMessage).where(eq(photoDeMessage.messageId, id)),
		base.update(message).set({ texte: '', supprime: 'moderation', majLe: maintenant }).where(eq(message.id, id)),
		classer(base, and(eq(signalementMessage.messageId, id), isNull(signalementMessage.classeLe)), maintenant),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'retirer_message', cibleType: 'message', cibleId: id }, maintenant),
		...photosEnUsage(base, s.photos)
	]);
	await effacerPhotos(basePhotos, orphelines(s.photos, montrees, copies));
}

// Le modérateur classe le signalement : la copie est effacée, et ses photos aussi si plus rien ne les montre. Journal sans le texte.
export async function classerSignalement(base: Base, basePhotos: BasePhotos, acteur: Acteur, idSignalement: number, maintenant: string): Promise<void> {
	await exigerModeration(base, acteur, exigerDateHeure(maintenant, 'Date'));
	const s = await lireSignalement(base, idSignalement);
	const [, , montrees, copies] = await base.batch([
		classer(base, eq(signalementMessage.id, idSignalement), maintenant),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'classer_signalement', cibleType: 'signalement', cibleId: idSignalement }, maintenant),
		...photosEnUsage(base, s.photos)
	]);
	await effacerPhotos(basePhotos, orphelines(s.photos, montrees, copies));
}

// Conservation (déclencheur planifié) : efface les messages créés avant `avant` (AAAA-MM-JJ), avec leurs réactions et leurs
// photos, et les signalements classés d'avant cette date. Un signalement non classé garde sa copie et ses photos.
// Les conversations restent, même vides.
export async function effacerAnciens(base: Base, basePhotos: BasePhotos, avant: string): Promise<void> {
	exigerDate(avant);
	const anciens = base.select({ id: message.id }).from(message).where(lt(message.creeLe, avant));
	const [, references, , , copies] = await base.batch([
		base.delete(reactionMessage).where(inArray(reactionMessage.messageId, anciens)),
		base.delete(photoDeMessage).where(inArray(photoDeMessage.messageId, anciens)).returning({ id: photoDeMessage.photoId }),
		base.delete(message).where(lt(message.creeLe, avant)),
		base.delete(signalementMessage).where(and(isNotNull(signalementMessage.classeLe), lt(signalementMessage.le, avant))),
		copiesEnCours(base)
	]);
	await effacerPhotos(
		basePhotos,
		orphelines(
			references.map((r) => r.id),
			[],
			copies
		)
	);
}
