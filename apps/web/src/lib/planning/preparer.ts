import type { EquipePlanning, Fete, SemaineCalculee } from '@gyro-caserne/socle';
import { pluriel } from '../pluriel.ts';

// Préparer l'année : cinq étapes, chacune enregistrée seule.
export const ETAPES = [
	{ id: 'roulement', libelle: 'Roulement' },
	{ id: 'fetes', libelle: 'Fêtes' },
	{ id: 'manoeuvres', libelle: 'Manœuvres' },
	{ id: 'reperes', libelle: 'Repères' },
	{ id: 'publier', libelle: 'Vérifier et publier' }
] as const;
export type Etape = (typeof ETAPES)[number]['id'];

export const etapeDe = (url: URL): Etape => ETAPES.find((e) => e.id === url.searchParams.get('etape'))?.id ?? 'roulement';

// L'équipe du rang `i` monte (-1) ou descend (+1) dans le roulement.
export function deplacer(ordre: number[], i: number, sens: -1 | 1): number[] {
	const j = i + sens;
	if (i < 0 || i >= ordre.length || j < 0 || j >= ordre.length) return [...ordre];
	const nouvel = [...ordre];
	[nouvel[i], nouvel[j]] = [nouvel[j]!, nouvel[i]!];
	return nouvel;
}

const MOMENTS: Record<Fete, string> = { noel: '12-25T12:00', nouvel_an: '12-31T23:00' };
const semaineDe = (semaines: SemaineCalculee[], moment: string) => semaines.findIndex((s) => s.periodes.some((p) => p.debut <= moment && moment < p.fin));

// Hors de son tour : la semaine d'une équipe attendue la plus proche de celle de la fête (hors semaine de l'autre fête), à échanger.
export function echangePropose(semaines: SemaineCalculee[], fete: Fete, attendues: number[], annee: number): { fete: SemaineCalculee; autre: SemaineCalculee } | null {
	const i = semaineDe(semaines, `${annee}-${MOMENTS[fete]}`);
	if (i < 0 || attendues.length === 0 || attendues.includes(semaines[i]!.equipeId)) return null;
	const autreFete = semaineDe(semaines, `${annee}-${MOMENTS[fete === 'noel' ? 'nouvel_an' : 'noel']}`);
	let meilleure = -1;
	semaines.forEach((s, j) => {
		if (j === i || j === autreFete || !attendues.includes(s.equipeId)) return;
		if (meilleure < 0 || Math.abs(j - i) < Math.abs(meilleure - i)) meilleure = j;
	});
	return meilleure < 0 ? null : { fete: semaines[i]!, autre: semaines[meilleure]! };
}

// Le récapitulatif avant de publier.
export function recapitulatif(p: { semaines: SemaineCalculee[]; manoeuvres: { annulee: boolean }[]; vacances: unknown[]; fetes: { noel: number | null; nouvelAn: number | null }; equipes: EquipePlanning[] }): string[] {
	const nom = (id: number | null) => (id === null ? 'personne' : (p.equipes.find((e) => e.id === id)?.nom ?? 'équipe archivée'));
	const changees = p.semaines.filter((s) => s.changee).length;
	const manoeuvres = p.manoeuvres.filter((m) => !m.annulee).length;
	return [
		`${pluriel(p.semaines.length, 'semaine')}, ${changees ? pluriel(changees, 'changée') : 'aucune changée'}`,
		manoeuvres ? pluriel(manoeuvres, 'manœuvre') : 'Aucune manœuvre',
		`Noël : ${nom(p.fetes.noel)} · Nouvel An : ${nom(p.fetes.nouvelAn)}`,
		p.vacances.length ? pluriel(p.vacances.length, 'période de vacances', 'périodes de vacances') : 'Aucune vacances scolaires'
	];
}
