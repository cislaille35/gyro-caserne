import { eq } from 'drizzle-orm';
import type { Base } from './base.ts';
import type { Acteur } from './droits.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { personne } from './schema.ts';

export function normaliserAdresse(adresse: string): string {
	return adresse.trim().toLowerCase();
}

function estSuperAdmin(email: string, superAdmins: string[]): boolean {
	return email !== '' && superAdmins.map(normaliserAdresse).includes(email);
}

// Seul endroit où un acteur « super » peut naître.
export async function acteurDe(base: Base, adresse: string, superAdmins: string[]): Promise<Acteur | null> {
	const email = normaliserAdresse(adresse);
	if (email === '') return null;
	if (estSuperAdmin(email, superAdmins)) return { type: 'super', email };

	const [fiche] = await base.select({ id: personne.id, statut: personne.statut }).from(personne).where(eq(personne.email, email));
	if (!fiche || !(STATUTS_AVEC_ACCES as readonly string[]).includes(fiche.statut)) return null;
	return { type: 'personne', id: fiche.id };
}

export async function adresseAutorisee(base: Base, adresse: string, superAdmins: string[]): Promise<boolean> {
	return (await acteurDe(base, adresse, superAdmins)) !== null;
}
