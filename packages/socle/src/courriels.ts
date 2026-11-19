import { and, eq, inArray, like, ne, notExists, sql, type SQL } from 'drizzle-orm';
import type { Base } from './base.ts';
import { exigerDate } from './dates.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { periodeCourte } from './reservations-calcul.ts';
import { gestionnairesDe } from './reservations.ts';
import { avisAnomalie, avisHabillement, coupure, personne, reservation, ressource } from './schema.ts';

// L'e-mail d'une nouvelle demande adressée à un référent : à chacun de ceux qui l'ont reçue en notification (la ligne de leur cloche
// en est la trace : mêmes destinataires, même titre, mêmes deux lignes), sauf s'ils ont coupé « courriel ». Une requête, lue après la réponse.
// Pas d'e-mail pour la suite d'une demande : seules les lignes « nouvelle demande » sont lues.

export type Courriel = { a: string; titre: string; texte: string; url: string };
export type DemandeACourriel =
	| { genre: 'habillement'; id: number }
	| { genre: 'anomalie'; id: number }
	// Les nouvelles anomalies d'une prise de garde validée : une ligne par destinataire, à l'heure de la validation.
	| { genre: 'prise'; enginId: number; quand: string }
	| { genre: 'reservation'; id: number };

const joignable = (qui: SQL) =>
	and(
		inArray(personne.statut, [...STATUTS_AVEC_ACCES]),
		notExists(
			sql`(select 1 from ${coupure} where ${coupure.personneId} = ${qui} and ${coupure.lieu} = 'courriel')`
		)
	);

export async function courrielsDeDemande(base: Base, d: DemandeACourriel, aujourdhui = ''): Promise<Courriel[]> {
	if (d.genre === 'reservation') {
		exigerDate(aujourdhui);
		const [lignes, gestionnaires] = await base.batch([
			base
				.select({ personneId: reservation.personneId, nomDemandeur: reservation.nomDemandeur, debut: reservation.debut, fin: reservation.fin, quantite: reservation.quantite, nom: sql<string>`${ressource.nom}`.as('ressource_nom'), forme: ressource.forme, prenom: personne.prenom, nomPersonne: sql<string | null>`${personne.nom}`.as('personne_nom') })
				.from(reservation)
				.innerJoin(ressource, eq(ressource.id, reservation.ressourceId))
				.leftJoin(personne, eq(personne.id, reservation.personneId))
				.where(and(eq(reservation.id, d.id), eq(reservation.etat, 'attente'))),
			base
				.select({ id: personne.id, a: personne.email })
				.from(personne)
				.where(and(inArray(personne.id, gestionnairesDe(base, sql`(select ${reservation.ressourceId} from ${reservation} where ${reservation.id} = ${d.id})`, aujourdhui)), joignable(sql`"personne"."id"`), ne(personne.email, '')))
		]);
		const r = lignes[0];
		if (!r) return [];
		const demandeur = r.nomDemandeur ?? `${r.prenom ?? ''} ${r.nomPersonne ?? ''}`.trim();
		const texte = [demandeur, ...(r.forme === 'jours' ? [String(r.quantite)] : []), periodeCourte(r.forme, r.debut, r.fin)].join(', ');
		return gestionnaires.filter((g) => g.id !== r.personneId).map((g) => ({ a: g.a, titre: `Demande de réservation · ${r.nom}`, texte, url: '/reservations/a-valider' }));
	}
	const t = d.genre === 'habillement' ? avisHabillement : avisAnomalie;
	const quelles =
		d.genre === 'habillement' ? and(eq(avisHabillement.url, `/habillement/${d.id}`), eq(avisHabillement.titre, 'Nouvelle demande d’habillement'))
		: d.genre === 'anomalie' ? and(eq(avisAnomalie.url, `/engins/anomalies/${d.id}`), like(avisAnomalie.titre, 'Anomalie signalée · %'))
		: and(eq(avisAnomalie.url, `/engins/anomalies?engin=${d.enginId}`), eq(avisAnomalie.creeLe, d.quand), like(avisAnomalie.titre, 'Prise de garde · %'));
	return base
		.select({ a: personne.email, titre: t.titre, texte: t.texte, url: t.url })
		.from(t)
		.innerJoin(personne, eq(personne.id, t.personneId))
		.where(and(quelles, joignable(sql`${t.personneId}`), ne(personne.email, '')))
		.orderBy(t.id);
}
