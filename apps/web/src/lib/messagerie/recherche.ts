// Pour chercher sans tenir compte des accents ni de la casse.
export const plat = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

// « Groupe avec l’Amicale », « Groupe avec Sport et santé ».
export const avecLeComite = (nom: string) => (/^[aeiouyh]/i.test(plat(nom)) ? `l’${nom}` : nom);
