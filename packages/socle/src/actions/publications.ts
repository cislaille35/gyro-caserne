import { and, asc, count, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Base, BasePhotos } from '../base.ts';
import { ajouterJours, exigerDate, exigerDateHeure } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { REPONSES_EVENEMENT, TYPES_PHOTO, TYPES_PUBLICATION, type ReponseEvenement, type TypePublication } from '../listes.ts';
import { tenuesValides } from '../casquettes.ts';
import { accesMur, agentsDuJour, estConvoque, exigerMur, lecturesAgents, membresDe, refusMur, type AgentsLus, type Appartenances, type CleMur, type Mur } from '../murs.ts';
import { commentaire, equipe, jaime, personne, photoPublication, priseConnaissance, publication, reponseEvenement, visiteMur, voteSondage } from '../schema.ts';
import { photo as octetsPhoto } from '../schema-photos.ts';
import type { CommentaireVue } from './interactions.ts';
import { nomActeur } from './personnes.ts';

const PHOTOS_MAX = 4;
export const TAILLE_PHOTO_MAX = 200 * 1024;
// D1 lie 100 paramètres au plus par requête : épinglées et page restent sous ce seuil.
const EPINGLEES_MAX = 10;
const PAGE_MAX = 30;

export type Convoques = 'tous' | number[];

export type DonneesPublication = {
	type: TypePublication;
	texte: string;
	priseDeConnaissance?: boolean;
	evenement?: { debut: string; lieu: string; convoques: Convoques };
	sondage?: { question: string; reponses: string[]; ouverture: string; cloture: string };
	photos?: { type: string; donnees: Uint8Array }[];
};

export type PublicationVue = {
	id: number;
	cle: CleMur;
	// `couleur` : celle de son équipe en cours ; `role` : Chef de centre, Adjoint ou Chef d’équipe. Null pour un auteur parti ou le super administrateur.
	auteur: { prenom: string; nom: string; couleur: string | null; role: string | null };
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
	evenement: { debut: string; lieu: string; convoques: Convoques; convoque: boolean; reponse: ReponseEvenement | null; compte: Record<ReponseEvenement, number>; presents: { prenom: string; nom: string; couleur: string | null }[] } | null;
	// `resultats` : null pour qui n'a pas voté, sauf l'auteur et les modérateurs ; donnés à tous une fois le sondage fermé, jamais avant l'ouverture.
	sondage: { question: string; reponses: string[]; ouverture: string | null; cloture: string | null; etat: EtatSondage; resultats: number[] | null; vote: number | null } | null;
	// `le` : quand l'acteur a pris connaissance, null s'il ne l'a pas encore fait. `faites` sur `attendues` : parmi les membres naturels du mur, sans l'auteur.
	priseDeConnaissance: { le: string | null; faites: number; attendues: number } | null;
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
		if (p.donnees.length > TAILLE_PHOTO_MAX) throw new DonneeInvalide('Photo trop lourde (200 Ko au plus)');
	}
	return photos as { type: (typeof TYPES_PHOTO)[number]; donnees: Uint8Array }[];
}

export type EtatSondage = 'avenir' | 'ouvert' | 'ferme';

// Comparaison à la minute. Sans dates (sondage publié avant les dates) : toujours ouvert.
export function etatSondage(ouverture: string | null, cloture: string | null, maintenant: string): EtatSondage {
	const m = maintenant.slice(0, 16);
	if (ouverture === null || cloture === null) return 'ouvert';
	if (m < ouverture) return 'avenir';
	return m >= cloture ? 'ferme' : 'ouvert';
}

function exigerSondage(sondage: DonneesPublication['sondage'], debutEvenement: string | undefined, maintenant: string) {
	if (!sondage) return { sondageQuestion: null, sondageReponses: null, sondageOuverture: null, sondageCloture: null };
	const question = texte(sondage.question, 'Question', 200, true);
	const reponses = Array.isArray(sondage.reponses) ? sondage.reponses.map((r) => texte(r, 'Réponse', 100, true)) : [];
	if (reponses.length < 2 || reponses.length > 6) throw new DonneeInvalide('De 2 à 6 réponses');
	if (!sondage.ouverture || !sondage.cloture) throw new DonneeInvalide('Dates du sondage manquantes');
	exigerDateHeure(sondage.ouverture, 'Ouverture');
	exigerDateHeure(sondage.cloture, 'Clôture');
	const ouverture = sondage.ouverture.slice(0, 16);
	const cloture = sondage.cloture.slice(0, 16);
	if (cloture <= ouverture) throw new DonneeInvalide('Clôture avant l’ouverture');
	if (cloture <= maintenant.slice(0, 16)) throw new DonneeInvalide('Clôture déjà passée');
	if (cloture > `${ajouterJours(ouverture.slice(0, 10), 365)}${ouverture.slice(10)}`) throw new DonneeInvalide('Clôture dans plus d’un an');
	if (debutEvenement && cloture > debutEvenement.slice(0, 16)) throw new DonneeInvalide('Clôture après le début de l’événement');
	return { sondageQuestion: question, sondageReponses: JSON.stringify(reponses), sondageOuverture: ouverture, sondageCloture: cloture };
}

async function exigerEvenement(base: Base, mur: Mur, donnees: DonneesPublication, maintenant: string) {
	const ev = donnees.evenement;
	if (donnees.type !== 'evenement') {
		if (ev) throw new DonneeInvalide('Date et lieu réservés aux événements');
		return { debut: null, lieu: null, convoques: null };
	}
	if (!ev) throw new DonneeInvalide('Date et lieu de l’événement manquants');
	exigerDateHeure(ev.debut, 'Début');
	// Date et heure, à la minute : un événement qui commence maintenant peut encore être publié.
	if (ev.debut.slice(0, 16) < maintenant.slice(0, 16)) throw new DonneeInvalide('Événement passé');
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

// Les octets d'abord, dans la base des photos ; puis la publication et ses références, dans la base principale.
export async function publier(base: Base, basePhotos: BasePhotos, acteur: Acteur, cle: string, donnees: DonneesPublication, maintenant: string): Promise<number> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const mur = await exigerMur(base, acteur, cle, aujourdhui, 'publier');
	if (!(TYPES_PUBLICATION as readonly string[]).includes(donnees.type)) throw new DonneeInvalide('Type inconnu');
	const corps = texte(donnees.texte, 'Texte', 4000);
	if (donnees.priseDeConnaissance) {
		if (donnees.type !== 'annonce') throw new DonneeInvalide('Prise de connaissance réservée aux annonces');
		if (!mur.peutModerer) throw refusMur(cle, 'moderer');
	}
	const photos = exigerPhotos(donnees.photos);
	const sondage = exigerSondage(donnees.sondage, donnees.type === 'evenement' ? donnees.evenement?.debut : undefined, maintenant);
	const evenement = await exigerEvenement(base, mur, donnees, maintenant);

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
	if (photos.length === 0) {
		const [lignes] = await base.batch(ecritures);
		return lignes[0]!.id;
	}
	const [premiere, ...autres] = photos.map((p) =>
		basePhotos.insert(octetsPhoto).values({ type: p.type, donnees: p.donnees, taille: p.donnees.length, creeLe: maintenant }).returning({ id: octetsPhoto.id })
	);
	const ids = (await basePhotos.batch([premiere!, ...autres])).map(([ligne]) => ligne!.id);
	try {
		const [lignes] = await base.batch([...ecritures, base.insert(photoPublication).values(photos.map((p, ordre) => ({ publicationId: derniere, ordre, type: p.type, photoId: ids[ordre]! })))]);
		return lignes[0]!.id;
	} catch (erreur) {
		// Publication non enregistrée : ses photos sont effacées. Si cet effacement échoue aussi, elles restent orphelines ; on signale la première erreur.
		await basePhotos
			.delete(octetsPhoto)
			.where(inArray(octetsPhoto.id, ids))
			.catch(() => {});
		throw erreur;
	}
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

// Photos, commentaires, j'aime, réponses et votes partent avec la publication (suppression en cascade) ; puis les octets des photos, dans leur base.
export async function supprimerPublication(base: Base, basePhotos: BasePhotos, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	const { cle, droits } = await cible(base, acteur, id, exigerDateHeure(maintenant, 'Date'));
	if (!droits.supprimer) throw refusMur(cle, 'moderer');
	const [photos] = await base.batch([
		base.select({ photoId: photoPublication.photoId }).from(photoPublication).where(eq(photoPublication.publicationId, id)),
		base.delete(publication).where(eq(publication.id, id)),
		journalPublication(base, acteur, 'supprimer_publication', id, maintenant, { mur: cle })
	]);
	if (photos.length === 0) return;
	// La publication est déjà supprimée : si l'effacement des octets échoue, ils restent orphelins (place perdue, rien de visible), sans gêner l'agent.
	await basePhotos
		.delete(octetsPhoto)
		.where(inArray(octetsPhoto.id, photos.map((p) => p.photoId)))
		.catch(() => {});
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
): Promise<{ mur: Mur; audience: number; epinglees: PublicationVue[]; publications: PublicationVue[]; suite: number | null }> {
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
	const { vues, audience } = await vuesDe(base, acteur, mur, appartenances, lignes, { maintenant, visite: true });
	const vue = (p: (typeof lignes)[number]) => vues.find((v) => v.id === p.id)!;
	return { mur, audience, epinglees: enTete.map(vue), publications: publications.map(vue), suite: suivantes.length > taille ? publications.at(-1)!.id : null };
}

// Une publication seule, avec tous ses commentaires (la visite du mur n'est pas marquée). Trois requêtes.
export async function lirePublication(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<{ mur: Mur; publication: PublicationVue; commentaires: CommentaireVue[] }> {
	const { ligne, mur, appartenances } = await cible(base, acteur, id, exigerDateHeure(maintenant, 'Date'));
	const tous: CommentaireVue[] = [];
	const {
		vues: [vue]
	} = await vuesDe(base, acteur, mur, appartenances, [ligne], { maintenant, tous });
	return { mur, publication: vue!, commentaires: tous };
}

export const auteurVu = (auteur: string, fiche: { prenom: string | null; nom: string | null } | undefined) =>
	auteur.startsWith('super:') ? { prenom: 'Super', nom: 'administrateur' } : !fiche?.nom ? { prenom: '', nom: 'Personne inconnue' } : { prenom: fiche.prenom ?? '', nom: fiche.nom };

const ROLES = [
	['chef_centre', 'Chef de centre'],
	['chef_centre_adjoint', 'Adjoint'],
	['chef_equipe', 'Chef d’équipe']
] as const;

// Couleur de l'équipe en cours et premier rôle tenu, pour un agent qui a accès ; rien sinon (parti, super administrateur).
function visage([agents, affectations, tenues]: AgentsLus, equipes: { id: number; couleur: string }[], personneId: number | null) {
	if (personneId === null || !agents.some((a) => a.id === personneId)) return { couleur: null, role: null };
	const affectation = affectations.find((x) => x.personneId === personneId);
	const siennes = tenuesValides(tenues.filter((t) => t.personneId === personneId));
	return {
		couleur: equipes.find((e) => e.id === affectation?.equipeId)?.couleur ?? null,
		role: ROLES.find(([systeme]) => siennes.some((t) => t.systeme === systeme))?.[1] ?? null
	};
}

const PRESENTS_MAX = 3;

const idPersonne = (auteur: string) => {
	const id = /^personne:(\d+)$/.exec(auteur)?.[1];
	return id === undefined ? null : Number(id);
};

// Tout ce qui accompagne des publications, en une requête : comptes, gestes de l'acteur, photos, auteurs, derniers commentaires,
// membres naturels du mur (audience, prises de connaissance attendues) et visages (couleur, rôle).
// `visite` : marque la visite du mur ; `tous` : reçoit tous les commentaires (d'une seule publication) au lieu des 2 derniers.
async function vuesDe(
	base: Base,
	acteur: Acteur,
	mur: Mur,
	appartenances: Appartenances,
	lignes: (typeof publication.$inferSelect)[],
	options: { maintenant: string; visite?: boolean; tous?: CommentaireVue[] }
): Promise<{ vues: PublicationVue[]; audience: number }> {
	const cle = mur.cle;
	const ids = lignes.map((p) => p.id);
	const idsAuteurs = [...new Set(lignes.map((p) => idPersonne(p.auteur)).filter((x) => x !== null))];

	// Le super administrateur n'a pas de fiche : 0 ne désigne personne.
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	const aujourdhui = options.maintenant.slice(0, 10);
	const lectures = [
		...lecturesAgents(base, aujourdhui),
		base.select({ id: equipe.id, couleur: equipe.couleur }).from(equipe),
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
		base.select({ publicationId: priseConnaissance.publicationId, personneId: priseConnaissance.personneId, le: priseConnaissance.le }).from(priseConnaissance).where(inArray(priseConnaissance.publicationId, ids)),
		// Les 3 premiers présents de chaque événement, dans l'ordre des réponses.
		base
			.select({ publicationId: reponseEvenement.publicationId, personneId: reponseEvenement.personneId, prenom: personne.prenom, nom: personne.nom })
			.from(reponseEvenement)
			.innerJoin(personne, eq(personne.id, reponseEvenement.personneId))
			.where(
				and(
					inArray(reponseEvenement.publicationId, ids),
					sql`${reponseEvenement}.rowid in (select r.rowid from ${reponseEvenement} r where r.publication_id = ${reponseEvenement.publicationId} and r.reponse = 'present' order by r.rowid limit ${PRESENTS_MAX})`
				)
			)
			.orderBy(sql`${reponseEvenement}.rowid`),
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
	const { maintenant } = options;
	const [agents, affectations, tenues, equipes, jaimes, commentaires, reponses, votes, prises, presents, photos, auteurs, derniers] =
		acteur.type === 'personne' && options.visite
			? await base.batch([
					...lectures,
					base
						.insert(visiteMur)
						.values({ personneId: moi, mur: cle, vueLe: maintenant })
						.onConflictDoUpdate({ target: [visiteMur.personneId, visiteMur.mur], set: { vueLe: maintenant } })
				])
			: await base.batch(lectures);
	const lus: AgentsLus = [agents, affectations, tenues];
	const membres = membresDe(agentsDuJour(lus, aujourdhui), cle);
	const vusCommentaires = derniers.map((c) => ({ ...commentaireVu(acteur, mur, c), publicationId: c.publicationId }));
	options.tous?.push(...vusCommentaires.map(({ publicationId: _, ...c }) => c));

	// L'auteur n'a pas à prendre connaissance de sa propre annonce (comme dans suiviPublication).
	const priseVue = (p: (typeof lignes)[number]) => {
		const siennes = prises.filter((x) => x.publicationId === p.id);
		const attendus = membres.filter((m) => `personne:${m.id}` !== p.auteur);
		return {
			le: siennes.find((x) => x.personneId === moi)?.le ?? null,
			faites: attendus.filter((m) => siennes.some((x) => x.personneId === m.id)).length,
			attendues: attendus.length
		};
	};
	const vue = (p: (typeof lignes)[number]): PublicationVue => {
		const j = jaimes.find((x) => x.publicationId === p.id);
		const sesReponses = reponses.filter((r) => r.publicationId === p.id);
		const sesVotes = votes.filter((v) => v.publicationId === p.id);
		const choix: string[] = p.sondageReponses ? JSON.parse(p.sondageReponses) : [];
		const convoques: Convoques = JSON.parse(p.convoques ?? '"tous"');
		const droits = droitsSur(acteur, mur, p);
		const monVote = sesVotes.find((v) => v.deMoi === 1)?.reponse ?? null;
		const etat = etatSondage(p.sondageOuverture, p.sondageCloture, maintenant);
		return {
			id: p.id,
			cle: p.mur as CleMur,
			auteur: { ...auteurVu(p.auteur, auteurs.find((a) => `personne:${a.id}` === p.auteur)), ...visage(lus, equipes, idPersonne(p.auteur)) },
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
							compte: Object.fromEntries(REPONSES_EVENEMENT.map((r) => [r, sesReponses.find((x) => x.reponse === r)?.n ?? 0])) as Record<ReponseEvenement, number>,
							presents: presents
								.filter((x) => x.publicationId === p.id)
								.map((x) => ({ prenom: x.prenom, nom: x.nom, couleur: visage(lus, equipes, x.personneId).couleur }))
						},
			sondage:
				p.sondageQuestion === null
					? null
					: {
							question: p.sondageQuestion,
							reponses: choix,
							ouverture: p.sondageOuverture,
							cloture: p.sondageCloture,
							etat,
							resultats: etat !== 'avenir' && (etat === 'ferme' || monVote !== null || droits.supprimer) ? choix.map((_, i) => sesVotes.find((v) => v.reponse === i)?.n ?? 0) : null,
							vote: monVote
						},
			priseDeConnaissance: p.priseDeConnaissance === 1 ? priseVue(p) : null,
			derniersCommentaires: vusCommentaires
				.filter((c) => c.publicationId === p.id)
				.slice(-2)
				.map(({ publicationId: _, ...c }) => c),
			droits
		};
	};
	return { vues: lignes.map(vue), audience: membres.length };
}

// Un commentaire tel que l'acteur le voit : supprimable par son auteur ou un modérateur du mur.
export function commentaireVu(acteur: Acteur, mur: Mur, c: { id: number; auteur: string; texte: string; creeLe: string; prenom: string | null; nom: string | null }): CommentaireVue {
	return { id: c.id, auteur: auteurVu(c.auteur, c), texte: c.texte, creeLe: c.creeLe, supprimable: c.auteur === nomActeur(acteur) || mur.peutModerer };
}

// Une photo, à qui peut lire son mur : l'accès se vérifie dans la base principale, les octets se lisent dans la base des photos.
export async function photo(base: Base, basePhotos: BasePhotos, acteur: Acteur, idPhoto: number, aujourdhui: string): Promise<{ type: string; donnees: Uint8Array }> {
	exigerDate(aujourdhui);
	const [ligne] = await base
		.select({ mur: publication.mur, photoId: photoPublication.photoId })
		.from(photoPublication)
		.innerJoin(publication, eq(publication.id, photoPublication.publicationId))
		.where(eq(photoPublication.id, idPhoto));
	if (!ligne) throw new DonneeInvalide('Photo inconnue');
	await exigerMur(base, acteur, ligne.mur, aujourdhui, 'lire');
	const [octets] = await basePhotos.select({ type: octetsPhoto.type, donnees: octetsPhoto.donnees }).from(octetsPhoto).where(eq(octetsPhoto.id, ligne.photoId));
	if (!octets) throw new DonneeInvalide('Photo inconnue');
	return octets;
}

// Une base D1 gratuite tient 500 Mo : alerte à 80 %, pour choisir à temps entre l'offre payante et un stockage R2 (décision 0010).
// Prudent : 500 millions d'octets, un peu moins que 500 × 1024 × 1024.
const LIMITE_PHOTOS = 500 * 1000 * 1000;
const SEUIL_ALERTE = 0.8;

export type RemplissagePhotos = { octets: number; limite: number; alerte: boolean };

// La place prise par les photos, en une requête.
export async function remplissagePhotos(basePhotos: BasePhotos): Promise<RemplissagePhotos> {
	const [ligne] = await basePhotos.select({ octets: sql<number>`coalesce(sum(${octetsPhoto.taille}), 0)` }).from(octetsPhoto);
	const octets = Number(ligne?.octets ?? 0);
	return { octets, limite: LIMITE_PHOTOS, alerte: octets >= SEUIL_ALERTE * LIMITE_PHOTOS };
}
