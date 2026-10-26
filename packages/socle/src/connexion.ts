import { and, eq, lte, sql } from 'drizzle-orm';
import type { Base } from './base.ts';
import type { Acteur } from './droits.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { envoiLien, personne, verification } from './schema.ts';

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

// Le super administrateur n'a pas de fiche : pas de prénom.
export async function prenomDe(base: Base, acteur: Acteur): Promise<string | null> {
	if (acteur.type === 'super') return null;
	const [fiche] = await base.select({ prenom: personne.prenom }).from(personne).where(eq(personne.id, acteur.id));
	return fiche?.prenom ?? null;
}

export async function adresseAutorisee(base: Base, adresse: string, superAdmins: string[]): Promise<boolean> {
	return (await acteurDe(base, adresse, superAdmins)) !== null;
}

// Liens de connexion vers cette adresse (Better Auth range l'adresse dans la valeur, en JSON ; les autres lignes sont ignorées).
function liensVers(adresse: string) {
	return sql`json_valid(${verification.value}) and lower(json_extract(${verification.value}, '$.email')) = ${normaliserAdresse(adresse)}`;
}

// Requête à passer dans un batch.
export function effacerLiensVers(base: Base, adresse: string) {
	return base.delete(verification).where(liensVers(adresse));
}

// Réserve l'envoi d'un lien vers cette adresse et renvoie la date réservée ; null si un lien y est parti il y a moins de 60 s.
// Une seule requête : deux demandes simultanées ne peuvent pas réserver toutes les deux.
export async function reserverEnvoi(base: Base, adresse: string): Promise<Date | null> {
	const maintenant = new Date();
	const reserve = await base
		.insert(envoiLien)
		.values({ adresse: normaliserAdresse(adresse), envoyeLe: maintenant })
		.onConflictDoUpdate({ target: envoiLien.adresse, set: { envoyeLe: maintenant }, setWhere: lte(envoiLien.envoyeLe, new Date(maintenant.getTime() - 60_000)) })
		.returning({ adresse: envoiLien.adresse });
	return reserve.length > 0 ? maintenant : null;
}

// L'envoi a échoué : un nouvel essai est permis tout de suite.
// Seulement si la réservation est encore la sienne : une plus récente reste en place.
export async function annulerEnvoi(base: Base, adresse: string, reservee: Date): Promise<void> {
	await base.delete(envoiLien).where(and(eq(envoiLien.adresse, normaliserAdresse(adresse)), eq(envoiLien.envoyeLe, reservee)));
}

export async function effacerLien(base: Base, identifiant: string): Promise<void> {
	await base.delete(verification).where(eq(verification.identifier, identifiant));
}
