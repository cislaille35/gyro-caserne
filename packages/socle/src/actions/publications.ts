import { and, asc, count, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDate, exigerDateHeure } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { REPONSES_EVENEMENT, TYPES_PHOTO, TYPES_PUBLICATION, type ReponseEvenement, type TypePublication } from '../listes.ts';
import { accesMur, estConvoque, exigerMur, refusMur, type Appartenances, type CleMur, type Mur } from '../murs.ts';
import { commentaire, equipe, jaime, personne, photoPublication, priseConnaissance, publication, reponseEvenement, visiteMur, voteSondage } from '../schema.ts';
import type { CommentaireVue } from './interactions.ts';
import { nomActeur } from './personnes.ts';

const PHOTOS_MAX = 4;
const TAILLE_PHOTO_MAX = 400 * 1024;
// D1 lie 100 paramètres au plus par requête : épinglées et page restent sous ce seuil.
const EPINGLEES_MAX = 10;
const PAGE_MAX = 30;

export type Convoques = 'tous' | number[];

export type DonneesPublication = {
	type: TypePublication;
	texte: string;
	priseDeConnaissance?: boolean;
	evenement?: { debut: string; lieu: string; convoques: Convoques };
	sondage?: { question: string; reponses: string[] };
	photos?: { type: string; donnees: Uint8Array }[];
};

export type PublicationVue = {
	id: number;
	cle: CleMur;
	auteur: { prenom: string; nom: string };
	type: TypePublication;
	texte: string;
	creeLe: string;
	modifieeLe: string | null;
	epinglee: boolean;
	commentairesFermes: boolean;
	photos: number[];
	jaime: number;
	commentaires: number;
	jaimeParMoi: boolean;
	evenement: { debut: string; lieu: string; convoques: Convoques; convoque: boolean; reponse: ReponseEvenement | null; compte: Record<ReponseEvenement, number> } | null;
	// `resultats` : null pour qui n'a pas voté, sauf l'auteur et les modérateurs.
	sondage: { question: string; reponses: string[]; resultats: number[] | null; vote: number | null } | null;
	// `le` : quand l'acteur a pris connaissance, null s'il ne l'a pas encore fait.
	priseDeConnaissance: { le: string | null } | null;
	// Les 2 derniers, du plus ancien au plus récent.
	derniersCommentaires: CommentaireVue[];
	droits: { modifier: boolean; supprimer: boolean; epingler: boolean; fermer: boolean };
};

// `feminin` : accord du message (« Question trop longue »).
export function texte(valeur: unknown, libelle: string, max: number, feminin = false): string {
	const propre = typeof valeur === 'string' ? valeur.trim() : '';
	if (!propre) throw new DonneeInvalide(`${libelle} vide`);
	if (propre.length > max) throw new DonneeInvalide(`${libelle} trop long${feminin ? 'ue' : ''}`);
	return propre;
}

// Le type déclaré ne suffit pas : on vérifie les premiers octets du fichier.
function estDuType(type: string, o: Uint8Array): boolean {
	const ascii = (debut: number, fin: number) => String.fromCharCode(...o.subarray(debut, fin));
	if (type === 'image/jpeg') return o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff;
	if (type === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
	return false;
}

function exigerPhotos(valeur: DonneesPublication['photos']) {
	const photos = valeur ?? [];
	if (!Array.isArray(photos)) throw new DonneeInvalide('Photos invalides');
	if (photos.length > PHOTOS_MAX) throw new DonneeInvalide(`${PHOTOS_MAX} photos au plus`);
	for (const p of photos) {
		if (!p || !(TYPES_PHOTO as readonly string[]).includes(p.type) || !(p.donnees instanceof Uint8Array) || !estDuType(p.type, p.donnees)) throw new DonneeInvalide('Photo JPEG ou WebP seulement');
		if (p.donnees.length > TAILLE_PHOTO_MAX) throw new DonneeInvalide('Photo trop lourde (400 Ko au plus)');
	}
	return photos as { type: (typeof TYPES_PHOTO)[number]; donnees: Uint8Array }[];
}

function exigerSondage(sondage: DonneesPublication['sondage']) {
	if (!sondage) return { sondageQuestion: null, sondageReponses: null };
	const question = texte(sondage.question, 'Question', 200, true);
	const reponses = Array.isArray(sondage.reponses) ? sondage.reponses.map((r) => texte(r, 'Réponse', 100, true)) : [];
	if (reponses.length < 2 || reponses.length > 6) throw new DonneeInvalide('De 2 à 6 réponses');
	return { sondageQuestion: question, sondageReponses: JSON.stringify(reponses) };
}

async function exigerEvenement(base: Base, mur: Mur, donnees: DonneesPublication, aujourdhui: string) {
	const ev = donnees.evenement;
	if (donnees.type !== 'evenement') {
		if (ev) throw new DonneeInvalide('Date et lieu réservés aux événements');
		return { debut: null, lieu: null, convoques: null };
	}
	if (!ev) throw new DonneeInvalide('Date et lieu de l’événement manquants');
	if (exigerDateHeure(ev.debut, 'Début') < aujourdhui) throw new DonneeInvalide('Événement passé');
	const lieu = texte(ev.lieu, 'Lieu', 200);
	// Dans un mur d'équipe, on convoque cette équipe.
	let convoques: Convoques;
	if (mur.type === 'equipe') convoques = [Number(mur.cle.slice('equipe:'.length))];
	else if (ev.convoques === 'tous') convoques = 'tous';
	else {
		convoques = Array.isArray(ev.convoques) ? [...new Set(ev.convoques)] : [];
		if (convoques.length === 0 || convoques.length > 30 || !convoques.every((id) => Number.isInteger(id) && id > 0)) throw new DonneeInvalide('Convoqués invalides');
		const connues = await base.select({ id: equipe.id }).from(equipe).where(inArray(equipe.id, convoques));
		if (connues.length !== convoques.length) throw new DonneeInvalide('Équipe inconnue');
	}
	return { debut: ev.debut, lieu, convoques: JSON.stringify(convoques) };
}

export async function publier(base: Base, acteur: Acteur, cle: string, donnees: DonneesPublication, maintenant: string): Promise<number> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const mur = await exigerMur(base, acteur, cle, aujourdhui, 'publier');
	if (!(TYPES_PUBLICATION as readonly string[]).includes(donnees.type)) throw new DonneeInvalide('Type inconnu');
	const corps = texte(donnees.texte, 'Texte', 4000);
	if (donnees.priseDeConnaissance) {
		if (donnees.type !== 'annonce') throw new DonneeInvalide('Prise de connaissance réservée aux annonces');
		if (!mur.peutModerer) throw refusMur(cle, 'moderer');
	}
	const photos = exigerPhotos(donnees.photos);
	const sondage = exigerSondage(donnees.sondage);
	const evenement = await exigerEvenement(base, mur, donnees, aujourdhui);

	const ecritures = [
		base
			.insert(publication)
			.values({ mur: cle, auteur: nomActeur(acteur), type: donnees.type, texte: corps, priseDeConnaissance: donnees.priseDeConnaissance ? 1 : 0, creeLe: maintenant, ...evenement, ...sondage })
			.returning({ id: publication.id }),
		// Juste après l'insertion, last_insert_rowid() est l'id de la publication. Jamais le texte au journal.
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'publier', cibleType: 'publication', cibleId: sql`last_insert_rowid()`, details: { mur: cle, type: donnees.type, photos: photos.length } }, maintenant)
	] as const;
	// Le batch est une transaction : aucune autre écriture ne s'intercale, et AUTOINCREMENT donne le plus grand id à la publication qui vient d'être insérée.
	const derniere = sql`(select max(${publication.id}) from ${publication})`;
	const [lignes] =
		photos.length === 0
			? await base.batch(ecritures)
			: await base.batch([...ecritures, base.insert(photoPublication).values(photos.map((p, ordre) => ({ publicationId: derniere, ordre, type: p.type, donnees: p.donnees })))]);
	return lignes[0]!.id;
}

// « fermer » : fermer les commentaires s'ils sont ouverts (auteur ou modérateur), les rouvrir sinon (modérateur seulement).
export function droitsSur(acteur: Acteur, mur: Mur, p: { auteur: string; commentairesFermes: number }): PublicationVue['droits'] {
	const moi = p.auteur === nomActeur(acteur);
	return { modifier: moi && mur.peutPublier, supprimer: moi || mur.peutModerer, epingler: mur.peutModerer, fermer: mur.peutModerer || (moi && p.commentairesFermes === 0) };
}

// La publication, son mur (que l'acteur doit pouvoir lire, celui de la publication et non un autre) et les droits de l'acteur dessus.
export async function cible(base: Base, acteur: Acteur, id: number, aujourdhui: string) {
	const [ligne] = await base.select().from(publication).where(eq(publication.id, id));
	if (!ligne) throw new DonneeInvalide('Publication inconnue');
	const { mur, appartenances } = await accesMur(base, acteur, ligne.mur, aujourdhui, 'lire');
	return { ligne, mur, appartenances, cle: ligne.mur, droits: droitsSur(acteur, mur, ligne) };
}

const journalPublication = (base: Base, acteur: Acteur, action: string, id: number, maintenant: string, details?: object) =>
	ligneJournal(base, { acteur: nomActeur(acteur), action, cibleType: 'publication', cibleId: id, details }, maintenant);

export async function modifierPublication(base: Base, acteur: Acteur, id: number, champs: { texte: string }, maintenant: string): Promise<void> {
	const { cle, droits } = await cible(base, acteur, id, exigerDateHeure(maintenant, 'Date'));
	if (!droits.modifier) throw refusMur(cle, 'publier');
	const corps = texte(champs.texte, 'Texte', 4000);
	await base.batch([base.update(publication).set({ texte: corps, modifieeLe: maintenant }).where(eq(publication.id, id)), journalPublication(base, acteur, 'modifier_publication', id, maintenant)]);
}

// Photos, commentaires, j'aime, réponses et votes partent avec la publication (suppression en cascade).
export async function supprimerPublication(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	const { cle, droits } = await cible(base, acteur, id, exigerDateHeure(maintenant, 'Date'));
	if (!droits.supprimer) throw refusMur(cle, 'moderer');
	await base.batch([base.delete(publication).where(eq(publication.id, id)), journalPublication(base, acteur, 'supprimer_publication', id, maintenant, { mur: cle })]);
}

export async function epingler(base: Base, acteur: Acteur, id: number, oui: boolean, maintenant: string): Promise<void> {
	const { ligne, cle, droits } = await cible(base, acteur, id, exigerDateHeure(maintenant, 'Date'));
	if (!droits.epingler) throw refusMur(cle, 'moderer');
	// Au-delà de dix, une épinglée ne serait plus affichée : on refuse plutôt que de la cacher.
	if (oui && ligne.epinglee === 0) {
		const [{ n }] = (await base.select({ n: count() }).from(publication).where(and(eq(publication.mur, cle), eq(publication.epinglee, 1)))) as [{ n: number }];
		if (n >= EPINGLEES_MAX) throw new DonneeInvalide('Dix publications sont déjà épinglées : désépinglez-en une d’abord');
	}
	await base.batch([base.update(publication).set({ epinglee: oui ? 1 : 0 }).where(eq(publication.id, id)), journalPublication(base, acteur, oui ? 'epingler' : 'desepingler', id, maintenant)]);
}

export async function fermerCommentaires(base: Base, acteur: Acteur, id: number, oui: boolean, maintenant: string): Promise<void> {
	const { cle, droits } = await cible(base, acteur, id, exigerDateHeure(maintenant, 'Date'));
	// Rouvrir est réservé aux modérateurs : l'auteur ne passe pas outre leur décision.
	if (!droits.fermer || (!oui && !droits.epingler)) throw refusMur(cle, 'moderer');
	await base.batch([
		base.update(publication).set({ commentairesFermes: oui ? 1 : 0 }).where(eq(publication.id, id)),
		journalPublication(base, acteur, oui ? 'fermer_commentaires' : 'ouvrir_commentaires', id, maintenant)
	]);
}

// Trois requêtes : les droits, les publications, puis tout le reste d'un bloc (comptes, gestes de l'acteur, photos, auteurs, visite).
export async function lireMur(
	base: Base,
	acteur: Acteur,
	cle: string,
	page: { avant?: number; nombre?: number },
	maintenant: string
): Promise<{ mur: Mur; epinglees: PublicationVue[]; publications: PublicationVue[]; suite: number | null }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const { avant, nombre = 20 } = page;
	if (avant !== undefined && !(Number.isInteger(avant) && avant > 0)) throw new DonneeInvalide('Page invalide');
	const taille = Number.isInteger(nombre) ? Math.min(Math.max(nombre, 1), PAGE_MAX) : 20;
	const { mur, appartenances } = await accesMur(base, acteur, cle, aujourdhui, 'lire');

	const [epinglees, suivantes] = await base.batch([
		base.select().from(publication).where(and(eq(publication.mur, cle), eq(publication.epinglee, 1)))
			.orderBy(desc(publication.id))
			.limit(EPINGLEES_MAX),
		base
			.select()
			.from(publication)
			.where(and(eq(publication.mur, cle), eq(publication.epinglee, 0), avant === undefined ? undefined : lt(publication.id, avant)))
			.orderBy(desc(publication.id))
			.limit(taille + 1)
	]);
	// Les épinglées ne sont qu'en première page.
	const enTete = avant === undefined ? epinglees : [];
	const publications = suivantes.slice(0, taille);
	const lignes = [...enTete, ...publications];
	const vues = await vuesDe(base, acteur, mur, appartenances, lignes, { visite: maintenant });
	const vue = (p: (typeof lignes)[number]) => vues.find((v) => v.id === p.id)!;
	return { mur, epinglees: enTete.map(vue), publications: publications.map(vue), suite: suivantes.length > taille ? publications.at(-1)!.id : null };
}

// Une publication seule, avec tous ses commentaires (la visite du mur n'est pas marquée). Trois requêtes.
export async function lirePublication(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<{ mur: Mur; publication: PublicationVue; commentaires: CommentaireVue[] }> {
	const { ligne, mur, appartenances } = await cible(base, acteur, id, exigerDateHeure(maintenant, 'Date'));
	const tous: CommentaireVue[] = [];
	const [vue] = await vuesDe(base, acteur, mur, appartenances, [ligne], { tous });
	return { mur, publication: vue!, commentaires: tous };
}

export const auteurVu = (auteur: string, fiche: { prenom: string | null; nom: string | null } | undefined) =>
	auteur.startsWith('super:') ? { prenom: 'Super', nom: 'administrateur' } : !fiche?.nom ? { prenom: '', nom: 'Personne inconnue' } : { prenom: fiche.prenom ?? '', nom: fiche.nom };

// Tout ce qui accompagne des publications, en une requête : comptes, gestes de l'acteur, photos, auteurs, derniers commentaires.
// `visite` : marque la visite du mur ; `tous` : reçoit tous les commentaires (d'une seule publication) au lieu des 2 derniers.
async function vuesDe(
	base: Base,
	acteur: Acteur,
	mur: Mur,
	appartenances: Appartenances,
	lignes: (typeof publication.$inferSelect)[],
	options: { visite?: string; tous?: CommentaireVue[] }
): Promise<PublicationVue[]> {
	const cle = mur.cle;
	const ids = lignes.map((p) => p.id);
	const idsAuteurs = [...new Set(lignes.map((p) => /^personne:(\d+)$/.exec(p.auteur)?.[1]).filter((x) => x !== undefined).map(Number))];

	// Le super administrateur n'a pas de fiche : 0 ne désigne personne.
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	const lectures = [
		base
			.select({ publicationId: jaime.publicationId, n: count(), deMoi: sql<number>`max(${jaime.personneId} = ${moi})` })
			.from(jaime)
			.where(inArray(jaime.publicationId, ids))
			.groupBy(jaime.publicationId),
		base.select({ publicationId: commentaire.publicationId, n: count() }).from(commentaire).where(inArray(commentaire.publicationId, ids)).groupBy(commentaire.publicationId),
		base
			.select({ publicationId: reponseEvenement.publicationId, reponse: reponseEvenement.reponse, n: count(), deMoi: sql<number>`max(${reponseEvenement.personneId} = ${moi})` })
			.from(reponseEvenement)
			.where(inArray(reponseEvenement.publicationId, ids))
			.groupBy(reponseEvenement.publicationId, reponseEvenement.reponse),
		base
			.select({ publicationId: voteSondage.publicationId, reponse: voteSondage.reponse, n: count(), deMoi: sql<number>`max(${voteSondage.personneId} = ${moi})` })
			.from(voteSondage)
			.where(inArray(voteSondage.publicationId, ids))
			.groupBy(voteSondage.publicationId, voteSondage.reponse),
		base
			.select({ publicationId: priseConnaissance.publicationId, le: priseConnaissance.le })
			.from(priseConnaissance)
			.where(and(inArray(priseConnaissance.publicationId, ids), eq(priseConnaissance.personneId, moi))),
		// Les identifiants seulement : les octets sont servis un par un, par photo().
		base.select({ id: photoPublication.id, publicationId: photoPublication.publicationId }).from(photoPublication).where(inArray(photoPublication.publicationId, ids)).orderBy(photoPublication.ordre),
		base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne).where(inArray(personne.id, idsAuteurs)),
		base
			.select({ id: commentaire.id, publicationId: commentaire.publicationId, auteur: commentaire.auteur, texte: commentaire.texte, creeLe: commentaire.creeLe, prenom: personne.prenom, nom: personne.nom })
			.from(commentaire)
			.leftJoin(personne, sql`${commentaire.auteur} = 'personne:' || ${personne.id}`)
			.where(
				and(
					inArray(commentaire.publicationId, ids),
					options.tous ? undefined : sql`${commentaire.id} in (select d.id from ${commentaire} d where d.publication_id = ${commentaire.publicationId} order by d.id desc limit 2)`
				)
			)
			.orderBy(asc(commentaire.id))
	] as const;
	const maintenant = options.visite;
	const [jaimes, commentaires, reponses, votes, prises, photos, auteurs, derniers] =
		acteur.type === 'personne' && maintenant
			? await base.batch([
					...lectures,
					base
						.insert(visiteMur)
						.values({ personneId: moi, mur: cle, vueLe: maintenant })
						.onConflictDoUpdate({ target: [visiteMur.personneId, visiteMur.mur], set: { vueLe: maintenant } })
				])
			: await base.batch(lectures);
	const vusCommentaires = derniers.map((c) => ({ ...commentaireVu(acteur, mur, c), publicationId: c.publicationId }));
	options.tous?.push(...vusCommentaires.map(({ publicationId: _, ...c }) => c));

	const vue = (p: (typeof lignes)[number]): PublicationVue => {
		const j = jaimes.find((x) => x.publicationId === p.id);
		const sesReponses = reponses.filter((r) => r.publicationId === p.id);
		const sesVotes = votes.filter((v) => v.publicationId === p.id);
		const choix: string[] = p.sondageReponses ? JSON.parse(p.sondageReponses) : [];
		const convoques: Convoques = JSON.parse(p.convoques ?? '"tous"');
		const droits = droitsSur(acteur, mur, p);
		const monVote = sesVotes.find((v) => v.deMoi === 1)?.reponse ?? null;
		return {
			id: p.id,
			cle: p.mur as CleMur,
			auteur: auteurVu(p.auteur, auteurs.find((a) => `personne:${a.id}` === p.auteur)),
			type: p.type,
			texte: p.texte,
			creeLe: p.creeLe,
			modifieeLe: p.modifieeLe,
			epinglee: p.epinglee === 1,
			commentairesFermes: p.commentairesFermes === 1,
			photos: photos.filter((ph) => ph.publicationId === p.id).map((ph) => ph.id),
			jaime: j?.n ?? 0,
			commentaires: commentaires.find((c) => c.publicationId === p.id)?.n ?? 0,
			jaimeParMoi: j?.deMoi === 1,
			evenement:
				p.debut === null
					? null
					: {
							debut: p.debut,
							lieu: p.lieu ?? '',
							convoques,
							convoque: estConvoque(appartenances, cle, convoques),
							reponse: sesReponses.find((r) => r.deMoi === 1)?.reponse ?? null,
							compte: Object.fromEntries(REPONSES_EVENEMENT.map((r) => [r, sesReponses.find((x) => x.reponse === r)?.n ?? 0])) as Record<ReponseEvenement, number>
						},
			sondage:
				p.sondageQuestion === null
					? null
					: {
							question: p.sondageQuestion,
							reponses: choix,
							resultats: monVote !== null || droits.supprimer ? choix.map((_, i) => sesVotes.find((v) => v.reponse === i)?.n ?? 0) : null,
							vote: monVote
						},
			priseDeConnaissance: p.priseDeConnaissance === 1 ? { le: prises.find((x) => x.publicationId === p.id)?.le ?? null } : null,
			derniersCommentaires: vusCommentaires
				.filter((c) => c.publicationId === p.id)
				.slice(-2)
				.map(({ publicationId: _, ...c }) => c),
			droits
		};
	};
	return lignes.map(vue);
}

// Un commentaire tel que l'acteur le voit : supprimable par son auteur ou un modérateur du mur.
export function commentaireVu(acteur: Acteur, mur: Mur, c: { id: number; auteur: string; texte: string; creeLe: string; prenom: string | null; nom: string | null }): CommentaireVue {
	return { id: c.id, auteur: auteurVu(c.auteur, c), texte: c.texte, creeLe: c.creeLe, supprimable: c.auteur === nomActeur(acteur) || mur.peutModerer };
}

// Une photo, à qui peut lire son mur.
export async function photo(base: Base, acteur: Acteur, idPhoto: number, aujourdhui: string): Promise<{ type: string; donnees: Uint8Array }> {
	exigerDate(aujourdhui);
	const [ligne] = await base.select({ mur: publication.mur }).from(photoPublication).innerJoin(publication, eq(publication.id, photoPublication.publicationId)).where(eq(photoPublication.id, idPhoto));
	if (!ligne) throw new DonneeInvalide('Photo inconnue');
	await exigerMur(base, acteur, ligne.mur, aujourdhui, 'lire');
	const [octets] = await base.select({ type: photoPublication.type, donnees: photoPublication.donnees }).from(photoPublication).where(eq(photoPublication.id, idPhoto));
	return octets!;
}
