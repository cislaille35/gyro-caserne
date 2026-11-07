import { and, between, gte, isNull, lt, lte, max, sql } from 'drizzle-orm';
import type { Base, BasePhotos } from './base.ts';
import { effacerPhotos } from './commun.ts';
import { ajouterJours, exigerDateHeure } from './dates.ts';
import { anomalie, photoMessage, photoPublication, priseGarde, signalementMessage } from './schema.ts';
import { photo as octets } from './schema-photos.ts';

// Les identifiants examinés par nuit.
export const FENETRE_ORPHELINES = 200;

// Ménage de nuit : efface les octets de PHOTOS que plus rien ne référence dans la base principale (un effacement d'octets
// qui a échoué laisse des orphelins). Les deux bases sont à part : chaque nuit examine une tranche de 200 identifiants,
// une autre la nuit suivante (la tranche dépend du jour), et toutes en autant de nuits que de tranches.
// Une photo de moins d'un jour est gardée : une publication en cours d'envoi peut ne pas encore la référencer.
// Références : photos des publications, des messages, des anomalies, des écarts d'une prise de garde (saisie, JSON),
// copies des signalements non classés (JSON). 4 requêtes au plus. Rend le nombre de photos effacées.
export async function effacerPhotosOrphelines(base: Base, basePhotos: BasePhotos, maintenant: string): Promise<number> {
	const jour = exigerDateHeure(maintenant, 'Date');
	const [{ dernier } = { dernier: null }] = await basePhotos.select({ dernier: max(octets.id) }).from(octets);
	if (dernier === null) return 0;
	const tranches = Math.ceil(dernier / FENETRE_ORPHELINES);
	const tranche = Math.floor(Date.parse(`${jour}T00:00Z`) / 864e5) % tranches;
	const de = tranche * FENETRE_ORPHELINES + 1;
	const a = de + FENETRE_ORPHELINES - 1;
	// Créées avant la veille à minuit : plus d'un jour, même au changement d'heure.
	const candidates = await basePhotos
		.select({ id: octets.id })
		.from(octets)
		.where(and(gte(octets.id, de), lte(octets.id, a), lt(octets.creeLe, ajouterJours(jour, -1))));
	if (candidates.length === 0) return 0;
	const [publications, messages, anomalies, prises, copies] = await base.batch([
		base.select({ id: photoPublication.photoId }).from(photoPublication).where(between(photoPublication.photoId, de, a)),
		base.select({ id: photoMessage.photoId }).from(photoMessage).where(between(photoMessage.photoId, de, a)),
		base.select({ id: anomalie.photoId }).from(anomalie).where(between(anomalie.photoId, de, a)),
		base
			.select({ saisie: priseGarde.saisie })
			.from(priseGarde)
			.where(sql`EXISTS (SELECT 1 FROM json_each(${priseGarde.saisie}, '$.ecarts') e WHERE json_extract(e.value, '$.photo') BETWEEN ${de} AND ${a})`),
		base
			.select({ photos: signalementMessage.photosCopie })
			.from(signalementMessage)
			.where(and(isNull(signalementMessage.classeLe), sql`EXISTS (SELECT 1 FROM json_each(${signalementMessage.photosCopie}) WHERE value BETWEEN ${de} AND ${a})`))
	]);
	const gardees = new Set<number | null>([
		...publications.map((p) => p.id),
		...messages.map((m) => m.id),
		...anomalies.map((x) => x.id),
		...prises.flatMap((p) => Object.values((JSON.parse(p.saisie) as { ecarts?: Record<string, { photo: number | null }> }).ecarts ?? {}).map((e) => e.photo)),
		...copies.flatMap((c) => JSON.parse(c.photos) as number[])
	]);
	const orphelines = candidates.map((c) => c.id).filter((id) => !gardees.has(id));
	await effacerPhotos(basePhotos, orphelines);
	return orphelines.length;
}
