import { asc, eq, sql } from 'drizzle-orm';
import type { Base } from './base.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { exigerGestionEngins, gereLesEngins } from './fiches.ts';
import { ligneJournal } from './journal.ts';
import { nomActeur } from './actions/personnes.ts';
import type { EtatEngin, SituationEngin } from './listes.ts';
import { engin, typeEngin } from './schema.ts';

// Les engins du centre : les nôtres, ceux qu'un autre centre nous prête, et ceux partis (sortis de la liste, leur historique reste).

export type EnginVu = {
	id: number;
	nom: string;
	immatriculation: string | null;
	typeId: number;
	type: string;
	situation: SituationEngin;
	provenance: string | null;
	etat: EtatEngin;
	partiLe: string | null;
};
export type SaisieEngin = { nom: string; immatriculation: string; typeId: number; situation: SituationEngin; provenance: string };

export const LIMITES_ENGIN = { nom: 30, immatriculation: 12, provenance: 60 } as const;

// Voir les engins : VOIR_ENGINS sur le centre, ou les gérer.
export async function voitLesEngins(base: Base, acteur: Acteur, aujourdhui: string): Promise<boolean> {
	return (await aLeDroit(base, acteur, 'VOIR_ENGINS', { type: 'centre' }, aujourdhui)) || (await gereLesEngins(base, acteur, aujourdhui));
}

async function exigerVue(base: Base, acteur: Acteur, aujourdhui: string): Promise<boolean> {
	if (!(await voitLesEngins(base, acteur, aujourdhui))) throw new RefusDroit('VOIR_ENGINS', { type: 'centre' });
	return gereLesEngins(base, acteur, aujourdhui);
}

const lecture = (base: Base) =>
	base
		.select({ id: engin.id, nom: engin.nom, immatriculation: engin.immatriculation, typeId: engin.typeId, type: typeEngin.nom, ordreType: typeEngin.ordre, situation: engin.situation, provenance: engin.provenance, etat: engin.etat, partiLe: engin.partiLe })
		.from(engin)
		.innerJoin(typeEngin, eq(typeEngin.id, engin.typeId));

// Rangés par type (ordre des fiches), puis par nom.
export async function listerEngins(base: Base, acteur: Acteur, aujourdhui: string): Promise<{ engins: EnginVu[]; gere: boolean }> {
	const gere = await exigerVue(base, acteur, aujourdhui);
	const lignes = await lecture(base).orderBy(asc(typeEngin.ordre));
	const engins = lignes.sort((a, b) => a.ordreType - b.ordreType || a.nom.localeCompare(b.nom, 'fr', { numeric: true })).map(({ ordreType: _, ...e }) => e);
	return { engins, gere };
}

export async function lireEngin(base: Base, acteur: Acteur, id: number, aujourdhui: string): Promise<{ engin: EnginVu; gere: boolean }> {
	const gere = await exigerVue(base, acteur, aujourdhui);
	const [ligne] = await lecture(base).where(eq(engin.id, id));
	if (!ligne) throw new DonneeInvalide('Engin inconnu');
	const { ordreType: _, ...e } = ligne;
	return { engin: e, gere };
}

const propre = (texte: string) => texte.trim().replace(/\s+/g, ' ');

// Sans `id` : un nouvel engin. Passer « parti » le sort de la liste à la date du jour ; le remettre au centre l'y fait revenir.
export async function enregistrerEngin(base: Base, acteur: Acteur, saisie: SaisieEngin & { id?: number }, maintenant: string): Promise<number> {
	const aujourdhui = await exigerGestionEngins(base, acteur, maintenant);
	const nom = propre(saisie.nom);
	const immatriculation = propre(saisie.immatriculation).toUpperCase() || null;
	const provenance = saisie.situation === 'prete' ? propre(saisie.provenance) : null;
	if (!nom) throw new DonneeInvalide('Nom vide');
	if (nom.length > LIMITES_ENGIN.nom) throw new DonneeInvalide('Nom trop long');
	if (immatriculation && immatriculation.length > LIMITES_ENGIN.immatriculation) throw new DonneeInvalide('Immatriculation trop longue');
	if (!['centre', 'prete', 'parti'].includes(saisie.situation)) throw new DonneeInvalide('Situation inconnue');
	if (saisie.situation === 'prete' && !provenance) throw new DonneeInvalide('Provenance vide');
	if (provenance && provenance.length > LIMITES_ENGIN.provenance) throw new DonneeInvalide('Provenance trop longue');

	const [types, existants] = await base.batch([base.select({ id: typeEngin.id }).from(typeEngin), base.select({ id: engin.id, nom: engin.nom, situation: engin.situation, partiLe: engin.partiLe }).from(engin)]);
	if (!types.some((t) => t.id === saisie.typeId)) throw new DonneeInvalide('Type inconnu');
	const avant = saisie.id === undefined ? null : existants.find((e) => e.id === saisie.id);
	if (avant === undefined) throw new DonneeInvalide('Engin inconnu');
	// Deux engins présents ne portent pas le même nom ; un parti libère le sien.
	const pris = existants.some((e) => e.id !== saisie.id && e.situation !== 'parti' && e.nom.toLocaleLowerCase('fr') === nom.toLocaleLowerCase('fr'));
	if (pris && saisie.situation !== 'parti') throw new DonneeInvalide('Nom déjà utilisé');
	const partiLe = saisie.situation !== 'parti' ? null : avant?.situation === 'parti' ? avant.partiLe : aujourdhui;
	const valeurs = { nom, immatriculation, typeId: saisie.typeId, situation: saisie.situation, provenance, partiLe };

	if (avant === null) {
		// L'engin et son journal d'un bloc.
		const [[cree]] = await base.batch([
			base.insert(engin).values({ ...valeurs, creeLe: maintenant }).returning({ id: engin.id }),
			ligneJournal(base, { acteur: nomActeur(acteur), action: 'ajouter_engin', cibleType: 'engin', cibleId: sql`last_insert_rowid()`, details: valeurs }, maintenant)
		]);
		return cree!.id;
	}
	await base.batch([
		base.update(engin).set(valeurs).where(eq(engin.id, avant.id)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'modifier_engin', cibleType: 'engin', cibleId: avant.id, details: valeurs }, maintenant)
	]);
	return avant.id;
}

// Données fictives (préprod et développement local) : quelques engins, dont un prêté. Relançable, sans doublon.
export async function chargerEnginsFictifs(base: Base, maintenant: string): Promise<void> {
	const [types, existants] = await base.batch([base.select({ id: typeEngin.id, nom: typeEngin.nom }).from(typeEngin), base.select({ nom: engin.nom }).from(engin)]);
	const type = (nom: string) => types.find((t) => t.nom === nom)?.id;
	const fictifs = [
		{ nom: 'VSAV 1', type: 'VSAV', immatriculation: 'AA-101-SP', situation: 'centre' as const, provenance: null },
		{ nom: 'FPT', type: 'FPT', immatriculation: 'AA-102-SP', situation: 'centre' as const, provenance: null },
		{ nom: 'VTU', type: 'VTU', immatriculation: 'AA-103-SP', situation: 'centre' as const, provenance: null },
		{ nom: 'VSAV 23', type: 'VSAV', immatriculation: 'AA-123-SP', situation: 'prete' as const, provenance: 'CIS Exemple-Nord' }
	].filter((f) => type(f.type) !== undefined && !existants.some((e) => e.nom === f.nom));
	if (fictifs.length === 0) return;
	await base.insert(engin).values(fictifs.map(({ type: t, ...f }) => ({ ...f, typeId: type(t)!, creeLe: maintenant })));
}
