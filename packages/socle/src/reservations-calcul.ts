import type { FormeRessource } from './listes.ts';

// Calculs purs des réservations, partagés par le socle (la règle) et l'écran Réserver (la disponibilité affichée tout de suite).

export type Periode = { debut: string; fin: string };
export type Prise = Periode & { quantite: number; etat: string };

// Seules les demandes en attente et les réservations acceptées tiennent une place.
export const tientUnePlace = (etat: string) => etat === 'attente' || etat === 'acceptee';

// Jours : bornes comprises. Créneau : la fin est libre pour le suivant.
export function chevauche(a: Periode, b: Periode, forme: FormeRessource): boolean {
	return forme === 'creneau' ? a.debut < b.fin && b.debut < a.fin : a.debut <= b.fin && b.debut <= a.fin;
}

export function joursEntre(du: string, au: string): string[] {
	const jours: string[] = [];
	for (let d = new Date(`${du}T00:00:00Z`); d.toISOString().slice(0, 10) <= au; d.setUTCDate(d.getUTCDate() + 1)) jours.push(d.toISOString().slice(0, 10));
	return jours;
}

export function restantParJour(stock: number, prises: Prise[], du: string, au: string): { jour: string; restant: number }[] {
	const comptees = prises.filter((p) => tientUnePlace(p.etat));
	return joursEntre(du, au).map((jour) => ({ jour, restant: stock - comptees.filter((p) => p.debut <= jour && jour <= p.fin).reduce((n, p) => n + p.quantite, 0) }));
}

// « 13 nov. » (les dates sont à l'heure de Paris, lues telles quelles).
export function jourCourt(date: string): string {
	return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

// « 9 h », « 12 h 30 ».
const heureCourte = (quand: string) => {
	const [h, m] = quand.slice(11, 16).split(':');
	return `${Number(h)} h${m === '00' ? '' : ` ${m}`}`;
};

// « 12 nov. », « du 12 au 14 nov. », « 7 nov., 9 h – 12 h », « du 7 nov., 18 h au 8 nov., 9 h ».
export function periodeCourte(forme: FormeRessource, debut: string, fin: string): string {
	if (forme === 'jours') {
		if (debut === fin) return jourCourt(debut);
		return `du ${debut.slice(0, 7) === fin.slice(0, 7) ? Number(debut.slice(8, 10)) : jourCourt(debut)} au ${jourCourt(fin)}`;
	}
	if (debut.slice(0, 10) === fin.slice(0, 10)) return `${jourCourt(debut)}, ${heureCourte(debut)} – ${heureCourte(fin)}`;
	return `du ${jourCourt(debut)}, ${heureCourte(debut)} au ${jourCourt(fin)}, ${heureCourte(fin)}`;
}
