import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { requeteTenues } from '../casquettes.ts';
import type { Base } from '../base.ts';
import { exigerDate, exigerDateHeure } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { REPONSES_EVENEMENT, STATUTS_AVEC_ACCES, type ReponseEvenement } from '../listes.ts';
import { appartenances, estConvoque, estMembre, exigerMur, refusMur } from '../murs.ts';
import { affectationEquipe, commentaire, jaime, personne, priseConnaissance, profil, publication, reponseEvenement, voteSondage } from '../schema.ts';
import { nomActeur } from './personnes.ts';
import { cible, commentaireVu, etatSondage, texte, type Convoques } from './publications.ts';

export type Personne = { id: number; prenom: string; nom: string };
export type CommentaireVue = { id: number; auteur: { prenom: string; nom: string }; texte: string; creeLe: string; supprimable: boolean };
export type Suivi = {
	priseDeConnaissance?: { faite: Personne[]; manquante: Personne[] };
	evenement?: Record<ReponseEvenement | 'sans_reponse', Personne[]>;
};

// Une publication où l'acteur peut agir : il la lit, son mur n'est pas en lecture seule, et il a une fiche (pas le super administrateur).
async function pourAgir(base: Base, acteur: Acteur, id: number, aujourdhui: string) {
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux personnes ayant une fiche');
	const c = await cible(base, acteur, id, aujourdhui);
	if (c.mur.lectureSeule) throw refusMur(c.cle, 'publier');
	return { ...c, moi: acteur.id };
}

// Tout lecteur, sauf sur un mur en lecture seule ou si les commentaires sont fermés.
export async function commenter(base: Base, acteur: Acteur, idPublication: number, contenu: string, maintenant: string): Promise<number> {
	const { ligne, mur, cle } = await cible(base, acteur, idPublication, exigerDateHeure(maintenant, 'Date'));
	if (mur.lectureSeule) throw refusMur(cle, 'publier');
	if (ligne.commentairesFermes === 1) throw new DonneeInvalide('Commentaires fermés');
	const corps = texte(contenu, 'Commentaire', 2000);
	const [nouveau] = await base.insert(commentaire).values({ publicationId: idPublication, auteur: nomActeur(acteur), texte: corps, creeLe: maintenant }).returning({ id: commentaire.id });
	return nouveau!.id;
}

// Par son auteur ou un modérateur du mur, même en lecture seule ; inscrit au journal sans le texte.
export async function supprimerCommentaire(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const [ligne] = await base.select({ auteur: commentaire.auteur, mur: publication.mur }).from(commentaire).innerJoin(publication, eq(publication.id, commentaire.publicationId)).where(eq(commentaire.id, id));
	if (!ligne) throw new DonneeInvalide('Commentaire inconnu');
	const mur = await exigerMur(base, acteur, ligne.mur, aujourdhui, 'lire');
	if (ligne.auteur !== nomActeur(acteur) && !mur.peutModerer) throw refusMur(ligne.mur, 'moderer');
	await base.batch([
		base.delete(commentaire).where(eq(commentaire.id, id)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'supprimer_commentaire', cibleType: 'commentaire', cibleId: id, details: { mur: ligne.mur } }, maintenant)
	]);
}

// Du plus ancien au plus récent.
export async function lireCommentaires(base: Base, acteur: Acteur, idPublication: number, aujourdhui: string): Promise<CommentaireVue[]> {
	exigerDate(aujourdhui);
	const { mur } = await cible(base, acteur, idPublication, aujourdhui);
	const lignes = await base
		.select({ id: commentaire.id, auteur: commentaire.auteur, texte: commentaire.texte, creeLe: commentaire.creeLe, prenom: personne.prenom, nom: personne.nom })
		.from(commentaire)
		.leftJoin(personne, sql`${commentaire.auteur} = 'personne:' || ${personne.id}`)
		.where(eq(commentaire.publicationId, idPublication))
		.orderBy(asc(commentaire.id));
	return lignes.map((c) => commentaireVu(acteur, mur, c));
}

export async function aimer(base: Base, acteur: Acteur, id: number, oui: boolean, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	const { moi } = await pourAgir(base, acteur, id, aujourdhui);
	if (oui) await base.insert(jaime).values({ publicationId: id, personneId: moi }).onConflictDoNothing();
	else await base.delete(jaime).where(and(eq(jaime.publicationId, id), eq(jaime.personneId, moi)));
}

// Seulement les convoqués (voir estConvoque), et avant le début. On peut changer sa réponse.
export async function repondreEvenement(base: Base, acteur: Acteur, id: number, reponse: ReponseEvenement, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(REPONSES_EVENEMENT as readonly string[]).includes(reponse)) throw new DonneeInvalide('Réponse inconnue');
	const { ligne, cle, appartenances, moi } = await pourAgir(base, acteur, id, aujourdhui);
	if (ligne.debut === null) throw new DonneeInvalide('Pas un événement');
	if (ligne.debut.slice(0, 16) <= maintenant.slice(0, 16)) throw new DonneeInvalide('Cet événement est passé');
	if (!estConvoque(appartenances, cle, JSON.parse(ligne.convoques ?? '"tous"'))) throw refusMur(cle, 'lire', 'Vous n’êtes pas convoqué à cet événement');
	await base.insert(reponseEvenement).values({ publicationId: id, personneId: moi, reponse }).onConflictDoUpdate({ target: [reponseEvenement.publicationId, reponseEvenement.personneId], set: { reponse } });
}

// Un vote par personne : le rang de la réponse choisie ; voter à nouveau le change. Seulement entre l'ouverture et la clôture.
export async function voter(base: Base, acteur: Acteur, id: number, reponse: number, maintenant: string): Promise<void> {
	const { ligne, moi } = await pourAgir(base, acteur, id, exigerDateHeure(maintenant, 'Date'));
	if (ligne.sondageReponses === null) throw new DonneeInvalide('Pas de sondage');
	const etat = etatSondage(ligne.sondageOuverture, ligne.sondageCloture, maintenant);
	if (etat === 'avenir') throw new DonneeInvalide('Sondage pas encore ouvert');
	if (etat === 'ferme') throw new DonneeInvalide('Sondage fermé');
	const choix: string[] = JSON.parse(ligne.sondageReponses);
	if (!Number.isInteger(reponse) || reponse < 0 || reponse >= choix.length) throw new DonneeInvalide('Réponse inconnue');
	await base.insert(voteSondage).values({ publicationId: id, personneId: moi, reponse }).onConflictDoUpdate({ target: [voteSondage.publicationId, voteSondage.personneId], set: { reponse } });
}

// Une fois : la date retenue est la première.
export async function prendreConnaissance(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<void> {
	const { ligne, moi } = await pourAgir(base, acteur, id, exigerDateHeure(maintenant, 'Date'));
	if (ligne.priseDeConnaissance !== 1) throw new DonneeInvalide('Aucune prise de connaissance demandée');
	await base.insert(priseConnaissance).values({ publicationId: id, personneId: moi, le: maintenant }).onConflictDoNothing();
}

const parNom = (a: Personne, b: Personne) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr');

// Qui a fait quoi, et qui pas encore parmi les membres du mur (ou les convoqués) ce jour-là. Auteur et modérateurs seulement. Trois requêtes.
export async function suiviPublication(base: Base, acteur: Acteur, id: number, aujourdhui: string): Promise<Suivi> {
	exigerDate(aujourdhui);
	const { ligne, cle, droits } = await cible(base, acteur, id, aujourdhui);
	if (!droits.supprimer) throw refusMur(cle, 'moderer');
	const convoques: Convoques | null = ligne.debut === null ? null : JSON.parse(ligne.convoques ?? '"tous"');
	const equipes = [...new Set([...(cle.startsWith('equipe:') ? [Number(cle.slice('equipe:'.length))] : []), ...(Array.isArray(convoques) ? convoques : [])])];

	// Agents (ni partis, ni suspendus, ni extérieurs, comme mursDe), affectations en cours des équipes utiles, rôles tenus par chacun.
	const [agents, affectations, tenues, prises, reponses] = await base.batch([
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom })
			.from(personne)
			.leftJoin(profil, eq(profil.id, personne.profilId))
			.where(and(inArray(personne.statut, STATUTS_AVEC_ACCES), or(isNull(profil.typePersonne), ne(profil.typePersonne, 'exterieur')))),
		base
			.select({ personneId: affectationEquipe.personneId, equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin })
			.from(affectationEquipe)
			.where(and(inArray(affectationEquipe.equipeId, equipes), lte(affectationEquipe.debut, aujourdhui), or(isNull(affectationEquipe.fin), gte(affectationEquipe.fin, aujourdhui)))),
		requeteTenues(base, null, aujourdhui),
		base
			.select({ personneId: priseConnaissance.personneId, prenom: personne.prenom, nom: personne.nom })
			.from(priseConnaissance)
			.innerJoin(personne, eq(personne.id, priseConnaissance.personneId))
			.where(eq(priseConnaissance.publicationId, id)),
		base
			.select({ personneId: reponseEvenement.personneId, reponse: reponseEvenement.reponse, prenom: personne.prenom, nom: personne.nom })
			.from(reponseEvenement)
			.innerJoin(personne, eq(personne.id, reponseEvenement.personneId))
			.where(eq(reponseEvenement.publicationId, id))
	]);

	const de = (p: number) =>
		appartenances(
			affectations.filter((x) => x.personneId === p),
			tenues.filter((t) => t.personneId === p),
			aujourdhui
		);
	const parAgent = agents.map((ag) => ({ ...ag, a: de(ag.id) }));
	const membres = parAgent.filter((x) => estMembre(x.a, cle));
	const personneDe = (p: { personneId: number; prenom: string; nom: string }): Personne => ({ id: p.personneId, prenom: p.prenom, nom: p.nom });
	const seule = (x: Personne): Personne => ({ id: x.id, prenom: x.prenom, nom: x.nom });

	const suivi: Suivi = {};
	if (ligne.priseDeConnaissance === 1) {
		const faite = prises.map(personneDe).sort(parNom);
		// L'auteur n'a pas à prendre connaissance de sa propre annonce.
		const manquante = membres.filter((m) => !faite.some((f) => f.id === m.id) && `personne:${m.id}` !== ligne.auteur).map(seule).sort(parNom);
		suivi.priseDeConnaissance = { faite, manquante };
	}
	if (convoques !== null) {
		const parReponse = (r: ReponseEvenement) => reponses.filter((x) => x.reponse === r).map(personneDe).sort(parNom);
		suivi.evenement = {
			present: parReponse('present'),
			absent: parReponse('absent'),
			incertain: parReponse('incertain'),
			sans_reponse: parAgent.filter((x) => estConvoque(x.a, cle, convoques) && !reponses.some((r) => r.personneId === x.id)).map(seule).sort(parNom)
		};
	}
	return suivi;
}
