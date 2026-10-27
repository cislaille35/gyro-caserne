import { echec, type Reponse } from './formulaire-agent.ts';

// Refus de nomination qui visent un champ précis du formulaire (le reste s'affiche en message général).
const CHAMP_DE_L_ERREUR: Record<string, string> = {
	'Cette personne tient déjà ce rôle sur cette période': 'debut',
	'Fin avant le début': 'fin',
	'Personne inconnue': 'personneId',
	'Responsabilité inconnue': 'responsabiliteId',
	'Responsabilité archivée': 'responsabiliteId',
	'Périmètre différent de celui de la responsabilité': 'perimetreId',
	'Équipe inconnue': 'perimetreId',
	'Comité inconnu': 'perimetreId',
	'Comité dissous': 'perimetreId'
};

// Traduit un refus du socle pour les formulaires de nomination (fiche, page « Nominations »).
export const echecAttribution = (erreur: unknown, contexte: Reponse = {}) => echec(erreur, contexte, CHAMP_DE_L_ERREUR);
