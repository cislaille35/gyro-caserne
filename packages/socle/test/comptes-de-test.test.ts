import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { acteurDe } from '../src/connexion.ts';
import { chargerComptesDeTest, COMPTES_DE_TEST } from '../src/comptes-de-test.ts';
import { DonneeInvalide } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { mursDe } from '../src/murs.ts';
import { personne, publication } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-10-29T10:00';
const aujourdhui = '2026-10-29';

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	await chargerComptesDeTest(base, 'caserne@exemple.fr', maintenant);
	return base;
}

async function mursDuCompte(base: Awaited<ReturnType<typeof baseDeTest>>, role: string) {
	const acteur = await acteurDe(base, `caserne+${role}@exemple.fr`, []);
	expect(acteur).not.toBeNull();
	return mursDe(base, acteur!, aujourdhui);
}

describe('chargerComptesDeTest', () => {
	it('crée un compte par profil, à l’adresse boîte+rôle', async () => {
		const base = await jeu();
		const adresses = (await base.select({ email: personne.email }).from(personne)).map((p) => p.email).sort();
		expect(adresses).toEqual(COMPTES_DE_TEST.map((c) => `caserne+${c.role}@exemple.fr`).sort());
		for (const c of COMPTES_DE_TEST) expect(await acteurDe(base, `caserne+${c.role}@exemple.fr`, [])).not.toBeNull();
	});

	it('donne à chaque compte les murs de son profil', async () => {
		const base = await jeu();
		const cles = async (role: string) => (await mursDuCompte(base, role)).map((m) => m.cle);
		expect((await cles('chef')).length).toBe(7);
		expect(await cles('agent')).toEqual(['centre', 'vie', 'equipe:1']);
		expect(await cles('exterieur')).toEqual([]);
		const amicale = (await mursDuCompte(base, 'rapporteur')).find((m) => m.nom === 'Amicale');
		expect(amicale?.peutModerer).toBe(true);
		const equipe1 = (await mursDuCompte(base, 'chef-equipe')).find((m) => m.cle === 'equipe:1');
		expect(equipe1?.peutModerer).toBe(true);
	});

	it('remplit les murs avec chaque sorte de publication', async () => {
		const base = await jeu();
		const pubs = await base.select().from(publication);
		expect(new Set(pubs.map((p) => p.mur.split(':')[0]))).toEqual(new Set(['centre', 'vie', 'equipe', 'comite']));
		expect(new Set(pubs.map((p) => p.type))).toEqual(new Set(['message', 'annonce', 'evenement', 'bravo']));
		expect(pubs.some((p) => p.priseDeConnaissance === 1 && p.epinglee === 1)).toBe(true);
		expect(pubs.some((p) => p.sondageQuestion !== null)).toBe(true);
		expect(pubs.filter((p) => p.type === 'evenement').every((p) => p.debut! > maintenant)).toBe(true);
	});

	it('ne fait rien la deuxième fois', async () => {
		const base = await jeu();
		const avant = (await base.select().from(publication)).length;
		await chargerComptesDeTest(base, 'caserne@exemple.fr', maintenant);
		expect((await base.select().from(publication)).length).toBe(avant);
		expect((await base.select().from(personne).where(eq(personne.email, 'caserne+chef@exemple.fr'))).length).toBe(1);
	});

	it('refuse une boîte mal écrite', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		for (const boite of ['', 'caserne', 'caserne+chef@exemple.fr', 'a@b@c.fr']) await expect(chargerComptesDeTest(base, boite, maintenant)).rejects.toThrow(DonneeInvalide);
	});
});
