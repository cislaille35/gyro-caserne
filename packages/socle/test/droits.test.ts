import { describe, expect, it } from 'vitest';
import { aLeDroit, couvre, droitsDe, type Acteur } from '../src/droits.ts';
import { attribution, equipe, personne, profil, profilDroit, responsabilite, responsabiliteDroit } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const centre = { type: 'centre' } as const;
const equipe1 = { type: 'equipe', id: 1 } as const;
const equipe2 = { type: 'equipe', id: 2 } as const;
const aujourdhui = '2026-10-25';

async function jeuDeDonnees() {
	const base = await baseDeTest();
	await base.insert(equipe).values([
		{ nom: 'A', couleur: 'rouge', ordreRotation: 1 },
		{ nom: 'B', couleur: 'bleu', ordreRotation: 2 }
	]);
	const [agent] = await base.insert(profil).values({ nom: 'Agent', typePersonne: 'agent' }).returning();
	const [exterieur] = await base.insert(profil).values({ nom: 'Extérieur', typePersonne: 'exterieur' }).returning();
	await base.insert(profilDroit).values([
		{ profilId: agent!.id, droit: 'VOIR_PLANNING', perimetreType: 'centre' },
		{ profilId: exterieur!.id, droit: 'VOIR_ANNUAIRE', perimetreType: 'centre' }
	]);
	const [chefEquipe] = await base.insert(responsabilite).values({ nom: 'Chef d’équipe', nature: 'fonction', typePerimetre: 'equipe' }).returning();
	const [chefCentre] = await base.insert(responsabilite).values({ nom: 'Chef de centre', nature: 'fonction', typePerimetre: 'centre' }).returning();
	await base.insert(responsabiliteDroit).values([
		{ responsabiliteId: chefEquipe!.id, droit: 'VALIDER_REMPLACEMENT' },
		{ responsabiliteId: chefCentre!.id, droit: 'GERER_ACCES' }
	]);
	const nouvelle = async (email: string, profilId: number | null, statut: 'operationnel' | 'suspendu' = 'operationnel') => {
		const [p] = await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId, statut }).returning();
		return p!.id;
	};
	const attribuer = (personneId: number, responsabiliteId: number, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }, debut: string, fin: string | null = null) =>
		base.insert(attribution).values({
			personneId,
			responsabiliteId,
			perimetreType: perimetre.type,
			perimetreId: perimetre.id ?? null,
			debut,
			fin,
			saisiePar: 'super:a@b.fr',
			saisieLe: '2026-01-01'
		});
	return { base, agent: agent!, exterieur: exterieur!, chefEquipe: chefEquipe!, chefCentre: chefCentre!, nouvelle, attribuer };
}

const personneActeur = (id: number): Acteur => ({ type: 'personne', id });

describe('couvre', () => {
	it('le centre couvre tout', () => {
		expect(couvre(centre, equipe1)).toBe(true);
		expect(couvre(centre, centre)).toBe(true);
	});
	it('un autre périmètre ne couvre que lui-même', () => {
		expect(couvre(equipe1, equipe1)).toBe(true);
		expect(couvre(equipe1, equipe2)).toBe(false);
		expect(couvre(equipe1, centre)).toBe(false);
		expect(couvre({ type: 'comite', id: 1 }, equipe1)).toBe(false);
	});
});

describe('aLeDroit', () => {
	it('le super administrateur a tous les droits', async () => {
		const { base } = await jeuDeDonnees();
		expect(await aLeDroit(base, { type: 'super', email: 'a@b.fr' }, 'GERER_ACCES', equipe2, aujourdhui)).toBe(true);
	});

	it('donne un droit du profil', async () => {
		const { base, agent, nouvelle } = await jeuDeDonnees();
		const id = await nouvelle('a@x.fr', agent.id);
		expect(await aLeDroit(base, personneActeur(id), 'VOIR_PLANNING', centre, aujourdhui)).toBe(true);
	});

	it('un droit sur le centre couvre une équipe', async () => {
		const { base, agent, nouvelle } = await jeuDeDonnees();
		const id = await nouvelle('a@x.fr', agent.id);
		expect(await aLeDroit(base, personneActeur(id), 'VOIR_PLANNING', equipe2, aujourdhui)).toBe(true);
	});

	it('un droit sur une équipe ne couvre pas une autre équipe', async () => {
		const { base, agent, chefEquipe, nouvelle, attribuer } = await jeuDeDonnees();
		const id = await nouvelle('a@x.fr', agent.id);
		await attribuer(id, chefEquipe.id, { type: 'equipe', id: 1 }, '2026-01-01');
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', equipe1, aujourdhui)).toBe(true);
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', equipe2, aujourdhui)).toBe(false);
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', centre, aujourdhui)).toBe(false);
	});

	it('un droit sur un comité couvre ce comité seulement', async () => {
		const { base, agent, chefEquipe, nouvelle, attribuer } = await jeuDeDonnees();
		const id = await nouvelle('a@x.fr', agent.id);
		await attribuer(id, chefEquipe.id, { type: 'comite', id: 1 }, '2026-01-01');
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', { type: 'comite', id: 1 }, aujourdhui)).toBe(true);
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', { type: 'comite', id: 2 }, aujourdhui)).toBe(false);
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', equipe1, aujourdhui)).toBe(false);
	});

	it('une attribution qui finit aujourd’hui vaut encore aujourd’hui', async () => {
		const { base, agent, chefEquipe, nouvelle, attribuer } = await jeuDeDonnees();
		const id = await nouvelle('a@x.fr', agent.id);
		await attribuer(id, chefEquipe.id, { type: 'equipe', id: 1 }, '2026-01-01', aujourdhui);
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', equipe1, aujourdhui)).toBe(true);
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', equipe1, '2026-10-26')).toBe(false);
	});

	it('une attribution qui commence demain ne vaut pas encore', async () => {
		const { base, agent, chefEquipe, nouvelle, attribuer } = await jeuDeDonnees();
		const id = await nouvelle('a@x.fr', agent.id);
		await attribuer(id, chefEquipe.id, { type: 'equipe', id: 1 }, '2026-10-26');
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', equipe1, aujourdhui)).toBe(false);
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', equipe1, '2026-10-26')).toBe(true);
	});

	it('un agent suspendu n’a plus aucun droit', async () => {
		const { base, agent, chefCentre, nouvelle, attribuer } = await jeuDeDonnees();
		const id = await nouvelle('a@x.fr', agent.id, 'suspendu');
		await attribuer(id, chefCentre.id, { type: 'centre' }, '2026-01-01');
		expect(await aLeDroit(base, personneActeur(id), 'GERER_ACCES', centre, aujourdhui)).toBe(false);
		expect(await aLeDroit(base, personneActeur(id), 'VOIR_PLANNING', centre, aujourdhui)).toBe(false);
		expect(await droitsDe(base, personneActeur(id), aujourdhui)).toEqual([]);
	});

	it('une personne extérieure n’a que les droits de son profil', async () => {
		const { base, exterieur, nouvelle } = await jeuDeDonnees();
		const id = await nouvelle('e@x.fr', exterieur.id);
		expect(await aLeDroit(base, personneActeur(id), 'VOIR_ANNUAIRE', centre, aujourdhui)).toBe(true);
		expect(await aLeDroit(base, personneActeur(id), 'VOIR_PLANNING', centre, aujourdhui)).toBe(false);
	});

	it('une personne sans profil n’a que ses attributions', async () => {
		const { base, chefCentre, nouvelle, attribuer } = await jeuDeDonnees();
		const id = await nouvelle('s@x.fr', null);
		expect(await droitsDe(base, personneActeur(id), aujourdhui)).toEqual([]);
		await attribuer(id, chefCentre.id, { type: 'centre' }, '2026-01-01');
		expect(await aLeDroit(base, personneActeur(id), 'GERER_ACCES', equipe1, aujourdhui)).toBe(true);
	});

	it('une personne inconnue n’a aucun droit', async () => {
		const { base } = await jeuDeDonnees();
		expect(await aLeDroit(base, personneActeur(999), 'VOIR_PLANNING', centre, aujourdhui)).toBe(false);
		expect(await droitsDe(base, personneActeur(999), aujourdhui)).toEqual([]);
	});
});

describe('droitsDe', () => {
	it('liste les droits du profil et des attributions en cours', async () => {
		const { base, agent, chefEquipe, nouvelle, attribuer } = await jeuDeDonnees();
		const id = await nouvelle('a@x.fr', agent.id);
		await attribuer(id, chefEquipe.id, { type: 'equipe', id: 1 }, '2026-01-01');
		await attribuer(id, chefEquipe.id, { type: 'equipe', id: 2 }, '2027-01-01');
		const droits = await droitsDe(base, personneActeur(id), aujourdhui);
		expect(droits).toHaveLength(2);
		expect(droits).toContainEqual({ droit: 'VOIR_PLANNING', perimetre: centre });
		expect(droits).toContainEqual({ droit: 'VALIDER_REMPLACEMENT', perimetre: equipe1 });
	});

	it('donne tous les droits sur le centre au super administrateur', async () => {
		const { base } = await jeuDeDonnees();
		const droits = await droitsDe(base, { type: 'super', email: 'a@b.fr' }, aujourdhui);
		expect(droits).toHaveLength(28);
		expect(droits.every((d) => d.perimetre.type === 'centre')).toBe(true);
	});
});
