// Dates au format 'AAAA-MM-JJ' : la comparaison de textes suit l'ordre des dates. Début et fin sont inclus.
export function enCours(debut: string, fin: string | null, date: string): boolean {
	return debut <= date && (fin === null || date <= fin);
}
