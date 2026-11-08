import type { EtapeHabillement, FilHabillement, IssueHabillement } from '@gyro-caserne/socle';

type Ton = 'ok' | 'info' | 'alerte' | 'danger' | 'neutre';

// Où en est une demande, en un mot et un ton (la pastille dit le mot : jamais la couleur seule).
export function etatDemande(d: { etape: EtapeHabillement; issue: IssueHabillement | null }): { texte: string; ton: Ton } {
	switch (d.etape) {
		case 'demandee':
			return { texte: 'Demandée', ton: 'alerte' };
		case 'prise':
			return { texte: 'Prise en compte', ton: 'info' };
		case 'question':
			return { texte: 'Question posée', ton: 'alerte' };
		case 'traitee':
			return { texte: d.issue === 'stock' ? 'En stock' : 'Commandée au SDIS', ton: 'info' };
		case 'livree':
			return { texte: 'Livrée', ton: 'ok' };
		case 'refusee':
			return { texte: 'Refusée', ton: 'danger' };
		default:
			return { texte: 'Annulée', ton: 'neutre' };
	}
}

// Les lignes du fil.
export const TEXTES_FIL: Record<FilHabillement, string> = {
	prise: 'Prise en compte',
	reprise: 'Reprise en main',
	question: 'Question',
	reponse: 'Réponse',
	precision: 'Précision',
	stock: 'Sortie du stock du centre',
	commande: 'Commandée au SDIS',
	refus: 'Refusée',
	livraison: 'Livrée',
	annulation: 'Annulée'
};

// Les étapes du suivi, dans l'ordre. Refusée ou annulée : la demande s'arrête là.
export const ETAPES_SUIVI = ['Demandée', 'Prise en compte', 'Traitée', 'Livrée'] as const;
export function rangSuivi(etape: EtapeHabillement): number {
	return etape === 'demandee' ? 0 : etape === 'prise' || etape === 'question' ? 1 : etape === 'traitee' ? 2 : 3;
}

// Les infos de récupération proposées au référent ; « Autre » laisse écrire un mot.
export const RECUPERATIONS = [
	{ valeur: 'À récupérer au centre', libelle: 'À récupérer au centre' },
	{ valeur: 'Dans votre casier', libelle: 'Dans votre casier' },
	{ valeur: 'autre', libelle: 'Autre' }
];

// Les messages du socle, dits pour l'agent.
const PHRASES: Record<string, string> = {
	'Demande vide': 'Décrivez votre besoin : quelle pièce, quelle taille, pourquoi.',
	'Demande trop longue': 'La demande est trop longue (500 caractères au plus).',
	'Réservé aux agents du centre': 'Les demandes de tenue sont réservées aux agents du centre.',
	'Message vide': 'Écrivez votre message.',
	'Texte trop long': 'Le message est trop long (500 caractères au plus).',
	'Refus sans explication': 'Expliquez le refus en un mot : l’agent le lira.',
	'Récupération à préciser': 'Dites où récupérer la tenue.',
	'Issue inconnue': 'Choisissez une issue.',
	'Geste impossible': 'Ce geste n’est plus possible : la demande a avancé.',
	'Demande changée entre-temps': 'La demande vient de changer : elle est rechargée, refaites votre geste.'
};
export const phraseHabillement = (message: string) => PHRASES[message] ?? 'Ce geste n’a pas pu être enregistré.';
