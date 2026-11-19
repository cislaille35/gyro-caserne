import { formatDeDate } from '@gyro-caserne/socle/dates';
import { dePlage, texteTranche, type Astreinte } from '@gyro-caserne/socle';
import { heure } from '../murs/quand.ts';

// Les dates du planning sont à l'heure de Paris, lues telles quelles.
const jour = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const ecart = (de: string, a: string) => Math.round((jour(a).getTime() - jour(de).getTime()) / 864e5);
const nomDuJour = (iso: string) => formatDeDate({ weekday: 'long', timeZone: 'UTC' }).format(jour(iso));
// « ven. 20 nov. »
const court = (iso: string) => formatDeDate({ weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(jour(iso)).replace(/(^|\s)1(?=\s)/, '$11er');

// L'équipe telle qu'on l'affiche cette semaine-là : en été, son groupe.
export const avecGroupe = <E extends { nom: string }>(e: E, s: { groupe?: string | null }): E => (s.groupe ? { ...e, nom: s.groupe } : e);

// « ce soir 18 h », « demain 6 h », « lundi 6 h », vu d'aujourd'hui.
export function quandRelatif(iso: string, maintenant: string): string {
	const n = ecart(maintenant, iso);
	if (n === 0) return `${iso.slice(11, 13) >= '17' ? 'ce soir' : 'aujourd’hui'} ${heure(iso)}`;
	if (n === 1) return `demain ${heure(iso)}`;
	return `${nomDuJour(iso)} ${heure(iso)}`;
}

// Le début et la fin de la plaque d’astreinte : « ven. 13 nov. 18 h ».
export const bornesAstreinte = (a: { debut: string; fin: string }) => ({ debut: `${court(a.debut)} ${heure(a.debut)}`, fin: `${court(a.fin)} ${heure(a.fin)}` });

export const duAuCourt = (debut: string, fin: string) => `du ${court(debut)} ${heure(debut)} au ${court(fin)} ${heure(fin)}`;

// Ce que dit la carte astreinte, à l'Accueil comme au Planning.
export function phraseAstreinte(a: Astreinte, maintenant: string): { titre: string; quand: string; plage: string | null; jours: number } {
	const m = maintenant.slice(0, 16);
	const jours = Math.max(0, ecart(m, a.debut));
	const quand = duAuCourt(a.debut, a.fin);
	if (!a.mienne) return { titre: `Cette semaine : ${a.equipe.nom} d’astreinte`, quand, plage: null, jours };
	if (!a.enCours) {
		const titre =
			jours === 0 ? `Vous êtes d’astreinte ${a.debut.slice(11, 13) >= '17' ? 'ce soir' : 'aujourd’hui'} à ${heure(a.debut)}` : jours === 1 ? `Votre équipe est d’astreinte demain à ${heure(a.debut)}` : `Votre équipe est d’astreinte dans ${jours} jours`;
		return { titre, quand, plage: null, jours };
	}
	const titre = ecart(m, a.fin) === 0 ? `Vous êtes d’astreinte jusqu’à ${heure(a.fin)}` : `Vous êtes d’astreinte jusqu’à ${nomDuJour(a.fin)} ${heure(a.fin)}`;
	const dedans = a.periodes.find((p) => p.debut <= m && m < p.fin);
	if (dedans) return { titre, quand, plage: `En ce moment, jusqu’à ${quandRelatif(dedans.fin, m)}`, jours };
	const suivante = a.periodes.find((p) => p.debut > m);
	const finPlage = suivante && ecart(suivante.debut, suivante.fin) <= 1 ? heure(suivante.fin) : suivante && quandRelatif(suivante.fin, m);
	return { titre, quand, plage: suivante ? `Prochaine plage : ${quandRelatif(suivante.debut, m)} – ${finPlage}` : null, jours };
}

// Sur la plaque : qui me remplace quelques heures (3 h au plus) dans cette astreinte, tant que ce n'est pas fini.
// « Marc Petit de 20 h à 22 h » aujourd'hui, avec le jour sinon. Lu dans les remplacements du planning, sans lecture de plus.
export function remplacantsCourts(a: { debut: string; fin: string }, remplacements: { debut: string; fin: string; remplacant: string; moi: 'cede' | 'prend' | null }[], maintenant: string): string[] {
	const heures = (r: { debut: string; fin: string }) => (Date.parse(`${r.fin}:00Z`) - Date.parse(`${r.debut}:00Z`)) / 3_600_000;
	return remplacements
		.filter((r) => r.moi === 'cede' && heures(r) <= 3 && r.fin > maintenant && a.debut <= r.debut && r.debut < a.fin)
		.sort((x, y) => x.debut.localeCompare(y.debut))
		.map((r) => `${r.remplacant} ${r.debut.slice(0, 10) === maintenant.slice(0, 10) ? dePlage(r) : texteTranche(r)}`);
}
