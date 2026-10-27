import { eq, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDate } from '../dates.ts';
import { aLeDroit, estChefDeCentre, type Acteur, type Perimetre } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { attribution, comite, equipe, personne, responsabilite } from '../schema.ts';
import { nomActeur } from './personnes.ts';

type Responsabilite = typeof responsabilite.$inferSelect;

async function exigerAttribution(base: Base, acteur: Acteur, laResponsabilite: Responsabilite, perimetre: Perimetre, aujourdhui: string) {
	// Exceptions aux droits : le chef de centre est nommé par un super administrateur, son adjoint par le chef de centre.
	if (laResponsabilite.systeme === 'chef_centre') {
		if (acteur.type !== 'super') throw new RefusDroit('ATTRIBUER_RESPONSABILITE', { type: 'centre' }, 'Seul un super administrateur nomme ou retire le chef de centre');
		return;
	}
	if (laResponsabilite.systeme === 'chef_centre_adjoint') {
		if (acteur.type !== 'super' && !(await estChefDeCentre(base, acteur.id, aujourdhui))) {
			throw new RefusDroit('ATTRIBUER_RESPONSABILITE', { type: 'centre' }, 'Seul le chef de centre nomme ou retire un adjoint');
		}
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
	if (laResponsabilite.archiveeLe !== null) throw new DonneeInvalide('Responsabilité archivée');
	if (a.perimetre.type !== laResponsabilite.typePerimetre) throw new DonneeInvalide('Périmètre différent de celui de la responsabilité');
	if (a.fin !== undefined && a.fin < a.debut) throw new DonneeInvalide('Fin avant le début');
	const [fiche] = await base.select({ id: personne.id }).from(personne).where(eq(personne.id, a.personneId));
	if (!fiche) throw new DonneeInvalide('Personne inconnue');
	if (a.perimetre.type === 'equipe') {
		const [uneEquipe] = await base.select({ id: equipe.id }).from(equipe).where(eq(equipe.id, a.perimetre.id));
		if (!uneEquipe) throw new DonneeInvalide('Équipe inconnue');
	}
	if (a.perimetre.type === 'comite') {
		const [unComite] = await base.select({ id: comite.id, dissousLe: comite.dissousLe }).from(comite).where(eq(comite.id, a.perimetre.id));
		if (!unComite) throw new DonneeInvalide('Comité inconnu');
		if (unComite.dissousLe !== null) throw new DonneeInvalide('Comité dissous');
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
