import { describe, expect, it } from 'vitest';
import { ligneJournal } from '../src/journal.ts';
import { attribution, comite, journal, personne, responsabilite, responsabiliteDroit } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const resp = { nom: 'Chef de centre', nature: 'fonction', typePerimetre: 'centre' } as const;

async function avecPersonneEtResponsabilite() {
	const base = await baseDeTest();
	const [p] = await base.insert(personne).values({ email: 'a@exemple.fr', prenom: 'Anne', nom: 'Durand' }).returning();
	const [r] = await base.insert(responsabilite).values(resp).returning();
	return { base, p: p!, r: r! };
}

describe('comités et responsabilités', () => {
	it('crée un comité', async () => {
		const base = await baseDeTest();
		await base.insert(comite).values({ nom: 'Comité sport', theme: 'Sport' });
		expect(await base.select().from(comite)).toHaveLength(1);
	});

	it('refuse deux responsabilités système identiques', async () => {
		const base = await baseDeTest();
		await base.insert(responsabilite).values({ ...resp, systeme: 'chef_centre' });
		await expect(base.insert(responsabilite).values({ ...resp, nom: 'Autre', systeme: 'chef_centre' })).rejects.toThrow();
	});

	it('accepte le code système du chef de centre adjoint', async () => {
		const base = await baseDeTest();
		await base.insert(responsabilite).values({ ...resp, systeme: 'chef_centre_adjoint' });
		expect(await base.select().from(responsabilite)).toHaveLength(1);
	});

	it('accepte plusieurs responsabilités sans code système', async () => {
		const base = await baseDeTest();
		await base.insert(responsabilite).values(resp);
		await base.insert(responsabilite).values({ ...resp, nom: 'Autre' });
		expect(await base.select().from(responsabilite)).toHaveLength(2);
	});

	it('refuse un code système ou une nature inconnue', async () => {
		const base = await baseDeTest();
		await expect(base.insert(responsabilite).values({ ...resp, systeme: 'roi' as never })).rejects.toThrow();
		await expect(base.insert(responsabilite).values({ ...resp, nature: 'titre' as never })).rejects.toThrow();
	});

	it('refuse un type de périmètre inconnu', async () => {
		const base = await baseDeTest();
		await expect(base.insert(responsabilite).values({ ...resp, typePerimetre: 'caserne' as never })).rejects.toThrow();
	});

	it('refuse un droit inconnu ou un verrou autre que 0 ou 1', async () => {
		const { base, r } = await avecPersonneEtResponsabilite();
		await expect(base.insert(responsabiliteDroit).values({ responsabiliteId: r.id, droit: 'TOUT_FAIRE' as never })).rejects.toThrow();
		await expect(base.insert(responsabiliteDroit).values({ responsabiliteId: r.id, droit: 'GERER_ACCES', verrouille: 2 })).rejects.toThrow();
	});

	it('verrouille à 0 par défaut', async () => {
		const { base, r } = await avecPersonneEtResponsabilite();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: r.id, droit: 'GERER_ACCES' });
		const [lu] = await base.select().from(responsabiliteDroit);
		expect(lu?.verrouille).toBe(0);
	});
});

describe('attributions', () => {
	const duree = { debut: '2026-01-01', saisiePar: 'super:a@exemple.fr', saisieLe: '2026-01-01T10:00:00Z' };

	it('enregistre une attribution sur le centre sans identifiant de périmètre', async () => {
		const { base, p, r } = await avecPersonneEtResponsabilite();
		await base.insert(attribution).values({ personneId: p.id, responsabiliteId: r.id, perimetreType: 'centre', ...duree });
		const [lu] = await base.select().from(attribution);
		expect(lu).toMatchObject({ perimetreId: null, fin: null, compteRendu: null });
	});

	it('exige un identifiant de périmètre hors centre, et pas pour le centre', async () => {
		const { base, p, r } = await avecPersonneEtResponsabilite();
		const base_ = { personneId: p.id, responsabiliteId: r.id, ...duree };
		await expect(base.insert(attribution).values({ ...base_, perimetreType: 'equipe' })).rejects.toThrow();
		await expect(base.insert(attribution).values({ ...base_, perimetreType: 'centre', perimetreId: 1 })).rejects.toThrow();
		await base.insert(attribution).values({ ...base_, perimetreType: 'equipe', perimetreId: 1 });
	});

	it('refuse un type de périmètre inconnu', async () => {
		const { base, p, r } = await avecPersonneEtResponsabilite();
		await expect(
			base.insert(attribution).values({ personneId: p.id, responsabiliteId: r.id, perimetreType: 'caserne' as never, perimetreId: 1, ...duree })
		).rejects.toThrow();
	});

	it('refuse une personne ou une responsabilité inexistante', async () => {
		const { base, p, r } = await avecPersonneEtResponsabilite();
		await expect(base.insert(attribution).values({ personneId: 999, responsabiliteId: r.id, perimetreType: 'centre', ...duree })).rejects.toThrow();
		await expect(base.insert(attribution).values({ personneId: p.id, responsabiliteId: 999, perimetreType: 'centre', ...duree })).rejects.toThrow();
	});
});

describe('journal', () => {
	it('ligneJournal renvoie une requête qui écrit la ligne une fois passée au batch', async () => {
		const base = await baseDeTest();
		const requete = ligneJournal(
			base,
			{ acteur: 'personne:3', action: 'attribution.creer', cibleType: 'attribution', cibleId: 7, details: { fin: null } },
			'2026-02-01T08:00:00Z'
		);
		expect(await base.select().from(journal)).toHaveLength(0);
		await base.batch([requete]);
		const [lu] = await base.select().from(journal);
		expect(lu).toMatchObject({
			quand: '2026-02-01T08:00:00Z',
			acteur: 'personne:3',
			action: 'attribution.creer',
			cibleType: 'attribution',
			cibleId: 7
		});
		expect(JSON.parse(lu!.details)).toEqual({ fin: null });
	});

	it('ligneJournal accepte une cible absente et des détails absents', async () => {
		const base = await baseDeTest();
		await base.batch([ligneJournal(base, { acteur: 'super:a@exemple.fr', action: 'connexion', cibleType: 'session', cibleId: null }, '2026-02-01T08:00:00Z')]);
		const [lu] = await base.select().from(journal);
		expect(lu?.cibleId).toBeNull();
		expect(JSON.parse(lu!.details)).toEqual({});
	});
});
