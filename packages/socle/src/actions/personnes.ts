import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { effacerLiensVers, normaliserAdresse } from '../connexion.ts';
import { enCours, exigerDate } from '../dates.ts';
import { aLeDroit, couvre, droitsDe, perimetreDe, type Acteur, type Perimetre } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { STATUTS_AVEC_ACCES, STATUTS_OPERATIONNELS, type StatutOperationnel } from '../listes.ts';
import { affectationEquipe, attribution, equipe, personne, profil, profilDroit, session, user } from '../schema.ts';

const centre: Perimetre = { type: 'centre' };

export function nomActeur(acteur: Acteur): string {
	return acteur.type === 'super' ? `super:${acteur.email}` : `personne:${acteur.id}`;
}

async function exiger(base: Base, acteur: Acteur, vise: Perimetre, aujourdhui: string) {
	if (!(await aLeDroit(base, acteur, 'GERER_ACCES', vise, aujourdhui))) throw new RefusDroit('GERER_ACCES', vise);
}

function veille(date: string): string {
	const jour = new Date(`${date}T00:00:00Z`);
	jour.setUTCDate(jour.getUTCDate() - 1);
	return jour.toISOString().slice(0, 10);
}

// Chaque droit du profil doit être détenu par l'acteur sur un périmètre qui le couvre.
async function exigerProfilCouvert(base: Base, acteur: Acteur, profilId: number, aujourdhui: string) {
	const detenus = await droitsDe(base, acteur, aujourdhui);
	const duProfil = await base.select().from(profilDroit).where(eq(profilDroit.profilId, profilId));
	for (const ligne of duProfil) {
		const cible = perimetreDe(ligne.perimetreType, ligne.perimetreId);
		if (!cible || !detenus.some((d) => d.droit === ligne.droit && couvre(d.perimetre, cible))) throw new RefusDroit(ligne.droit, cible ?? centre);
	}
}

export async function ajouterPersonne(
	base: Base,
	acteur: Acteur,
	donnees: { email: string; prenom: string; nom: string; profilId: number; equipeId?: number },
	aujourdhui: string
): Promise<number> {
	exigerDate(aujourdhui);
	const email = normaliserAdresse(donnees.email);
	if (!email) throw new DonneeInvalide('Adresse vide');
	const [leProfil] = await base.select().from(profil).where(eq(profil.id, donnees.profilId));
	if (!leProfil) throw new DonneeInvalide('Profil inconnu');

	// Le chef d'équipe n'agit que sur un agent de son équipe.
	const vise: Perimetre = leProfil.typePersonne === 'agent' && donnees.equipeId !== undefined ? { type: 'equipe', id: donnees.equipeId } : centre;
	await exiger(base, acteur, vise, aujourdhui);

	// Sans GERER_ACCES sur le centre, on ne donne pas plus de droits que ceux qu'on détient.
	if (!(await aLeDroit(base, acteur, 'GERER_ACCES', centre, aujourdhui))) {
		await exigerProfilCouvert(base, acteur, donnees.profilId, aujourdhui);
	}

	if (donnees.equipeId !== undefined) {
		const [uneEquipe] = await base.select().from(equipe).where(eq(equipe.id, donnees.equipeId));
		if (!uneEquipe) throw new DonneeInvalide('Équipe inconnue');
	}
	const [existante] = await base.select({ id: personne.id }).from(personne).where(eq(personne.email, email));
	if (existante) throw new DonneeInvalide('Adresse déjà utilisée');

	const nouvelle = base.insert(personne).values({ email, prenom: donnees.prenom, nom: donnees.nom, profilId: donnees.profilId }).returning({ id: personne.id });
	// L'ordre compte : juste après l'insertion de la personne, last_insert_rowid() est son identifiant.
	const journalise = ligneJournal(base, { acteur: nomActeur(acteur), action: 'ajouter_personne', cibleType: 'personne', cibleId: sql`last_insert_rowid()`, details: { email, profilId: donnees.profilId, equipeId: donnees.equipeId ?? null } }, aujourdhui);
	const ecritures = [nouvelle, journalise] as const;
	if (donnees.equipeId === undefined) {
		const [lignes] = await base.batch(ecritures);
		return lignes[0]!.id;
	}
	const affectation = base.insert(affectationEquipe).values({ personneId: sql`(select id from personne where email = ${email})`, equipeId: donnees.equipeId, debut: aujourdhui });
	const [lignes] = await base.batch([...ecritures, affectation]);
	return lignes[0]!.id;
}

export async function changerStatut(base: Base, acteur: Acteur, personneId: number, statut: StatutOperationnel, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	if (!(STATUTS_OPERATIONNELS as readonly string[]).includes(statut)) throw new DonneeInvalide('Statut inconnu');
	const [fiche] = await base.select({ id: personne.id, email: personne.email, profilId: personne.profilId }).from(personne).where(eq(personne.id, personneId));
	if (!fiche) throw new DonneeInvalide('Personne inconnue');

	const affectations = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, personneId));
	const courante = affectations.find((a) => enCours(a.debut, a.fin, aujourdhui));
	const parCentre = await aLeDroit(base, acteur, 'GERER_ACCES', centre, aujourdhui);
	if (!parCentre) {
		// Sans le centre : ni sur une responsabilité en cours ou à venir, ni sur un profil plus large que ses droits.
		const responsabilites = await base.select().from(attribution).where(eq(attribution.personneId, personneId));
		if (responsabilites.some((r) => r.fin === null || r.fin >= aujourdhui)) throw new RefusDroit('GERER_ACCES', centre);
		if (fiche.profilId !== null) await exigerProfilCouvert(base, acteur, fiche.profilId, aujourdhui);
		const vise: Perimetre = courante ? { type: 'equipe', id: courante.equipeId } : centre;
		await exiger(base, acteur, vise, aujourdhui);
	}

	const ecritures = [
		base.update(personne).set({ statut }).where(eq(personne.id, personneId)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'changer_statut', cibleType: 'personne', cibleId: personneId, details: { statut } }, aujourdhui)
	] as const;
	if ((STATUTS_AVEC_ACCES as readonly string[]).includes(statut)) {
		await base.batch(ecritures);
		return;
	}
	// Sans accès, la personne est déconnectée tout de suite, et ses liens en attente ne valent plus rien.
	const sesComptes = base.select({ id: user.id }).from(user).where(eq(user.email, fiche.email));
	await base.batch([...ecritures, base.delete(session).where(inArray(session.userId, sesComptes)), effacerLiensVers(base, fiche.email)]);
}

export async function affecterEquipe(base: Base, acteur: Acteur, personneId: number, equipeId: number, debut: string, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	exigerDate(debut);
	await exiger(base, acteur, centre, aujourdhui);
	const [fiche] = await base.select({ id: personne.id }).from(personne).where(eq(personne.id, personneId));
	if (!fiche) throw new DonneeInvalide('Personne inconnue');
	const [uneEquipe] = await base.select().from(equipe).where(eq(equipe.id, equipeId));
	if (!uneEquipe) throw new DonneeInvalide('Équipe inconnue');

	const [ouverte] = await base
		.select()
		.from(affectationEquipe)
		.where(and(eq(affectationEquipe.personneId, personneId), isNull(affectationEquipe.fin)));
	if (ouverte && ouverte.debut >= debut) throw new DonneeInvalide('Début antérieur à l’affectation en cours');

	await base.batch([
		base
			.update(affectationEquipe)
			.set({ fin: veille(debut) })
			.where(and(eq(affectationEquipe.personneId, personneId), isNull(affectationEquipe.fin))),
		base.insert(affectationEquipe).values({ personneId, equipeId, debut }),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'affecter_equipe', cibleType: 'personne', cibleId: personneId, details: { equipeId, debut } }, aujourdhui)
	]);
}
