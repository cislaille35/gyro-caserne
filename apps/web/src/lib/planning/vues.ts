import { texteTranche, type PeriodePlanning, type SemaineCalculee, type Vacances } from '@gyro-caserne/socle';
import { heure } from '../murs/quand.ts';
import { pluriel } from '../pluriel.ts';
import { dansLaSemaine, finDeSemaine, jourLong } from './dates.ts';

// Les vues de l'onglet Planning, sans affichage : ce qui se passe chaque jour, chaque semaine, chaque mois.

export type Mode = 'moi' | 'equipes';
export type Remplacement = { debut: string; fin: string; titulaire: string; remplacant: string; moi: 'cede' | 'prend' | null };
export type Donnees = { annee: number; feries: { date: string; nom: string }[]; vacances: Vacances[]; manoeuvres: { id: number; debut: string; theme: string; convoque: boolean }[]; remplacements: Remplacement[] };
export type Repere = { genre: 'ferie' | 'vacances' | 'manoeuvre' | 'fete' | 'remplacement'; texte: string; date: string };
export const SIGNES: Record<Repere['genre'], string> = { ferie: 'Férié', vacances: 'Vacances', manoeuvre: 'Manœuvre', fete: 'Fête', remplacement: 'Remplacement' };

const lendemain = (date: string) => {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
};
const contient = (s: SemaineCalculee, moment: string) => s.periodes.some((p) => p.debut <= moment && moment < p.fin);

function texteRemplacement(r: Remplacement, avecQuand: boolean): string {
	const quand = avecQuand ? `, ${texteTranche(r)}` : '';
	if (r.moi === 'cede') return `${r.remplacant} me remplace${quand}`;
	if (r.moi === 'prend') return `je remplace ${r.titulaire}${quand}`;
	return `${r.remplacant} remplace ${r.titulaire}${quand}`;
}

// Les repères d'une semaine ; en mode « moi », seulement mes manœuvres et mes remplacements.
// `jour` : textes courts, pour une ligne de jour.
export function reperesDe(s: SemaineCalculee, d: Donnees, mode: Mode, jour = false): Repere[] {
	const fin = finDeSemaine(s.debut);
	const liste: Repere[] = [];
	for (const f of d.feries) if (dansLaSemaine(f.date, s.debut)) liste.push({ genre: 'ferie', texte: jour ? f.nom : `${f.nom}, ${jourLong(f.date)}`, date: f.date });
	if (!jour) for (const v of d.vacances) if (v.debut < fin && v.fin >= s.debut) liste.push({ genre: 'vacances', texte: v.nom, date: v.debut });
	for (const m of d.manoeuvres) {
		if (!dansLaSemaine(m.debut, s.debut) || (mode === 'moi' && !m.convoque)) continue;
		liste.push({ genre: 'manoeuvre', texte: jour ? `« ${m.theme} », ${heure(m.debut)}` : `« ${m.theme} », ${jourLong(m.debut)}, ${heure(m.debut)}`, date: m.debut.slice(0, 10) });
	}
	for (const r of d.remplacements) {
		if (!s.periodes.some((p) => p.debut <= r.debut && r.debut < p.fin)) continue;
		if (mode === 'moi' && r.moi === null) continue;
		liste.push({ genre: 'remplacement', texte: texteRemplacement(r, true), date: r.debut.slice(0, 10) });
	}
	if (contient(s, `${d.annee}-12-25T12:00`)) liste.push({ genre: 'fete', texte: 'Garde de Noël', date: `${d.annee}-12-25` });
	if (contient(s, `${d.annee}-12-31T23:00`)) liste.push({ genre: 'fete', texte: 'Garde du Nouvel An', date: `${d.annee}-12-31` });
	return liste;
}

// Les plages d'astreinte d'un jour : « 18 h – 6 h » (une nuit), « 24 h », « dès 18 h », « jusqu’à 6 h ».
export function plagesDuJour(date: string, periodes: PeriodePlanning[]): string[] {
	const debutJour = `${date}T00:00`;
	const finJour = `${lendemain(date)}T00:00`;
	const plages: string[] = [];
	for (const p of periodes) {
		if (p.fin <= debutJour || p.debut >= finJour) continue;
		// Une nuit : elle finit avant midi le lendemain de son début, et se dit le jour où elle commence.
		const nuit = p.fin <= `${lendemain(p.debut.slice(0, 10))}T12:00`;
		if (p.debut >= debutJour) plages.push(nuit ? `${heure(p.debut)} – ${heure(p.fin)}` : `dès ${heure(p.debut)}`);
		else if (p.fin >= finJour) plages.push('24 h');
		else if (!nuit) plages.push(`jusqu’à ${heure(p.fin)}`);
	}
	return plages;
}

// La semaine jour par jour, du jour de relève à la veille de la suivante.
export function joursDeLaSemaine(s: SemaineCalculee, d: Donnees, mode: Mode): { date: string; plages: string[]; reperes: Repere[] }[] {
	const reperes = reperesDe(s, d, mode, true);
	const jours = [];
	for (let date = s.debut; date < finDeSemaine(s.debut); date = lendemain(date)) {
		jours.push({ date, plages: plagesDuJour(date, s.periodes), reperes: reperes.filter((r) => r.date === date) });
	}
	return jours;
}

// Le mois en bandes : une ligne par semaine d'astreinte qui touche le mois, sept jours de la relève à la veille de la suivante.
export function grilleDuMois<S extends { debut: string }>(annee: number, mois: number, semaines: S[]): { semaine: S; jours: { date: string; dansLeMois: boolean }[] }[] {
	const prefixe = `${annee}-${String(mois).padStart(2, '0')}`;
	return semaines
		.map((semaine) => {
			const jours = [];
			for (let date = semaine.debut; date < finDeSemaine(semaine.debut); date = lendemain(date)) jours.push({ date, dansLeMois: date.startsWith(prefixe) });
			return { semaine, jours };
		})
		.filter((l) => l.jours.some((j) => j.dansLeMois));
}

// « 1 astreinte · 1 manœuvre · 2 fériés » (moi) ; « 4 semaines · … » (toutes les équipes).
export function resumeDuMois(annee: number, mois: number, semaines: (SemaineCalculee & { mienne: boolean })[], d: Donnees, mode: Mode): string {
	const prefixe = `${annee}-${String(mois).padStart(2, '0')}`;
	const manoeuvres = d.manoeuvres.filter((m) => m.debut.startsWith(prefixe) && (mode === 'equipes' || m.convoque)).length;
	const feries = d.feries.filter((f) => f.date.startsWith(prefixe)).length;
	const miennes = semaines.filter((s) => s.mienne).length;
	return [mode === 'moi' ? (miennes ? pluriel(miennes, 'astreinte') : 'Aucune astreinte') : pluriel(semaines.length, 'semaine'), ...(manoeuvres ? [pluriel(manoeuvres, 'manœuvre')] : []), ...(feries ? [pluriel(feries, 'férié')] : [])].join(' · ');
}
