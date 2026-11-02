import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { appliquerGeste, creerTypeEngin, ecrireOuRefuser, ecrituresFiche, gereLesEngins, lireFiche, lireFiches, modifierFicheEngin, type ZoneFiche } from '../src/fiches.ts';
import { attribution, comite, responsabilite, responsabiliteDroit } from '../src/schema.ts';
import { aujourdhui } from './de-test-engins.ts';
import { ficheElement, ficheVersion, journal } from '../src/schema.ts';
import { jeuEngins, maintenant } from './de-test-engins.ts';

const zones: ZoneFiche[] = [
	{ ref: 1, nom: 'Cabine', elements: [{ ref: 10, libelle: 'Radio', quantite: null }, { ref: 11, libelle: 'Lampes', quantite: 2 }] },
	{ ref: 2, nom: 'Coffres', elements: [{ ref: 12, libelle: 'Bâches', quantite: null }] }
];
const refs = { zone: 3, element: 13 };
const vue = (z: ZoneFiche[]) => z.map((x) => `${x.nom}: ${x.elements.map((e) => e.libelle + (e.quantite ? ` ×${e.quantite}` : '')).join(', ')}`);

describe('appliquerGeste', () => {
	it('ajoute, renomme, déplace et retire une zone', () => {
		expect(vue(appliquerGeste(zones, { quoi: 'ajouter_zone', nom: '  Toit ' }, refs))).toEqual(['Cabine: Radio, Lampes ×2', 'Coffres: Bâches', 'Toit: ']);
		expect(appliquerGeste(zones, { quoi: 'ajouter_zone', nom: 'Toit' }, refs)[2]!.ref).toBe(3);
		expect(vue(appliquerGeste(zones, { quoi: 'renommer_zone', zone: 2, nom: 'Coffre arrière' }, refs))[1]).toBe('Coffre arrière: Bâches');
		expect(vue(appliquerGeste(zones, { quoi: 'deplacer_zone', zone: 2, sens: -1 }, refs))).toEqual(['Coffres: Bâches', 'Cabine: Radio, Lampes ×2']);
		expect(vue(appliquerGeste(zones, { quoi: 'deplacer_zone', zone: 1, sens: -1 }, refs))).toEqual(vue(zones));
		expect(vue(appliquerGeste(zones, { quoi: 'retirer_zone', zone: 1 }, refs))).toEqual(['Coffres: Bâches']);
	});

	it('ajoute, modifie, change de zone, déplace et retire un élément ; la référence suit l’élément', () => {
		const ajout = appliquerGeste(zones, { quoi: 'ajouter_element', zone: 2, libelle: 'Cordes', quantite: 3 }, refs);
		expect(vue(ajout)[1]).toBe('Coffres: Bâches, Cordes ×3');
		expect(ajout[1]!.elements[1]!.ref).toBe(13);
		expect(vue(appliquerGeste(zones, { quoi: 'modifier_element', element: 11, zone: 1, libelle: 'Lampes chargées', quantite: 4 }, refs))[0]).toBe('Cabine: Radio, Lampes chargées ×4');
		const deplace = appliquerGeste(zones, { quoi: 'modifier_element', element: 10, zone: 2, libelle: 'Radio', quantite: null }, refs);
		expect(vue(deplace)).toEqual(['Cabine: Lampes ×2', 'Coffres: Bâches, Radio']);
		expect(deplace[1]!.elements[1]!.ref).toBe(10);
		expect(vue(appliquerGeste(zones, { quoi: 'deplacer_element', element: 11, sens: -1 }, refs))[0]).toBe('Cabine: Lampes ×2, Radio');
		expect(vue(appliquerGeste(zones, { quoi: 'retirer_element', element: 10 }, refs))[0]).toBe('Cabine: Lampes ×2');
	});

	it('refuse une zone en double, un libellé vide, une quantité impossible, une référence inconnue', () => {
		expect(() => appliquerGeste(zones, { quoi: 'ajouter_zone', nom: 'cabine' }, refs)).toThrow(new DonneeInvalide('Zone déjà présente'));
		expect(() => appliquerGeste(zones, { quoi: 'ajouter_zone', nom: ' ' }, refs)).toThrow(new DonneeInvalide('Nom de zone vide'));
		expect(() => appliquerGeste(zones, { quoi: 'ajouter_element', zone: 1, libelle: '', quantite: null }, refs)).toThrow(new DonneeInvalide('Élément vide'));
		for (const quantite of [0, 1.5, 1000]) expect(() => appliquerGeste(zones, { quoi: 'ajouter_element', zone: 1, libelle: 'X', quantite }, refs)).toThrow(new DonneeInvalide('Quantité invalide'));
		expect(() => appliquerGeste(zones, { quoi: 'retirer_element', element: 99 }, refs)).toThrow(new DonneeInvalide('Élément inconnu'));
		expect(() => appliquerGeste(zones, { quoi: 'retirer_zone', zone: 99 }, refs)).toThrow(new DonneeInvalide('Zone inconnue'));
	});
});

describe('modifierFicheEngin', () => {
	it('réservé à qui gère les engins', async () => {
		const { base, alice, types } = await jeuEngins();
		await expect(modifierFicheEngin(base, alice, types.VTU, { quoi: 'ajouter_zone', nom: 'Toit' }, maintenant)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('version pas encore utilisée : réécrite sur place, références gardées, auteur et journal', async () => {
		const { base, chefDeGarde, types } = await jeuEngins();
		const avant = await lireFiche(base, types.VTU);
		await modifierFicheEngin(base, chefDeGarde, types.VTU, { quoi: 'retirer_element', element: avant.zones[0]!.elements[0]!.ref }, maintenant);
		const apres = await lireFiche(base, types.VTU);
		expect(apres.version).toMatchObject({ id: avant.version.id, numero: 1, auteur: 'Chloé Fictif', creeLe: maintenant, utilisee: false });
		expect(apres.zones[0]!.elements.map((e) => e.ref)).toEqual(avant.zones[0]!.elements.slice(1).map((e) => e.ref));
		expect(await base.select().from(ficheVersion).where(eq(ficheVersion.typeId, types.VTU))).toHaveLength(1);
		expect((await base.select().from(journal)).find((j) => j.action === 'modifier_fiche')).toMatchObject({ cibleType: 'type_engin', cibleId: types.VTU });
		// Les autres fiches ne bougent pas.
		expect((await lireFiche(base, types.VSAV)).zones.flatMap((z) => z.elements)).toHaveLength(33);
	});

	it('version déjà utilisée par une prise : gardée telle quelle, la modification crée la version suivante', async () => {
		const { base, referent, types } = await jeuEngins();
		const avant = await lireFiche(base, types.VTU);
		await base.update(ficheVersion).set({ utilisee: 1 }).where(eq(ficheVersion.id, avant.version.id));
		const zone = avant.zones[1]!.ref;
		await modifierFicheEngin(base, referent, types.VTU, { quoi: 'ajouter_element', zone, libelle: 'Tuyau d’aspiration', quantite: 2 }, maintenant);
		const apres = await lireFiche(base, types.VTU);
		expect(apres.version).toMatchObject({ numero: 2, utilisee: false, auteur: 'Rémi Fictif' });
		expect(apres.version.id).not.toBe(avant.version.id);
		expect(apres.zones.map((z) => z.ref)).toEqual(avant.zones.map((z) => z.ref));
		expect(apres.zones[1]!.elements.at(-1)).toMatchObject({ libelle: 'Tuyau d’aspiration', quantite: 2, ref: 73 });
		// L'ancienne version garde son contenu, pour l'historique des prises.
		expect(await base.select().from(ficheElement).where(eq(ficheElement.versionId, avant.version.id))).toHaveLength(15);
		// Une 2e modification réécrit la version 2, encore inutilisée.
		await modifierFicheEngin(base, referent, types.VTU, { quoi: 'renommer_zone', zone, nom: 'Pompes' }, maintenant);
		expect((await lireFiche(base, types.VTU)).version.numero).toBe(2);
		expect(await base.select().from(ficheVersion).where(eq(ficheVersion.typeId, types.VTU))).toHaveLength(2);
	});

	it('lit toutes les fiches en une requête', async () => {
		const { base } = await jeuEngins();
		const avant = base.requetes;
		const fiches = await lireFiches(base);
		expect(base.requetes - avant).toBe(1);
		expect(fiches.map((f) => [f.type, f.version.auteur])).toEqual([['VSAV', 'Fiche de départ'], ['FPT', 'Fiche de départ'], ['VTU', 'Fiche de départ']]);
	});
});

describe('écritures concurrentes', () => {
	it('une fiche réécrite ou utilisée depuis la lecture : l’écriture est refusée, rien ne change', async () => {
		const { base, referent, types } = await jeuEngins();
		const lue = await lireFiche(base, types.VTU);
		const zones = appliquerGeste(lue.zones, { quoi: 'ajouter_zone', nom: 'Toit' }, { zone: 100, element: 100 });
		const ecrire = (fiche: typeof lue) => ecrireOuRefuser(() => base.batch(ecrituresFiche(base, fiche, zones, 'personne:1', maintenant) as never));
		// Quelqu'un d'autre modifie la fiche entre la lecture et l'écriture.
		await modifierFicheEngin(base, referent, types.VTU, { quoi: 'renommer_zone', zone: lue.zones[0]!.ref, nom: 'Poste de conduite' }, maintenant);
		await expect(ecrire(lue)).rejects.toThrow(new DonneeInvalide('Fiche changée entre-temps'));
		expect((await lireFiche(base, types.VTU)).zones.map((z) => z.nom)).toEqual(['Poste de conduite', 'Épuisement', 'Coffres']);
		// Une prise de garde la marque utilisée entre-temps.
		const relue = await lireFiche(base, types.VTU);
		await base.update(ficheVersion).set({ utilisee: 1 }).where(eq(ficheVersion.id, relue.version.id));
		await expect(ecrire(relue)).rejects.toThrow(new DonneeInvalide('Fiche changée entre-temps'));
		expect(await base.select().from(ficheElement).where(eq(ficheElement.versionId, relue.version.id))).toHaveLength(15);
		// Relue à jour, l'écriture passe.
		await ecrire(await lireFiche(base, types.VTU));
		expect((await lireFiche(base, types.VTU)).zones.at(-1)!.nom).toBe('Toit');
	});

	it('un geste sans effet n’écrit rien, même sur une version utilisée', async () => {
		const { base, referent, types } = await jeuEngins();
		const avant = await lireFiche(base, types.VTU);
		await base.update(ficheVersion).set({ utilisee: 1 }).where(eq(ficheVersion.id, avant.version.id));
		await modifierFicheEngin(base, referent, types.VTU, { quoi: 'deplacer_zone', zone: avant.zones[0]!.ref, sens: -1 }, maintenant);
		await modifierFicheEngin(base, referent, types.VTU, { quoi: 'renommer_zone', zone: avant.zones[0]!.ref, nom: 'Cabine' }, maintenant);
		expect(await base.select().from(ficheVersion).where(eq(ficheVersion.typeId, types.VTU))).toHaveLength(1);
		expect((await base.select().from(journal)).filter((j) => j.action === 'modifier_fiche')).toEqual([]);
	});
});

describe('gereLesEngins', () => {
	it('GERER_FICHES sur un comité ne donne pas la flotte', async () => {
		const { base, alice } = await jeuEngins();
		const [membre] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Membre de comité'));
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		await base.insert(responsabiliteDroit).values({ responsabiliteId: membre!.id, droit: 'GERER_FICHES' });
		await base.insert(attribution).values({ personneId: (alice as { id: number }).id, responsabiliteId: membre!.id, perimetreType: 'comite', perimetreId: amicale!.id, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		expect(await gereLesEngins(base, alice, aujourdhui)).toBe(false);
	});
});

describe('creerTypeEngin', () => {
	it('un nouveau type, en majuscules, avec une fiche vide ; pas de doublon', async () => {
		const { base, referent, alice } = await jeuEngins();
		await expect(creerTypeEngin(base, alice, 'CCF', maintenant)).rejects.toBeInstanceOf(RefusDroit);
		const id = await creerTypeEngin(base, referent, ' ccfm ', maintenant);
		expect(await lireFiche(base, id)).toMatchObject({ type: 'CCFM', zones: [], version: { numero: 1 } });
		expect((await lireFiches(base)).map((f) => f.type)).toEqual(['VSAV', 'FPT', 'VTU', 'CCFM']);
		await expect(creerTypeEngin(base, referent, 'vsav', maintenant)).rejects.toThrow(new DonneeInvalide('Type déjà présent'));
		await expect(creerTypeEngin(base, referent, '', maintenant)).rejects.toThrow(new DonneeInvalide('Nom vide'));
		await expect(creerTypeEngin(base, referent, 'VSAV/2', maintenant)).rejects.toThrow(new DonneeInvalide('Caractère interdit dans le type'));
	});
});
