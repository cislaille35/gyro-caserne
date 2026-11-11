import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { chargerComptesDeTest } from '../src/comptes-de-test.ts';
import { acteurDe } from '../src/connexion.ts';
import { deposerEcusson, ecussonDuCentre, octetsEcusson, retirerEcusson } from '../src/ecusson.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { enTeteDe } from '../src/notifications.ts';
import { effacerPhotosOrphelines } from '../src/photos-orphelines.ts';
import { ecusson, journal } from '../src/schema.ts';
import { photo as octets } from '../src/schema-photos.ts';
import { baseDeTest } from './base-de-test.ts';

const M = '2026-11-11T10:00';
const J = '2026-11-11';
const webp = (taille = 100) => {
	const o = new Uint8Array(taille);
	o.set([...'RIFF'].map((c) => c.charCodeAt(0)));
	o.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
	return { type: 'image/webp', donnees: o };
};
const jpeg = (taille = 100) => {
	const o = new Uint8Array(taille);
	o.set([0xff, 0xd8, 0xff, 0xe0]);
	return { type: 'image/jpeg', donnees: o };
};

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', M);
	const acteur = async (role: string) => (await acteurDe(base, `caserne+${role}@exemple.fr`, []))!;
	return { base, chef: await acteur('chef'), agent: await acteur('agent'), superAdmin: { type: 'super', email: 'admin@exemple.fr' } as const };
}

describe('écusson du centre', () => {
	it('sans écusson : rien, et l’en-tête n’en a pas', async () => {
		const { base, agent } = await jeu();
		expect(await ecussonDuCentre(base)).toBeNull();
		expect((await enTeteDe(base, agent, J, M)).ecusson).toBeNull();
	});

	it('déposé par qui gère les listes du centre : rangé dans PHOTOS, dit par l’en-tête (sans requête de plus), servi par sa version', async () => {
		const { base, chef, agent } = await jeu();
		const id = await deposerEcusson(base, base.photos, chef, webp(), M);
		expect(await ecussonDuCentre(base)).toBe(id);
		expect(await base.photos.select({ type: octets.type, taille: octets.taille }).from(octets)).toContainEqual({ type: 'image/webp', taille: 100 });
		base.requetes = 0;
		expect((await enTeteDe(base, agent, J, M)).ecusson).toBe(id);
		expect(base.requetes).toBe(1);
		expect(await octetsEcusson(base, base.photos, id)).toMatchObject({ type: 'image/webp' });
		expect((await base.select().from(journal)).map((l) => l.action)).toContain('deposer_ecusson');
	});

	it('le super administrateur voit aussi l’écusson dans l’en-tête', async () => {
		const { base, chef, superAdmin } = await jeu();
		const id = await deposerEcusson(base, base.photos, chef, jpeg(), M);
		expect((await enTeteDe(base, superAdmin, J, M)).ecusson).toBe(id);
	});

	it('réservé à qui gère les listes du centre', async () => {
		const { base, agent } = await jeu();
		await expect(deposerEcusson(base, base.photos, agent, webp(), M)).rejects.toThrow(RefusDroit);
		await expect(retirerEcusson(base, base.photos, agent, M)).rejects.toThrow(RefusDroit);
	});

	it('JPEG ou WebP de 200 Ko au plus, comme les photos', async () => {
		const { base, chef } = await jeu();
		const png = { type: 'image/png', donnees: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]) };
		await expect(deposerEcusson(base, base.photos, chef, png, M)).rejects.toThrow(DonneeInvalide);
		await expect(deposerEcusson(base, base.photos, chef, { type: 'image/webp', donnees: jpeg().donnees }, M)).rejects.toThrow(DonneeInvalide);
		await expect(deposerEcusson(base, base.photos, chef, webp(200 * 1024 + 1), M)).rejects.toThrow('Photo trop lourde (200 Ko au plus)');
		expect(await base.photos.select().from(octets)).toHaveLength(0);
	});

	it('remplacé : une nouvelle version, l’ancienne image effacée et plus servie', async () => {
		const { base, chef } = await jeu();
		const avant = await deposerEcusson(base, base.photos, chef, webp(), M);
		const apres = await deposerEcusson(base, base.photos, chef, jpeg(), '2026-11-12T10:00');
		expect(apres).not.toBe(avant);
		expect(await ecussonDuCentre(base)).toBe(apres);
		expect((await base.photos.select({ id: octets.id }).from(octets)).map((x) => x.id)).toEqual([apres]);
		await expect(octetsEcusson(base, base.photos, avant)).rejects.toThrow(DonneeInvalide);
		expect(await base.select().from(ecusson)).toHaveLength(1);
	});

	it('retiré : plus d’écusson, l’image effacée ; retirer sans écusson ne fait rien', async () => {
		const { base, chef } = await jeu();
		const id = await deposerEcusson(base, base.photos, chef, webp(), M);
		await retirerEcusson(base, base.photos, chef, M);
		expect(await ecussonDuCentre(base)).toBeNull();
		expect(await base.photos.select().from(octets)).toHaveLength(0);
		await expect(octetsEcusson(base, base.photos, id)).rejects.toThrow(DonneeInvalide);
		await retirerEcusson(base, base.photos, chef, M);
		expect((await base.select().from(journal)).filter((l) => l.action === 'retirer_ecusson')).toHaveLength(1);
	});

	it('une autre photo n’est jamais servie comme écusson (l’adresse est publique)', async () => {
		const { base, chef } = await jeu();
		const id = await deposerEcusson(base, base.photos, chef, webp(), M);
		const [autre] = await base.photos.insert(octets).values({ type: 'image/jpeg', donnees: jpeg().donnees, taille: 100, creeLe: M }).returning({ id: octets.id });
		await expect(octetsEcusson(base, base.photos, autre!.id)).rejects.toThrow(DonneeInvalide);
		await expect(octetsEcusson(base, base.photos, id + 100)).rejects.toThrow(DonneeInvalide);
	});

	it('le ménage de nuit garde l’écusson', async () => {
		const { base, chef } = await jeu();
		const id = await deposerEcusson(base, base.photos, chef, webp(), M);
		// Une image vieille d'un mois : candidate au ménage, mais référencée.
		await base.photos.update(octets).set({ creeLe: '2026-10-01T10:00' });
		expect(await effacerPhotosOrphelines(base, base.photos, M)).toBe(0);
		expect(await ecussonDuCentre(base)).toBe(id);
		expect(await octetsEcusson(base, base.photos, id)).toMatchObject({ type: 'image/webp' });
	});
});
