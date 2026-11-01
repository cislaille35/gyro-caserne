import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { nomActeur } from './actions/personnes.ts';
import type { Base } from './base.ts';
import { ajouterJours, exigerDate, exigerDateHeure } from './dates.ts';
import type { Acteur } from './droits.ts';
import { STATUTS_AVEC_ACCES, type ReponseEvenement } from './listes.ts';
import { estConvoque, estMembre, mursEtAppartenances, type CleMur, type Mur } from './murs.ts';
import { personne, priseConnaissance, profil, publication, reponseEvenement, visiteMur, voteSondage } from './schema.ts';

export type ItemANePasManquer = { id: number; cle: CleMur; nomMur: string; titre: string };
export type ANePasManquer = {
	annonces: ItemANePasManquer[];
	evenements: (ItemANePasManquer & { debut: string; demain: boolean; reponse: ReponseEvenement | null })[];
	sondages: ItemANePasManquer[];
	epinglees: ItemANePasManquer[];
	nouveautes: { cle: CleMur; nom: string; nombre: number }[];
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
	if (murs.length === 0) return { annonces: [], evenements: [], sondages: [], epinglees: [], nouveautes: [] };

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

	const [annonces, evenements, sondages, epinglees, nouveautes] = await base.batch([
		base
			.select(champs)
			.from(publication)
			.leftJoin(priseConnaissance, and(eq(priseConnaissance.publicationId, publication.id), eq(priseConnaissance.personneId, moi)))
			.where(and(surSesMurs, eq(publication.type, 'annonce'), eq(publication.priseDeConnaissance, 1), pasDeMoi, gte(publication.creeLe, ajouterJours(aujourdhui, -ANNONCES)), isNull(priseConnaissance.publicationId)))
			.orderBy(desc(publication.creeLe), desc(publication.id)),
		base
			.select({ ...champs, debut: publication.debut, convoques: publication.convoques, reponse: reponseEvenement.reponse })
			.from(publication)
			.leftJoin(reponseEvenement, and(eq(reponseEvenement.publicationId, publication.id), eq(reponseEvenement.personneId, moi)))
			.where(and(surSesMurs, gt(publication.debut, maintenant), isNull(publication.annuleeLe)))
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
			.groupBy(publication.mur)
	]);

	const parCle = new Map<string, Mur>(murs.map((m) => [m.cle, m]));
	const item = (p: { id: number; mur: string; texte: string }): ItemANePasManquer => ({ id: p.id, cle: p.mur as CleMur, nomMur: parCle.get(p.mur)!.nom, titre: titre(p.texte) });
	const demain = ajouterJours(aujourdhui, 1);

	return {
		annonces: annonces.map(item),
		evenements: evenements
			.filter((p) => estConvoque(appartenances, p.mur, JSON.parse(p.convoques ?? '"tous"')))
			.map((p) => ({ ...item(p), debut: p.debut!, demain: p.debut!.slice(0, 10) === demain, reponse: p.reponse })),
		sondages: sondages.map(item),
		epinglees: epinglees.filter((p) => parCle.has(p.mur)).map(item),
		nouveautes: murs.flatMap((m) => {
			const nombre = nouveautes.find((n) => n.mur === m.cle)?.nombre ?? 0;
			return nombre > 0 ? [{ cle: m.cle, nom: m.nom, nombre }] : [];
		})
	};
}

// Agents (ni partis, ni suspendus, ni extérieurs) dont la date de naissance est inscrite et l'affichage activé. Jamais l'âge.
// Né un 29 février : fêté le 28 février les années non bissextiles.
export async function anniversairesDuJour(base: Base, aujourdhui: string): Promise<{ prenom: string; nom: string }[]> {
	const jours = joursFetes(aujourdhui);
	return base
		.select({ prenom: personne.prenom, nom: personne.nom })
		.from(personne)
		.leftJoin(profil, eq(profil.id, personne.profilId))
		.where(
			and(
				inArray(sql`substr(${personne.naissance}, 6, 5)`, jours),
				eq(personne.anniversaireVisible, 1),
				inArray(personne.statut, [...STATUTS_AVEC_ACCES]),
				or(isNull(profil.typePersonne), ne(profil.typePersonne, 'exterieur'))
			)
		)
		.orderBy(asc(personne.nom), asc(personne.prenom));
}

// L'agent connecté fête-t-il son anniversaire aujourd'hui ? Mêmes règles : date inscrite et affichage activé.
export async function monAnniversaire(base: Base, acteur: Acteur, aujourdhui: string): Promise<boolean> {
	const jours = joursFetes(aujourdhui);
	if (acteur.type !== 'personne') return false;
	const [fiche] = await base
		.select({ id: personne.id })
		.from(personne)
		.where(and(eq(personne.id, acteur.id), inArray(sql`substr(${personne.naissance}, 6, 5)`, jours), eq(personne.anniversaireVisible, 1)));
	return fiche !== undefined;
}

function joursFetes(aujourdhui: string): string[] {
	exigerDate(aujourdhui);
	const jour = aujourdhui.slice(5);
	return jour === '02-28' && ajouterJours(aujourdhui, 1).endsWith('03-01') ? ['02-28', '02-29'] : [jour];
}
