import { tenuesValides } from './casquettes.ts';
import { DonneeInvalide } from './erreurs.ts';

// Outils partagés par les murs et la messagerie.

// `feminin` : accord du message (« Question trop longue »).
export function texte(valeur: unknown, libelle: string, max: number, feminin = false): string {
	const propre = typeof valeur === 'string' ? valeur.trim() : '';
	if (!propre) throw new DonneeInvalide(`${libelle} vide`);
	if (propre.length > max) throw new DonneeInvalide(`${libelle} trop long${feminin ? 'ue' : ''}`);
	return propre;
}

const ROLES = [
	['chef_centre', 'Chef de centre'],
	['chef_centre_adjoint', 'Adjoint'],
	['chef_equipe', 'Chef d’équipe']
] as const;

// Premier rôle tenu (Chef de centre, Adjoint, Chef d’équipe), parmi les rôles tenus du jour (requeteTenues).
export function roleDe(tenues: { personneId: number; type: string; portee: string; systeme: string | null }[], personneId: number): string | null {
	const siennes = tenuesValides(tenues.filter((t) => t.personneId === personneId));
	return ROLES.find(([systeme]) => siennes.some((t) => t.systeme === systeme))?.[1] ?? null;
}
