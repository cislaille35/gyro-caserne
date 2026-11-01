import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { aptitudesDe, donnerAptitude, enregistrerAptitude, listerAptitudes, oterAptitude, retirerAptitude, validesLe } from '../src/aptitudes.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { attribution, journal, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-11-01T10:00';

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const nouvelle = async (prenom: string) => (await base.insert(personne).values({ email: `${prenom}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning())[0]!.id;
	const chef = await nouvelle('chef');
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: chef, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const alice = await nouvelle('alice');
	const bruno = await nouvelle('bruno');
	const a = (id: number): Acteur => ({ type: 'personne', id });
	return { base, chef: a(chef), alice: a(alice), bruno: a(bruno) };
}

describe('liste des aptitudes du centre', () => {
	it('les dix du modèle métier par défaut, commandement et conduite contrôlées', async () => {
		const { base } = await jeu();
		const liste = await listerAptitudes(base);
		expect(liste.map((x) => x.nom)).toEqual(['CA2', 'CA1', 'CE', 'COD1', 'COD2', 'INC', 'SAP', 'DIV', 'FDF1', 'FDF2']);
		expect(liste.filter((x) => x.controlee).map((x) => x.nom)).toEqual(['CA2', 'CA1', 'CE', 'COD1', 'COD2']);
	});

	it('ajouter, renommer, retirer : réservé à GERER_LISTES, nom unique, journalisé', async () => {
		const { base, chef, alice } = await jeu();
		await expect(enregistrerAptitude(base, alice, { nom: 'SR', controlee: false }, maintenant)).rejects.toThrow(RefusDroit);
		const id = await enregistrerAptitude(base, chef, { nom: ' SR ', controlee: true }, maintenant);
		await expect(enregistrerAptitude(base, chef, { nom: 'sr', controlee: false }, maintenant)).rejects.toThrow(new DonneeInvalide('Nom déjà utilisé'));
		await enregistrerAptitude(base, chef, { id, nom: 'SR1', controlee: false }, maintenant);
		expect((await listerAptitudes(base)).at(-1)).toMatchObject({ id, nom: 'SR1', controlee: false, ordre: 11 });
		await retirerAptitude(base, chef, id, maintenant);
		expect((await listerAptitudes(base)).some((x) => x.id === id)).toBe(false);
		expect(await base.select().from(journal).where(eq(journal.cibleType, 'aptitude'))).toHaveLength(3);
	});
});

describe('aptitudes d’un agent', () => {
	it('datées ; expirée, elle ne vaut plus ; l’agent voit les siennes seulement', async () => {
		const { base, chef, alice, bruno } = await jeu();
		const [ca1, cod1] = (await listerAptitudes(base)).filter((x) => ['CA1', 'COD1'].includes(x.nom));
		const id = (alice as { id: number }).id;
		await expect(donnerAptitude(base, bruno, id, { aptitudeId: ca1!.id, obtenueLe: '2020-01-01', expireLe: null }, maintenant)).rejects.toThrow(RefusDroit);
		await donnerAptitude(base, chef, id, { aptitudeId: ca1!.id, obtenueLe: '2020-01-01', expireLe: null }, maintenant);
		await donnerAptitude(base, chef, id, { aptitudeId: cod1!.id, obtenueLe: '2020-01-01', expireLe: '2026-10-31' }, maintenant);
		await expect(donnerAptitude(base, chef, id, { aptitudeId: cod1!.id, obtenueLe: '2026-01-01', expireLe: '2025-01-01' }, maintenant)).rejects.toThrow(DonneeInvalide);
		const siennes = await aptitudesDe(base, alice, id, '2026-11-01');
		expect(siennes.map((x) => [x.nom, x.valide])).toEqual([
			['CA1', true],
			['COD1', false]
		]);
		await expect(aptitudesDe(base, bruno, id, '2026-11-01')).rejects.toThrow(RefusDroit);
		await oterAptitude(base, chef, id, cod1!.id, maintenant);
		expect((await aptitudesDe(base, chef, id, '2026-11-01')).map((x) => x.nom)).toEqual(['CA1']);
		expect(await base.select().from(journal).where(eq(journal.action, 'donner_aptitude'))).toHaveLength(2);
	});

	it('validesLe : obtenue avant, pas expirée', () => {
		const lignes = [
			{ aptitudeId: 1, obtenueLe: '2026-01-01', expireLe: null },
			{ aptitudeId: 2, obtenueLe: '2026-12-01', expireLe: null },
			{ aptitudeId: 3, obtenueLe: '2020-01-01', expireLe: '2026-11-01' },
			{ aptitudeId: 4, obtenueLe: '2020-01-01', expireLe: '2026-10-31' }
		];
		expect([...validesLe(lignes, '2026-11-01')]).toEqual([1, 3]);
	});
});
