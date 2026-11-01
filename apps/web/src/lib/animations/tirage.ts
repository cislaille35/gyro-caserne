// Tirer pour actualiser : le doigt tire la page, freiné ; au-delà du seuil, on relâche et la page se relit.
export const SEUIL = 80;
export const TIRAGE_MAX = 120;

// Un geste surtout de côté (un tableau qui défile) n'est pas un tirage.
export function tirage(dx: number, dy: number): number {
	if (dy <= 0 || Math.abs(dx) > dy) return 0;
	return Math.min(dy * 0.6, TIRAGE_MAX);
}

export const declenche = (t: number) => t >= SEUIL;

export const forceDuJet = (t: number) => Math.min(t / SEUIL, 1);

export function consigne(t: number, actualise: boolean): string {
	if (actualise) return 'Actualisation…';
	return declenche(t) ? 'Relâchez pour actualiser' : 'Tirez pour actualiser';
}
