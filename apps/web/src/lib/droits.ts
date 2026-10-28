import type { Droit } from '@gyro-caserne/socle';

// Ce que chaque droit permet, dit simplement.
export const LIBELLES_DROIT: Record<Droit, string> = {
	VOIR_PLANNING: 'Voir le planning',
	VOIR_ANNUAIRE: 'Voir l’annuaire',
	VOIR_ENGINS: 'Voir les engins',
	VOIR_ANOMALIES: 'Voir les anomalies',
	SIGNALER_ANOMALIE: 'Signaler une anomalie',
	SIGNALER_BESOIN_STOCK: 'Signaler un besoin de stock',
	DEMANDER_REMPLACEMENT: 'Demander un remplacement',
	DECLARER_DISPONIBILITE: 'Déclarer ses disponibilités',
	UTILISER_MESSAGERIE: 'Utiliser la messagerie',
	FAIRE_PRISE_DE_GARDE: 'Faire la prise de garde',
	PRENDRE_EN_CHARGE_ANOMALIE: 'Prendre en charge une anomalie',
	TRAITER_ANOMALIE: 'Traiter une anomalie',
	GERER_FICHES: 'Gérer les fiches de prise de garde',
	GERER_STOCK: 'Gérer le stock',
	GERER_PLANNING: 'Gérer le planning',
	VALIDER_REMPLACEMENT: 'Valider un remplacement',
	VOIR_MOTIFS_ABSENCE: 'Voir les motifs d’absence',
	LIRE_SALON: 'Lire un salon',
	PUBLIER_SALON: 'Publier dans un salon',
	MODERER_SALON: 'Modérer un salon',
	EPINGLER_SALON: 'Épingler dans un salon',
	RESERVER: 'Réserver une ressource',
	GERER_RESERVATIONS: 'Gérer les réservations',
	MODERER_MESSAGERIE: 'Modérer la messagerie',
	GERER_LISTES: 'Gérer les responsabilités',
	GERER_ACCES: 'Gérer les accès',
	GERER_COMITES: 'Gérer les comités',
	ATTRIBUER_RESPONSABILITE: 'Attribuer une responsabilité'
};
