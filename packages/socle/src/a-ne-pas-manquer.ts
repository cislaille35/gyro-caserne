import { alias } from 'drizzle-orm/sqlite-core';
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { nomActeur } from './actions/personnes.ts';
import type { Base } from './base.ts';
import { ajouterJours, debutMinimumEvenement, exigerDate, exigerDateHeure, momentEvenement } from './dates.ts';
import type { Acteur } from './droits.ts';
import { STATUTS_AVEC_ACCES, type ReponseEvenement } from './listes.ts';
import { estConvoque, estMembre, mursEtAppartenances, type CleMur, type Mur } from './murs.ts';
import { requetePourMoi } from './remplacements/lectures.ts';
import { texteDemande } from './remplacements/tranches.ts';
import { personne, priseConnaissance, profil, publication, reponseEvenement, souhaitAnniversaire, visiteMur, voteSondage } from './schema.ts';

export type ItemANePasManquer = { id: number; cle: CleMur; nomMur: string; titre: string };
export type ANePasManquer = {
	annonces: ItemANePasManquer[];
	// `enCours` : commencé, pas fini (à sa fin, ou 3 h après le début) ; on ne peut plus y répondre.
	evenements: (ItemANePasManquer & { debut: string; demain: boolean; enCours: boolean; reponse: ReponseEvenement | null })[];
	sondages: ItemANePasManquer[];
	epinglees: ItemANePasManquer[];
	nouveautes: { cle: CleMur; nom: string; nombre: number }[];
	// Les demandes de remplacement reçues qui attendent une réponse.
	remplacements: { id: number; titre: string; sous: string; debut: string }[];
};

const RECENT = 30;
const ANNONCES = 90;
const SANS_VISITE = 14;

// Le début du texte, sur une ligne, 80 caractères au plus.
function titre(texte: string): string {
	const ligne = texte.replace(/\s+/g, ' ').trim();
	return ligne.length <= 80 ? ligne : `${ligne.slice(0, 79)}…`;
}

// Deux requêtes : les murs de l'acteur, puis un bloc de lectures filtrées ici selon ses murs.
// Annonces (90 derniers jours), événements et sondages : seulement les murs dont il est membre (pas ceux qu'il supervise), hors lecture seule.
export async function aNePasManquer(base: Base, acteur: Acteur, aujourdhui: string, maintenant: string): Promise<ANePasManquer> {
	exigerDate(aujourdhui);
	exigerDateHeure(maintenant, 'Date');
	const { murs, appartenances } = await mursEtAppartenances(base, acteur, aujourdhui);
	if (murs.length === 0) return { annonces: [], evenements: [], sondages: [], epinglees: [], nouveautes: [], remplacements: [] };

	// Le super administrateur n'a pas de fiche : 0 ne désigne personne.
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	const pasDeMoi = ne(publication.auteur, nomActeur(acteur));
	const recent = gte(publication.creeLe, ajouterJours(aujourdhui, -RECENT));
	// Même règle qu'etatSondage : sans ses deux dates, un sondage est toujours ouvert.
	const m = maintenant.slice(0, 16);
	const ouvert = or(isNull(publication.sondageOuverture), isNull(publication.sondageCloture), and(lte(publication.sondageOuverture, m), gt(publication.sondageCloture, m)));
	// Le début du texte suffit au titre.
	const champs = { id: publication.id, mur: publication.mur, texte: sql<string>`substr(${publication.texte}, 1, 200)`.as('debut_texte') };
	// Murs où l'acteur a quelque chose à faire : membre, et mur ouvert. Quelques clés seulement (centre, vie, son équipe, ses comités).
	const aTraiter = murs.filter((m) => !m.lectureSeule && estMembre(appartenances, m.cle)).map((m) => m.cle);
	const surSesMurs = inArray(publication.mur, aTraiter);

	const [annonces, evenements, sondages, epinglees, nouveautes, remplacements] = await base.batch([
		base
			.select(champs)
			.from(publication)
			.leftJoin(priseConnaissance, and(eq(priseConnaissance.publicationId, publication.id), eq(priseConnaissance.personneId, moi)))
			.where(and(surSesMurs, eq(publication.type, 'annonce'), eq(publication.priseDeConnaissance, 1), pasDeMoi, gte(publication.creeLe, ajouterJours(aujourdhui, -ANNONCES)), isNull(priseConnaissance.publicationId)))
			.orderBy(desc(publication.creeLe), desc(publication.id)),
		base
			.select({ ...champs, debut: publication.debut, fin: publication.fin, convoques: publication.convoques, reponse: reponseEvenement.reponse })
			.from(publication)
			.leftJoin(reponseEvenement, and(eq(reponseEvenement.publicationId, publication.id), eq(reponseEvenement.personneId, moi)))
			.where(and(surSesMurs, or(gt(publication.debut, debutMinimumEvenement(maintenant)), gt(publication.fin, m)), isNull(publication.annuleeLe)))
			.orderBy(asc(publication.debut), asc(publication.id)),
		base
			.select(champs)
			.from(publication)
			.leftJoin(voteSondage, and(eq(voteSondage.publicationId, publication.id), eq(voteSondage.personneId, moi)))
			.where(and(surSesMurs, sql`${publication.sondageQuestion} is not null`, ouvert, recent, isNull(voteSondage.publicationId), isNull(publication.annuleeLe)))
			.orderBy(desc(publication.creeLe), desc(publication.id)),
		base
			.select(champs)
			.from(publication)
			.where(and(eq(publication.epinglee, 1), recent))
			.orderBy(desc(publication.creeLe), desc(publication.id)),
		// Sans visite, les 14 derniers jours. Ses propres publications ne comptent pas.
		base
			.select({ mur: publication.mur, nombre: count() })
			.from(publication)
			.leftJoin(visiteMur, and(eq(visiteMur.personneId, moi), eq(visiteMur.mur, publication.mur)))
			.where(and(pasDeMoi, sql`${publication.creeLe} > coalesce(${visiteMur.vueLe}, ${ajouterJours(aujourdhui, -SANS_VISITE)})`))
			.groupBy(publication.mur),
		requetePourMoi(base, moi, maintenant)
	]);

	const parCle = new Map<string, Mur>(murs.map((m) => [m.cle, m]));
	const item = (p: { id: number; mur: string; texte: string }): ItemANePasManquer => ({ id: p.id, cle: p.mur as CleMur, nomMur: parCle.get(p.mur)!.nom, titre: titre(p.texte) });
	const demain = ajouterJours(aujourdhui, 1);

	return {
		annonces: annonces.map(item),
		evenements: evenements
			// La requête ramène aussi une manœuvre courte déjà finie (moins de 3 h) : écartée ici.
			.filter((p) => estConvoque(appartenances, p.mur, JSON.parse(p.convoques ?? '"tous"'), moi) && momentEvenement(p.debut!, maintenant, p.fin) !== 'passe')
			.map((p) => {
				const enCours = momentEvenement(p.debut!, maintenant, p.fin) === 'enCours';
				return { ...item(p), debut: p.debut!, demain: !enCours && p.debut!.slice(0, 10) === demain, enCours, reponse: p.reponse };
			}),
		sondages: sondages.map(item),
		epinglees: epinglees.filter((p) => parCle.has(p.mur)).map(item),
		remplacements: remplacements.map((r) => ({
			id: r.id,
			titre: r.genre === 'remplacement' ? `${r.prenom} ${r.nom} cherche un remplaçant` : `${r.prenom} ${r.nom} propose un échange`,
			sous: r.genre === 'manoeuvre' ? 'Échange de manœuvre' : texteDemande(JSON.parse(r.periodes)),
			debut: r.debut
		})),
		nouveautes: murs.flatMap((m) => {
			const nombre = nouveautes.find((n) => n.mur === m.cle)?.nombre ?? 0;
			return nombre > 0 ? [{ cle: m.cle, nom: m.nom, nombre }] : [];
		})
	};
}

// Date de naissance inscrite et affichage activé. Né un 29 février : fêté le 28 février les années non bissextiles.
const sonJour = (aujourdhui: string) => and(inArray(sql`substr(${personne.naissance}, 6, 5)`, joursFetes(aujourdhui)), eq(personne.anniversaireVisible, 1));
// Qui le centre fête aujourd'hui : en plus, agents ni partis, ni suspendus, ni extérieurs (requête jointe à `profil`).
export const fetesDuJour = (aujourdhui: string) => and(sonJour(aujourdhui), inArray(personne.statut, [...STATUTS_AVEC_ACCES]), or(isNull(profil.typePersonne), ne(profil.typePersonne, 'exterieur')));

// `geste` : ce que la personne peut faire pour chacun ; rien pour elle-même ni pour le super administrateur (décision 0033). Jamais l'âge.
export type AnniversaireDuJour = { id: number; prenom: string; nom: string; geste: 'souhaiter' | 'souhaite' | null };

export async function anniversairesDuJour(base: Base, acteur: Acteur, aujourdhui: string): Promise<AnniversaireDuJour[]> {
	const moi = acteur.type === 'personne' ? acteur.id : null;
	const souhaite = sql<number>`exists (select 1 from ${souhaitAnniversaire} where ${souhaitAnniversaire.personneId} = ${personne.id} and ${souhaitAnniversaire.jour} = ${aujourdhui} and ${souhaitAnniversaire.auteurId} = ${moi ?? 0})`;
	const lignes = await base
		.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, souhaite: souhaite.as('souhaite') })
		.from(personne)
		.leftJoin(profil, eq(profil.id, personne.profilId))
		.where(fetesDuJour(aujourdhui))
		.orderBy(asc(personne.nom), asc(personne.prenom));
	return lignes.map(({ souhaite, ...p }) => ({ ...p, geste: moi === null || p.id === moi ? null : souhaite ? 'souhaite' : 'souhaiter' }));
}

// L'agent connecté fête-t-il son anniversaire aujourd'hui ? Date inscrite et affichage activé. Si oui, les collègues qui le lui ont souhaité. Une requête.
export async function monAnniversaire(base: Base, acteur: Acteur, aujourdhui: string): Promise<{ souhaitePar: { prenom: string; nom: string }[] } | null> {
	exigerDate(aujourdhui);
	if (acteur.type !== 'personne') return null;
	const auteur = alias(personne, 'auteur');
	const [fete, souhaits] = await base.batch([
		base
			.select({ id: personne.id })
			.from(personne)
			.where(and(eq(personne.id, acteur.id), sonJour(aujourdhui))),
		base
			.select({ prenom: auteur.prenom, nom: auteur.nom })
			.from(souhaitAnniversaire)
			.innerJoin(auteur, eq(auteur.id, souhaitAnniversaire.auteurId))
			.where(and(eq(souhaitAnniversaire.personneId, acteur.id), eq(souhaitAnniversaire.jour, aujourdhui)))
			.orderBy(asc(souhaitAnniversaire.creeLe), asc(souhaitAnniversaire.id))
	]);
	return fete.length === 0 ? null : { souhaitePar: souhaits };
}

function joursFetes(aujourdhui: string): string[] {
	exigerDate(aujourdhui);
	const jour = aujourdhui.slice(5);
	return jour === '02-28' && ajouterJours(aujourdhui, 1).endsWith('03-01') ? ['02-28', '02-29'] : [jour];
}
