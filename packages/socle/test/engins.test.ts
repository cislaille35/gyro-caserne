import { describe, expect, it } from 'vitest';
import { enregistrerEngin, lireEngin, listerEngins, voitLesEngins } from '../src/engins.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { gereLesEngins } from '../src/fiches.ts';
import { journal } from '../src/schema.ts';
import { aujourdhui, jeuEngins, maintenant } from './de-test-engins.ts';

const saisie = (typeId: number, nom: string, plus: Partial<{ immatriculation: string; situation: 'centre' | 'prete' | 'parti'; provenance: string }> = {}) => ({
	nom,
	typeId,
	immatriculation: '',
	situation: 'centre' as const,
	provenance: '',
	...plus
});

describe('droits sur les engins', () => {
	it('tout agent voit ; le chef de garde (sur son équipe), le référent engins et le super administrateur gèrent', async () => {
		const { base, alice, chefDeGarde, referent, sansProfil, superAdmin } = await jeuEngins();
		expect(await voitLesEngins(base, alice, aujourdhui)).toBe(true);
		expect(await gereLesEngins(base, alice, aujourdhui)).toBe(false);
		for (const a of [chefDeGarde, referent, superAdmin]) expect(await gereLesEngins(base, a, aujourdhui)).toBe(true);
		expect(await voitLesEngins(base, sansProfil, aujourdhui)).toBe(false);
		await expect(listerEngins(base, sansProfil, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('un agent ne crée ni ne modifie d’engin', async () => {
		const { base, alice, types } = await jeuEngins();
		await expect(enregistrerEngin(base, alice, saisie(types.VSAV, 'VSAV 1'), maintenant)).rejects.toBeInstanceOf(RefusDroit);
	});
});

describe('enregistrerEngin', () => {
	it('crée un engin, le journalise, et le range par type puis par nom', async () => {
		const { base, referent, alice, types } = await jeuEngins();
		await enregistrerEngin(base, referent, saisie(types.VTU, 'VTU'), maintenant);
		await enregistrerEngin(base, referent, saisie(types.VSAV, ' VSAV  10 ', { immatriculation: 'ab-123-cd' }), maintenant);
		await enregistrerEngin(base, referent, saisie(types.VSAV, 'VSAV 2'), maintenant);
		const { engins, gere } = await listerEngins(base, alice, aujourdhui);
		expect(gere).toBe(false);
		expect(engins.map((e) => [e.nom, e.type, e.immatriculation, e.situation, e.etat])).toEqual([
			['VSAV 2', 'VSAV', null, 'centre', 'disponible'],
			['VSAV 10', 'VSAV', 'AB-123-CD', 'centre', 'disponible'],
			['VTU', 'VTU', null, 'centre', 'disponible']
		]);
		expect((await base.select().from(journal)).filter((j) => j.action === 'ajouter_engin')).toHaveLength(3);
	});

	it('un engin prêté au centre dit par qui', async () => {
		const { base, chefDeGarde, types } = await jeuEngins();
		await expect(enregistrerEngin(base, chefDeGarde, saisie(types.VSAV, 'VSAV 23', { situation: 'prete' }), maintenant)).rejects.toThrow(new DonneeInvalide('Provenance vide'));
		const id = await enregistrerEngin(base, chefDeGarde, saisie(types.VSAV, 'VSAV 23', { situation: 'prete', provenance: 'CIS Exemple-Nord' }), maintenant);
		const { engin } = await lireEngin(base, chefDeGarde, id, aujourdhui);
		expect(engin).toMatchObject({ situation: 'prete', provenance: 'CIS Exemple-Nord', partiLe: null });
	});

	it('deux engins présents n’ont pas le même nom ; un engin parti libère le sien et garde sa date de départ', async () => {
		const { base, referent, types } = await jeuEngins();
		const id = await enregistrerEngin(base, referent, saisie(types.VSAV, 'VSAV 1'), maintenant);
		await expect(enregistrerEngin(base, referent, saisie(types.VSAV, 'vsav 1'), maintenant)).rejects.toThrow(new DonneeInvalide('Nom déjà utilisé'));
		await enregistrerEngin(base, referent, { id, ...saisie(types.VSAV, 'VSAV 1', { situation: 'parti' }) }, maintenant);
		await enregistrerEngin(base, referent, { id, ...saisie(types.VSAV, 'VSAV 1', { situation: 'parti' }) }, '2026-12-01T08:00');
		expect((await lireEngin(base, referent, id, aujourdhui)).engin).toMatchObject({ situation: 'parti', partiLe: aujourdhui });
		const nouveau = await enregistrerEngin(base, referent, saisie(types.VSAV, 'VSAV 1'), maintenant);
		expect(nouveau).not.toBe(id);
		// Revenir au centre : refusé tant que le nom est pris ; sinon, la date de départ s'efface.
		await expect(enregistrerEngin(base, referent, { id, ...saisie(types.VSAV, 'VSAV 1') }, maintenant)).rejects.toThrow(new DonneeInvalide('Nom déjà utilisé'));
		await enregistrerEngin(base, referent, { id, ...saisie(types.VSAV, 'VSAV 1 bis') }, maintenant);
		expect((await lireEngin(base, referent, id, aujourdhui)).engin).toMatchObject({ situation: 'centre', partiLe: null, nom: 'VSAV 1 bis' });
	});

	it('refuse un nom vide ou trop long, un type ou un engin inconnu', async () => {
		const { base, referent, types } = await jeuEngins();
		await expect(enregistrerEngin(base, referent, saisie(types.VSAV, '  '), maintenant)).rejects.toThrow(new DonneeInvalide('Nom vide'));
		await expect(enregistrerEngin(base, referent, saisie(types.VSAV, 'x'.repeat(31)), maintenant)).rejects.toThrow(new DonneeInvalide('Nom trop long'));
		await expect(enregistrerEngin(base, referent, saisie(999, 'X'), maintenant)).rejects.toThrow(new DonneeInvalide('Type inconnu'));
		await expect(enregistrerEngin(base, referent, { id: 999, ...saisie(types.VSAV, 'X') }, maintenant)).rejects.toThrow(new DonneeInvalide('Engin inconnu'));
		await expect(lireEngin(base, referent, 999, aujourdhui)).rejects.toThrow(new DonneeInvalide('Engin inconnu'));
	});
});

describe('chargerEnginsFictifs', () => {
	it('quatre engins fictifs, dont un prêté ; relancé, sans doublon', async () => {
		const { chargerEnginsFictifs } = await import('../src/engins.ts');
		const { base, alice } = await jeuEngins();
		await chargerEnginsFictifs(base, maintenant);
		await chargerEnginsFictifs(base, maintenant);
		const { engins } = await listerEngins(base, alice, aujourdhui);
		expect(engins.map((e) => [e.nom, e.situation])).toEqual([
			['VSAV 1', 'centre'],
			['VSAV 23', 'prete'],
			['FPT', 'centre'],
			['VTU', 'centre']
		]);
	});
});
