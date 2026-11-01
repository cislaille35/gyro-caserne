import type { Niveau } from '../affichage.ts';
import type { Tenue } from '../gyro/tenues.ts';
import { calme } from './tirage.ts';

// Les vrais moments, fêtés une fois par personne : la clé dit lequel.
export type Moment = { cle: string; texte: string; tenue: Tenue };

export function momentAnniversaire(estLeJour: boolean, aujourdhui: string): Moment | null {
	return estLeJour ? { cle: `anniversaire:${aujourdhui}`, texte: 'Joyeux anniversaire\u00a0!', tenue: 'anniversaire' } : null;
}

// Une seule réservation acceptée, et elle est à venir : une acceptée il y a longtemps ne se fête plus.
export function momentPremiereReservation(aVenir: { etat: string }[], passees: { etat: string }[]): Moment | null {
	const acceptee = (r: { etat: string }) => r.etat === 'acceptee';
	return aVenir.filter(acceptee).length === 1 && !passees.some(acceptee) ? { cle: 'premiere-reservation', texte: 'Votre première réservation est acceptée\u00a0!', tenue: 'victoire' } : null;
}

export function momentPlanningPublie(annee: number | null): Moment | null {
	return annee === null ? null : { cle: `planning-publie:${annee}`, texte: `Planning ${annee} publié. Bravo\u00a0!`, tenue: 'victoire' };
}

// « Réduire les animations » et l'affichage sobre coupent la fête.
export function aCelebrer(moment: Moment | null, vus: string[], o: { niveau: Niveau; reduit: boolean }): boolean {
	return moment !== null && !calme(o.niveau, o.reduit) && !vus.includes(moment.cle);
}

// Mémoire du navigateur : peut manquer (navigation privée, stockage bloqué) ; on ne fait alors simplement rien.
type Stockage = Pick<Storage, 'getItem' | 'setItem'>;
const GARDES = 50;
const cleDe = (qui: string) => `gyro.celebrations.${qui}`;

export function lireVus(stockage: Stockage | undefined, qui: string): string[] {
	try {
		const vus: unknown = JSON.parse(stockage?.getItem(cleDe(qui)) ?? '[]');
		return Array.isArray(vus) ? vus.filter((v) => typeof v === 'string') : [];
	} catch {
		return [];
	}
}

export function noterVu(stockage: Stockage | undefined, qui: string, cle: string): void {
	try {
		stockage?.setItem(cleDe(qui), JSON.stringify([...lireVus(stockage, qui), cle].slice(-GARDES)));
	} catch {
		// Rien : la fête reviendra peut-être une fois de plus.
	}
}
