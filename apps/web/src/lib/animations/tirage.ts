import type { Niveau } from '../affichage.ts';

// Tirer pour actualiser : le doigt tire la page, freiné ; au-delà du seuil, on relâche et la page se relit.
export const SEUIL = 80;
export const TIRAGE_MAX = 120;

// Un geste surtout de côté (un tableau qui défile) n'est pas un tirage.
export function tirage(dx: number, dy: number): number {
	if (dy <= 0 || Math.abs(dx) > dy) return 0;
	return Math.min(dy * 0.6, TIRAGE_MAX);
}

// « Réduire les animations » ou affichage sobre : ni lance ni fête.
export const calme = (niveau: Niveau, reduit: boolean) => reduit || niveau === 'sobre';

// Un geste commencé plus bas dans la page, à plusieurs doigts, dans un champ ou une fenêtre n'est pas un tirage.
export function peutTirer(g: { defile: number; actualise: boolean; doigts: number; dansUnChamp: boolean }): boolean {
	return g.defile <= 0 && !g.actualise && g.doigts === 1 && !g.dansUnChamp;
}

export const declenche = (t: number) => t >= SEUIL;

export const forceDuJet = (t: number) => Math.min(t / SEUIL, 1);

export function consigne(t: number, actualise: boolean): string {
	if (actualise) return 'Actualisation…';
	return declenche(t) ? 'Relâchez pour actualiser' : 'Tirez pour actualiser';
}
