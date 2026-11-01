import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { armement, enregistrerArmement, lireArmement, postesDe, type Poste } from '../src/armement.ts';
import { RefusDroit, DonneeInvalide } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { aptitude, attribution, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const FPT = { ca2: 1, ca1: 0, ce: 2, cod1: 1, agent: 2 };
const qui = (id: number, ...postes: Poste[]) => ({ id, postes: new Set<Poste>(['agent', ...postes]) });

describe('FPT armé : six postes distincts, une personne par poste', () => {
	it('armé avec un CA tout engins, un conducteur, deux CE et deux agents', () => {
		const equipe = [qui(1, 'ca2', 'ca1', 'ce'), qui(2, 'cod1'), qui(3, 'ce'), qui(4, 'ce'), qui(5), qui(6)];
		expect(armement(FPT, equipe)).toEqual({ arme: true, manque: [] });
	});

	it('une même personne ne tient pas deux postes : le CA conducteur ne conduit pas en plus', () => {
		const equipe = [qui(1, 'ca2', 'ca1', 'ce', 'cod1'), qui(3, 'ce'), qui(4, 'ce'), qui(5), qui(6)];
		expect(armement(FPT, equipe)).toEqual({ arme: false, manque: ['cod1'] });
	});

	it('un plus qualifié tient un poste en dessous : CA en CE, CE en agent', () => {
		const equipe = [qui(1, 'ca2', 'ca1', 'ce'), qui(2, 'ca2', 'ca1', 'ce'), qui(3, 'cod1'), qui(4, 'ce'), qui(5, 'ce'), qui(6, 'ce')];
		expect(armement(FPT, equipe).arme).toBe(true);
	});

	it('cherche la bonne répartition : l’ordre des présents ne compte pas', () => {
		// Le seul CA2 est aussi le seul conducteur possible pour personne d'autre : le calcul ne le gaspille pas en agent.
		const equipe = [qui(5), qui(1, 'ca2', 'ca1', 'ce'), qui(6, 'ce'), qui(2, 'cod1', 'ce'), qui(4, 'ce'), qui(3)];
		expect(armement(FPT, equipe).arme).toBe(true);
	});

	it('trop peu de monde : ce qui manque, du plus qualifié au moins', () => {
		expect(armement(FPT, [qui(2, 'cod1'), qui(5)])).toEqual({ arme: false, manque: ['ca2', 'ce', 'ce', 'agent'] });
	});

	it('les postes d’un agent selon ses aptitudes : le COD2 tient le poste COD1, le CA1 tient CE', () => {
		const niveaux = { ca2: 1, ca1: 2, ce: 3, cod1: 4, cod2: 5 };
		expect([...postesDe(niveaux, new Set([5]))].sort()).toEqual(['agent', 'cod1']);
		expect([...postesDe(niveaux, new Set([2]))].sort()).toEqual(['agent', 'ca1', 'ce']);
		expect([...postesDe(niveaux, new Set([1, 4]))].sort()).toEqual(['agent', 'ca1', 'ca2', 'ce', 'cod1']);
		expect([...postesDe({ ...niveaux, cod2: null }, new Set([5]))]).toEqual(['agent']);
	});
});

describe('réglages de l’armement', () => {
	async function jeu() {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
		const [p] = await base.insert(personne).values({ email: 'chef@exemple.fr', prenom: 'Chef', nom: 'Test', profilId: agent!.id }).returning();
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
		await base.insert(attribution).values({ personneId: p!.id, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const [a] = await base.insert(personne).values({ email: 'alice@exemple.fr', prenom: 'Alice', nom: 'Test', profilId: agent!.id }).returning();
		const id = async (nom: string) => (await base.select().from(aptitude).where(eq(aptitude.nom, nom)))[0]!.id;
		return { base, chef: { type: 'personne', id: p!.id } as const, alice: { type: 'personne', id: a!.id } as const, id };
	}

	it('par défaut : VSAV, VTU et FPT ; les niveaux reliés aux aptitudes du même nom', async () => {
		const { base, id } = await jeu();
		const r = await lireArmement(base);
		expect(r.engins).toEqual([
			{ nom: 'VSAV', postes: { ca2: 0, ca1: 1, ce: 1, cod1: 0, agent: 1 } },
			{ nom: 'VTU', postes: { ca2: 0, ca1: 1, ce: 1, cod1: 0, agent: 1 } },
			{ nom: 'FPT', postes: FPT }
		]);
		expect(r.niveaux).toEqual({ ca2: await id('CA2'), ca1: await id('CA1'), ce: await id('CE'), cod1: await id('COD1'), cod2: await id('COD2') });
	});

	it('enregistrés par qui gère les listes ; refus sinon ; valeurs contrôlées', async () => {
		const { base, chef, alice, id } = await jeu();
		const r = await lireArmement(base);
		const voulu = { engins: r.engins.map((e) => (e.nom === 'FPT' ? { ...e, postes: { ...e.postes, agent: 3 } } : e)), niveaux: { ...r.niveaux, cod2: null } };
		await expect(enregistrerArmement(base, alice, voulu, '2026-11-01T10:00')).rejects.toThrow(RefusDroit);
		await enregistrerArmement(base, chef, voulu, '2026-11-01T10:00');
		expect(await lireArmement(base)).toEqual(voulu);
		await expect(enregistrerArmement(base, chef, { ...voulu, niveaux: { ...voulu.niveaux, ce: 9999 } }, '2026-11-01T10:00')).rejects.toThrow(DonneeInvalide);
		await expect(enregistrerArmement(base, chef, { ...voulu, engins: [{ nom: 'FPT', postes: { ...FPT, agent: 12 } }] }, '2026-11-01T10:00')).rejects.toThrow(DonneeInvalide);
		expect(await id('CE')).toBeGreaterThan(0);
	});
});
