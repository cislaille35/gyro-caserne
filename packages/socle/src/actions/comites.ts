import { and, count, countDistinct, eq, isNull, lte, ne, or, gte, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDate } from '../dates.ts';
import { aLeDroit, type Acteur } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { finirOuSupprimer } from '../fin-de-periode.ts';
import { NOM_COMITE_CENTRE } from '../jeu-de-depart.ts';
import { NOMS_ICONES, type NomIcone } from '../icones.ts';
import { ligneJournal } from '../journal.ts';
import { attribution, comite, personne, responsabilite, responsabiliteDroit } from '../schema.ts';
import { nomActeur } from './personnes.ts';

const LONGUEUR_MAX = 60;

async function exiger(base: Base, acteur: Acteur, aujourdhui: string) {
	exigerDate(aujourdhui);
	if (!(await aLeDroit(base, acteur, 'GERER_COMITES', { type: 'centre' }, aujourdhui))) throw new RefusDroit('GERER_COMITES', { type: 'centre' });
}

function texte(valeur: unknown, libelle: string): string {
	const propre = typeof valeur === 'string' ? valeur.trim() : '';
	if (!propre) throw new DonneeInvalide(`${libelle} vide`);
	if (propre.length > LONGUEUR_MAX) throw new DonneeInvalide(`${libelle} trop long`);
	return propre;
}

function iconeValide(valeur: string): NomIcone {
	if (!(NOMS_ICONES as readonly string[]).includes(valeur)) throw new DonneeInvalide('Icône inconnue');
	return valeur as NomIcone;
}

// Unicité parmi tous les comités (dissous compris), sans tenir compte de la casse ni des espaces de bord.
async function exigerNomLibre(base: Base, nom: string, sauf?: number) {
	const autres = await base.select({ id: comite.id, nom: comite.nom }).from(comite);
	if (autres.some((c) => c.id !== sauf && c.nom.trim().toLowerCase() === nom.toLowerCase())) throw new DonneeInvalide('Nom déjà utilisé');
}

async function comiteConnu(base: Base, id: number) {
	const [ligne] = await base.select().from(comite).where(eq(comite.id, id));
	if (!ligne) throw new DonneeInvalide('Comité inconnu');
	return ligne;
}

export async function listerComites(base: Base, acteur: Acteur, aujourdhui: string) {
	await exiger(base, acteur, aujourdhui);
	const comites = await base.select().from(comite).orderBy(comite.nom);
	const enCours = await base
		.select({ id: attribution.perimetreId, membres: countDistinct(attribution.personneId) })
		.from(attribution)
		.where(and(eq(attribution.perimetreType, 'comite'), lte(attribution.debut, aujourdhui), or(isNull(attribution.fin), gte(attribution.fin, aujourdhui))))
		.groupBy(attribution.perimetreId);
	// Le rapporteur : qui tient dans le comité un rôle qui nomme.
	const rapporteurs = await base
		.selectDistinct({ id: attribution.perimetreId, prenom: personne.prenom, nom: personne.nom })
		.from(attribution)
		.innerJoin(personne, eq(personne.id, attribution.personneId))
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.innerJoin(responsabiliteDroit, and(eq(responsabiliteDroit.responsabiliteId, attribution.responsabiliteId), eq(responsabiliteDroit.droit, 'ATTRIBUER_RESPONSABILITE')))
		// Mêmes filtres que les casquettes : rôle de comité non archivé, attribution en cours, agent présent.
		.where(
			and(
				eq(attribution.perimetreType, 'comite'),
				eq(responsabilite.typePerimetre, 'comite'),
				isNull(responsabilite.archiveeLe),
				ne(personne.statut, 'parti'),
				lte(attribution.debut, aujourdhui),
				or(isNull(attribution.fin), gte(attribution.fin, aujourdhui))
			)
		)
		.orderBy(personne.nom, personne.prenom);
	return comites.map((c) => ({
		id: c.id,
		nom: c.nom,
		theme: c.theme,
		icone: c.icone,
		dissousLe: c.dissousLe,
		estCentre: c.nom === NOM_COMITE_CENTRE,
		membresEnCours: enCours.find((e) => e.id === c.id)?.membres ?? 0,
		rapporteurs: rapporteurs.filter((r) => r.id === c.id).map((r) => `${r.prenom} ${r.nom}`)
	}));
}

export async function creerComite(base: Base, acteur: Acteur, donnees: { nom: string; theme: string; icone?: NomIcone }, aujourdhui: string): Promise<number> {
	await exiger(base, acteur, aujourdhui);
	const nom = texte(donnees.nom, 'Nom');
	const theme = texte(donnees.theme, 'Thème');
	const icone = donnees.icone === undefined ? null : iconeValide(donnees.icone);
	await exigerNomLibre(base, nom);
	const [lignes] = await base.batch([
		base.insert(comite).values({ nom, theme, icone }).returning({ id: comite.id }),
		// L'ordre compte : le journal suit l'insertion, last_insert_rowid() est l'id du comité.
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'creer_comite', cibleType: 'comite', cibleId: sql`last_insert_rowid()`, details: { nom, theme, icone } }, aujourdhui)
	]);
	return lignes[0]!.id;
}

export async function modifierComite(base: Base, acteur: Acteur, id: number, champs: { nom?: string; theme?: string; icone?: NomIcone | null }, aujourdhui: string): Promise<void> {
	await exiger(base, acteur, aujourdhui);
	const ligne = await comiteConnu(base, id);
	if (ligne.dissousLe !== null) throw new DonneeInvalide('Comité dissous');
	const changes: { nom?: string; theme?: string; icone?: NomIcone | null } = {};
	if (champs.nom !== undefined) {
		const nom = texte(champs.nom, 'Nom');
		if (ligne.nom === NOM_COMITE_CENTRE && nom !== ligne.nom) throw new DonneeInvalide('Le comité du centre ne se renomme pas');
		await exigerNomLibre(base, nom, id);
		if (nom !== ligne.nom) changes.nom = nom;
	}
	if (champs.theme !== undefined) {
		const theme = texte(champs.theme, 'Thème');
		if (theme !== ligne.theme) changes.theme = theme;
	}
	if (champs.icone !== undefined) {
		const icone = champs.icone === null ? null : iconeValide(champs.icone);
		if (icone !== ligne.icone) changes.icone = icone;
	}
	if (Object.keys(changes).length === 0) return;
	await base.batch([
		base.update(comite).set(changes).where(eq(comite.id, id)),
		// Les noms des champs seulement.
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'modifier_comite', cibleType: 'comite', cibleId: id, details: { champs: Object.keys(changes) } }, aujourdhui)
	]);
}

export async function dissoudreComite(base: Base, acteur: Acteur, id: number, aujourdhui: string): Promise<void> {
	await exiger(base, acteur, aujourdhui);
	const ligne = await comiteConnu(base, id);
	if (ligne.nom === NOM_COMITE_CENTRE) throw new DonneeInvalide('Le comité du centre ne se dissout pas');
	if (ligne.dissousLe !== null) throw new DonneeInvalide('Comité déjà dissous');

	const [bloquante] = await base
		.select({ nom: responsabilite.nom })
		.from(responsabilite)
		.where(and(eq(responsabilite.comiteAttributeurId, id), eq(responsabilite.typePerimetre, 'comite'), isNull(responsabilite.archiveeLe)))
		.orderBy(responsabilite.nom);
	if (bloquante) throw new DonneeInvalide(`Changez d’abord qui attribue « ${bloquante.nom} »`);

	const duComite = and(eq(attribution.perimetreType, 'comite'), eq(attribution.perimetreId, id));
	const [{ n }] = await base
		.select({ n: count() })
		.from(attribution)
		.where(and(duComite, or(isNull(attribution.fin), gte(attribution.fin, aujourdhui))));
	const [supprimer, terminer] = finirOuSupprimer(base, attribution, duComite, aujourdhui);
	await base.batch([
		supprimer,
		terminer,
		base.update(responsabilite).set({ comiteAttributeurId: null }).where(eq(responsabilite.comiteAttributeurId, id)),
		base.update(comite).set({ dissousLe: aujourdhui }).where(eq(comite.id, id)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'dissoudre_comite', cibleType: 'comite', cibleId: id, details: { attributionsClose: n } }, aujourdhui)
	]);
}
