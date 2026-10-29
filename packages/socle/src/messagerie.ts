import { and, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, max, ne, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { roleDe, texte } from './actions/publications.ts';
import type { Base, BasePhotos } from './base.ts';
import { requeteTenues } from './casquettes.ts';
import { exigerDateHeure } from './dates.ts';
import type { Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { ligneJournal } from './journal.ts';
import { STATUTS_AVEC_ACCES, type TypeConversation } from './listes.ts';
import { affectationEquipe, conversation, equipe, membreConversation, message, personne } from './schema.ts';

const PAGE = 40;
const EXTRAIT = 100;

type Visage = { id: number; prenom: string; nom: string; couleur: string | null };

export type Photo = { type: string; donnees: Uint8Array };

export type VueMessage = {
	id: number;
	auteur: Visage | null;
	texte: string;
	cree_le: string;
	modifie: boolean;
	supprime: 'auteur' | 'moderation' | null;
	systeme: string | null;
	reponse: { id: number; auteur: Visage | null; extrait: string } | null;
	photos: number[];
	reactions: { emoji: string; nombre: number; deMoi: boolean }[];
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

const STATUTS = sql.raw(STATUTS_AVEC_ACCES.map((s) => `'${s}'`).join(', '));

// Seule règle d'accès à la messagerie, en SQL pour l'appliquer à beaucoup de personnes en une requête : un agent qui a accès
// (ni parti, ni suspendu, ni extérieur) et qui tient UTILISER_MESSAGERIE sur le centre ce jour-là, par son profil ou par une
// responsabilité en cours (même calcul que droitsDe, vérifié par les tests).
function aLaMessagerie(id: SQLWrapper | number, aujourdhui: string): SQL {
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
// Deux requêtes : les contrôles, puis l'écriture. Le texte n'est jamais écrit au journal.
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
	// Les photos des messages arrivent avec la tâche 3.
	if (donnees.photos && donnees.photos.length > 0) throw new DonneeInvalide('Photos pas encore disponibles dans la messagerie');
	const corps = texte(donnees.texte, 'Message', 4000);
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
	if (existante?.type === 'deux' && autres.some((a) => !a.acces)) throw new DonneeInvalide('Conversation en lecture seule');
	if (reponseA !== null && cite.length === 0) throw new DonneeInvalide('Message cité introuvable');

	const id = existante ? sql`${existante.id}` : laConversation;
	const nouveau = base
		.insert(message)
		.values({ conversationId: id, auteur: moi, texte: corps, reponseA, creeLe: maintenant, majLe: maintenant })
		.returning({ id: message.id, conversation: message.conversationId });
	// L'auteur a lu son propre message.
	const lu = base
		.update(membreConversation)
		.set({ luJusquA: sql`(select max(${message.id}) from ${message} where ${message.conversationId} = ${id})` })
		.where(and(eq(membreConversation.conversationId, id), eq(membreConversation.personneId, moi)));

	if (existante) {
		const [lignes] = await base.batch([nouveau, base.update(conversation).set({ dernierLe: maintenant }).where(eq(conversation.id, id)), lu]);
		return { conversation: lignes[0]!.conversation, message: lignes[0]!.id };
	}
	try {
		const [, , , lignes] = await base.batch([
			base.insert(conversation).values({ type: 'deux', clePaire: cle, creePar: moi, creeLe: maintenant, dernierLe: maintenant }),
			ligneJournal(base, { acteur: `personne:${moi}`, action: 'creer_conversation', cibleType: 'conversation', cibleId: id, details: { type: 'deux' } }, maintenant),
			base.insert(membreConversation).values([moi, autre!].map((personneId) => ({ conversationId: id, personneId, entreLe: maintenant }))),
			nouveau,
			lu
		]);
		return { conversation: lignes[0]!.conversation, message: lignes[0]!.id };
	} catch (erreur) {
		// Créée entre-temps par l’autre : on la rejoint.
		for (let e: unknown = erreur; e instanceof Error; e = e.cause)
			if (/UNIQUE constraint failed: conversation\.cle_paire/.test(e.message)) {
				const [trouvee] = await base.select({ id: conversation.id }).from(conversation).where(eq(conversation.clePaire, cle!));
				return envoyer(base, basePhotos, acteur, { conversation: trouvee!.id }, donnees, maintenant);
			}
		throw erreur;
	}
}

const extrait = sql<string>`case when ${message.supprime} is null then substr(${message.texte}, 1, ${EXTRAIT}) else '' end`;

// Une page de 40 messages au plus (les plus récents, ou ceux d'avant `page.avant`). Sur la dernière page, l'acteur a lu
// jusqu'au dernier message. Deux requêtes au plus. Seuls les membres lisent, chef de centre compris.
export async function lireConversation(base: Base, acteur: Acteur, id: number, page: { avant?: number }, maintenant: string): Promise<VueConversation> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = idDe(acteur);
	exigerId(id, 'Conversation');
	const avant = page.avant === undefined ? null : exigerId(page.avant, 'Page');
	const dansLaPage = and(eq(message.conversationId, id), avant === null ? undefined : lt(message.id, avant));
	const luParMoi = sql`(select ${membreConversation.luJusquA} from ${membreConversation} where ${membreConversation.conversationId} = ${id} and ${membreConversation.personneId} = ${moi})`;

	const [acces, place, membres, messages, cites, auteurs, affectations, nonLu] = await base.batch([
		lireAcces(base, moi, aujourdhui),
		base
			.select({ id: conversation.id, type: conversation.type, nom: conversation.nom, icone: conversation.icone })
			.from(conversation)
			.innerJoin(membreConversation, and(eq(membreConversation.conversationId, conversation.id), eq(membreConversation.personneId, moi)))
			.where(eq(conversation.id, id)),
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
		base
			.select()
			.from(message)
			.where(dansLaPage)
			.orderBy(desc(message.id))
			.limit(PAGE + 1),
		base
			.select({ id: message.id, auteur: message.auteur, extrait })
			.from(message)
			.where(and(eq(message.conversationId, id), inArray(message.id, base.select({ id: message.reponseA }).from(message).where(dansLaPage).orderBy(desc(message.id)).limit(PAGE + 1)))),
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom })
			.from(personne)
			.where(
				or(
					inArray(personne.id, base.select({ id: membreConversation.personneId }).from(membreConversation).where(eq(membreConversation.conversationId, id))),
					inArray(personne.id, base.selectDistinct({ id: message.auteur }).from(message).where(and(eq(message.conversationId, id), isNotNull(message.auteur))))
				)
			),
		affectationsDuJour(base, aujourdhui),
		base
			.select({ premier: sql<number | null>`min(${message.id})`.as('premier') })
			.from(message)
			.where(and(eq(message.conversationId, id), gt(message.id, luParMoi), ne(message.auteur, moi), isNull(message.supprime)))
	]);
	if (acces.length === 0) throw refus();
	const conv = place[0];
	if (!conv) throw refus('Conversation non accessible');

	const equipes = equipesDe(affectations);
	const visages = new Map(auteurs.map((a) => [a.id, { id: a.id, prenom: a.prenom, nom: a.nom, couleur: equipes.get(a.id)?.couleur ?? null }]));
	const visage = (pid: number | null) => (pid === null ? null : (visages.get(pid) ?? null));
	const autres = membres.filter((m) => m.id !== moi);
	const mesCoches = membres.find((m) => m.id === moi)?.coches === 1;
	const citesParId = new Map(cites.map((c) => [c.id, { id: c.id, auteur: visage(c.auteur), extrait: c.extrait }]));

	// « lu » quand tous les autres présents à l'envoi, coches ouvertes, l'ont lu ; jamais si l'acteur a coupé les siennes.
	const coche = (m: (typeof messages)[number]): VueMessage['coche'] => {
		if (m.auteur !== moi || m.systeme !== null) return null;
		const lecteurs = autres.filter((a) => a.coches === 1 && a.entreLe <= m.creeLe);
		return mesCoches && lecteurs.length > 0 && lecteurs.every((a) => a.luJusquA >= m.id) ? 'lu' : 'envoye';
	};

	const vus = messages.slice(0, PAGE).reverse();
	const vues: VueMessage[] = vus.map((m) => ({
		id: m.id,
		auteur: visage(m.auteur),
		texte: m.supprime === null ? m.texte : '',
		cree_le: m.creeLe,
		modifie: m.modifie === 1,
		supprime: m.supprime,
		systeme: m.systeme,
		reponse: m.reponseA === null ? null : (citesParId.get(m.reponseA) ?? null),
		photos: [],
		reactions: [],
		moi: m.auteur === moi,
		coche: coche(m)
	}));

	const dernier = vus.at(-1)?.id;
	const monLu = membres.find((m) => m.id === moi)?.luJusquA ?? 0;
	if (avant === null && dernier !== undefined && dernier > monLu)
		await base
			.update(membreConversation)
			.set({ luJusquA: sql`max(${membreConversation.luJusquA}, ${dernier})` })
			.where(and(eq(membreConversation.conversationId, id), eq(membreConversation.personneId, moi)));

	const nomDeux = autres[0] ? `${visages.get(autres[0].id)?.prenom ?? ''} ${visages.get(autres[0].id)?.nom ?? ''}`.trim() : '';
	return {
		id: conv.id,
		type: conv.type,
		nom: conv.type === 'deux' ? nomDeux : (conv.nom ?? ''),
		icone: conv.icone,
		membres: membres.map((m) => visage(m.id)).filter((v) => v !== null),
		messages: vues,
		premierNonLu: nonLu[0]?.premier ?? null,
		lectureSeule: conv.type === 'deux' && (autres.length === 0 || autres.some((a) => !a.acces)),
		plusAnciens: messages.length > PAGE
	};
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

	const [acces, conversations, derniers, nonLus, autres, affectations] = await base.batch([
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
			.where(inArray(message.id, base.select({ id: max(message.id) }).from(message).where(inArray(message.conversationId, miennes)).groupBy(message.conversationId))),
		base.select({ conversationId: message.conversationId, n: count() }).from(message).innerJoin(membreConversation, nonLusDe(moi)).groupBy(message.conversationId),
		base
			.select({ conversationId: membreConversation.conversationId, id: personne.id, prenom: personne.prenom, nom: personne.nom })
			.from(membreConversation)
			.innerJoin(personne, eq(personne.id, membreConversation.personneId))
			.innerJoin(conversation, eq(conversation.id, membreConversation.conversationId))
			.where(and(inArray(membreConversation.conversationId, miennes), ne(membreConversation.personneId, moi), eq(conversation.type, 'deux'))),
		affectationsDuJour(base, aujourdhui)
	]);
	if (acces.length === 0) throw refus();
	const equipes = equipesDe(affectations);

	return conversations.map((c) => {
		const d = derniers.find((x) => x.conversationId === c.id);
		const l = autres.find((x) => x.conversationId === c.id);
		const personneVue = c.type === 'deux' && l ? { id: l.id, prenom: l.prenom, nom: l.nom, couleur: equipes.get(l.id)?.couleur ?? null } : null;
		let apercu = '';
		if (d?.systeme) apercu = d.systeme;
		else if (d?.supprime) apercu = 'Message supprimé';
		else if (d) apercu = `${d.auteur === moi ? 'Vous' : (d.prenom ?? '')} : ${d.extrait}`;
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

// Total des non-lus de l'acteur (pastille d'Échanges), en une requête ; 0 sans messagerie.
export async function nonLusTotal(base: Base, acteur: Acteur, aujourdhui: string): Promise<number> {
	if (acteur.type !== 'personne') return 0;
	const [ligne] = await base
		.select({ n: count() })
		.from(message)
		.innerJoin(membreConversation, nonLusDe(acteur.id))
		.where(aLaMessagerie(acteur.id, aujourdhui));
	return ligne?.n ?? 0;
}
