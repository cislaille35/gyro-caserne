import { inArray, isNull, and } from 'drizzle-orm';
import type { Base } from './base.ts';
import { exigerDateHeure } from './dates.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { ligneJournal } from './journal.ts';
import { nomActeur } from './actions/personnes.ts';
import { aptitude, reglageArmement } from './schema.ts';

// Les règles d'armement du centre : par engin, les postes de l'équipage ; et les aptitudes du centre reliées aux niveaux.
// Un agent plus qualifié tient un poste en dessous de son niveau. Une personne tient un seul poste.

export const POSTES = ['ca2', 'ca1', 'cod1', 'ce', 'agent'] as const;
export type Poste = (typeof POSTES)[number];
export const NIVEAUX = ['ca2', 'ca1', 'ce', 'cod2', 'cod1'] as const;
export type Niveau = (typeof NIVEAUX)[number];

export const LIBELLES_POSTE: Record<Poste, string> = { ca2: 'CA tout engins', ca1: 'CA 1 agrès', cod1: 'conducteur', ce: 'CE', agent: 'agent' };
export const LIBELLES_NIVEAU: Record<Niveau, string> = { ca2: 'Chef d’agrès tout engins', ca1: 'Chef d’agrès 1 agrès', ce: 'Chef d’équipe (CE)', cod2: 'Conducteur COD2', cod1: 'Conducteur COD1' };

// Ce que couvre chaque niveau. Tout agent tient le poste « agent ».
const COUVRE: Record<Niveau, Poste[]> = { ca2: ['ca2', 'ca1', 'ce'], ca1: ['ca1', 'ce'], ce: ['ce'], cod2: ['cod1'], cod1: ['cod1'] };

export type Postes = Record<Poste, number>;
export type Engin = { nom: string; postes: Postes };
export type ReglageArmement = { engins: Engin[]; niveaux: Record<Niveau, number | null> };

const ENGINS_PAR_DEFAUT: Engin[] = [
	// Le CE conduit : pas de poste de conducteur.
	{ nom: 'VSAV', postes: { ca2: 0, ca1: 1, ce: 1, cod1: 0, agent: 1 } },
	{ nom: 'VTU', postes: { ca2: 0, ca1: 1, ce: 1, cod1: 0, agent: 1 } },
	{ nom: 'FPT', postes: { ca2: 1, ca1: 0, ce: 2, cod1: 1, agent: 2 } }
];
// Seul le FPT est calculé : s'il est armé, les autres le sont.
export const ENGIN_CALCULE = 'FPT';
const POSTES_MAX = 8;

// Les postes qu'un agent peut tenir, d'après ses aptitudes valables (identifiants).
export function postesDe(niveaux: ReglageArmement['niveaux'], aptitudes: Set<number>): Set<Poste> {
	const postes = new Set<Poste>(['agent']);
	for (const n of NIVEAUX) {
		const id = niveaux[n];
		if (id !== null && aptitudes.has(id)) for (const p of COUVRE[n]) postes.add(p);
	}
	return postes;
}

// Les places de l'engin, des plus exigeantes aux moins exigeantes.
const places = (postes: Postes) => POSTES.flatMap((p) => Array.from({ length: postes[p] }, () => p));

// La meilleure répartition (chaînes de réaffectation) : pour chaque place, l'indice du présent qui la tient, ou null.
function repartir(postes: Postes, presents: { postes: Set<Poste> }[]) {
	const liste = places(postes);
	const tenue: (number | null)[] = liste.map(() => null);
	const placer = (i: number, vues: Set<number>): boolean => {
		// Une place libre d'abord : on ne déplace personne sans besoin.
		const libre = liste.findIndex((p, j) => tenue[j] === null && !vues.has(j) && presents[i]!.postes.has(p));
		if (libre >= 0) {
			tenue[libre] = i;
			return true;
		}
		for (let j = 0; j < liste.length; j++) {
			if (vues.has(j) || !presents[i]!.postes.has(liste[j]!)) continue;
			vues.add(j);
			if (tenue[j] === null || placer(tenue[j]!, vues)) {
				tenue[j] = i;
				return true;
			}
		}
		return false;
	};
	presents.forEach((_, i) => placer(i, new Set()));
	return { liste, tenue };
}

// Armé si chaque place a sa personne, chacune une seule place.
// `manque` : les places restées vides dans la meilleure répartition, des plus exigeantes aux moins exigeantes.
export function armement(postes: Postes, presents: { id: number; postes: Set<Poste> }[]): { arme: boolean; manque: Poste[] } {
	const { liste, tenue } = repartir(postes, presents);
	const manque = liste.filter((_, j) => tenue[j] === null);
	return { arme: manque.length === 0, manque };
}

// Le poste de chacun dans cette répartition ; un présent « en plus » n'en a pas.
export function postesTenus(postes: Postes, presents: { id: number; postes: Set<Poste> }[]): Map<number, Poste> {
	const { liste, tenue } = repartir(postes, presents);
	return new Map(tenue.flatMap((i, j) => (i === null ? [] : [[presents[i]!.id, liste[j]!] as const])));
}

export async function lireArmement(base: Base): Promise<ReglageArmement> {
	const [[ligne], aptitudes] = await base.batch([base.select().from(reglageArmement), base.select({ id: aptitude.id, nom: aptitude.nom }).from(aptitude).where(isNull(aptitude.retireeLe))]);
	if (ligne) return JSON.parse(ligne.valeur) as ReglageArmement;
	const parNom = (nom: string) => aptitudes.find((a) => a.nom.toUpperCase() === nom)?.id ?? null;
	return { engins: ENGINS_PAR_DEFAUT, niveaux: { ca2: parNom('CA2'), ca1: parNom('CA1'), ce: parNom('CE'), cod2: parNom('COD2'), cod1: parNom('COD1') } };
}

export async function enregistrerArmement(base: Base, acteur: Acteur, r: ReglageArmement, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await aLeDroit(base, acteur, 'GERER_LISTES', { type: 'centre' }, aujourdhui))) throw new RefusDroit('GERER_LISTES', { type: 'centre' });
	const engins = ENGINS_PAR_DEFAUT.map((defaut) => {
		const e = r.engins.find((x) => x.nom === defaut.nom) ?? defaut;
		const postes = Object.fromEntries(POSTES.map((p) => [p, e.postes[p]])) as Postes;
		if (!POSTES.every((p) => Number.isInteger(postes[p]) && postes[p] >= 0) || places(postes).length > POSTES_MAX || places(postes).length === 0) throw new DonneeInvalide(`${defaut.nom} : de 1 à ${POSTES_MAX} postes`);
		return { nom: defaut.nom, postes };
	});
	const niveaux = Object.fromEntries(NIVEAUX.map((n) => [n, r.niveaux[n] ?? null])) as ReglageArmement['niveaux'];
	const ids = Object.values(niveaux).filter((x): x is number => x !== null);
	if (!ids.every((x) => Number.isInteger(x))) throw new DonneeInvalide('Aptitude inconnue');
	const connues = ids.length ? await base.select({ id: aptitude.id }).from(aptitude).where(and(inArray(aptitude.id, ids), isNull(aptitude.retireeLe))) : [];
	if (connues.length !== new Set(ids).size) throw new DonneeInvalide('Aptitude inconnue');
	const valeur = JSON.stringify({ engins, niveaux });
	await base.batch([
		base.insert(reglageArmement).values({ id: 1, valeur }).onConflictDoUpdate({ target: reglageArmement.id, set: { valeur } }),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'regler_armement', cibleType: 'centre', cibleId: null, details: { engins, niveaux } }, maintenant)
	]);
}
