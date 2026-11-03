import type { Centre, JourSemaine } from '@gyro-caserne/centre';
import { ajouterJours } from '../dates.ts';

// Calculs du planning, sans base : fériés, semaines, équipes, heures d'astreinte, fêtes.
// Moments à l'heure de Paris, « AAAA-MM-JJTHH:MM » : la comparaison de textes suit l'ordre du temps.

export type Reglage = Centre['astreinte'];
export type Periode = { debut: string; fin: string };
export type SemaineCalculee = { debut: string; numero: number; equipeId: number; changee: boolean; periodes: Periode[] };
export type Fete = 'noel' | 'nouvel_an';

const JOURS: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// 0 pour lundi, 6 pour dimanche.
export const rangDuJour = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

function paques(annee: number): string {
	const a = annee % 19;
	const b = Math.floor(annee / 100);
	const c = annee % 100;
	const h = (19 * a + b - Math.floor(b / 4) - Math.floor((8 * b + 13) / 25) + 15) % 30;
	const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const mois = Math.floor((h + l - 7 * m + 114) / 31);
	const jour = ((h + l - 7 * m + 114) % 31) + 1;
	return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

// Les onze jours fériés nationaux, dans l'ordre de l'année.
export function feries(annee: number): { date: string; nom: string }[] {
	const p = paques(annee);
	const fixe = (mmjj: string, nom: string) => ({ date: `${annee}-${mmjj}`, nom });
	return [
		fixe('01-01', 'Jour de l’an'),
		{ date: ajouterJours(p, 1), nom: 'Lundi de Pâques' },
		fixe('05-01', 'Fête du Travail'),
		fixe('05-08', 'Victoire 1945'),
		{ date: ajouterJours(p, 39), nom: 'Ascension' },
		{ date: ajouterJours(p, 50), nom: 'Lundi de Pentecôte' },
		fixe('07-14', 'Fête nationale'),
		fixe('08-15', 'Assomption'),
		fixe('11-01', 'Toussaint'),
		fixe('11-11', 'Armistice 1918'),
		fixe('12-25', 'Noël')
	].sort((a, b) => a.date.localeCompare(b.date));
}

// Numéro de semaine ISO (celle du jeudi de la même semaine).
export function numeroSemaine(date: string): number {
	const jeudi = ajouterJours(date, 3 - rangDuJour(date));
	const premier = new Date(`${jeudi.slice(0, 4)}-01-01T00:00:00Z`).getTime();
	return Math.floor((new Date(`${jeudi}T00:00:00Z`).getTime() - premier) / 864e5 / 7) + 1;
}

// Les jours de relève de l'année : une semaine appartient à l'année où elle commence.
export function semainesDe(annee: number, reglage: Reglage): { debut: string; numero: number }[] {
	const premier = `${annee}-01-01`;
	let jour = ajouterJours(premier, (JOURS.indexOf(reglage.debut.jour) - rangDuJour(premier) + 7) % 7);
	const semaines = [];
	while (jour.startsWith(String(annee))) {
		semaines.push({ debut: jour, numero: numeroSemaine(jour) });
		jour = ajouterJours(jour, 7);
	}
	return semaines;
}

// Le jour où finit la semaine commencée `debut`.
const jourDeFin = (debut: string, reglage: Reglage) => ajouterJours(debut, (JOURS.indexOf(reglage.fin.jour) - JOURS.indexOf(reglage.debut.jour) + 7) % 7 || 7);

// Les heures d'astreinte d'une semaine. En semaine, seulement les heures réglées (souvent la nuit) ; le samedi, le dimanche
// et les fériés, toute la journée et la nuit qui suit. Un jour de relève férié ou de week-end, l'équipe sortante reste jusqu'à la relève.
export function periodesDeLaSemaine(debut: string, reglage: Reglage, feriesDates: Set<string>): Periode[] {
	const fin = jourDeFin(debut, reglage);
	const continu = (jour: string) => rangDuJour(jour) >= 5 || feriesDates.has(jour);
	const borneDebut = `${debut}T${reglage.debut.heure}`;
	const borneFin = `${fin}T${reglage.semaine && continu(fin) ? reglage.debut.heure : reglage.fin.heure}`;
	const semaine = reglage.semaine;
	if (!semaine) return [{ debut: borneDebut, fin: borneFin }];

	const morceaux: Periode[] = [];
	const nuit = semaine.debut > semaine.fin;
	for (let jour = debut; jour <= fin; jour = ajouterJours(jour, 1)) {
		const lendemain = ajouterJours(jour, 1);
		if (continu(jour)) morceaux.push({ debut: `${jour}T00:00`, fin: `${lendemain}T${nuit ? semaine.fin : '00:00'}` });
		else morceaux.push({ debut: `${jour}T${semaine.debut}`, fin: nuit ? `${lendemain}T${semaine.fin}` : `${jour}T${semaine.fin}` });
	}
	const periodes: Periode[] = [];
	for (const m of morceaux) {
		const p = { debut: m.debut < borneDebut ? borneDebut : m.debut, fin: m.fin > borneFin ? borneFin : m.fin };
		if (p.debut >= p.fin) continue;
		const precedente = periodes.at(-1);
		if (precedente && p.debut <= precedente.fin) precedente.fin = p.fin > precedente.fin ? p.fin : precedente.fin;
		else periodes.push(p);
	}
	return periodes;
}

// Roulement : la semaine `i` revient à ordre[i % n], sauf si le chef l'a changée.
export function calculerAnnee(annee: number, reglage: Reglage, ordre: number[], changees: Map<string, number>): SemaineCalculee[] {
	const f = new Set(feries(annee).map((x) => x.date));
	// La dernière semaine peut finir en janvier suivant.
	for (const x of feries(annee + 1)) f.add(x.date);
	return semainesDe(annee, reglage).map((s, i) => {
		const prevue = ordre.length ? ordre[i % ordre.length]! : 0;
		const choisie = changees.get(s.debut);
		const equipeId = choisie ?? prevue;
		return { ...s, equipeId, changee: choisie !== undefined && choisie !== prevue, periodes: periodesDeLaSemaine(s.debut, reglage, f) };
	});
}

// L'équipe d'astreinte à ce moment-là, ou null (en journée, en semaine).
export function equipeA(moment: string, semaines: SemaineCalculee[]): number | null {
	return semaines.find((s) => s.periodes.some((p) => p.debut <= moment && moment < p.fin))?.equipeId ?? null;
}

// La garde de Noël : le 25 décembre à midi ; celle du Nouvel An : le 31 décembre à 23 h.
export const momentsDesFetes = (annee: number) => ({ noel: `${annee}-12-25T12:00`, nouvelAn: `${annee}-12-31T23:00` });

// L'équipe d'astreinte à chacune de ces gardes.
export function fetes(annee: number, semaines: SemaineCalculee[]): { noel: number | null; nouvelAn: number | null } {
	const m = momentsDesFetes(annee);
	return { noel: equipeA(m.noel, semaines), nouvelAn: equipeA(m.nouvelAn, semaines) };
}

// La file d'attente d'une fête : le rang de chaque équipe, 0 pour celles qui l'ont tenue il y a le plus longtemps, ou jamais (avant `annee`).
export function rangsDuTour(historique: { annee: number; fete: Fete; equipeId: number }[], fete: Fete, equipes: number[], annee: number): Map<number, number> {
	const derniere = (id: number) => Math.max(-Infinity, ...historique.filter((h) => h.fete === fete && h.equipeId === id && h.annee < annee).map((h) => h.annee));
	const dates = [...new Set(equipes.map(derniere))].sort((a, b) => a - b);
	return new Map(equipes.map((id) => [id, dates.indexOf(derniere(id))]));
}

// Les équipes dont c'est le tour : les premières de la file.
export function tourDesFetes(historique: { annee: number; fete: Fete; equipeId: number }[], equipes: number[], annee: number): { noel: number[]; nouvelAn: number[] } {
	const attendues = (fete: Fete) => {
		const rangs = rangsDuTour(historique, fete, equipes, annee);
		return equipes.filter((id) => rangs.get(id) === 0);
	};
	return { noel: attendues('noel'), nouvelAn: attendues('nouvel_an') };
}
