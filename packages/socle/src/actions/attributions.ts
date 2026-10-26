import { and, eq, notInArray, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { enCours, exigerDate } from '../dates.ts';
import { aLeDroit, type Acteur, type Perimetre } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { DROITS, type Droit } from '../listes.ts';
import { attribution, comite, equipe, personne, responsabilite, responsabiliteDroit } from '../schema.ts';
import { nomActeur } from './personnes.ts';

type Responsabilite = typeof responsabilite.$inferSelect;

// Le chef de centre, c'est la personne qui a une attribution en cours de la responsabilité système chef_centre.
export async function estChefDeCentre(base: Base, personneId: number, aujourdhui: string): Promise<boolean> {
	const lignes = await base
		.select({ debut: attribution.debut, fin: attribution.fin })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.where(and(eq(attribution.personneId, personneId), eq(responsabilite.systeme, 'chef_centre')));
	return lignes.some((l) => enCours(l.debut, l.fin, aujourdhui));
}

async function exigerAttribution(base: Base, acteur: Acteur, laResponsabilite: Responsabilite, perimetre: Perimetre, aujourdhui: string) {
	// Exceptions aux droits : le chef de centre est nommé par un super administrateur, son adjoint par le chef de centre.
	if (laResponsabilite.systeme === 'chef_centre') {
		if (acteur.type !== 'super') throw new RefusDroit('ATTRIBUER_RESPONSABILITE', { type: 'centre' });
		return;
	}
	if (laResponsabilite.systeme === 'chef_centre_adjoint') {
		if (acteur.type !== 'super' && !(await estChefDeCentre(base, acteur.id, aujourdhui))) throw new RefusDroit('ATTRIBUER_RESPONSABILITE', { type: 'centre' });
		return;
	}
	let vise: Perimetre;
	if (laResponsabilite.comiteAttributeurId !== null) vise = { type: 'comite', id: laResponsabilite.comiteAttributeurId };
	else if (perimetre.type === 'comite') vise = perimetre;
	else vise = { type: 'centre' };
	if (!(await aLeDroit(base, acteur, 'ATTRIBUER_RESPONSABILITE', vise, aujourdhui))) throw new RefusDroit('ATTRIBUER_RESPONSABILITE', vise);
}

async function responsabiliteConnue(base: Base, id: number): Promise<Responsabilite> {
	const [ligne] = await base.select().from(responsabilite).where(eq(responsabilite.id, id));
	if (!ligne) throw new DonneeInvalide('Responsabilité inconnue');
	return ligne;
}

export async function attribuer(
	base: Base,
	acteur: Acteur,
	a: { personneId: number; responsabiliteId: number; perimetre: Perimetre; debut: string; fin?: string; compteRendu?: string },
	aujourdhui: string
): Promise<number> {
	exigerDate(aujourdhui);
	exigerDate(a.debut);
	if (a.fin !== undefined) exigerDate(a.fin);
	const laResponsabilite = await responsabiliteConnue(base, a.responsabiliteId);
	if (a.perimetre.type !== laResponsabilite.typePerimetre) throw new DonneeInvalide('Périmètre différent de celui de la responsabilité');
	if (a.fin !== undefined && a.fin < a.debut) throw new DonneeInvalide('Fin avant le début');
	const [fiche] = await base.select({ id: personne.id }).from(personne).where(eq(personne.id, a.personneId));
	if (!fiche) throw new DonneeInvalide('Personne inconnue');
	if (a.perimetre.type === 'equipe') {
		const [uneEquipe] = await base.select({ id: equipe.id }).from(equipe).where(eq(equipe.id, a.perimetre.id));
		if (!uneEquipe) throw new DonneeInvalide('Équipe inconnue');
	}
	if (a.perimetre.type === 'comite') {
		const [unComite] = await base.select({ id: comite.id }).from(comite).where(eq(comite.id, a.perimetre.id));
		if (!unComite) throw new DonneeInvalide('Comité inconnu');
	}

	await exigerAttribution(base, acteur, laResponsabilite, a.perimetre, aujourdhui);

	const qui = nomActeur(acteur);
	const [lignes] = await base.batch([
		base
			.insert(attribution)
			.values({
				personneId: a.personneId,
				responsabiliteId: a.responsabiliteId,
				perimetreType: a.perimetre.type,
				perimetreId: a.perimetre.type === 'centre' ? null : a.perimetre.id,
				debut: a.debut,
				fin: a.fin ?? null,
				saisiePar: qui,
				saisieLe: aujourdhui,
				compteRendu: a.compteRendu ?? null
			})
			.returning({ id: attribution.id }),
		// L'ordre compte : le journal suit l'insertion, last_insert_rowid() est l'id de l'attribution.
		ligneJournal(base, { acteur: qui, action: 'attribuer', cibleType: 'attribution', cibleId: sql`last_insert_rowid()`, details: { personneId: a.personneId, responsabiliteId: a.responsabiliteId, perimetre: a.perimetre, debut: a.debut, fin: a.fin ?? null } }, aujourdhui)
	]);
	return lignes[0]!.id;
}

export async function finirAttribution(base: Base, acteur: Acteur, attributionId: number, fin: string, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	exigerDate(fin);
	const [ligne] = await base.select().from(attribution).where(eq(attribution.id, attributionId));
	if (!ligne) throw new DonneeInvalide('Attribution inconnue');
	if (fin < ligne.debut) throw new DonneeInvalide('Fin avant le début');
	if (ligne.fin !== null && fin > ligne.fin) throw new DonneeInvalide('Une attribution ne peut qu’être raccourcie');
	const laResponsabilite = await responsabiliteConnue(base, ligne.responsabiliteId);
	const perimetre: Perimetre = ligne.perimetreType === 'centre' || ligne.perimetreId === null ? { type: 'centre' } : { type: ligne.perimetreType, id: ligne.perimetreId };
	await exigerAttribution(base, acteur, laResponsabilite, perimetre, aujourdhui);

	await base.batch([
		base.update(attribution).set({ fin }).where(eq(attribution.id, attributionId)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'finir_attribution', cibleType: 'attribution', cibleId: attributionId, details: { fin } }, aujourdhui)
	]);
}

export async function modifierDroitsResponsabilite(base: Base, acteur: Acteur, responsabiliteId: number, droits: Droit[], aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	if (!(await aLeDroit(base, acteur, 'GERER_LISTES', { type: 'centre' }, aujourdhui))) throw new RefusDroit('GERER_LISTES', { type: 'centre' });
	await responsabiliteConnue(base, responsabiliteId);
	if (droits.some((droit) => !(DROITS as readonly string[]).includes(droit))) throw new DonneeInvalide('Droit inconnu');

	const actuels = await base.select().from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, responsabiliteId));
	if (actuels.some((ligne) => ligne.verrouille === 1 && !droits.includes(ligne.droit))) throw new DonneeInvalide('Droit verrouillé : impossible de le retirer');

	const aGarder = [...new Set(droits)];
	const aAjouter = aGarder.filter((droit) => !actuels.some((ligne) => ligne.droit === droit));
	await base.batch([
		aGarder.length === 0
			? base.delete(responsabiliteDroit).where(and(eq(responsabiliteDroit.responsabiliteId, responsabiliteId), eq(responsabiliteDroit.verrouille, 0)))
			: base.delete(responsabiliteDroit).where(and(eq(responsabiliteDroit.responsabiliteId, responsabiliteId), eq(responsabiliteDroit.verrouille, 0), notInArray(responsabiliteDroit.droit, aGarder))),
		...(aAjouter.length > 0 ? [base.insert(responsabiliteDroit).values(aAjouter.map((droit) => ({ responsabiliteId, droit })))] : []),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'modifier_droits_responsabilite', cibleType: 'responsabilite', cibleId: responsabiliteId, details: { droits: aGarder } }, aujourdhui)
	]);
}
