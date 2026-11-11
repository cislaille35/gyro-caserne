// La valeur à montrer dans une liste : celle voulue si elle existe, sinon le choix en cours, pour que la liste ne se vide jamais.
export const valeurConnue = (voulue: string, options: { valeur: string }[], actuelle: string) => (options.some((o) => o.valeur === voulue) ? voulue : actuelle);
