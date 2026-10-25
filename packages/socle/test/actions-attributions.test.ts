import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { attribuer, finirAttribution, modifierDroitsResponsabilite } from '../src/actions/attributions.ts';
import { aLeDroit, type Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { attribution, comite, equipe, journal, personne, profil, responsabilite, responsabiliteDroit } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-25';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

async function jeu() {
	const base = await baseDeTest();
	await base.insert(equipe).values([
		{ nom: 'A', couleur: 'rouge', ordreRotation: 1 },
		{ nom: 'B', couleur: 'bleu', ordreRotation: 2 }
	]);
	const [amicale] = await base.insert(comite).values({ nom: 'Amicale', theme: 'vie' }).returning();
	const [bureau] = await base.insert(comite).values({ nom: 'Bureau', theme: 'direction' }).returning();
	const [agent] = await base.insert(profil).values({ nom: 'Agent', typePersonne: 'agent' }).returning();
	const [chefCentre] = await base.insert(responsabilite).values({ nom: 'Chef de centre', nature: 'fonction', typePerimetre: 'centre', systeme: 'chef_centre' }).returning();
	const [chefEquipe] = await base
		.insert(responsabilite)
		.values({ nom: 'Chef d’équipe', nature: 'fonction', typePerimetre: 'equipe', systeme: 'chef_equipe', comiteAttributeurId: bureau!.id })
		.returning();
	const [rapporteur] = await base.insert(responsabilite).values({ nom: 'Rapporteur', nature: 'mission', typePerimetre: 'comite' }).returning();
	await base.insert(responsabiliteDroit).values([
		{ responsabiliteId: rapporteur!.id, droit: 'ATTRIBUER_RESPONSABILITE' },
		{ responsabiliteId: chefEquipe!.id, droit: 'VALIDER_REMPLACEMENT', verrouille: 1 },
		{ responsabiliteId: chefEquipe!.id, droit: 'VOIR_MOTIFS_ABSENCE' }
	]);
	const nouvelle = async (email: string) => (await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId: agent!.id }).returning())[0]!.id;
	return { base, amicale: amicale!, bureau: bureau!, chefCentre: chefCentre!, chefEquipe: chefEquipe!, rapporteur: rapporteur!, nouvelle };
}

describe('attribuer', () => {
	it('seul le super administrateur nomme le chef de centre', async () => {
		const { base, chefCentre, rapporteur, amicale, nouvelle } = await jeu();
		const rapp = await nouvelle('rapp@exemple.fr');
		await attribuer(base, superAdmin, { personneId: rapp, responsabiliteId: rapporteur.id, perimetre: { type: 'comite', id: amicale.id }, debut: '2026-01-01' }, aujourdhui);
		const cible = await nouvelle('cible@exemple.fr');
		const demande = { personneId: cible, responsabiliteId: chefCentre.id, perimetre: { type: 'centre' as const }, debut: aujourdhui };
		await expect(attribuer(base, { type: 'personne', id: rapp }, demande, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		const id = await attribuer(base, superAdmin, demande, aujourdhui);
		const [ligne] = await base.select().from(attribution).where(eq(attribution.id, id));
		expect(ligne).toMatchObject({ personneId: cible, perimetreType: 'centre', perimetreId: null, saisiePar: 'super:admin@exemple.fr', saisieLe: aujourdhui });
	});

	it('le rapporteur de l’amicale ne peut pas nommer un chef d’équipe', async () => {
		const { base, chefEquipe, rapporteur, amicale, bureau, nouvelle } = await jeu();
		const rappAmicale = await nouvelle('amicale@exemple.fr');
		const rappBureau = await nouvelle('bureau@exemple.fr');
		await attribuer(base, superAdmin, { personneId: rappAmicale, responsabiliteId: rapporteur.id, perimetre: { type: 'comite', id: amicale.id }, debut: '2026-01-01' }, aujourdhui);
		await attribuer(base, superAdmin, { personneId: rappBureau, responsabiliteId: rapporteur.id, perimetre: { type: 'comite', id: bureau.id }, debut: '2026-01-01' }, aujourdhui);
		const cible = await nouvelle('cible@exemple.fr');
		const demande = { personneId: cible, responsabiliteId: chefEquipe.id, perimetre: { type: 'equipe' as const, id: 1 }, debut: aujourdhui };
		await expect(attribuer(base, { type: 'personne', id: rappAmicale }, demande, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(attribuer(base, { type: 'personne', id: rappBureau }, demande, aujourdhui)).resolves.toBeTypeOf('number');
	});

	it('refuse un chef d’équipe nommé par le rapporteur d’un comité sans pouvoir sur lui', async () => {
		const { base, chefEquipe, nouvelle } = await jeu();
		const simple = await nouvelle('simple@exemple.fr');
		const cible = await nouvelle('cible@exemple.fr');
		await expect(
			attribuer(base, { type: 'personne', id: simple }, { personneId: cible, responsabiliteId: chefEquipe.id, perimetre: { type: 'equipe', id: 1 }, debut: aujourdhui }, aujourdhui)
		).rejects.toMatchObject({ droit: 'ATTRIBUER_RESPONSABILITE', perimetre: { type: 'comite' } });
	});

	it('refuse un périmètre qui ne correspond pas à la responsabilité', async () => {
		const { base, chefEquipe, nouvelle } = await jeu();
		const cible = await nouvelle('cible@exemple.fr');
		await expect(attribuer(base, superAdmin, { personneId: cible, responsabiliteId: chefEquipe.id, perimetre: { type: 'centre' }, debut: aujourdhui }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('refuse une personne, une responsabilité ou des dates invalides', async () => {
		const { base, chefEquipe, nouvelle } = await jeu();
		const cible = await nouvelle('cible@exemple.fr');
		const ok = { personneId: cible, responsabiliteId: chefEquipe.id, perimetre: { type: 'equipe' as const, id: 1 }, debut: '2026-05-01' };
		await expect(attribuer(base, superAdmin, { ...ok, personneId: 99 }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(attribuer(base, superAdmin, { ...ok, responsabiliteId: 99 }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(attribuer(base, superAdmin, { ...ok, fin: '2026-04-30' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(attribuer(base, superAdmin, { ...ok, perimetre: { type: 'equipe', id: 99 } }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('finirAttribution', () => {
	it('clôt une attribution avec les mêmes droits que attribuer', async () => {
		const { base, chefEquipe, nouvelle } = await jeu();
		const cible = await nouvelle('cible@exemple.fr');
		const simple = await nouvelle('simple@exemple.fr');
		const id = await attribuer(base, superAdmin, { personneId: cible, responsabiliteId: chefEquipe.id, perimetre: { type: 'equipe', id: 1 }, debut: '2026-01-01' }, aujourdhui);
		await expect(finirAttribution(base, { type: 'personne', id: simple }, id, '2026-10-31', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(finirAttribution(base, superAdmin, id, '2025-12-31', aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(finirAttribution(base, superAdmin, 99, '2026-10-31', aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await finirAttribution(base, superAdmin, id, '2026-10-31', aujourdhui);
		const [ligne] = await base.select().from(attribution).where(eq(attribution.id, id));
		expect(ligne!.fin).toBe('2026-10-31');
		expect(await aLeDroit(base, { type: 'personne', id: cible }, 'VALIDER_REMPLACEMENT', { type: 'equipe', id: 1 }, '2026-11-01')).toBe(false);
	});
});

describe('modifierDroitsResponsabilite', () => {
	it('remplace les droits non verrouillés', async () => {
		const { base, chefEquipe } = await jeu();
		await modifierDroitsResponsabilite(base, superAdmin, chefEquipe.id, ['VALIDER_REMPLACEMENT', 'GERER_PLANNING'], aujourdhui);
		const lignes = await base.select().from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, chefEquipe.id));
		expect(lignes.map((l) => l.droit).sort()).toEqual(['GERER_PLANNING', 'VALIDER_REMPLACEMENT']);
	});

	it('refuse de retirer un droit verrouillé', async () => {
		const { base, chefEquipe } = await jeu();
		await expect(modifierDroitsResponsabilite(base, superAdmin, chefEquipe.id, ['GERER_PLANNING'], aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		const lignes = await base.select().from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, chefEquipe.id));
		expect(lignes).toHaveLength(2);
	});

	it('exige GERER_LISTES sur le centre et une responsabilité connue', async () => {
		const { base, chefEquipe, nouvelle } = await jeu();
		const simple = await nouvelle('simple@exemple.fr');
		await expect(modifierDroitsResponsabilite(base, { type: 'personne', id: simple }, chefEquipe.id, ['VALIDER_REMPLACEMENT'], aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(modifierDroitsResponsabilite(base, superAdmin, 99, [], aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('journal', () => {
	it('chaque action écrit une ligne de journal', async () => {
		const { base, chefEquipe, nouvelle } = await jeu();
		const cible = await nouvelle('cible@exemple.fr');
		const id = await attribuer(base, superAdmin, { personneId: cible, responsabiliteId: chefEquipe.id, perimetre: { type: 'equipe', id: 1 }, debut: aujourdhui }, aujourdhui);
		await finirAttribution(base, superAdmin, id, '2026-12-31', aujourdhui);
		await modifierDroitsResponsabilite(base, superAdmin, chefEquipe.id, ['VALIDER_REMPLACEMENT'], aujourdhui);
		const lignes = await base.select().from(journal);
		expect(lignes.map((l) => [l.action, l.cibleType, l.cibleId])).toEqual([
			['attribuer', 'attribution', id],
			['finir_attribution', 'attribution', id],
			['modifier_droits_responsabilite', 'responsabilite', chefEquipe.id]
		]);
	});
});
