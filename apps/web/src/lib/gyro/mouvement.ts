// Pas de mouvement décoratif sans fin (RGAA 13.8 / WCAG 2.2.2).
export const DUREE_DECOR = 5000;
export const DUREE_ACCUEIL = 10_000;

export function arreterApres(duree: number, arreter: () => void): () => void {
	const minuteur = setTimeout(arreter, duree);
	return () => clearTimeout(minuteur);
}
