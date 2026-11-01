import { ajouterJours } from '../dates.ts';
import { rangDuJour, type Periode, type Reglage } from '../planning/calendrier.ts';

// Calculs purs des remplacements : les tranches qu'on peut céder, et les périodes qui restent.

export const chevauche = (a: Periode, b: Periode) => a.debut < b.fin && b.debut < a.fin;

// Chaque période d'astreinte coupée à l'heure de fin du soir (6 h) : nuits de semaine, gardes de 24 h le week-end et les fériés.
// Sans horaire de semaine (astreinte continue) : des tranches de 24 h, à l'heure de relève.
export function tranchesDe(periodes: Periode[], reglage: Reglage): Periode[] {
	const coupe = reglage.semaine?.fin ?? reglage.debut.heure;
	const tranches: Periode[] = [];
	for (const p of periodes) {
		let debut = p.debut;
		for (let jour = p.debut.slice(0, 10); `${jour}T${coupe}` < p.fin; jour = ajouterJours(jour, 1)) {
			const borne = `${jour}T${coupe}`;
			if (borne <= debut) continue;
			tranches.push({ debut, fin: borne });
			debut = borne;
		}
		tranches.push({ debut, fin: p.fin });
	}
	return tranches;
}

// Les périodes moins celles retirées (bornes à l'heure de Paris).
export function soustraire(periodes: Periode[], retirees: Periode[]): Periode[] {
	let reste = periodes;
	for (const r of retirees) {
		reste = reste.flatMap((p) => {
			if (!chevauche(p, r)) return [p];
			return [...(p.debut < r.debut ? [{ debut: p.debut, fin: r.debut }] : []), ...(r.fin < p.fin ? [{ debut: r.fin, fin: p.fin }] : [])];
		});
	}
	return reste;
}

// Des tranches qui se suivent n'en font qu'une.
export function reunir(periodes: Periode[]): Periode[] {
	const triees = [...periodes].sort((a, b) => a.debut.localeCompare(b.debut));
	const unies: Periode[] = [];
	for (const p of triees) {
		const derniere = unies.at(-1);
		if (derniere && p.debut <= derniere.fin) derniere.fin = p.fin > derniere.fin ? p.fin : derniere.fin;
		else unies.push({ ...p });
	}
	return unies;
}

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const jourEnLettres = (moment: string) => `${JOURS[rangDuJour(moment.slice(0, 10))]} ${Number(moment.slice(8, 10)) === 1 ? '1er' : Number(moment.slice(8, 10))} ${MOIS[Number(moment.slice(5, 7)) - 1]}`;
const heure = (moment: string) => {
	const [h, m] = moment.slice(11, 16).split(':');
	return `${Number(h)} h${m === '00' ? '' : ` ${m}`}`;
};
const heures = (p: Periode) => (Date.parse(`${p.fin}:00Z`) - Date.parse(`${p.debut}:00Z`)) / 3_600_000;

// « nuit du lundi 9 novembre », « 24 h du samedi 7 novembre », « du vendredi 6 novembre, 18 h au lundi 9 novembre, 6 h ».
export function texteTranche(p: Periode): string {
	const duree = heures(p);
	if (duree === 24) return `24 h du ${jourEnLettres(p.debut)}`;
	if (duree <= 14 && p.debut.slice(11, 16) >= '17:00' && p.fin.slice(0, 10) === ajouterJours(p.debut.slice(0, 10), 1)) return `nuit du ${jourEnLettres(p.debut)}`;
	return `du ${jourEnLettres(p.debut)}, ${heure(p.debut)} au ${jourEnLettres(p.fin)}, ${heure(p.fin)}`;
}

// Les périodes d'une demande, réunies quand elles se suivent : « nuit du lundi 9 novembre et nuit du mercredi 11 novembre ».
export function texteDemande(periodes: Periode[]): string {
	const textes = reunir(periodes).map(texteTranche);
	return textes.length <= 1 ? (textes[0] ?? '') : `${textes.slice(0, -1).join(', ')} et ${textes.at(-1)}`;
}
