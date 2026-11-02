import { type SQL, sql } from 'drizzle-orm';

export const DROITS = [
	'VOIR_PLANNING',
	'VOIR_ANNUAIRE',
	'VOIR_ENGINS',
	'VOIR_ANOMALIES',
	'SIGNALER_ANOMALIE',
	'SIGNALER_BESOIN_STOCK',
	'DEMANDER_REMPLACEMENT',
	'DECLARER_DISPONIBILITE',
	'UTILISER_MESSAGERIE',
	'FAIRE_PRISE_DE_GARDE',
	'PRENDRE_EN_CHARGE_ANOMALIE',
	'TRAITER_ANOMALIE',
	'GERER_FICHES',
	'GERER_STOCK',
	'GERER_PLANNING',
	'VALIDER_REMPLACEMENT',
	'VOIR_MOTIFS_ABSENCE',
	'LIRE_SALON',
	'PUBLIER_SALON',
	'MODERER_SALON',
	'EPINGLER_SALON',
	'RESERVER',
	'GERER_RESERVATIONS',
	'MODERER_MESSAGERIE',
	'GERER_LISTES',
	'GERER_ACCES',
	'GERER_COMITES',
	'ATTRIBUER_RESPONSABILITE',
] as const;
export type Droit = (typeof DROITS)[number];

// Droits qui donnent du pouvoir sur l'appli ; tous les autres sont des droits métier.
export const DROITS_POUVOIR = ['GERER_ACCES', 'ATTRIBUER_RESPONSABILITE', 'GERER_LISTES', 'GERER_COMITES'] as const;

export function estDroitPouvoir(d: Droit): boolean {
	return (DROITS_POUVOIR as readonly Droit[]).includes(d);
}

export const TYPES_PERIMETRE = ['centre', 'equipe', 'comite', 'salon', 'ressource'] as const;
export type TypePerimetre = (typeof TYPES_PERIMETRE)[number];

export const TYPES_PERSONNE = ['agent', 'exterieur'] as const;
export type TypePersonne = (typeof TYPES_PERSONNE)[number];

export const STATUTS_OPERATIONNELS = ['operationnel', 'stagiaire', 'inapte_temporaire', 'suspendu', 'parti'] as const;
export type StatutOperationnel = (typeof STATUTS_OPERATIONNELS)[number];

export const STATUTS_AVEC_ACCES = ['operationnel', 'stagiaire', 'inapte_temporaire'] as const;

export const NATURES_RESPONSABILITE = ['fonction', 'mission'] as const;

export const TYPES_PUBLICATION = ['message', 'annonce', 'evenement', 'bravo'] as const;
export type TypePublication = (typeof TYPES_PUBLICATION)[number];

export const REPONSES_EVENEMENT = ['present', 'absent', 'incertain'] as const;
export type ReponseEvenement = (typeof REPONSES_EVENEMENT)[number];

export const TYPES_PHOTO = ['image/jpeg', 'image/webp'] as const;

export const TYPES_CONVERSATION = ['deux', 'groupe'] as const;
export type TypeConversation = (typeof TYPES_CONVERSATION)[number];

export const SUPPRESSIONS_MESSAGE = ['auteur', 'moderation'] as const;

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '👏'] as const;
export type Reaction = (typeof REACTIONS)[number];

// Réservations : une ressource se prend par jours (avec un stock) ou par créneau horaire.
export const FORMES_RESSOURCE = ['jours', 'creneau'] as const;
export type FormeRessource = (typeof FORMES_RESSOURCE)[number];

export const ETATS_RESERVATION = ['attente', 'acceptee', 'refusee', 'annulee'] as const;
export type EtatReservation = (typeof ETATS_RESERVATION)[number];

export const AVIS_RESERVATION = ['acceptee', 'refusee', 'annulee'] as const;
export type AvisReservation = (typeof AVIS_RESERVATION)[number];
export const FETES = ['noel', 'nouvel_an'] as const;

// Remplacements : céder une ou des périodes, échanger des périodes, échanger une manœuvre.
export const GENRES_DEMANDE = ['remplacement', 'echange', 'manoeuvre'] as const;
export type GenreDemande = (typeof GENRES_DEMANDE)[number];
export const ETATS_DEMANDE = ['attente', 'a_valider', 'conclue', 'refusee', 'annulee', 'expiree'] as const;
export type EtatDemande = (typeof ETATS_DEMANDE)[number];
export const AVIS_REMPLACEMENT = ['recue', 'acceptee', 'refusee', 'a_valider', 'validee', 'refus_chef', 'desistement', 'expiree', 'annulee', 'relance', 'informe'] as const;
export type AvisRemplacement = (typeof AVIS_REMPLACEMENT)[number];
// Ce qu'un agent apprend de l'été : rappel de ses vacances, sa place dans la répartition publiée, ou (chef) des vacances changées.
export const AVIS_ETE = ['rappel', 'repartition', 'vacances_changees', 'semaine'] as const;
export type AvisEte = (typeof AVIS_ETE)[number];

export const RESPONSABILITES_SYSTEME = ['chef_centre', 'chef_centre_adjoint', 'chef_equipe'] as const;
export type ResponsabiliteSysteme = (typeof RESPONSABILITES_SYSTEME)[number];

// Condition à passer à check() de Drizzle ; valeurs écrites en dur car une migration n'accepte pas de paramètre.
export function checkDans(colonne: string, liste: readonly string[]): SQL {
	const valeurs = liste.map((valeur) => sql.raw(`'${valeur.replaceAll("'", "''")}'`));
	return sql`${sql.identifier(colonne)} IN (${sql.join(valeurs, sql.raw(', '))})`;
}
