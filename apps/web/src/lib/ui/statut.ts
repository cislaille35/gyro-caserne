export type StatutPersonne = 'operationnel' | 'stagiaire' | 'inapte_temporaire' | 'suspendu' | 'parti';

export const LIBELLES_STATUT: Record<StatutPersonne, string> = {
	operationnel: 'Opérationnel',
	stagiaire: 'Stagiaire',
	inapte_temporaire: 'Inapte temporaire',
	suspendu: 'Suspendu',
	parti: 'Parti'
};
