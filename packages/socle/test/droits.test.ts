import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { creerBaseD1 } from '../src/base.ts';
import { aLeDroit, aLeDroitAuCentreSql, couvre, droitsDe, perimetreDe, type Acteur } from '../src/droits.ts';
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
	const [chefEquipe] = await base.insert(responsabilite).values({ nom: 'Chef de garde', nature: 'fonction', typePerimetre: 'equipe' }).returning();
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

describe('aLeDroitAuCentreSql', () => {
	it('même réponse que aLeDroit sur le centre : profil, attribution en cours ou finie, périmètre d’équipe, statut sans accès', async () => {
		const { base, agent, chefEquipe, chefCentre, nouvelle, attribuer } = await jeuDeDonnees();
		const parProfil = await nouvelle('a@x.fr', agent.id);
		const chef = await nouvelle('b@x.fr', null);
		await attribuer(chef, chefCentre.id, centre, '2026-01-01');
		const fini = await nouvelle('c@x.fr', null);
		await attribuer(fini, chefCentre.id, centre, '2026-01-01', '2026-10-24');
		const chefDEquipe = await nouvelle('d@x.fr', null);
		await attribuer(chefDEquipe, chefEquipe.id, equipe1, '2026-01-01');
		const suspendu = await nouvelle('e@x.fr', agent.id, 'suspendu');
		for (const [droit, id] of [['VOIR_PLANNING', parProfil], ['VOIR_PLANNING', chef], ['GERER_ACCES', chef], ['GERER_ACCES', fini], ['VALIDER_REMPLACEMENT', chefDEquipe], ['VOIR_PLANNING', suspendu]] as const) {
			const [ligne] = await base.select({ oui: sql<number>`${aLeDroitAuCentreSql(sql`"personne"."id"`, droit, aujourdhui)}` }).from(personne).where(eq(personne.id, id));
			expect(ligne!.oui === 1, `${droit} ${id}`).toBe(await aLeDroit(base, personneActeur(id), droit, centre, aujourdhui));
		}
	});
});

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

describe('perimetreDe', () => {
	it('refuse un périmètre sans identifiant hors centre', () => {
		expect(perimetreDe('equipe', null)).toBeNull();
		expect(perimetreDe('centre', null)).toEqual({ type: 'centre' });
		expect(perimetreDe('equipe', 3)).toEqual({ type: 'equipe', id: 3 });
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
		const { base, agent, nouvelle, attribuer } = await jeuDeDonnees();
		const [chefComite] = await base.insert(responsabilite).values({ nom: 'Chef de comité', nature: 'fonction', typePerimetre: 'comite' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: chefComite!.id, droit: 'GERER_COMITES' });
		const id = await nouvelle('a@x.fr', agent.id);
		await attribuer(id, chefComite!.id, { type: 'comite', id: 1 }, '2026-01-01');
		expect(await aLeDroit(base, personneActeur(id), 'GERER_COMITES', { type: 'comite', id: 1 }, aujourdhui)).toBe(true);
		expect(await aLeDroit(base, personneActeur(id), 'GERER_COMITES', { type: 'comite', id: 2 }, aujourdhui)).toBe(false);
		expect(await aLeDroit(base, personneActeur(id), 'GERER_COMITES', equipe1, aujourdhui)).toBe(false);
	});

	it('ignore une attribution dont le périmètre ne correspond pas à la responsabilité', async () => {
		const { base, agent, chefEquipe, nouvelle, attribuer } = await jeuDeDonnees();
		const id = await nouvelle('a@x.fr', agent.id);
		await attribuer(id, chefEquipe.id, { type: 'centre' }, '2026-01-01');
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', equipe1, aujourdhui)).toBe(false);
		expect(await aLeDroit(base, personneActeur(id), 'VALIDER_REMPLACEMENT', centre, aujourdhui)).toBe(false);
	});

	it('un droit de profil sur une équipe couvre cette équipe seulement', async () => {
		const { base, agent, nouvelle } = await jeuDeDonnees();
		await base.insert(profilDroit).values({ profilId: agent.id, droit: 'GERER_PLANNING', perimetreType: 'equipe', perimetreId: 1 });
		const id = await nouvelle('a@x.fr', agent.id);
		expect(await aLeDroit(base, personneActeur(id), 'GERER_PLANNING', equipe1, aujourdhui)).toBe(true);
		expect(await aLeDroit(base, personneActeur(id), 'GERER_PLANNING', equipe2, aujourdhui)).toBe(false);
		expect(await aLeDroit(base, personneActeur(id), 'GERER_PLANNING', centre, aujourdhui)).toBe(false);
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

	it('un agent parti n’a plus aucun droit', async () => {
		const { base, agent, chefCentre, nouvelle, attribuer } = await jeuDeDonnees();
		const [p] = await base.insert(personne).values({ email: 'p@x.fr', prenom: 'P', nom: 'N', profilId: agent.id, statut: 'parti' }).returning();
		await attribuer(p!.id, chefCentre.id, { type: 'centre' }, '2026-01-01');
		expect(await droitsDe(base, personneActeur(p!.id), aujourdhui)).toEqual([]);
		expect(await aLeDroit(base, personneActeur(p!.id), 'VOIR_PLANNING', centre, aujourdhui)).toBe(false);
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

describe('droitsDe : lus une fois par requête', () => {
	it('relire les mêmes droits ne coûte aucune requête ; une autre date les relit', async () => {
		const { base, agent, nouvelle } = await jeuDeDonnees();
		const id = await nouvelle('a@x.fr', agent.id);
		const premiere = await droitsDe(base, personneActeur(id), aujourdhui);
		const avant = base.requetes;
		expect(await droitsDe(base, personneActeur(id), aujourdhui)).toEqual(premiere);
		expect(await aLeDroit(base, personneActeur(id), 'VOIR_PLANNING', centre, aujourdhui)).toBe(true);
		expect(base.requetes).toBe(avant);
		await droitsDe(base, personneActeur(id), '2026-10-26');
		expect(base.requetes).toBeGreaterThan(avant);
	});

	it('toute écriture, seule ou en batch, fait relire les droits', async () => {
		const { base, agent, chefCentre, nouvelle, attribuer } = await jeuDeDonnees();
		const id = await nouvelle('a@x.fr', agent.id);
		expect(await aLeDroit(base, personneActeur(id), 'GERER_ACCES', centre, aujourdhui)).toBe(false);
		await attribuer(id, chefCentre.id, centre, '2026-01-01');
		expect(await aLeDroit(base, personneActeur(id), 'GERER_ACCES', centre, aujourdhui)).toBe(true);
		await base.batch([base.update(personne).set({ statut: 'suspendu' }).where(eq(personne.id, id))]);
		expect(await droitsDe(base, personneActeur(id), aujourdhui)).toEqual([]);
	});

	it('avec D1 aussi : une écriture fait relire les droits', async () => {
		const envoyees: string[] = [];
		const instruction = { bind: () => instruction, raw: async () => [], all: async () => ({ results: [] }), run: async () => ({ results: [], meta: {} }) };
		const d1 = { prepare: (sql: string) => (envoyees.push(sql), instruction), batch: async () => [] } as unknown as D1Database;
		const base = creerBaseD1(d1);
		const lectures = () => envoyees.filter((sql) => sql.startsWith('select')).length;
		await droitsDe(base, personneActeur(1), aujourdhui);
		await droitsDe(base, personneActeur(1), aujourdhui);
		expect(lectures()).toBe(1);
		await base.update(personne).set({ statut: 'suspendu' }).where(eq(personne.id, 1));
		await droitsDe(base, personneActeur(1), aujourdhui);
		expect(lectures()).toBe(2);
	});
});
