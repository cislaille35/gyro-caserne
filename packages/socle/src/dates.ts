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
	return ajouterJours(date, -1);
}

// Appelée des centaines de fois par page (calendrier) : sans analyse de texte par Date.
export function ajouterJours(date: string, jours: number): string {
	const jour = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + jours));
	if (date.length !== 10 || Number.isNaN(jour.getTime())) throw new RangeError(`Date illisible : ${date}`);
	const mois = jour.getUTCMonth() + 1;
	const quantieme = jour.getUTCDate();
	return `${jour.getUTCFullYear()}-${mois < 10 ? '0' : ''}${mois}-${quantieme < 10 ? '0' : ''}${quantieme}`;
}

// Créer un format de date coûte cher au serveur (offre gratuite : 10 ms de calcul par requête) : chacun n'est créé qu'une fois.
const formats = new Map<string, Intl.DateTimeFormat>();
export function formatDeDate(options: Intl.DateTimeFormatOptions, langue = 'fr-FR'): Intl.DateTimeFormat {
	const cle = langue + JSON.stringify(options);
	let format = formats.get(cle);
	if (!format) {
		format = new Intl.DateTimeFormat(langue, options);
		formats.set(cle, format);
	}
	return format;
}

// Date et heure de Paris, « AAAA-MM-JJTHH:MM » (secondes permises) ; rend la date seule.
export function exigerDateHeure(valeur: unknown, libelle: string): string {
	if (typeof valeur !== 'string' || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(valeur)) throw new DonneeInvalide(`${libelle} invalide`);
	const jour = valeur.slice(0, 10);
	exigerDate(jour);
	return jour;
}
