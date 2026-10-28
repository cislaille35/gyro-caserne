import { and, eq, inArray } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDate } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { estDroitPouvoir, type Droit } from '../listes.ts';
import { profil, profilDroit } from '../schema.ts';
import { nomActeur } from './personnes.ts';
import { exigerDroits, geresLePouvoir } from './responsabilites.ts';

// Les droits d'un profil, comme ceux du pouvoir, sont l'affaire du chef de centre, de l'adjoint et du super administrateur.
async function exiger(base: Base, acteur: Acteur, aujourdhui: string) {
	exigerDate(aujourdhui);
	if (!(await geresLePouvoir(base, acteur, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' });
}

// Seuls les droits sur le centre : les autres périmètres (salon…) ne se règlent pas ici.
const surLeCentre = (id: number) => and(eq(profilDroit.profilId, id), eq(profilDroit.perimetreType, 'centre'));

export async function listerProfils(base: Base, acteur: Acteur, aujourdhui: string) {
	await exiger(base, acteur, aujourdhui);
	const profils = await base.select().from(profil).orderBy(profil.id);
	const droits = await base.select({ profilId: profilDroit.profilId, droit: profilDroit.droit }).from(profilDroit).where(eq(profilDroit.perimetreType, 'centre'));
	return profils.map((p) => ({
		id: p.id,
		nom: p.nom,
		typePersonne: p.typePersonne,
		droits: [...new Set(droits.filter((d) => d.profilId === p.id).map((d) => d.droit))].sort()
	}));
}

export async function modifierDroitsProfil(base: Base, acteur: Acteur, profilId: number, droits: Droit[], aujourdhui: string): Promise<void> {
	await exiger(base, acteur, aujourdhui);
	const apres = exigerDroits(droits);
	if (apres.some(estDroitPouvoir)) throw new DonneeInvalide('Un profil ne donne pas de droit de pouvoir');
	const [ligne] = await base.select({ id: profil.id }).from(profil).where(eq(profil.id, profilId));
	if (!ligne) throw new DonneeInvalide('Profil inconnu');

	const avant = [...new Set((await base.select({ droit: profilDroit.droit }).from(profilDroit).where(surLeCentre(profilId))).map((l) => l.droit))];
	const ajoutes = apres.filter((d) => !avant.includes(d));
	const retires = avant.filter((d) => !apres.includes(d));
	if (ajoutes.length === 0 && retires.length === 0) return;

	await base.batch([
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'modifier_droits_profil', cibleType: 'profil', cibleId: profilId, details: { droits: { avant: [...avant].sort(), apres: [...apres].sort() } } }, aujourdhui),
		...(retires.length > 0 ? [base.delete(profilDroit).where(and(surLeCentre(profilId), inArray(profilDroit.droit, retires)))] : []),
		...(ajoutes.length > 0 ? [base.insert(profilDroit).values(ajoutes.map((droit) => ({ profilId, droit, perimetreType: 'centre' as const, perimetreId: null })))] : [])
	]);
}
