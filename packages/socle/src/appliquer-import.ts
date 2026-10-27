import { and, eq, inArray } from 'drizzle-orm';
import { attribuer, terminerAttribution } from './actions/attributions.ts';
import { affecterEquipe, ajouterPersonne, changerStatut, modifierFiche, retirerEquipe } from './actions/personnes.ts';
import type { Operation } from './apercu-import.ts';
import type { Base } from './base.ts';
import { enCours, exigerDate } from './dates.ts';
import type { Acteur } from './droits.ts';
import { estGestionnaire } from './effectif.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { attribution, responsabilite } from './schema.ts';

// Le chef de centre et l'adjoint en fonction ne se touchent pas par le fichier.
async function exigerNonProtege(base: Base, personneId: number, aujourdhui: string) {
	const roles = await base
		.select({ debut: attribution.debut, fin: attribution.fin })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.where(and(eq(attribution.personneId, personneId), inArray(responsabilite.systeme, ['chef_centre', 'chef_centre_adjoint'])));
	if (roles.some((r) => enCours(r.debut, r.fin, aujourdhui))) throw new DonneeInvalide('Le chef de centre et l’adjoint se modifient à l’écran');
}

// Applique une opération de l'aperçu ; `nouvelles` : n° de ligne → id de l'agent créé par cette ligne.
export async function appliquerOperation(
	base: Base,
	acteur: Acteur,
	op: Operation,
	nouvelles: Record<number, number>,
	aujourdhui: string,
	adressesReservees: string[]
): Promise<{ personneId: number | null }> {
	exigerDate(aujourdhui);
	if (!(await estGestionnaire(base, acteur, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' });

	if (op.type === 'ajouter') return { personneId: await ajouterPersonne(base, acteur, op.donnees, aujourdhui, adressesReservees) };
	if (op.type === 'terminer') {
		const [ligne] = await base.select({ personneId: attribution.personneId }).from(attribution).where(eq(attribution.id, op.attributionId));
		if (ligne) await exigerNonProtege(base, ligne.personneId, aujourdhui);
		await terminerAttribution(base, acteur, op.attributionId, aujourdhui);
		return { personneId: null };
	}

	let personneId: number;
	if (op.type === 'attribuer') {
		const id = 'id' in op.personne ? op.personne.id : nouvelles[op.personne.ligne];
		if (id === undefined) throw new DonneeInvalide('Agent de la ligne non créé');
		personneId = id;
	} else personneId = op.personneId;
	await exigerNonProtege(base, personneId, aujourdhui);

	if (op.type === 'modifier') await modifierFiche(base, acteur, personneId, op.champs, aujourdhui, adressesReservees);
	else if (op.type === 'equipe') {
		if (op.equipeId === null) await retirerEquipe(base, acteur, personneId, aujourdhui);
		else await affecterEquipe(base, acteur, personneId, op.equipeId, aujourdhui, aujourdhui);
	} else if (op.type === 'statut') await changerStatut(base, acteur, personneId, op.statut, aujourdhui);
	else await attribuer(base, acteur, { personneId, responsabiliteId: op.responsabiliteId, perimetre: op.perimetre, debut: aujourdhui }, aujourdhui);
	return { personneId: null };
}
