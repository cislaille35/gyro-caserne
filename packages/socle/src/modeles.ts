import type { NomIcone } from './icones.ts';
import type { Droit } from './listes.ts';

export type Modele = { id: string; nom: string; nature: 'fonction' | 'mission'; portee: 'centre' | 'equipe' | 'comite'; icone: NomIcone; droits: Droit[] };

// Fixés par l'appli : « Nouveau rôle → à partir de… ». Un rôle créé garde l'identifiant de son modèle.
export const MODELES: Modele[] = [
	{ id: 'referent_materiel', nom: 'Référent matériel', nature: 'mission', portee: 'centre', icone: 'camion', droits: ['TRAITER_ANOMALIE', 'GERER_FICHES'] },
	{ id: 'referent_pharmacie', nom: 'Référent pharmacie', nature: 'mission', portee: 'centre', icone: 'croix', droits: ['GERER_STOCK'] },
	{ id: 'referent_technique', nom: 'Référent technique', nature: 'fonction', portee: 'centre', icone: 'cle', droits: ['GERER_LISTES', 'GERER_COMITES'] },
	{ id: 'membre_comite', nom: 'Membre de comité', nature: 'mission', portee: 'comite', icone: 'groupe', droits: [] },
	{ id: 'rapporteur_comite', nom: 'Rapporteur de comité', nature: 'mission', portee: 'comite', icone: 'livre', droits: ['ATTRIBUER_RESPONSABILITE'] },
	{ id: 'vierge', nom: 'Vierge', nature: 'mission', portee: 'centre', icone: 'outil', droits: [] }
];
