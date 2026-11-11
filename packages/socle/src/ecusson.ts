import { eq } from 'drizzle-orm';
import { nomActeur } from './actions/personnes.ts';
import type { Base, BasePhotos } from './base.ts';
import { avecPhotos, effacerPhotos, exigerPhotos, lireOctets, type Photo } from './commun.ts';
import { exigerDateHeure } from './dates.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { ligneJournal } from './journal.ts';
import { ecusson } from './schema.ts';

// L'écusson du centre : une image déposée dans les réglages, montrée à la connexion et dans l'en-tête. Sans écusson, rien ne change.
// L'identifiant de sa photo sert de version : l'adresse de l'image change à chaque remplacement, le navigateur la garde sinon.

async function exigerListes(base: Base, acteur: Acteur, maintenant: string) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await aLeDroit(base, acteur, 'GERER_LISTES', { type: 'centre' }, aujourdhui))) throw new RefusDroit('GERER_LISTES', { type: 'centre' });
}

// La version de l'écusson (l'identifiant de sa photo), ou null.
export const requeteEcusson = (base: Base) => base.select({ photoId: ecusson.photoId }).from(ecusson);
export async function ecussonDuCentre(base: Base): Promise<number | null> {
	const [l] = await requeteEcusson(base);
	return l?.photoId ?? null;
}

// Dépose ou remplace l'écusson (JPEG ou WebP, 200 Ko au plus, comme les photos). L'ancienne image est effacée. Rend la nouvelle version.
export async function deposerEcusson(base: Base, basePhotos: BasePhotos, acteur: Acteur, image: Photo, maintenant: string): Promise<number> {
	await exigerListes(base, acteur, maintenant);
	const [valide] = exigerPhotos([image]);
	if (!valide) throw new DonneeInvalide('Image manquante');
	const avant = await ecussonDuCentre(base);
	const id = await avecPhotos(basePhotos, [valide], maintenant, async ([photoId]) => {
		await base.batch([
			base.insert(ecusson).values({ id: 1, photoId: photoId!, modifieLe: maintenant }).onConflictDoUpdate({ target: ecusson.id, set: { photoId: photoId!, modifieLe: maintenant } }),
			ligneJournal(base, { acteur: nomActeur(acteur), action: 'deposer_ecusson', cibleType: 'centre', cibleId: null, details: { photoId } }, maintenant)
		]);
		return photoId!;
	});
	if (avant !== null) await effacerPhotos(basePhotos, [avant]);
	return id;
}

export async function retirerEcusson(base: Base, basePhotos: BasePhotos, acteur: Acteur, maintenant: string): Promise<void> {
	await exigerListes(base, acteur, maintenant);
	const avant = await ecussonDuCentre(base);
	if (avant === null) return;
	await base.batch([base.delete(ecusson).where(eq(ecusson.id, 1)), ligneJournal(base, { acteur: nomActeur(acteur), action: 'retirer_ecusson', cibleType: 'centre', cibleId: null, details: { photoId: avant } }, maintenant)]);
	await effacerPhotos(basePhotos, [avant]);
}

// L'image, seulement si `version` est celle de l'écusson en place : l'adresse est publique (page de connexion), aucune autre photo n'y passe.
export async function octetsEcusson(base: Base, basePhotos: BasePhotos, version: number): Promise<Photo> {
	if ((await ecussonDuCentre(base)) !== version) throw new DonneeInvalide('Écusson inconnu');
	return lireOctets(basePhotos, version);
}
