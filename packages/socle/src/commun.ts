import { eq, inArray } from 'drizzle-orm';
import type { BasePhotos } from './base.ts';
import { tenuesValides } from './casquettes.ts';
import { DonneeInvalide } from './erreurs.ts';
import { TYPES_PHOTO } from './listes.ts';
import { photo as octetsPhoto } from './schema-photos.ts';

// Outils partagés par les murs et la messagerie.

// `feminin` : accord du message (« Question trop longue »).
export function texte(valeur: unknown, libelle: string, max: number, feminin = false): string {
	const propre = typeof valeur === 'string' ? valeur.trim() : '';
	if (!propre) throw new DonneeInvalide(`${libelle} vide`);
	if (propre.length > max) throw new DonneeInvalide(`${libelle} trop long${feminin ? 'ue' : ''}`);
	return propre;
}

const ROLES = [
	['chef_centre', 'Chef de centre'],
	['chef_centre_adjoint', 'Adjoint'],
	['chef_equipe', 'Chef d’équipe']
] as const;

// Premier rôle tenu (Chef de centre, Adjoint, Chef d’équipe), parmi les rôles tenus du jour (requeteTenues).
export function roleDe(tenues: { personneId: number; type: string; portee: string; systeme: string | null }[], personneId: number): string | null {
	const siennes = tenuesValides(tenues.filter((t) => t.personneId === personneId));
	return ROLES.find(([systeme]) => siennes.some((t) => t.systeme === systeme))?.[1] ?? null;
}

const PHOTOS_MAX = 4;
export const TAILLE_PHOTO_MAX = 200 * 1024;

export type Photo = { type: string; donnees: Uint8Array };
export type PhotoValide = { type: (typeof TYPES_PHOTO)[number]; donnees: Uint8Array };

// Le type déclaré ne suffit pas : on vérifie les premiers octets du fichier.
function estDuType(type: string, o: Uint8Array): boolean {
	const ascii = (debut: number, fin: number) => String.fromCharCode(...o.subarray(debut, fin));
	if (type === 'image/jpeg') return o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff;
	if (type === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
	return false;
}

// 4 photos au plus, JPEG ou WebP, de 200 Ko chacune au plus.
export function exigerPhotos(valeur: Photo[] | undefined): PhotoValide[] {
	const photos = valeur ?? [];
	if (!Array.isArray(photos)) throw new DonneeInvalide('Photos invalides');
	if (photos.length > PHOTOS_MAX) throw new DonneeInvalide(`${PHOTOS_MAX} photos au plus`);
	for (const p of photos) {
		if (!p || !(TYPES_PHOTO as readonly string[]).includes(p.type) || !(p.donnees instanceof Uint8Array) || !estDuType(p.type, p.donnees)) throw new DonneeInvalide('Photo JPEG ou WebP seulement');
		if (p.donnees.length > TAILLE_PHOTO_MAX) throw new DonneeInvalide('Photo trop lourde (200 Ko au plus)');
	}
	return photos as PhotoValide[];
}

// Les octets d'abord, dans la base des photos ; puis `suite` écrit les références (ids dans l'ordre des photos).
// Si `suite` échoue, les octets sont effacés et l'erreur relancée. Sans photo, rien n'est écrit dans PHOTOS.
export async function avecPhotos<T>(basePhotos: BasePhotos, photos: PhotoValide[], maintenant: string, suite: (ids: number[]) => Promise<T>): Promise<T> {
	if (photos.length === 0) return suite([]);
	const [premiere, ...autres] = photos.map((p) => basePhotos.insert(octetsPhoto).values({ type: p.type, donnees: p.donnees, taille: p.donnees.length, creeLe: maintenant }).returning({ id: octetsPhoto.id }));
	const ids = (await basePhotos.batch([premiere!, ...autres])).map(([ligne]) => ligne!.id);
	try {
		return await suite(ids);
	} catch (erreur) {
		await effacerPhotos(basePhotos, ids);
		throw erreur;
	}
}

// Efface des octets, par paquets de 100 (limite de D1), en une requête. Ce qui les référençait est déjà effacé :
// si l'effacement échoue, ils restent orphelins (place perdue, rien de visible), sans gêner l'agent.
export async function effacerPhotos(basePhotos: BasePhotos, ids: number[]): Promise<void> {
	const paquets = [];
	for (let i = 0; i < ids.length; i += 100) paquets.push(basePhotos.delete(octetsPhoto).where(inArray(octetsPhoto.id, ids.slice(i, i + 100))));
	const [premier, ...autres] = paquets;
	if (premier) await basePhotos.batch([premier, ...autres]).catch(() => {});
}

// Les octets d'une photo, une fois l'accès vérifié dans la base principale.
export async function lireOctets(basePhotos: BasePhotos, id: number): Promise<Photo> {
	const [octets] = await basePhotos.select({ type: octetsPhoto.type, donnees: octetsPhoto.donnees }).from(octetsPhoto).where(eq(octetsPhoto.id, id));
	if (!octets) throw new DonneeInvalide('Photo inconnue');
	return octets;
}
