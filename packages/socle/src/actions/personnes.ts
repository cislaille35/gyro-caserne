import { and, eq, gt, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { effacerLiensVers, normaliserAdresse } from '../connexion.ts';
import { enCours, exigerDate } from '../dates.ts';
import { aLeDroit, couvre, droitsDe, estChefDeCentre, occupe, perimetreDe, type Acteur, type Perimetre } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { STATUTS_AVEC_ACCES, STATUTS_OPERATIONNELS, type StatutOperationnel } from '../listes.ts';
import { affectationEquipe, attribution, equipe, grade, personne, profil, profilDroit, session, user } from '../schema.ts';

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

// Le chef de centre en fonction relève d'un super administrateur ; un adjoint en fonction, du chef de centre ou d'un super administrateur.
async function exigerProtection(base: Base, acteur: Acteur, personneId: number, aujourdhui: string, refus: { chef: string; adjoint: string }) {
	if (acteur.type === 'super') return;
	if (await estChefDeCentre(base, personneId, aujourdhui)) throw new RefusDroit('GERER_ACCES', centre, refus.chef);
	if ((await occupe(base, personneId, 'chef_centre_adjoint', aujourdhui)) && !(await estChefDeCentre(base, acteur.id, aujourdhui))) throw new RefusDroit('GERER_ACCES', centre, refus.adjoint);
}

type Complements = { gradeId?: number | null; dateGrade?: string | null; telephone?: string | null; naissance?: string | null; entreeCentre?: string | null; engagementSpv?: string | null };

async function exigerComplements(base: Base, c: Complements) {
	for (const date of [c.dateGrade, c.naissance, c.entreeCentre, c.engagementSpv]) if (date != null) exigerDate(date);
	if (c.gradeId != null) {
		const [leGrade] = await base.select({ id: grade.id }).from(grade).where(eq(grade.id, c.gradeId));
		if (!leGrade) throw new DonneeInvalide('Grade inconnu');
	}
}

async function exigerProfil(base: Base, profilId: number) {
	const [leProfil] = await base.select().from(profil).where(eq(profil.id, profilId));
	if (!leProfil) throw new DonneeInvalide('Profil inconnu');
	return leProfil;
}

async function exigerAdresseLibre(base: Base, email: string) {
	const [existante] = await base.select({ id: personne.id }).from(personne).where(eq(personne.email, email));
	if (existante) throw new DonneeInvalide('Adresse déjà utilisée');
}

export async function ajouterPersonne(
	base: Base,
	acteur: Acteur,
	donnees: { email: string; prenom: string; nom: string; profilId: number; equipeId?: number } & Complements,
	aujourdhui: string
): Promise<number> {
	exigerDate(aujourdhui);
	const email = normaliserAdresse(donnees.email);
	if (!email) throw new DonneeInvalide('Adresse vide');
	const leProfil = await exigerProfil(base, donnees.profilId);

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
	await exigerComplements(base, donnees);
	await exigerAdresseLibre(base, email);

	const { gradeId, dateGrade, telephone, naissance, entreeCentre, engagementSpv } = donnees;
	const nouvelle = base
		.insert(personne)
		.values({ email, prenom: donnees.prenom, nom: donnees.nom, profilId: donnees.profilId, gradeId, dateGrade, telephone, naissance, entreeCentre, engagementSpv })
		.returning({ id: personne.id });
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
	const [fiche] = await base.select({ id: personne.id, email: personne.email, profilId: personne.profilId, statut: personne.statut }).from(personne).where(eq(personne.id, personneId));
	if (!fiche) throw new DonneeInvalide('Personne inconnue');
	await exigerProtection(base, acteur, personneId, aujourdhui, {
		chef: 'Seul un super administrateur change le statut du chef de centre',
		adjoint: 'Seuls le chef de centre ou un super administrateur changent le statut d’un adjoint'
	});
	// Seuls le chef de centre ou son adjoint font revenir une personne suspendue ou partie.
	if ((fiche.statut === 'suspendu' || fiche.statut === 'parti') && statut !== fiche.statut) await exiger(base, acteur, centre, aujourdhui);

	const affectations = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, personneId));
	const courante = affectations.find((a) => enCours(a.debut, a.fin, aujourdhui));
	const parCentre = await aLeDroit(base, acteur, 'GERER_ACCES', centre, aujourdhui);
	if (!parCentre) {
		// Sans le centre : ni sur une responsabilité en cours ou à venir, ni sur un profil plus large que ses droits.
		const responsabilites = await base.select().from(attribution).where(eq(attribution.personneId, personneId));
		if (responsabilites.some((r) => r.fin === null || r.fin >= aujourdhui))
			throw new RefusDroit('GERER_ACCES', centre, 'Le statut d’une personne qui a une responsabilité en cours ou à venir relève du centre');
		if (fiche.profilId !== null) await exigerProfilCouvert(base, acteur, fiche.profilId, aujourdhui);
		const vise: Perimetre = courante ? { type: 'equipe', id: courante.equipeId } : centre;
		await exiger(base, acteur, vise, aujourdhui);
	}

	const ecritures = [
		// Au départ, on n'en garde pas plus que nécessaire.
		base
			.update(personne)
			.set(statut === 'parti' ? { statut, naissance: null, contactUrgence: null } : { statut })
			.where(eq(personne.id, personneId)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'changer_statut', cibleType: 'personne', cibleId: personneId, details: { statut } }, aujourdhui)
	] as const;
	if ((STATUTS_AVEC_ACCES as readonly string[]).includes(statut)) {
		await base.batch(ecritures);
		return;
	}
	// Sans accès, la personne est déconnectée tout de suite, et ses liens en attente ne valent plus rien.
	await base.batch([...ecritures, ...deconnecter(base, fiche.email)]);
}

// Requêtes à passer dans un batch : sessions et liens en attente de cette adresse.
function deconnecter(base: Base, email: string) {
	const sesComptes = base.select({ id: user.id }).from(user).where(eq(user.email, email));
	return [base.delete(session).where(inArray(session.userId, sesComptes)), effacerLiensVers(base, email)] as const;
}

export type ChampsFiche = { email: string; prenom: string; nom: string; profilId: number } & Required<Complements>;
const CHAMPS_FICHE = ['email', 'prenom', 'nom', 'gradeId', 'dateGrade', 'profilId', 'telephone', 'naissance', 'entreeCentre', 'engagementSpv'] as const;

export async function modifierFiche(base: Base, acteur: Acteur, id: number, champs: Partial<ChampsFiche>, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	await exiger(base, acteur, centre, aujourdhui);
	const [fiche] = await base.select().from(personne).where(eq(personne.id, id));
	if (!fiche) throw new DonneeInvalide('Personne inconnue');
	await exigerProtection(base, acteur, id, aujourdhui, {
		chef: 'Seul un super administrateur modifie la fiche du chef de centre',
		adjoint: 'Seuls le chef de centre ou un super administrateur modifient la fiche d’un adjoint'
	});

	// Seuls ces champs : le statut ou le contact d'urgence ont leurs propres règles.
	const nouveaux = Object.fromEntries(CHAMPS_FICHE.filter((cle) => champs[cle] !== undefined).map((cle) => [cle, champs[cle]])) as Partial<ChampsFiche>;
	const textes = { email: 'Adresse', prenom: 'Prénom', nom: 'Nom' } as const;
	for (const cle of ['email', 'prenom', 'nom'] as const) {
		const valeur: unknown = champs[cle];
		if (valeur === undefined) continue;
		if (typeof valeur !== 'string') throw new DonneeInvalide(`${textes[cle]} invalide`);
		nouveaux[cle] = cle === 'email' ? normaliserAdresse(valeur) : valeur.trim();
		if (!nouveaux[cle]) throw new DonneeInvalide(`${textes[cle]} vide`);
	}
	await exigerComplements(base, nouveaux);
	if (nouveaux.profilId !== undefined) await exigerProfil(base, nouveaux.profilId);

	const changes = Object.fromEntries(Object.entries(nouveaux).filter(([cle, valeur]) => valeur !== fiche[cle as keyof ChampsFiche])) as Partial<ChampsFiche>;
	if (Object.keys(changes).length === 0) return;
	if (changes.email !== undefined) await exigerAdresseLibre(base, changes.email);

	const ecritures = [
		base.update(personne).set(changes).where(eq(personne.id, id)),
		// Les noms des champs seulement : une valeur effacée au départ ne doit pas survivre au journal.
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'modifier_fiche', cibleType: 'personne', cibleId: id, details: { champs: Object.keys(changes) } }, aujourdhui)
	] as const;
	// L'adresse sert à la connexion : l'ancienne ne doit plus ouvrir de session.
	await base.batch(changes.email === undefined ? ecritures : [...ecritures, ...deconnecter(base, fiche.email)]);
}

// L'affectation en cours se termine la veille (supprimée si elle commence aujourd'hui) ; celles à venir sont supprimées.
export async function retirerEquipe(base: Base, acteur: Acteur, id: number, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	await exiger(base, acteur, centre, aujourdhui);
	const affectations = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id));
	const courante = affectations.find((a) => enCours(a.debut, a.fin, aujourdhui));
	if (!courante && !affectations.some((a) => a.debut > aujourdhui)) throw new DonneeInvalide('Aucune équipe en cours');

	const aSupprimer = courante?.debut === aujourdhui ? gte(affectationEquipe.debut, aujourdhui) : gt(affectationEquipe.debut, aujourdhui);
	const ecritures = [
		base.delete(affectationEquipe).where(and(eq(affectationEquipe.personneId, id), aSupprimer)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'retirer_equipe', cibleType: 'personne', cibleId: id, details: { equipeId: courante?.equipeId ?? null } }, aujourdhui)
	] as const;
	if (!courante || courante.debut === aujourdhui) {
		await base.batch(ecritures);
		return;
	}
	const terminer = base
		.update(affectationEquipe)
		.set({ fin: veille(aujourdhui) })
		.where(and(eq(affectationEquipe.personneId, id), eq(affectationEquipe.debut, courante.debut)));
	await base.batch([terminer, ...ecritures]);
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

export type MonProfil = { surnom: string | null; telephone: string | null; telephoneVisible: boolean; contactUrgence: string | null; anniversaireVisible: boolean };
const TEXTES_PROFIL = ['surnom', 'telephone', 'contactUrgence'] as const;
const BOOLEENS_PROFIL = ['telephoneVisible', 'anniversaireVisible'] as const;

function exigerPersonne(acteur: Acteur): number {
	if (acteur.type === 'super') throw new DonneeInvalide('Pas de fiche pour le super administrateur');
	return acteur.id;
}

export async function monProfil(base: Base, acteur: Acteur): Promise<MonProfil | null> {
	if (acteur.type === 'super') return null;
	const [fiche] = await base.select().from(personne).where(eq(personne.id, acteur.id));
	if (!fiche) return null;
	return { surnom: fiche.surnom, telephone: fiche.telephone, telephoneVisible: fiche.telephoneVisible === 1, contactUrgence: fiche.contactUrgence, anniversaireVisible: fiche.anniversaireVisible === 1 };
}

export async function modifierMonProfil(base: Base, acteur: Acteur, champs: Partial<MonProfil>, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	const id = exigerPersonne(acteur);
	const [fiche] = await base.select().from(personne).where(eq(personne.id, id));
	if (!fiche) throw new DonneeInvalide('Personne inconnue');

	// Seuls ces champs : le reste de la fiche relève de la gestion.
	const permis: readonly string[] = [...TEXTES_PROFIL, ...BOOLEENS_PROFIL];
	if (Object.keys(champs).some((cle) => !permis.includes(cle))) throw new DonneeInvalide('Champ non modifiable');

	const nouveaux: Partial<Record<(typeof TEXTES_PROFIL)[number], string | null>> & Partial<Record<(typeof BOOLEENS_PROFIL)[number], number>> = {};
	for (const cle of TEXTES_PROFIL) {
		const valeur: unknown = champs[cle];
		if (valeur === undefined) continue;
		if (valeur !== null && typeof valeur !== 'string') throw new DonneeInvalide(`Champ ${cle} invalide`);
		nouveaux[cle] = valeur?.trim() || null;
	}
	for (const cle of BOOLEENS_PROFIL) {
		const valeur: unknown = champs[cle];
		if (valeur === undefined) continue;
		if (typeof valeur !== 'boolean') throw new DonneeInvalide(`Champ ${cle} invalide`);
		nouveaux[cle] = valeur ? 1 : 0;
	}

	const changes = Object.fromEntries(Object.entries(nouveaux).filter(([cle, valeur]) => valeur !== fiche[cle as keyof typeof fiche]));
	if (Object.keys(changes).length === 0) return;
	await base.batch([
		base.update(personne).set(changes).where(eq(personne.id, id)),
		// Les noms des champs seulement : aucune valeur personnelle dans le journal.
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'modifier_mon_profil', cibleType: 'personne', cibleId: id, details: { champs: Object.keys(changes) } }, aujourdhui)
	]);
}
