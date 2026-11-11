import { and, asc, eq, inArray, isNotNull, isNull, lte, notInArray, sql } from 'drizzle-orm';
import type { Base } from './base.ts';
import { effacerLiensVers, normaliserAdresse } from './connexion.ts';
import { exigerDate, exigerDateHeure } from './dates.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { ligneJournal } from './journal.ts';
import { effacerNotificationsDe } from './notifications.ts';
import { aptitudeAgent, cleAgenda, envoiLien, journal, personne, user, valeurChamp, visiteMur } from './schema.ts';

// Agents partis : 12 mois après le dernier départ, la nuit efface leurs données personnelles (décision 0029).
// La fiche reste, sous « Ancien agent » : publications, messages, demandes, prises de garde, anomalies et habillement la citent.
export const PARTIS_PAR_NUIT = 10;

// Le jour où la nuit l'efface : un an après le départ (la limite de 12 mois tombe le 28 février pour un départ un 29 : le 1er mars).
export function dateDEffacement(partiLe: string): string {
	exigerDate(partiLe);
	const suivant = `${Number(partiLe.slice(0, 4)) + 1}${partiLe.slice(4)}`;
	return suivant.endsWith('-02-29') ? `${suivant.slice(0, 4)}-03-01` : suivant;
}

// Une adresse unique qui ne reçoit rien (domaine réservé `.invalid`) : la colonne reste remplie et unique.
const adresseEffacee = (id: number) => `efface-${id}@efface.invalid`;

type Partie = { id: number; email: string };

// Toutes les adresses qu'a eues chaque agent (l'actuelle, et celles du journal : ajout, changements), sauf celles qu'une autre
// fiche porte aujourd'hui ou qui est réservée à un super administrateur : son compte de connexion et ses liens peuvent être
// restés sous une ancienne adresse. Une requête.
async function adressesDe(base: Base, parties: Partie[], adressesReservees: string[]): Promise<Map<number, string[]>> {
	const ids = parties.map((p) => p.id);
	const [lignes, autres] = await base.batch([
		base
			.select({ id: journal.cibleId, details: journal.details })
			.from(journal)
			.where(and(eq(journal.cibleType, 'personne'), inArray(journal.cibleId, ids), sql`json_extract(${journal.details}, '$.email') IS NOT NULL`)),
		base.select({ email: personne.email }).from(personne).where(notInArray(personne.id, ids))
	]);
	const prises = new Set([...autres.map((a) => a.email), ...adressesReservees.map(normaliserAdresse)]);
	const parAgent = new Map(parties.map((p) => [p.id, new Set([p.email])]));
	for (const l of lignes) {
		const email = (JSON.parse(l.details) as { email: string | { avant: string; apres: string } }).email;
		for (const a of typeof email === 'string' ? [email] : [email.avant, email.apres]) parAgent.get(l.id!)?.add(a);
	}
	return new Map([...parAgent].map(([id, a]) => [id, [...a].filter((x) => !prises.has(x))]));
}

// Toutes les écritures d'un effacement, en un batch. Aucune photo n'est à l'agent seul (celles des publications, messages,
// anomalies et prises restent avec elles ; `personne.photo` n'est jamais remplie) : PHOTOS n'est pas touchée.
function effacement(base: Base, p: Partie, adresses: string[], acteur: string, aujourdhui: string) {
	return [
		base
			.update(personne)
			.set({ email: adresseEffacee(p.id), prenom: 'Ancien', nom: 'agent', surnom: null, photo: null, telephone: null, telephoneVisible: 0, naissance: null, anniversaireVisible: 0, entreeCentre: null, engagementSpv: null, gradeId: null, dateGrade: null, contactUrgence: null, effaceLe: aujourdhui })
			.where(eq(personne.id, p.id)),
		// Le compte de connexion (sessions et comptes partent en cascade), les liens en attente, le dernier envoi de lien.
		base.delete(user).where(inArray(user.email, adresses)),
		...adresses.map((a) => effacerLiensVers(base, a)),
		base.delete(envoiLien).where(inArray(envoiLien.adresse, adresses)),
		base.delete(valeurChamp).where(eq(valeurChamp.personneId, p.id)),
		base.delete(aptitudeAgent).where(eq(aptitudeAgent.personneId, p.id)),
		base.delete(cleAgenda).where(eq(cleAgenda.personneId, p.id)),
		base.delete(visiteMur).where(eq(visiteMur.personneId, p.id)),
		// Déjà fait au départ ; refait : appareils (et envois en file), fil, avis, coupures.
		...effacerNotificationsDe(base, p.id),
		// Ses adresses dans le journal (ajout, changement d'adresse) ; les lignes restent.
		base
			.update(journal)
			.set({ details: sql`json_remove(${journal.details}, '$.email')` })
			.where(and(eq(journal.cibleType, 'personne'), eq(journal.cibleId, p.id), sql`json_extract(${journal.details}, '$.email') IS NOT NULL`)),
		ligneJournal(base, { acteur, action: 'effacer_agent', cibleType: 'personne', cibleId: p.id }, aujourdhui)
	] as const;
}

// Tâche de nuit : efface les agents partis le jour `limite` ou avant (AAAA-MM-JJ, 12 mois plus tôt), jamais un agent revenu
// (sa date de départ est vide). 10 au plus par nuit, le reste la nuit suivante : deux lectures, puis un batch par agent. Rend le nombre effacé.
export async function effacerAgentsPartis(base: Base, limite: string, aujourdhui: string, adressesReservees: string[]): Promise<number> {
	exigerDate(limite);
	exigerDate(aujourdhui);
	const parties = await base
		.select({ id: personne.id, email: personne.email })
		.from(personne)
		.where(and(eq(personne.statut, 'parti'), isNotNull(personne.partiLe), lte(personne.partiLe, limite), isNull(personne.effaceLe)))
		.orderBy(asc(personne.partiLe), asc(personne.id))
		.limit(PARTIS_PAR_NUIT);
	if (parties.length === 0) return 0;
	const adresses = await adressesDe(base, parties, adressesReservees);
	for (const p of parties) await base.batch(effacement(base, p, adresses.get(p.id)!, 'nuit', aujourdhui));
	return parties.length;
}

// Sur demande de l'agent, sans attendre 12 mois : le droit qui fait revenir un agent parti, GERER_ACCES sur le centre.
// L'agent doit être parti : le départ a déjà fini ses rôles, ses groupes, ses demandes et ses réservations.
export async function effacerAgent(base: Base, acteur: Acteur, personneId: number, maintenant: string, adressesReservees: string[]): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await aLeDroit(base, acteur, 'GERER_ACCES', { type: 'centre' }, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' });
	if (acteur.type === 'personne' && acteur.id === personneId) throw new DonneeInvalide('Vous ne pouvez pas effacer vos propres données');
	const [p] = await base.select({ id: personne.id, email: personne.email, statut: personne.statut, effaceLe: personne.effaceLe }).from(personne).where(eq(personne.id, personneId));
	if (!p) throw new DonneeInvalide('Personne inconnue');
	if (adressesReservees.map(normaliserAdresse).includes(p.email)) throw new DonneeInvalide('Adresse réservée au super administrateur');
	if (p.effaceLe !== null) throw new DonneeInvalide('Agent déjà effacé');
	if (p.statut !== 'parti') throw new DonneeInvalide('Déclarez d’abord son départ');
	const adresses = await adressesDe(base, [p], adressesReservees);
	await base.batch(effacement(base, p, adresses.get(p.id)!, acteur.type === 'super' ? `super:${acteur.email}` : `personne:${acteur.id}`, aujourdhui));
}
