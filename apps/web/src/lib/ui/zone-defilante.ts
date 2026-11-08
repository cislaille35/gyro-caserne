type Bornes = { haut: number; bas: number };

// De combien faire défiler une zone pour que sa ligne se voie entièrement ; rien si elle se voit déjà.
export function decalagePourVoir(zone: Bornes, ligne: Bornes): number {
	if (ligne.bas > zone.bas) return ligne.bas - zone.bas;
	if (ligne.haut < zone.haut) return ligne.haut - zone.haut;
	return 0;
}

// Montre la ligne de la page affichée dans une liste qui défile seule, sans bouger la page.
export function montrerCourante(zone: HTMLElement | undefined) {
	const ligne = zone?.querySelector('[aria-current="page"], [aria-current="true"]');
	if (!zone || !ligne || zone.scrollHeight <= zone.clientHeight) return;
	const z = zone.getBoundingClientRect();
	const l = ligne.getBoundingClientRect();
	zone.scrollTop += decalagePourVoir({ haut: z.top, bas: z.bottom }, { haut: l.top, bas: l.bottom });
}
