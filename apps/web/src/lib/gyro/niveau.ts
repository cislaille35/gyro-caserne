import { getContext, setContext } from 'svelte';
import { AFFICHAGE_PAR_DEFAUT, type Affichage, type Niveau } from '../affichage.ts';

const CLE = 'affichage';

// L'objet transmis peut porter des accesseurs : il suit alors les changements de réglage.
export function definirAffichage(a: Affichage): void {
	setContext(CLE, a);
}

export function lireAffichageContexte(): Affichage {
	return getContext<Affichage | undefined>(CLE) ?? AFFICHAGE_PAR_DEFAUT;
}

export function gyroSelonNiveau(n: Niveau): { visible: boolean; anime: boolean } {
	return { visible: n !== 'sobre', anime: n === 'vivant' };
}
