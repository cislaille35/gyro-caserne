// Icônes des rôles : les tracés sont dans l'appli (icones-roles.ts), mêmes noms.
export const NOMS_ICONES = ['etoile', 'casque', 'camion', 'croix', 'cle', 'ballon', 'livre', 'groupe', 'coeur', 'outil'] as const;
export type NomIcone = (typeof NOMS_ICONES)[number];
