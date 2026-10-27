import { and, count, countDistinct, eq, gte, isNull, lte, notInArray, or, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDate } from '../dates.ts';
import { aLeDroit, type Acteur } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { finirOuSupprimer } from '../fin-de-periode.ts';
import { ligneJournal } from '../journal.ts';
import { DROITS, estDroitPouvoir, NATURES_RESPONSABILITE, type Droit, type TypePerimetre } from '../listes.ts';
import { attribution, comite, responsabilite, responsabiliteDroit } from '../schema.ts';
import { nomActeur } from './personnes.ts';

const LONGUEUR_MAX = 60;
const PORTEES = ['centre', 'equipe', 'comite'] as const;
type Portee = (typeof PORTEES)[number];
type Nature = (typeof NATURES_RESPONSABILITE)[number];
type Responsabilite = typeof responsabilite.$inferSelect;

// Qui attribue : le chef de centre, le comité visé par l'attribution (portée « comité »), ou un comité désigné.
export type Attributeur = { type: 'chef_centre' } | { type: 'comite_vise' } | { type: 'comite'; id: number };

const DONNER_POUVOIR = 'Seuls le chef de centre ou un super administrateur donnent un droit de pouvoir';
const MODIFIER_POUVOIR = 'Seuls le chef de centre ou un super administrateur modifient une responsabilité qui donne un droit de pouvoir';

async function exiger(base: Base, acteur: Acteur, aujourdhui: string) {
	exigerDate(aujourdhui);
	if (!(await aLeDroit(base, acteur, 'GERER_LISTES', { type: 'centre' }, aujourdhui))) throw new RefusDroit('GERER_LISTES', { type: 'centre' });
}

// Gère le pouvoir : super administrateur, ou GERER_ACCES sur le centre (chef de centre, adjoint).
async function geresLePouvoir(base: Base, acteur: Acteur, aujourdhui: string): Promise<boolean> {
	return acteur.type === 'super' || (await aLeDroit(base, acteur, 'GERER_ACCES', { type: 'centre' }, aujourdhui));
}

function texte(valeur: unknown): string {
	const propre = typeof valeur === 'string' ? valeur.trim() : '';
	if (!propre) throw new DonneeInvalide('Nom vide');
	if (propre.length > LONGUEUR_MAX) throw new DonneeInvalide('Nom trop long');
	return propre;
}

// Unicité parmi toutes les responsabilités (archivées comprises), sans tenir compte de la casse ni des espaces de bord.
async function exigerNomLibre(base: Base, nom: string, sauf?: number) {
	const autres = await base.select({ id: responsabilite.id, nom: responsabilite.nom }).from(responsabilite);
	if (autres.some((r) => r.id !== sauf && r.nom.trim().toLowerCase() === nom.toLowerCase())) throw new DonneeInvalide('Nom déjà utilisé');
}

function exigerNature(nature: unknown): Nature {
	if (!(NATURES_RESPONSABILITE as readonly unknown[]).includes(nature)) throw new DonneeInvalide('Nature inconnue');
	return nature as Nature;
}

function exigerPortee(portee: unknown): Portee {
	if (!(PORTEES as readonly unknown[]).includes(portee)) throw new DonneeInvalide('Portée inconnue');
	return portee as Portee;
}

function exigerDroits(droits: unknown): Droit[] {
	if (!Array.isArray(droits) || droits.some((d) => !(DROITS as readonly unknown[]).includes(d))) throw new DonneeInvalide('Droit inconnu');
	return [...new Set(droits as Droit[])];
}

// Traduit qui attribue en comiteAttributeurId, en vérifiant qu'il va avec la portée.
async function comiteAttributeur(base: Base, attributeur: Attributeur, portee: Portee): Promise<number | null> {
	if (attributeur?.type === 'comite') {
		const [ligne] = await base.select().from(comite).where(eq(comite.id, attributeur.id));
		if (!ligne) throw new DonneeInvalide('Comité inconnu');
		if (ligne.dissousLe !== null) throw new DonneeInvalide('Comité dissous');
		return ligne.id;
	}
	// En base, « nul » veut dire comité visé pour une portée « comité », chef de centre sinon.
	if (attributeur?.type === 'comite_vise') {
		if (portee !== 'comite') throw new DonneeInvalide('Seule une responsabilité de portée « comité » est attribuée par le comité visé');
		return null;
	}
	if (attributeur?.type === 'chef_centre') {
		if (portee === 'comite') throw new DonneeInvalide('Une responsabilité de portée « comité » est attribuée par le comité visé ou par un comité désigné');
		return null;
	}
	throw new DonneeInvalide('Attributeur inconnu');
}

function attributeurDe(r: Pick<Responsabilite, 'comiteAttributeurId' | 'typePerimetre'>): Attributeur {
	if (r.comiteAttributeurId !== null) return { type: 'comite', id: r.comiteAttributeurId };
	return r.typePerimetre === 'comite' ? { type: 'comite_vise' } : { type: 'chef_centre' };
}

function memeAttributeur(a: Attributeur, b: Attributeur): boolean {
	return a.type === b.type && (a.type !== 'comite' || (b.type === 'comite' && a.id === b.id));
}

async function responsabiliteConnue(base: Base, id: number): Promise<Responsabilite> {
	const [ligne] = await base.select().from(responsabilite).where(eq(responsabilite.id, id));
	if (!ligne) throw new DonneeInvalide('Responsabilité inconnue');
	return ligne;
}

async function droitsActuels(base: Base, id: number) {
	return base.select().from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, id));
}

// Le référent technique ne touche pas à une responsabilité qui donne du pouvoir, la sienne comprise.
async function exigerNonProtegee(base: Base, acteur: Acteur, id: number, aujourdhui: string) {
	const actuels = await droitsActuels(base, id);
	if (actuels.some((l) => estDroitPouvoir(l.droit)) && !(await geresLePouvoir(base, acteur, aujourdhui))) {
		throw new RefusDroit('GERER_ACCES', { type: 'centre' }, MODIFIER_POUVOIR);
	}
	return actuels;
}

export async function listerResponsabilites(base: Base, acteur: Acteur, aujourdhui: string) {
	await exiger(base, acteur, aujourdhui);
	const pouvoir = await geresLePouvoir(base, acteur, aujourdhui);
	const lignes = await base.select().from(responsabilite).orderBy(responsabilite.nom);
	const droits = await base.select().from(responsabiliteDroit);
	const titulaires = await base
		.select({ id: attribution.responsabiliteId, n: countDistinct(attribution.personneId) })
		.from(attribution)
		.where(and(lte(attribution.debut, aujourdhui), or(isNull(attribution.fin), gte(attribution.fin, aujourdhui))))
		.groupBy(attribution.responsabiliteId);
	return lignes.map((r) => {
		const siens = droits.filter((d) => d.responsabiliteId === r.id).sort((a, b) => a.droit.localeCompare(b.droit));
		return {
			id: r.id,
			nom: r.nom,
			nature: r.nature,
			portee: r.typePerimetre as TypePerimetre,
			attributeur: attributeurDe(r),
			droits: siens.map((d) => ({ droit: d.droit, verrouille: d.verrouille === 1 })),
			systeme: r.systeme as string | null,
			archiveeLe: r.archiveeLe,
			titulaires: titulaires.find((t) => t.id === r.id)?.n ?? 0,
			protegee: !pouvoir && siens.some((d) => estDroitPouvoir(d.droit))
		};
	});
}

export async function creerResponsabilite(
	base: Base,
	acteur: Acteur,
	donnees: { nom: string; nature: Nature; portee: Portee; attributeur: Attributeur; droits: Droit[] },
	aujourdhui: string
): Promise<number> {
	await exiger(base, acteur, aujourdhui);
	const droits = exigerDroits(donnees.droits);
	if (droits.some(estDroitPouvoir) && !(await geresLePouvoir(base, acteur, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' }, DONNER_POUVOIR);
	const nom = texte(donnees.nom);
	const nature = exigerNature(donnees.nature);
	const portee = exigerPortee(donnees.portee);
	const comiteAttributeurId = await comiteAttributeur(base, donnees.attributeur, portee);
	await exigerNomLibre(base, nom);

	// La nouvelle responsabilité, retrouvée par son nom (unique).
	const idNouvelle = sql<number>`(SELECT ${responsabilite.id} FROM ${responsabilite} WHERE ${responsabilite.nom} = ${nom} ORDER BY ${responsabilite.id} DESC LIMIT 1)`;
	const [lignes] = await base.batch([
		base.insert(responsabilite).values({ nom, nature, typePerimetre: portee, comiteAttributeurId }).returning({ id: responsabilite.id }),
		// L'ordre compte : le journal suit l'insertion, last_insert_rowid() est l'id de la responsabilité.
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'creer_responsabilite', cibleType: 'responsabilite', cibleId: sql`last_insert_rowid()`, details: { nom, nature, portee, attributeur: attributeurDe({ comiteAttributeurId, typePerimetre: portee }), droits } }, aujourdhui),
		...(droits.length > 0 ? [base.insert(responsabiliteDroit).values(droits.map((droit) => ({ responsabiliteId: idNouvelle, droit })))] : [])
	]);
	return lignes[0]!.id;
}

export async function modifierResponsabilite(
	base: Base,
	acteur: Acteur,
	id: number,
	champs: Partial<{ nom: string; nature: Nature; portee: Portee; attributeur: Attributeur; droits: Droit[] }>,
	aujourdhui: string
): Promise<void> {
	await exiger(base, acteur, aujourdhui);
	const ligne = await responsabiliteConnue(base, id);
	if (ligne.archiveeLe !== null) throw new DonneeInvalide('Responsabilité archivée');
	const actuels = await exigerNonProtegee(base, acteur, id, aujourdhui);

	const changes: Partial<Pick<Responsabilite, 'nom' | 'nature' | 'typePerimetre' | 'comiteAttributeurId'>> = {};
	const noms: string[] = [];
	if (champs.nom !== undefined) {
		const nom = texte(champs.nom);
		await exigerNomLibre(base, nom, id);
		if (nom !== ligne.nom) {
			changes.nom = nom;
			noms.push('nom');
		}
	}
	if (champs.nature !== undefined) {
		const nature = exigerNature(champs.nature);
		if (nature !== ligne.nature) {
			changes.nature = nature;
			noms.push('nature');
		}
	}
	const portee = champs.portee === undefined ? (ligne.typePerimetre as Portee) : exigerPortee(champs.portee);
	if (portee !== ligne.typePerimetre) {
		if (ligne.systeme !== null) throw new DonneeInvalide('La portée d’une responsabilité système ne change pas');
		const [{ n }] = await base
			.select({ n: count() })
			.from(attribution)
			.where(and(eq(attribution.responsabiliteId, id), or(isNull(attribution.fin), gte(attribution.fin, aujourdhui))));
		if (n > 0) throw new DonneeInvalide('Portée verrouillée : la responsabilité est tenue');
		changes.typePerimetre = portee;
		noms.push('portee');
	}
	// Qui attribue se vérifie avec la portée finale, même s'il n'est pas modifié.
	const attributeur = champs.attributeur ?? attributeurDe(ligne);
	const comiteAttributeurId = await comiteAttributeur(base, attributeur, portee);
	if (comiteAttributeurId !== ligne.comiteAttributeurId) changes.comiteAttributeurId = comiteAttributeurId;
	if (!memeAttributeur(attributeur, attributeurDe(ligne))) noms.push('attributeur');

	const avant = actuels.map((l) => l.droit);
	const apres = champs.droits === undefined ? avant : exigerDroits(champs.droits);
	const ajoutes = apres.filter((d) => !avant.includes(d));
	if (champs.droits !== undefined) {
		const retires = actuels.filter((l) => !apres.includes(l.droit));
		if ([...ajoutes, ...retires.map((l) => l.droit)].some(estDroitPouvoir) && !(await geresLePouvoir(base, acteur, aujourdhui))) {
			throw new RefusDroit('GERER_ACCES', { type: 'centre' }, DONNER_POUVOIR);
		}
		if (retires.some((l) => l.verrouille === 1)) throw new DonneeInvalide('Droit verrouillé : impossible de le retirer');
		if (ajoutes.length > 0 || retires.length > 0) noms.push('droits');
	}
	if (noms.length === 0) return;

	await base.batch([
		// Les noms des champs ; pour les droits, avant et après (ce ne sont pas des données personnelles).
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'modifier_responsabilite', cibleType: 'responsabilite', cibleId: id, details: { champs: noms, ...(noms.includes('droits') ? { droits: { avant: [...avant].sort(), apres: [...apres].sort() } } : {}) } }, aujourdhui),
		...(Object.keys(changes).length > 0 ? [base.update(responsabilite).set(changes).where(eq(responsabilite.id, id))] : []),
		...(noms.includes('droits')
			? [
					apres.length === 0
						? base.delete(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, id))
						: base.delete(responsabiliteDroit).where(and(eq(responsabiliteDroit.responsabiliteId, id), notInArray(responsabiliteDroit.droit, apres))),
					...(ajoutes.length > 0 ? [base.insert(responsabiliteDroit).values(ajoutes.map((droit) => ({ responsabiliteId: id, droit })))] : [])
				]
			: [])
	]);
}

export async function archiverResponsabilite(base: Base, acteur: Acteur, id: number, aujourdhui: string): Promise<void> {
	await exiger(base, acteur, aujourdhui);
	const ligne = await responsabiliteConnue(base, id);
	await exigerNonProtegee(base, acteur, id, aujourdhui);
	if (ligne.systeme !== null) throw new DonneeInvalide('Une responsabilité système ne s’archive pas');
	if (ligne.archiveeLe !== null) throw new DonneeInvalide('Responsabilité déjà archivée');

	const deLaResponsabilite = eq(attribution.responsabiliteId, id);
	const [{ n }] = await base
		.select({ n: count() })
		.from(attribution)
		.where(and(deLaResponsabilite, or(isNull(attribution.fin), gte(attribution.fin, aujourdhui))));
	const [supprimer, terminer] = finirOuSupprimer(base, attribution, deLaResponsabilite, aujourdhui);
	await base.batch([
		supprimer,
		terminer,
		base.update(responsabilite).set({ archiveeLe: aujourdhui }).where(eq(responsabilite.id, id)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'archiver_responsabilite', cibleType: 'responsabilite', cibleId: id, details: { attributionsClose: n } }, aujourdhui)
	]);
}
