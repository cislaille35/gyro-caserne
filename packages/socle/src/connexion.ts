import { and, eq, gt, sql } from 'drizzle-orm';
import type { Base } from './base.ts';
import type { Acteur } from './droits.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { personne, verification } from './schema.ts';

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

// Liens de connexion vers cette adresse (Better Auth range l'adresse dans la valeur, en JSON).
function liensVers(adresse: string) {
	return sql`lower(json_extract(${verification.value}, '$.email')) = ${normaliserAdresse(adresse)}`;
}

// Requête à passer dans un batch.
export function effacerLiensVers(base: Base, adresse: string) {
	return base.delete(verification).where(liensVers(adresse));
}

// Un autre lien de connexion vers cette adresse, créé il y a moins de 60 s et avant celui-ci (identifiant).
export async function lienRecent(base: Base, adresse: string, identifiant: string): Promise<boolean> {
	const [autre] = await base
		.select({ id: verification.id })
		.from(verification)
		.where(
			and(
				liensVers(adresse),
				gt(verification.createdAt, new Date(Date.now() - 60_000)),
				sql`${verification}.rowid < (select v.rowid from verification v where v.identifier = ${identifiant})`
			)
		)
		.limit(1);
	return autre !== undefined;
}

export async function effacerLien(base: Base, identifiant: string): Promise<void> {
	await base.delete(verification).where(eq(verification.identifier, identifiant));
}
