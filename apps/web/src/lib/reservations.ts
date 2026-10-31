import { chevauche, jourCourt, restantParJour, type EtatReservation, type Prise, type Ressource } from '@gyro-caserne/socle';
import { heure } from './murs/quand.ts';

// Le calendrier des réservations : jours, semaines et mois, à l'heure de Paris (dates lues telles quelles).

export const ETATS: Record<EtatReservation, { libelle: string; ton: 'ok' | 'info' | 'alerte' | 'danger' | 'neutre' }> = {
	attente: { libelle: 'En attente', ton: 'alerte' },
	acceptee: { libelle: 'Acceptée', ton: 'ok' },
	refusee: { libelle: 'Refusée', ton: 'danger' },
	annulee: { libelle: 'Annulée', ton: 'neutre' }
};

const date = (jour: string) => new Date(`${jour.slice(0, 10)}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const format = (options: Intl.DateTimeFormatOptions, jour: string) => new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(date(jour));

export function decaler(jour: string, jours: number): string {
	const d = date(jour);
	d.setUTCDate(d.getUTCDate() + jours);
	return iso(d);
}

// Le premier jour du mois, `mois` mois plus tard (ou plus tôt).
export function premierDuMois(jour: string, mois = 0): string {
	const d = date(jour);
	return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + mois, 1)));
}

const lundi = (jour: string) => decaler(jour, -((date(jour).getUTCDay() + 6) % 7));

export const grilleDuMois = (jour: string) => Array.from({ length: 42 }, (_, i) => decaler(lundi(premierDuMois(jour)), i));

export const jourLong = (jour: string) => format({ weekday: 'long', day: 'numeric', month: 'short' }, jour);
export const moisDe = (jour: string) => format({ month: 'long', year: 'numeric' }, jour);

// Ce qui est pris ce jour-là : un créneau qui finit à minuit libère le jour.
export function ceJour<T extends { debut: string; fin: string }>(liste: T[], jour: string): T[] {
	return liste.filter((r) => r.debut.slice(0, 10) <= jour && (r.fin.length === 10 ? r.fin >= jour : r.fin > `${jour}T00:00`));
}

// L'horaire d'un créneau vu d'un jour : « 9 h – 12 h », « Dès 18 h », « Jusqu'à 12 h », « Toute la journée ».
export function horaire(r: { debut: string; fin: string }, jour: string): string {
	const avant = r.debut.slice(0, 10) < jour;
	const apres = r.fin.slice(0, 10) > jour && r.fin !== `${decaler(jour, 1)}T00:00`;
	if (avant && apres) return 'Toute la journée';
	if (avant) return `Jusqu’à ${heure(r.fin)}`;
	if (apres) return `Dès ${heure(r.debut)}`;
	return `${heure(r.debut)} – ${heure(r.fin)}`;
}

// Ce que la page « Réserver » dit tout de suite de la période choisie ; rien tant qu'elle est incomplète.
export function disponibilite(r: Pick<Ressource, 'nom' | 'forme' | 'stock' | 'gestionnaire'>, prises: Prise[], v: { debut: string; fin: string; quantite: string }, maintenant = ''): { ton: 'ok' | 'alerte' | 'danger'; texte: string } | null {
	const jour = /^\d{4}-\d{2}-\d{2}$/;
	const moment = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
	if (r.forme === 'creneau') {
		if (!moment.test(v.debut) || !moment.test(v.fin) || v.fin <= v.debut) return null;
		if (v.debut < maintenant.slice(0, 16)) return { ton: 'danger', texte: 'Ce début est déjà passé.' };
		return prises.some((p) => chevauche(p, v, 'creneau'))
			? { ton: 'alerte', texte: `Créneau déjà demandé : votre demande attendra la décision de ${r.gestionnaire.nom}.` }
			: { ton: 'ok', texte: 'Libre : la réservation est acceptée dès l’envoi.' };
	}
	if (!jour.test(v.debut) || !jour.test(v.fin) || v.fin < v.debut || r.stock === null) return null;
	if (v.debut < maintenant.slice(0, 10)) return { ton: 'danger', texte: 'Ce début est déjà passé.' };
	const plusPris = restantParJour(r.stock, prises, v.debut, v.fin).reduce((a, b) => (b.restant < a.restant ? b : a));
	const voulue = Number(v.quantite) || 1;
	if (voulue > plusPris.restant) return { ton: 'danger', texte: plusPris.restant <= 0 ? `Plus rien de libre le ${jourCourt(plusPris.jour)}` : `Pas assez : il en reste ${plusPris.restant} le ${jourCourt(plusPris.jour)}` };
	return { ton: 'ok', texte: plusPris.restant === r.stock ? `Disponible : ${r.stock} sur ${r.stock} sur toute la période.` : `Disponible : il en reste au moins ${plusPris.restant} sur toute la période.` };
}
