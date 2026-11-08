import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { quiFaitQuoi } from '../src/qui-fait-quoi.ts';
import { attribution, comite, equipe, personne, profil, profilDroit, responsabilite, ressource } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-25';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const acteur = (id: number): Acteur => ({ type: 'personne', id });

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const responsabilites = await base.select().from(responsabilite);
	const role = (nom: string) => responsabilites.find((r) => r.nom === nom)!.id;
	const comites = await base.select().from(comite);
	const idComite = (nom: string) => comites.find((c) => c.nom === nom)!.id;
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);

	const nouvelle = async (prenom: string, nom: string, options: { exterieur?: boolean; statut?: 'parti' } = {}) => {
		const [p] = await base
			.insert(personne)
			.values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom, profilId: profils.find((x) => x.typePersonne === (options.exterieur ? 'exterieur' : 'agent'))!.id, statut: options.statut ?? 'operationnel' })
			.returning();
		return p!.id;
	};
	const nommer = async (personneId: number, responsabiliteId: number, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }, dates: { debut?: string; fin?: string } = {}) => {
		await base.insert(attribution).values({ personneId, responsabiliteId, perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: dates.debut ?? '2026-01-01', fin: dates.fin ?? null, saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	};

	const chef = await nouvelle('Claire', 'Martin');
	await nommer(chef, role('Chef de centre'), { type: 'centre' });
	const alice = await nouvelle('Alice', 'Bernard');
	const bruno = await nouvelle('Bruno', 'Petit');
	const amicale = idComite('Amicale');
	await nommer(alice, role('Membre de comité'), { type: 'comite', id: amicale });
	await nommer(bruno, role('Rapporteur de comité'), { type: 'comite', id: amicale });
	await nommer(alice, role('Référent pharmacie'), { type: 'centre' });
	await nommer(bruno, role('Chef de garde'), { type: 'equipe', id: equipes[0]!.id });
	return { base, role, idComite, nouvelle, nommer, chef, alice, bruno, amicale, equipes };
}

describe('quiFaitQuoi', () => {
	it('les comités en cours, leurs membres et leur rôle dans le comité, le rapporteur d’abord', async () => {
		const { base, alice } = await jeu();
		const vue = await quiFaitQuoi(base, acteur(alice), aujourdhui);
		expect(vue.comites.map((c) => c.nom)).toEqual(['Amicale', 'Comité du centre']);
		const [amicale, centre] = vue.comites;
		expect(amicale!.membres).toEqual([
			{ id: expect.any(Number), nom: 'Bruno Petit', roles: ['Rapporteur'] },
			{ id: expect.any(Number), nom: 'Alice Bernard', roles: ['Membre'] }
		]);
		expect(amicale!.icone).toBe('coeur');
		expect(centre!.membres).toEqual([]);
	});

	it('le lien vers le mur seulement pour qui le lit : ses membres, le chef, l’adjoint, le super administrateur', async () => {
		const { base, alice, chef, nouvelle } = await jeu();
		const mur = async (qui: Acteur) => Object.fromEntries((await quiFaitQuoi(base, qui, aujourdhui)).comites.map((c) => [c.nom, c.mur]));
		expect(await mur(acteur(alice))).toEqual({ Amicale: true, 'Comité du centre': false });
		expect(await mur(acteur(await nouvelle('Denis', 'Roux')))).toEqual({ Amicale: false, 'Comité du centre': false });
		expect(await mur(acteur(chef))).toEqual({ Amicale: true, 'Comité du centre': true });
		expect(await mur(superAdmin)).toEqual({ Amicale: true, 'Comité du centre': true });
	});

	it('un comité dissous n’y est plus ; un membre parti, une attribution finie ou à venir non plus', async () => {
		const { base, alice, amicale, role, nommer, nouvelle } = await jeu();
		await base.insert(comite).values({ nom: 'Ancien', theme: 'autre', dissousLe: '2026-02-01' });
		await nommer(await nouvelle('Paul', 'Parti', { statut: 'parti' }), role('Membre de comité'), { type: 'comite', id: amicale });
		await nommer(await nouvelle('Fini', 'Avant'), role('Membre de comité'), { type: 'comite', id: amicale }, { fin: '2026-03-01' });
		await nommer(await nouvelle('Futur', 'Après'), role('Membre de comité'), { type: 'comite', id: amicale }, { debut: '2027-01-01' });
		const vue = await quiFaitQuoi(base, acteur(alice), aujourdhui);
		expect(vue.comites.map((c) => c.nom)).not.toContain('Ancien');
		expect(vue.comites.find((c) => c.nom === 'Amicale')!.membres.map((m) => m.nom)).toEqual(['Bruno Petit', 'Alice Bernard']);
	});

	it('le matériel du comité ; lien vers sa page pour qui peut le réserver', async () => {
		const { base, alice, amicale, nouvelle } = await jeu();
		await base.insert(ressource).values([
			{ nom: 'Barnum', forme: 'jours', stock: 2, icone: 'outil', gereeParComiteId: amicale, creeLe: '2026-01-01T00:00' },
			{ nom: 'Retiré', forme: 'jours', stock: 1, icone: 'outil', gereeParComiteId: amicale, creeLe: '2026-01-01T00:00', retireeLe: '2026-02-01' }
		]);
		const vue = await quiFaitQuoi(base, acteur(alice), aujourdhui);
		expect(vue.comites.find((c) => c.nom === 'Amicale')!.ressources).toEqual([{ id: expect.any(Number), nom: 'Barnum', icone: 'outil', lien: true }]);
		expect(vue.comites.find((c) => c.nom === 'Comité du centre')!.ressources).toEqual([]);
		// Sans le droit de réserver : le nom seul, sauf pour un membre du comité (il gère son matériel).
		const denis = await nouvelle('Denis', 'Roux');
		const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
		await base.delete(profilDroit).where(eq(profilDroit.profilId, agent!.id));
		const lien = async (qui: number) => (await quiFaitQuoi(base, acteur(qui), aujourdhui)).comites.find((c) => c.nom === 'Amicale')!.ressources[0]!.lien;
		expect(await lien(denis)).toBe(false);
		expect(await lien(alice)).toBe(true);
	});

	it('les référents avec leurs titulaires, « personne » pour un rôle vide ; ni archivé ni rôle de comité', async () => {
		const { base, alice, base: b } = await jeu();
		await b.insert(responsabilite).values({ nom: 'Référent ancien', nature: 'mission', typePerimetre: 'centre', archiveeLe: '2026-02-01' });
		const vue = await quiFaitQuoi(base, acteur(alice), aujourdhui);
		expect(vue.referents.map((r) => [r.nom, r.titulaires])).toEqual([
			['Référent engins', []],
			['Référent pharmacie', ['Alice Bernard']],
			['Référent technique', []]
		]);
		expect(vue.referents.find((r) => r.nom === 'Référent pharmacie')!.icone).toBe('croix');
		expect(vue.commandement.map((r) => [r.nom, r.titulaires])).toEqual([
			['Chef de centre', ['Claire Martin']],
			['Chef de centre adjoint', []]
		]);
	});

	it('les chefs de garde, par équipe active', async () => {
		const { base, alice, equipes } = await jeu();
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, equipes.at(-1)!.id));
		const vue = await quiFaitQuoi(base, acteur(alice), aujourdhui);
		expect(vue.equipes).toHaveLength(1);
		const [chefs] = vue.equipes;
		expect(chefs!.nom).toBe('Chef de garde');
		expect(chefs!.parEquipe[0]).toEqual({ equipe: equipes[0]!.nom, titulaires: ['Bruno Petit'] });
		expect(chefs!.parEquipe.map((l) => l.equipe)).toEqual(equipes.slice(0, -1).map((e) => e.nom));
		expect(chefs!.parEquipe[1]!.titulaires).toEqual([]);
	});

	it('réservée aux agents qui ont accès et au super administrateur', async () => {
		const { base, nouvelle } = await jeu();
		await expect(quiFaitQuoi(base, acteur(await nouvelle('Reserve', 'Citoyenne', { exterieur: true })), aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(quiFaitQuoi(base, acteur(await nouvelle('Paul', 'Parti', { statut: 'parti' })), aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(quiFaitQuoi(base, superAdmin, aujourdhui)).resolves.toMatchObject({ comites: expect.any(Array) });
	});
});
