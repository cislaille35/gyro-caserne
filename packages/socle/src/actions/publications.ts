import { and, count, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDate } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { REPONSES_EVENEMENT, TYPES_PHOTO, TYPES_PUBLICATION, type ReponseEvenement, type TypePublication } from '../listes.ts';
import { exigerMur, refusMur, type CleMur, type Mur } from '../murs.ts';
import { commentaire, equipe, jaime, personne, photoPublication, priseConnaissance, publication, reponseEvenement, visiteMur, voteSondage } from '../schema.ts';
import { nomActeur } from './personnes.ts';

const PHOTOS_MAX = 4;
const TAILLE_PHOTO_MAX = 400 * 1024;
const PAGE_MAX = 50;

type Convoques = 'tous' | number[];

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
	evenement: { debut: string; lieu: string; convoques: Convoques; reponse: ReponseEvenement | null; compte: Record<ReponseEvenement, number> } | null;
	sondage: { question: string; reponses: string[]; resultats: number[]; vote: number | null } | null;
	priseDeConnaissance: { faite: boolean } | null;
	droits: { modifier: boolean; supprimer: boolean; epingler: boolean; fermer: boolean };
};

// Date et heure de Paris, « AAAA-MM-JJTHH:MM » (secondes permises) ; rend la date seule.
function exigerDateHeure(valeur: unknown, libelle: string): string {
	if (typeof valeur !== 'string' || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(valeur)) throw new DonneeInvalide(`${libelle} invalide`);
	const jour = valeur.slice(0, 10);
	exigerDate(jour);
	return jour;
}

function texte(valeur: unknown, libelle: string, max: number): string {
	const propre = typeof valeur === 'string' ? valeur.trim() : '';
	if (!propre) throw new DonneeInvalide(`${libelle} vide`);
	if (propre.length > max) throw new DonneeInvalide(`${libelle} trop long`);
	return propre;
}

// Le type déclaré ne suffit pas : on vérifie les premiers octets du fichier.
function estDuType(type: string, o: Uint8Array): boolean {
	const ascii = (debut: number, fin: number) => String.fromCharCode(...o.subarray(debut, fin));
	if (type === 'image/jpeg') return o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff;
	if (type === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
	return false;
}

function exigerPhotos(photos: DonneesPublication['photos'] = []) {
	if (photos.length > PHOTOS_MAX) throw new DonneeInvalide(`${PHOTOS_MAX} photos au plus`);
	for (const p of photos) {
		if (!(TYPES_PHOTO as readonly string[]).includes(p.type) || !(p.donnees instanceof Uint8Array) || !estDuType(p.type, p.donnees)) throw new DonneeInvalide('Photo JPEG ou WebP seulement');
		if (p.donnees.length > TAILLE_PHOTO_MAX) throw new DonneeInvalide('Photo trop lourde (400 Ko au plus)');
	}
	return photos as { type: (typeof TYPES_PHOTO)[number]; donnees: Uint8Array }[];
}

function exigerSondage(sondage: DonneesPublication['sondage']) {
	if (!sondage) return { sondageQuestion: null, sondageReponses: null };
	const question = texte(sondage.question, 'Question', 200);
	const reponses = Array.isArray(sondage.reponses) ? sondage.reponses.map((r) => texte(r, 'Réponse', 100)) : [];
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
		if (convoques.length === 0 || !convoques.every((id) => Number.isInteger(id) && id > 0)) throw new DonneeInvalide('Convoqués invalides');
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
	const derniere = sql`(select max(${publication.id}) from ${publication})`;
	const [lignes] =
		photos.length === 0
			? await base.batch(ecritures)
			: await base.batch([...ecritures, base.insert(photoPublication).values(photos.map((p, ordre) => ({ publicationId: derniere, ordre, type: p.type, donnees: p.donnees })))]);
	return lignes[0]!.id;
}

function droitsSur(acteur: Acteur, mur: Mur, auteur: string): PublicationVue['droits'] {
	const moi = auteur === nomActeur(acteur);
	return { modifier: moi && mur.peutPublier, supprimer: moi || mur.peutModerer, epingler: mur.peutModerer, fermer: moi || mur.peutModerer };
}

// La publication, son mur (que l'acteur doit pouvoir lire) et les droits de l'acteur dessus.
async function cible(base: Base, acteur: Acteur, id: number, maintenant: string) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const [ligne] = await base.select({ mur: publication.mur, auteur: publication.auteur }).from(publication).where(eq(publication.id, id));
	if (!ligne) throw new DonneeInvalide('Publication inconnue');
	const mur = await exigerMur(base, acteur, ligne.mur, aujourdhui, 'lire');
	return { cle: ligne.mur, droits: droitsSur(acteur, mur, ligne.auteur) };
}

const journalPublication = (base: Base, acteur: Acteur, action: string, id: number, maintenant: string, details?: object) =>
	ligneJournal(base, { acteur: nomActeur(acteur), action, cibleType: 'publication', cibleId: id, details }, maintenant);

export async function modifierPublication(base: Base, acteur: Acteur, id: number, champs: { texte: string }, maintenant: string): Promise<void> {
	const { cle, droits } = await cible(base, acteur, id, maintenant);
	if (!droits.modifier) throw refusMur(cle, 'publier');
	const corps = texte(champs.texte, 'Texte', 4000);
	await base.batch([base.update(publication).set({ texte: corps, modifieeLe: maintenant }).where(eq(publication.id, id)), journalPublication(base, acteur, 'modifier_publication', id, maintenant)]);
}

// Photos, commentaires, j'aime, réponses et votes partent avec la publication (suppression en cascade).
export async function supprimerPublication(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	const { cle, droits } = await cible(base, acteur, id, maintenant);
	if (!droits.supprimer) throw refusMur(cle, 'moderer');
	await base.batch([base.delete(publication).where(eq(publication.id, id)), journalPublication(base, acteur, 'supprimer_publication', id, maintenant, { mur: cle })]);
}

export async function epingler(base: Base, acteur: Acteur, id: number, oui: boolean, maintenant: string): Promise<void> {
	const { cle, droits } = await cible(base, acteur, id, maintenant);
	if (!droits.epingler) throw refusMur(cle, 'moderer');
	await base.batch([base.update(publication).set({ epinglee: oui ? 1 : 0 }).where(eq(publication.id, id)), journalPublication(base, acteur, oui ? 'epingler' : 'desepingler', id, maintenant)]);
}

export async function fermerCommentaires(base: Base, acteur: Acteur, id: number, oui: boolean, maintenant: string): Promise<void> {
	const { cle, droits } = await cible(base, acteur, id, maintenant);
	if (!droits.fermer) throw refusMur(cle, 'moderer');
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
	const mur = await exigerMur(base, acteur, cle, aujourdhui, 'lire');

	const [epinglees, suivantes] = await base.batch([
		base.select().from(publication).where(and(eq(publication.mur, cle), eq(publication.epinglee, 1))).orderBy(desc(publication.id)),
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
			.select({ publicationId: priseConnaissance.publicationId })
			.from(priseConnaissance)
			.where(and(inArray(priseConnaissance.publicationId, ids), eq(priseConnaissance.personneId, moi))),
		// Les identifiants seulement : les octets sont servis un par un, par photo().
		base.select({ id: photoPublication.id, publicationId: photoPublication.publicationId }).from(photoPublication).where(inArray(photoPublication.publicationId, ids)).orderBy(photoPublication.ordre),
		base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne).where(inArray(personne.id, idsAuteurs))
	] as const;
	const visite = base
		.insert(visiteMur)
		.values({ personneId: moi, mur: cle, vueLe: maintenant })
		.onConflictDoUpdate({ target: [visiteMur.personneId, visiteMur.mur], set: { vueLe: maintenant } });
	const [jaimes, commentaires, reponses, votes, prises, photos, auteurs] = acteur.type === 'personne' ? await base.batch([...lectures, visite]) : await base.batch(lectures);

	const vue = (p: (typeof lignes)[number]): PublicationVue => {
		const j = jaimes.find((x) => x.publicationId === p.id);
		const auteur = p.auteur.startsWith('super:') ? { prenom: 'Super', nom: 'administrateur' } : auteurs.find((a) => `personne:${a.id}` === p.auteur);
		const sesReponses = reponses.filter((r) => r.publicationId === p.id);
		const sesVotes = votes.filter((v) => v.publicationId === p.id);
		const choix: string[] = p.sondageReponses ? JSON.parse(p.sondageReponses) : [];
		return {
			id: p.id,
			cle: p.mur as CleMur,
			auteur: auteur ? { prenom: auteur.prenom, nom: auteur.nom } : { prenom: '', nom: 'Personne inconnue' },
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
							convoques: JSON.parse(p.convoques ?? '"tous"'),
							reponse: sesReponses.find((r) => r.deMoi === 1)?.reponse ?? null,
							compte: Object.fromEntries(REPONSES_EVENEMENT.map((r) => [r, sesReponses.find((x) => x.reponse === r)?.n ?? 0])) as Record<ReponseEvenement, number>
						},
			sondage:
				p.sondageQuestion === null
					? null
					: {
							question: p.sondageQuestion,
							reponses: choix,
							resultats: choix.map((_, i) => sesVotes.find((v) => v.reponse === i)?.n ?? 0),
							vote: sesVotes.find((v) => v.deMoi === 1)?.reponse ?? null
						},
			priseDeConnaissance: p.priseDeConnaissance === 1 ? { faite: prises.some((x) => x.publicationId === p.id) } : null,
			droits: droitsSur(acteur, mur, p.auteur)
		};
	};
	return { mur, epinglees: enTete.map(vue), publications: publications.map(vue), suite: suivantes.length > taille ? publications.at(-1)!.id : null };
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
