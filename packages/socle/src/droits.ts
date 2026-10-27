import { and, eq } from 'drizzle-orm';
import type { Base } from './base.ts';
import { enCours } from './dates.ts';
import { DROITS, STATUTS_AVEC_ACCES, type Droit, type ResponsabiliteSysteme, type TypePerimetre } from './listes.ts';
import { attribution, personne, profilDroit, responsabilite, responsabiliteDroit } from './schema.ts';

export type Acteur = { type: 'super'; email: string } | { type: 'personne'; id: number };
export type Perimetre = { type: 'centre' } | { type: Exclude<TypePerimetre, 'centre'>; id: number };
export type DroitAccorde = { droit: Droit; perimetre: Perimetre };

// Le centre couvre tout ; sinon, même type et même identifiant.
export function couvre(detenu: Perimetre, vise: Perimetre): boolean {
	if (detenu.type === 'centre') return true;
	return vise.type === detenu.type && 'id' in vise && vise.id === detenu.id;
}

// Un périmètre sans identifiant, hors centre, est invalide : refusé, jamais élargi au centre.
export function perimetreDe(type: TypePerimetre, id: number | null): Perimetre | null {
	if (type === 'centre') return { type: 'centre' };
	return id === null ? null : { type, id };
}

function accordes(lignes: Array<{ droit: Droit; type: TypePerimetre; id: number | null }>): DroitAccorde[] {
	return lignes.flatMap(({ droit, type, id }) => {
		const perimetre = perimetreDe(type, id);
		return perimetre ? [{ droit, perimetre }] : [];
	});
}

// Seule définition des droits d'un acteur : tout le reste (aLeDroit, affichage) s'y appuie.
export async function droitsDe(base: Base, acteur: Acteur, date: string): Promise<DroitAccorde[]> {
	if (acteur.type === 'super') return DROITS.map((droit) => ({ droit, perimetre: { type: 'centre' } }));

	const [fiche] = await base.select({ statut: personne.statut, profilId: personne.profilId }).from(personne).where(eq(personne.id, acteur.id));
	if (!fiche || !(STATUTS_AVEC_ACCES as readonly string[]).includes(fiche.statut)) return [];

	const duProfil =
		fiche.profilId === null
			? []
			: await base
					.select({ droit: profilDroit.droit, type: profilDroit.perimetreType, id: profilDroit.perimetreId })
					.from(profilDroit)
					.where(eq(profilDroit.profilId, fiche.profilId));

	const desAttributions = await base
		.select({
			droit: responsabiliteDroit.droit,
			type: attribution.perimetreType,
			id: attribution.perimetreId,
			typeResponsabilite: responsabilite.typePerimetre,
			debut: attribution.debut,
			fin: attribution.fin
		})
		.from(attribution)
		.innerJoin(responsabiliteDroit, eq(responsabiliteDroit.responsabiliteId, attribution.responsabiliteId))
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.where(eq(attribution.personneId, acteur.id));

	// Une attribution hors du type de périmètre de sa responsabilité ne donne rien.
	const valides = desAttributions.filter((ligne) => ligne.type === ligne.typeResponsabilite && enCours(ligne.debut, ligne.fin, date));

	return [...accordes(duProfil), ...accordes(valides)];
}

// Parmi des droits déjà lus, l'un donne-t-il `droit` sur `vise` ?
export function accorde(droits: DroitAccorde[], droit: Droit, vise: Perimetre): boolean {
	return droits.some((d) => d.droit === droit && couvre(d.perimetre, vise));
}

export async function aLeDroit(base: Base, acteur: Acteur, droit: Droit, vise: Perimetre, date: string): Promise<boolean> {
	return accorde(await droitsDe(base, acteur, date), droit, vise);
}

// Le chef de centre, c'est la personne qui a une attribution en cours de la responsabilité système chef_centre.
export async function estChefDeCentre(base: Base, personneId: number, aujourdhui: string): Promise<boolean> {
	return occupe(base, personneId, 'chef_centre', aujourdhui);
}

// La personne a-t-elle, aujourd'hui, la responsabilité système donnée ?
export async function occupe(base: Base, personneId: number, systeme: ResponsabiliteSysteme, aujourdhui: string): Promise<boolean> {
	const lignes = await base
		.select({ debut: attribution.debut, fin: attribution.fin })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.where(and(eq(attribution.personneId, personneId), eq(responsabilite.systeme, systeme)));
	return lignes.some((l) => enCours(l.debut, l.fin, aujourdhui));
}
