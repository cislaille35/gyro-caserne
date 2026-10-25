import { DonneeInvalide } from './erreurs.ts';

// Dates au format 'AAAA-MM-JJ' : la comparaison de textes suit l'ordre des dates. Début et fin sont inclus.
export function enCours(debut: string, fin: string | null, date: string): boolean {
	return debut <= date && (fin === null || date <= fin);
}

// Refuse tout ce qui n'est pas une vraie date AAAA-MM-JJ.
export function exigerDate(date: string): void {
	const jour = new Date(`${date}T00:00:00Z`);
	const valide = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(jour.getTime()) && jour.toISOString().slice(0, 10) === date;
	if (!valide) throw new DonneeInvalide(`Date invalide : ${date}`);
}
