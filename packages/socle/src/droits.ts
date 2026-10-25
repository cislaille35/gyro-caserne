import { eq } from 'drizzle-orm';
import type { Base } from './base.ts';
import { enCours } from './dates.ts';
import { DROITS, STATUTS_AVEC_ACCES, type Droit, type TypePerimetre } from './listes.ts';
import { attribution, personne, profilDroit, responsabiliteDroit } from './schema.ts';

export type Acteur = { type: 'super'; email: string } | { type: 'personne'; id: number };
export type Perimetre = { type: 'centre' } | { type: Exclude<TypePerimetre, 'centre'>; id: number };
export type DroitAccorde = { droit: Droit; perimetre: Perimetre };

// Le centre couvre tout ; sinon, même type et même identifiant.
export function couvre(detenu: Perimetre, vise: Perimetre): boolean {
	if (detenu.type === 'centre') return true;
	return vise.type === detenu.type && 'id' in vise && vise.id === detenu.id;
}

function perimetreDe(type: TypePerimetre, id: number | null): Perimetre {
	return type === 'centre' || id === null ? { type: 'centre' } : { type, id };
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
			debut: attribution.debut,
			fin: attribution.fin
		})
		.from(attribution)
		.innerJoin(responsabiliteDroit, eq(responsabiliteDroit.responsabiliteId, attribution.responsabiliteId))
		.where(eq(attribution.personneId, acteur.id));

	return [
		...duProfil.map((ligne) => ({ droit: ligne.droit, perimetre: perimetreDe(ligne.type, ligne.id) })),
		...desAttributions.filter((ligne) => enCours(ligne.debut, ligne.fin, date)).map((ligne) => ({ droit: ligne.droit, perimetre: perimetreDe(ligne.type, ligne.id) }))
	];
}

export async function aLeDroit(base: Base, acteur: Acteur, droit: Droit, vise: Perimetre, date: string): Promise<boolean> {
	if (acteur.type === 'super') return true;
	const droits = await droitsDe(base, acteur, date);
	return droits.some((accorde) => accorde.droit === droit && couvre(accorde.perimetre, vise));
}
