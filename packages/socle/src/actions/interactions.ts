import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDate } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { REPONSES_EVENEMENT, STATUTS_AVEC_ACCES, type ReponseEvenement } from '../listes.ts';
import { exigerMur, refusMur } from '../murs.ts';
import { affectationEquipe, attribution, commentaire, jaime, personne, priseConnaissance, profil, publication, reponseEvenement, responsabilite, voteSondage } from '../schema.ts';
import { nomActeur } from './personnes.ts';
import { cible, exigerDateHeure, texte, type Convoques } from './publications.ts';

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
	return lignes.map((c) => ({
		id: c.id,
		auteur: c.auteur.startsWith('super:') ? { prenom: 'Super', nom: 'administrateur' } : c.nom === null ? { prenom: '', nom: 'Personne inconnue' } : { prenom: c.prenom!, nom: c.nom },
		texte: c.texte,
		creeLe: c.creeLe,
		supprimable: c.auteur === nomActeur(acteur) || mur.peutModerer
	}));
}

export async function aimer(base: Base, acteur: Acteur, id: number, oui: boolean, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	const { moi } = await pourAgir(base, acteur, id, aujourdhui);
	if (oui) await base.insert(jaime).values({ publicationId: id, personneId: moi }).onConflictDoNothing();
	else await base.delete(jaime).where(and(eq(jaime.publicationId, id), eq(jaime.personneId, moi)));
}

// Seulement les convoqués : tout le mur, ou les membres en cours des équipes convoquées. On peut changer sa réponse.
export async function repondreEvenement(base: Base, acteur: Acteur, id: number, reponse: ReponseEvenement, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	if (!(REPONSES_EVENEMENT as readonly string[]).includes(reponse)) throw new DonneeInvalide('Réponse inconnue');
	const { ligne, cle, moi } = await pourAgir(base, acteur, id, aujourdhui);
	if (ligne.debut === null) throw new DonneeInvalide('Pas un événement');
	const convoques: Convoques = JSON.parse(ligne.convoques ?? '"tous"');
	if (convoques !== 'tous') {
		const membre = await base
			.select({ equipeId: affectationEquipe.equipeId })
			.from(affectationEquipe)
			.where(and(eq(affectationEquipe.personneId, moi), inArray(affectationEquipe.equipeId, convoques), enCoursLe(aujourdhui)));
		if (membre.length === 0) throw refusMur(cle, 'lire');
	}
	await base.insert(reponseEvenement).values({ publicationId: id, personneId: moi, reponse }).onConflictDoUpdate({ target: [reponseEvenement.publicationId, reponseEvenement.personneId], set: { reponse } });
}

// Un vote par personne : le rang de la réponse choisie ; voter à nouveau le change.
export async function voter(base: Base, acteur: Acteur, id: number, reponse: number, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	const { ligne, moi } = await pourAgir(base, acteur, id, aujourdhui);
	if (ligne.sondageReponses === null) throw new DonneeInvalide('Pas de sondage');
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

const enCoursLe = (aujourdhui: string) => and(lte(affectationEquipe.debut, aujourdhui), or(isNull(affectationEquipe.fin), gte(affectationEquipe.fin, aujourdhui)));
const parNom = (a: Personne, b: Personne) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr');

// Qui a fait quoi, et qui pas encore parmi les lecteurs (ou convoqués) du jour. Auteur et modérateurs seulement. Trois requêtes.
export async function suiviPublication(base: Base, acteur: Acteur, id: number, aujourdhui: string): Promise<Suivi> {
	exigerDate(aujourdhui);
	const { ligne, mur, cle, droits } = await cible(base, acteur, id, aujourdhui);
	if (!droits.supprimer) throw refusMur(cle, 'moderer');
	const convoques: Convoques | null = ligne.debut === null ? null : JSON.parse(ligne.convoques ?? '"tous"');
	const [type, numero] = cle.split(':') as [string, string | undefined];
	const equipesUtiles = [...new Set([...(type === 'equipe' ? [Number(numero)] : []), ...(Array.isArray(convoques) ? convoques : [])])];

	// Comme mursDe : agents (ni partis, ni suspendus, ni extérieurs), leurs équipes en cours et les rôles qui ouvrent des murs.
	const [agents, affectations, tenues, prises, reponses] = await base.batch([
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom })
			.from(personne)
			.leftJoin(profil, eq(profil.id, personne.profilId))
			.where(and(inArray(personne.statut, STATUTS_AVEC_ACCES), or(isNull(profil.typePersonne), ne(profil.typePersonne, 'exterieur')))),
		base
			.select({ personneId: affectationEquipe.personneId, equipeId: affectationEquipe.equipeId })
			.from(affectationEquipe)
			.where(and(inArray(affectationEquipe.equipeId, equipesUtiles), enCoursLe(aujourdhui))),
		base
			.select({ personneId: attribution.personneId, type: attribution.perimetreType, perimetreId: attribution.perimetreId, systeme: responsabilite.systeme })
			.from(attribution)
			.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
			.where(
				and(
					isNull(responsabilite.archiveeLe),
					eq(attribution.perimetreType, responsabilite.typePerimetre),
					lte(attribution.debut, aujourdhui),
					or(isNull(attribution.fin), gte(attribution.fin, aujourdhui)),
					or(inArray(responsabilite.systeme, ['chef_centre', 'chef_centre_adjoint', 'chef_equipe']), eq(attribution.perimetreType, 'comite'))
				)
			),
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

	const tient = (p: number, garde: (t: (typeof tenues)[number]) => boolean) => tenues.some((t) => t.personneId === p && garde(t));
	const membre = (p: number, equipeId: number) => affectations.some((a) => a.personneId === p && a.equipeId === equipeId);
	const litLeMur = (p: number) => {
		if (type === 'centre' || type === 'vie' || tient(p, (t) => t.systeme === 'chef_centre' || t.systeme === 'chef_centre_adjoint')) return true;
		const n = Number(numero);
		if (type === 'equipe') return membre(p, n) || tient(p, (t) => t.systeme === 'chef_equipe' && t.perimetreId === n);
		// Un comité dissous n'est plus lu que par le chef de centre et l'adjoint.
		return !mur.lectureSeule && tient(p, (t) => t.type === 'comite' && t.perimetreId === n);
	};
	const lecteurs = agents.filter((a) => litLeMur(a.id));
	const personneDe = (p: { personneId: number; prenom: string; nom: string }): Personne => ({ id: p.personneId, prenom: p.prenom, nom: p.nom });

	const suivi: Suivi = {};
	if (ligne.priseDeConnaissance === 1) {
		const faite = prises.map(personneDe).sort(parNom);
		// L'auteur n'a pas à prendre connaissance de sa propre annonce.
		const manquante = lecteurs.filter((l) => !faite.some((f) => f.id === l.id) && `personne:${l.id}` !== ligne.auteur).sort(parNom);
		suivi.priseDeConnaissance = { faite, manquante };
	}
	if (convoques !== null) {
		const attendus = convoques === 'tous' ? lecteurs : lecteurs.filter((l) => convoques.some((e) => membre(l.id, e)));
		const parReponse = (r: ReponseEvenement) => reponses.filter((x) => x.reponse === r).map(personneDe).sort(parNom);
		suivi.evenement = {
			present: parReponse('present'),
			absent: parReponse('absent'),
			incertain: parReponse('incertain'),
			sans_reponse: attendus.filter((a) => !reponses.some((r) => r.personneId === a.id)).sort(parNom)
		};
	}
	return suivi;
}
