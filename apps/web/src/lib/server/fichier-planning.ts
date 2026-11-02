import { error, json } from '@sveltejs/kit';
import { aLeDroit, type Acteur, type FichierPlanningLu } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { connecte } from '#lib/server/planning.ts';

const LIGNES_MAX = 1000;
const textes = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 200 && v.every((t) => typeof t === 'string' && t.length <= 500);

// Le fichier lu vient du navigateur : sa forme est vérifiée avant le calcul.
export function estFichierPlanningLu(v: unknown): v is FichierPlanningLu {
	if (typeof v !== 'object' || v === null) return false;
	const feuilles = (v as Record<string, unknown>).feuilles;
	if (typeof feuilles !== 'object' || feuilles === null) return false;
	const entetes = (v as Record<string, unknown>).entetes;
	if (entetes !== undefined && (typeof entetes !== 'object' || entetes === null || !Object.values(entetes).every(textes))) return false;
	return Object.values(feuilles).every(
		(lignes) => Array.isArray(lignes) && lignes.length <= LIGNES_MAX && lignes.every((l) => typeof l === 'object' && l !== null && Number.isSafeInteger(l.numero) && textes(l.cellules))
	);
}

// L'année visée (?annee= ou dans le corps), bornée comme ailleurs.
export function anneeValide(brut: unknown): number {
	const n = Number(brut);
	const courante = Number(aujourdhuiParis().slice(0, 4));
	if (!Number.isInteger(n) || n < courante - 5 || n > courante + 5) error(400, 'Année invalide');
	return n;
}

// Réservé à qui gère le planning : un refus net, avant toute lecture.
export async function exigerPlanning(locals: App.Locals): Promise<Acteur> {
	const { acteur, base } = connecte(locals);
	if (!(await aLeDroit(base, acteur, 'GERER_PLANNING', { type: 'centre' }, aujourdhuiParis()))) error(403, 'Le fichier du planning est réservé à qui gère le planning du centre.');
	return acteur;
}

export { json };
