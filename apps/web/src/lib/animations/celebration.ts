import type { Niveau } from '../affichage.ts';
import type { Tenue } from '../gyro/tenues.ts';

// Les vrais moments, fêtés une fois par personne : la clé dit lequel.
export type Moment = { cle: string; texte: string; tenue: Tenue };

export function momentAnniversaire(estLeJour: boolean, aujourdhui: string): Moment | null {
	return estLeJour ? { cle: `anniversaire:${aujourdhui}`, texte: 'Joyeux anniversaire\u00a0!', tenue: 'anniversaire' } : null;
}

export function momentPremiereReservation(reservations: { etat: string }[]): Moment | null {
	const acceptees = reservations.filter((r) => r.etat === 'acceptee').length;
	return acceptees === 1 ? { cle: 'premiere-reservation', texte: 'Votre première réservation est acceptée\u00a0!', tenue: 'victoire' } : null;
}

export function momentPlanningPublie(annee: number | null): Moment | null {
	return annee === null ? null : { cle: `planning-publie:${annee}`, texte: `Planning ${annee} publié. Bravo\u00a0!`, tenue: 'victoire' };
}

// « Réduire les animations » et l'affichage sobre coupent la fête.
export function aCelebrer(moment: Moment | null, vus: string[], o: { niveau: Niveau; reduit: boolean }): boolean {
	return moment !== null && !o.reduit && o.niveau !== 'sobre' && !vus.includes(moment.cle);
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
