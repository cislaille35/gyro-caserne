import { ajouterJours, formatDeDate } from '@gyro-caserne/socle/dates';
import { heure } from '../murs/quand.ts';

// Les dates du planning sont à l'heure de Paris, lues telles quelles.
const jour = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
// Le premier du mois s'écrit « 1er ».
const format = (options: Intl.DateTimeFormatOptions, iso: string) =>
	formatDeDate({ ...options, timeZone: 'UTC' }).format(jour(iso)).replace(/(^|\s)1(?=\s)/, '$11er');

export const moisDeLAnnee = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// « vendredi 6 novembre, 18 h »
export const momentLong = (iso: string) => `${format({ weekday: 'long', day: 'numeric', month: 'long' }, iso)}, ${heure(iso)}`;

// « vendredi 6 novembre »
export const jourLong = (iso: string) => format({ weekday: 'long', day: 'numeric', month: 'long' }, iso);

// « 6 – 13 nov. », « 27 nov. – 4 déc. »
export function duAu(debut: string, fin: string): string {
	const court = (iso: string) => format({ day: 'numeric', month: 'short' }, iso);
	const premier = (iso: string) => (iso.slice(8, 10) === '01' ? '1er' : String(Number(iso.slice(8, 10))));
	return debut.slice(5, 7) === fin.slice(5, 7) ? `${premier(debut)} – ${court(fin)}` : `${court(debut)} – ${court(fin)}`;
}

export const finDeSemaine = (debut: string) => {
	return ajouterJours(debut.slice(0, 10), 7);
};

// La date tombe-t-elle dans la semaine qui commence `debut` (jusqu'à la relève suivante, exclue) ?
export const dansLaSemaine = (date: string, debut: string) => debut <= date.slice(0, 10) && date.slice(0, 10) < finDeSemaine(debut);

// Les douze mois, chacun avec les semaines dont la relève y tombe.
export function semainesParMois<S extends { debut: string }>(annee: number, semaines: S[]): { numero: number; nom: string; semaines: S[] }[] {
	return moisDeLAnnee.map((nom, i) => {
		const prefixe = `${annee}-${String(i + 1).padStart(2, '0')}`;
		return { numero: i + 1, nom, semaines: semaines.filter((s) => s.debut.startsWith(prefixe)) };
	});
}
