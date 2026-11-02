import type { Ambiance } from '@gyro-caserne/socle';
import type { Tenue } from './tenues.ts';

const parisFormat = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'Europe/Paris',
	hour: 'numeric',
	day: 'numeric',
	month: 'numeric',
	hourCycle: 'h23'
});

// La tenue selon le temps qu'il fait au centre ; beau temps et nuages n'en changent pas.
const PAR_METEO: Partial<Record<Ambiance, Tenue>> = { pluie: 'pluie', orage: 'orage', neige: 'hiver', gel: 'hiver', chaleur: 'ete', vent: 'vent', brouillard: 'brouillard' };

// Priorité : fête du jour, nuit (23 h-6 h), p'tit-déj (6 h-10 h), météo, calendriers (nov.-déc.), saison, normal.
export function tenueDuMoment(date: Date, ambiance?: Ambiance | null): Tenue {
	const parties = Object.fromEntries(parisFormat.formatToParts(date).map((p) => [p.type, Number(p.value)]));
	const { hour: heure, day: jour, month: mois } = parties;

	if (mois === 1 && jour === 1) return 'nouvelan';
	if (mois === 1) return 'galette';
	if (mois === 2 && jour === 2) return 'chandeleur';
	if (mois === 4 && jour === 1) return 'poisson';
	if (mois === 7 && (jour === 13 || jour === 14)) return 'bal14';
	if (mois === 10 && jour === 31) return 'halloween';
	if (mois === 12 && jour === 4) return 'saintebarbe';
	if (mois === 12 && jour >= 24 && jour <= 26) return 'noel';

	if (heure >= 23 || heure < 6) return 'nuit';
	if (heure < 10) return 'ptitdej';
	const meteo = ambiance ? PAR_METEO[ambiance] : undefined;
	if (meteo) return meteo;
	if (mois === 11 || mois === 12) return 'calendriers';
	if (mois >= 6 && mois <= 8) return 'ete';
	if (mois <= 2) return 'hiver';
	return 'normal';
}
