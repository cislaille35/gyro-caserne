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

export function veille(date: string): string {
	const jour = new Date(`${date}T00:00:00Z`);
	jour.setUTCDate(jour.getUTCDate() - 1);
	return jour.toISOString().slice(0, 10);
}

export function ajouterJours(date: string, jours: number): string {
	const jour = new Date(`${date}T00:00:00Z`);
	jour.setUTCDate(jour.getUTCDate() + jours);
	return jour.toISOString().slice(0, 10);
}

// Date et heure de Paris, « AAAA-MM-JJTHH:MM » (secondes permises) ; rend la date seule.
export function exigerDateHeure(valeur: unknown, libelle: string): string {
	if (typeof valeur !== 'string' || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(valeur)) throw new DonneeInvalide(`${libelle} invalide`);
	const jour = valeur.slice(0, 10);
	exigerDate(jour);
	return jour;
}
