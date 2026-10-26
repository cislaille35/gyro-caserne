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

	it('refuse un acteur sans responsabilité, en visant le comité attributeur', async () => {
		const { base, chefEquipe, nouvelle } = await jeu();
		const simple = await nouvelle('simple@exemple.fr');
		const cible = await nouvelle('cible@exemple.fr');
		await expect(
			attribuer(base, { type: 'personne', id: simple }, { personneId: cible, responsabiliteId: chefEquipe.id, perimetre: { type: 'equipe', id: 1 }, debut: aujourdhui }, aujourdhui)
		).rejects.toMatchObject({ droit: 'ATTRIBUER_RESPONSABILITE', perimetre: { type: 'comite' } });
	});

	it('sans comité attributeur : le centre pour une équipe, le comité visé pour un comité', async () => {
		const { base, rapporteur, amicale, nouvelle } = await jeu();
		const [libre] = await base.insert(responsabilite).values({ nom: 'Libre', nature: 'mission', typePerimetre: 'equipe' }).returning();
		const cible = await nouvelle('cible@exemple.fr');
		const rapp = await nouvelle('rapp@exemple.fr');
		const autre = await nouvelle('autre@exemple.fr');
		await attribuer(base, superAdmin, { personneId: rapp, responsabiliteId: rapporteur.id, perimetre: { type: 'comite', id: amicale.id }, debut: '2026-01-01' }, aujourdhui);
		await expect(attribuer(base, { type: 'personne', id: rapp }, { personneId: cible, responsabiliteId: libre!.id, perimetre: { type: 'equipe', id: 1 }, debut: aujourdhui }, aujourdhui)).rejects.toMatchObject({ perimetre: { type: 'centre' } });
		await expect(attribuer(base, { type: 'personne', id: rapp }, { personneId: cible, responsabiliteId: rapporteur.id, perimetre: { type: 'comite', id: amicale.id }, debut: aujourdhui }, aujourdhui)).resolves.toBeTypeOf('number');
		const [autreComite] = await base.insert(comite).values({ nom: 'Autre', theme: 'x' }).returning();
		await expect(attribuer(base, { type: 'personne', id: autre }, { personneId: cible, responsabiliteId: rapporteur.id, perimetre: { type: 'comite', id: autreComite!.id }, debut: aujourdhui }, aujourdhui)).rejects.toMatchObject({ perimetre: { type: 'comite', id: autreComite!.id } });
	});

	it('enregistre un périmètre centre sans identifiant et refuse une date invalide', async () => {
		const { base, chefCentre, nouvelle } = await jeu();
		const cible = await nouvelle('cible@exemple.fr');
		const id = await attribuer(base, superAdmin, { personneId: cible, responsabiliteId: chefCentre.id, perimetre: { type: 'centre', id: 7 } as never, debut: aujourdhui }, aujourdhui);
		const [ligne] = await base.select().from(attribution).where(eq(attribution.id, id));
		expect(ligne!.perimetreId).toBeNull();
		await expect(attribuer(base, superAdmin, { personneId: cible, responsabiliteId: chefCentre.id, perimetre: { type: 'centre' }, debut: aujourdhui, fin: '9' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
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

describe('finirAttribution (suite)', () => {
	it('ne peut que raccourcir', async () => {
		const { base, chefEquipe, nouvelle } = await jeu();
		const cible = await nouvelle('cible@exemple.fr');
		const id = await attribuer(base, superAdmin, { personneId: cible, responsabiliteId: chefEquipe.id, perimetre: { type: 'equipe', id: 1 }, debut: '2026-01-01', fin: '2026-12-31' }, aujourdhui);
		await expect(finirAttribution(base, superAdmin, id, '2027-01-31', aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(finirAttribution(base, superAdmin, id, '2026-11-30', aujourdhui)).resolves.toBeUndefined();
	});

	it('seul le super administrateur clôt un chef de centre', async () => {
		const { base, chefCentre, rapporteur, amicale, nouvelle } = await jeu();
		const cible = await nouvelle('cible@exemple.fr');
		const rapp = await nouvelle('rapp@exemple.fr');
		await attribuer(base, superAdmin, { personneId: rapp, responsabiliteId: rapporteur.id, perimetre: { type: 'comite', id: amicale.id }, debut: '2026-01-01' }, aujourdhui);
		const id = await attribuer(base, superAdmin, { personneId: cible, responsabiliteId: chefCentre.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhui);
		await expect(finirAttribution(base, { type: 'personne', id: rapp }, id, '2026-11-30', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(finirAttribution(base, superAdmin, id, '2026-11-30', aujourdhui)).resolves.toBeUndefined();
	});
});

describe('chef de centre adjoint', () => {
	async function avecAdjoint() {
		const j = await jeu();
		const [adjoint] = await j.base.insert(responsabilite).values({ nom: 'Chef de centre adjoint', nature: 'fonction', typePerimetre: 'centre', systeme: 'chef_centre_adjoint' }).returning();
		await j.base.insert(responsabiliteDroit).values([
			{ responsabiliteId: j.chefCentre.id, droit: 'ATTRIBUER_RESPONSABILITE' },
			{ responsabiliteId: adjoint!.id, droit: 'ATTRIBUER_RESPONSABILITE' }
		]);
		const chef = await j.nouvelle('chef@exemple.fr');
		await attribuer(j.base, superAdmin, { personneId: chef, responsabiliteId: j.chefCentre.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhui);
		const nommer = (personneId: number) => ({ personneId, responsabiliteId: adjoint!.id, perimetre: { type: 'centre' as const }, debut: aujourdhui });
		return { ...j, adjoint: adjoint!, chef: { type: 'personne', id: chef } as Acteur, nommer };
	}

	it('le chef de centre nomme et retire un adjoint', async () => {
		const { base, chef, nommer, nouvelle } = await avecAdjoint();
		const id = await attribuer(base, chef, nommer(await nouvelle('adj@exemple.fr')), aujourdhui);
		await expect(finirAttribution(base, chef, id, '2026-12-31', aujourdhui)).resolves.toBeUndefined();
	});

	it('un adjoint ne nomme ni ne retire un adjoint, malgré ATTRIBUER_RESPONSABILITE sur le centre', async () => {
		const { base, chef, nommer, nouvelle } = await avecAdjoint();
		const adj = await nouvelle('adj@exemple.fr');
		const id = await attribuer(base, chef, nommer(adj), aujourdhui);
		const acteur: Acteur = { type: 'personne', id: adj };
		expect(await aLeDroit(base, acteur, 'ATTRIBUER_RESPONSABILITE', { type: 'centre' }, aujourdhui)).toBe(true);
		await expect(attribuer(base, acteur, nommer(await nouvelle('autre@exemple.fr')), aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(finirAttribution(base, acteur, id, '2026-12-31', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('un ancien chef de centre ne nomme plus d’adjoint', async () => {
		const { base, chefCentre, nommer, nouvelle } = await avecAdjoint();
		const ancien = await nouvelle('ancien@exemple.fr');
		await attribuer(base, superAdmin, { personneId: ancien, responsabiliteId: chefCentre.id, perimetre: { type: 'centre' }, debut: '2025-01-01', fin: '2025-12-31' }, aujourdhui);
		await expect(attribuer(base, { type: 'personne', id: ancien }, nommer(await nouvelle('adj@exemple.fr')), aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('le super administrateur nomme et retire un adjoint', async () => {
		const { base, nommer, nouvelle } = await avecAdjoint();
		const id = await attribuer(base, superAdmin, nommer(await nouvelle('adj@exemple.fr')), aujourdhui);
		await expect(finirAttribution(base, superAdmin, id, '2026-12-31', aujourdhui)).resolves.toBeUndefined();
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

	it('refuse un droit inconnu', async () => {
		const { base, chefEquipe } = await jeu();
		await expect(modifierDroitsResponsabilite(base, superAdmin, chefEquipe.id, ['VALIDER_REMPLACEMENT', 'N_IMPORTE_QUOI' as never], aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
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
