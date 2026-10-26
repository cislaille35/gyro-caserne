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

export const TYPES_PERIMETRE = ['centre', 'equipe', 'comite', 'salon', 'ressource'] as const;
export type TypePerimetre = (typeof TYPES_PERIMETRE)[number];

export const TYPES_PERSONNE = ['agent', 'exterieur'] as const;
export type TypePersonne = (typeof TYPES_PERSONNE)[number];

export const STATUTS_OPERATIONNELS = ['operationnel', 'stagiaire', 'inapte_temporaire', 'suspendu', 'parti'] as const;
export type StatutOperationnel = (typeof STATUTS_OPERATIONNELS)[number];

export const STATUTS_AVEC_ACCES = ['operationnel', 'stagiaire', 'inapte_temporaire'] as const;

export const NATURES_RESPONSABILITE = ['fonction', 'mission'] as const;

export const RESPONSABILITES_SYSTEME = ['chef_centre', 'chef_centre_adjoint', 'chef_equipe'] as const;
export type ResponsabiliteSysteme = (typeof RESPONSABILITES_SYSTEME)[number];

// Condition à passer à check() de Drizzle ; valeurs écrites en dur car une migration n'accepte pas de paramètre.
export function checkDans(colonne: string, liste: readonly string[]): SQL {
	const valeurs = liste.map((valeur) => sql.raw(`'${valeur.replaceAll("'", "''")}'`));
	return sql`${sql.identifier(colonne)} IN (${sql.join(valeurs, sql.raw(', '))})`;
}
