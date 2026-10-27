import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { aDecider, casquettesDe, contenuCasquette } from '../src/casquettes.ts';
import type { Acteur } from '../src/droits.ts';
import { RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { attribution, comite, equipe, grade, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-25';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const acteur = (id: number): Acteur => ({ type: 'personne', id });

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const [sap] = await base.select().from(grade).limit(1);
	const responsabilites = await base.select().from(responsabilite);
	const role = (nom: string) => responsabilites.find((r) => r.nom === nom)!.id;
	const comites = await base.select().from(comite);
	const idComite = (nom: string) => comites.find((c) => c.nom === nom)!.id;

	const nouvelle = async (prenom: string, options: { complete?: boolean; exterieur?: boolean; statut?: 'parti' } = {}) => {
		const complete = options.complete ?? true;
		const [p] = await base
			.insert(personne)
			.values({
				email: `${prenom.toLowerCase()}@exemple.fr`,
				prenom,
				nom: 'Test',
				profilId: profils.find((x) => x.typePersonne === (options.exterieur ? 'exterieur' : 'agent'))!.id,
				gradeId: complete ? sap!.id : null,
				entreeCentre: complete ? '2020-01-01' : null,
				statut: options.statut ?? 'operationnel'
			})
			.returning();
		return p!.id;
	};
	const nommer = async (personneId: number, responsabiliteId: number, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }, dates: { debut?: string; fin?: string } = {}) => {
		await base.insert(attribution).values({
			personneId,
			responsabiliteId,
			perimetreType: perimetre.type,
			perimetreId: perimetre.id ?? null,
			debut: dates.debut ?? '2026-01-01',
			fin: dates.fin ?? null,
			saisiePar: 'super:a@b.fr',
			saisieLe: '2026-01-01'
		});
	};
	return { base, role, idComite, nouvelle, nommer };
}

describe('casquettesDe', () => {
	it('agent sans rôle : seulement « Mon astreinte »', async () => {
		const { base, nouvelle } = await jeu();
		const id = await nouvelle('David');
		expect(await casquettesDe(base, acteur(id), aujourdhui)).toEqual([{ id: 'astreinte', nom: 'Mon astreinte', icone: 'casque', compte: 0 }]);
	});

	it('chef de centre et adjoint : « Le centre » en premier, avec le compte de « À décider »', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const chef = await nouvelle('Claire');
		const adjoint = await nouvelle('Hugo');
		await nommer(chef, role('Chef de centre'), { type: 'centre' });
		await nommer(adjoint, role('Chef de centre adjoint'), { type: 'centre' });
		for (const id of [chef, adjoint]) {
			const casquettes = await casquettesDe(base, acteur(id), aujourdhui);
			expect(casquettes.map((c) => c.id)).toEqual(['centre', 'astreinte']);
			expect(casquettes[0]).toMatchObject({ nom: 'Le centre', icone: 'etoile', compte: (await aDecider(base, acteur(id), aujourdhui)).length });
			expect(casquettes[0]!.compte).toBeGreaterThan(0);
		}
	});

	it('super administrateur : « Le centre », sans astreinte', async () => {
		const { base } = await jeu();
		expect((await casquettesDe(base, superAdmin, aujourdhui)).map((c) => c.id)).toEqual(['centre']);
	});

	it('chef d’équipe, référent pharmacie et membre de l’Amicale : quatre casquettes dans l’ordre', async () => {
		const { base, role, idComite, nouvelle, nommer } = await jeu();
		const alice = await nouvelle('Alice');
		const [equipe1] = await base.select().from(equipe).where(eq(equipe.nom, 'Équipe 1'));
		await nommer(alice, role('Membre de comité'), { type: 'comite', id: idComite('Amicale') });
		await nommer(alice, role('Référent pharmacie'), { type: 'centre' });
		await nommer(alice, role('Chef d’équipe'), { type: 'equipe', id: equipe1!.id });
		expect(await casquettesDe(base, acteur(alice), aujourdhui)).toEqual([
			{ id: `equipe:${equipe1!.id}`, nom: 'Chef d’équipe · Équipe 1', icone: 'casque', compte: 0 },
			{ id: 'astreinte', nom: 'Mon astreinte', icone: 'casque', compte: 0 },
			{ id: `role:${role('Référent pharmacie')}`, nom: 'Référent pharmacie', icone: 'croix', compte: 0 },
			{ id: `comite:${idComite('Amicale')}`, nom: 'Amicale', icone: 'groupe', compte: 0 }
		]);
	});

	it('icône d’un rôle selon son nom ; membre et rapporteur d’un même comité : une seule casquette', async () => {
		const { base, role, idComite, nouvelle, nommer } = await jeu();
		const bruno = await nouvelle('Bruno');
		const [sport] = await base.insert(responsabilite).values({ nom: 'Référent sport', nature: 'mission', typePerimetre: 'centre' }).returning();
		await nommer(bruno, role('Référent engins'), { type: 'centre' });
		await nommer(bruno, role('Référent technique'), { type: 'centre' });
		await nommer(bruno, sport!.id, { type: 'centre' });
		await nommer(bruno, role('Membre de comité'), { type: 'comite', id: idComite('Amicale') });
		await nommer(bruno, role('Rapporteur de comité'), { type: 'comite', id: idComite('Amicale') });
		const casquettes = await casquettesDe(base, acteur(bruno), aujourdhui);
		expect(casquettes.map((c) => [c.nom, c.icone])).toEqual([
			['Mon astreinte', 'casque'],
			['Référent engins', 'camion'],
			['Référent sport', 'outil'],
			['Référent technique', 'cle'],
			['Amicale', 'groupe']
		]);
	});

	it('ignore une attribution passée ou à venir, un rôle archivé et un comité dissous', async () => {
		const { base, role, idComite, nouvelle, nommer } = await jeu();
		const id = await nouvelle('Chloé');
		await nommer(id, role('Référent pharmacie'), { type: 'centre' }, { debut: '2025-01-01', fin: '2025-12-31' });
		await nommer(id, role('Chef de centre'), { type: 'centre' }, { debut: '2027-01-01' });
		await nommer(id, role('Référent engins'), { type: 'centre' });
		await base.update(responsabilite).set({ archiveeLe: '2026-06-01' }).where(eq(responsabilite.id, role('Référent engins')));
		await nommer(id, role('Membre de comité'), { type: 'comite', id: idComite('Amicale') });
		await base.update(comite).set({ dissousLe: '2026-06-01' }).where(eq(comite.id, idComite('Amicale')));
		expect((await casquettesDe(base, acteur(id), aujourdhui)).map((c) => c.id)).toEqual(['astreinte']);
	});

	it('reste sous 50 requêtes avec 150 agents', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		for (let i = 0; i < 150; i++) await nouvelle(`Agent${i}`, { complete: i % 2 === 0 });
		const chef = await nouvelle('Claire');
		await nommer(chef, role('Chef de centre'), { type: 'centre' });
		const avant = base.requetes;
		await casquettesDe(base, acteur(chef), aujourdhui);
		await aDecider(base, acteur(chef), aujourdhui);
		expect(base.requetes - avant).toBeLessThanOrEqual(50);
	});
});

describe('aDecider', () => {
	it('équipes sans chef, rôles sans titulaire (hors système), fiches à compléter', async () => {
		const { base, role, idComite, nouvelle, nommer } = await jeu();
		const equipes = await base.select().from(equipe);
		const chef = await nouvelle('Claire');
		await nommer(chef, role('Chef de centre'), { type: 'centre' });
		await nommer(chef, role('Chef d’équipe'), { type: 'equipe', id: equipes.find((e) => e.nom === 'Équipe 1')!.id });
		await nommer(chef, role('Chef d’équipe'), { type: 'equipe', id: equipes.find((e) => e.nom === 'Équipe 2')!.id }, { debut: '2025-01-01', fin: '2025-12-31' });
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.nom, 'Équipe 3'));
		await nommer(chef, role('Référent engins'), { type: 'centre' });
		await nommer(chef, role('Membre de comité'), { type: 'comite', id: idComite('Amicale') });
		await nommer(chef, role('Rapporteur de comité'), { type: 'comite', id: idComite('Amicale') });
		await base.update(responsabilite).set({ archiveeLe: '2026-06-01' }).where(eq(responsabilite.id, role('Référent technique')));
		await nouvelle('Sansgrade', { complete: false });
		await nouvelle('Sansdate', { complete: false });
		await nouvelle('Parti', { complete: false, statut: 'parti' });
		await nouvelle('Exterieur', { complete: false, exterieur: true });

		expect(await aDecider(base, acteur(chef), aujourdhui)).toEqual([
			{ texte: 'Équipe 2 sans chef d’équipe', lien: '/nominations' },
			{ texte: 'Référent pharmacie : aucun titulaire', lien: '/nominations' },
			{ texte: '2 fiches à compléter (grade ou date d’entrée manquants)', lien: '/agents' }
		]);
	});

	it('une seule fiche : au singulier ; rien à décider : liste vide', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const chef = await nouvelle('Claire', { complete: false });
		await nommer(chef, role('Chef de centre'), { type: 'centre' });
		expect(await aDecider(base, acteur(chef), aujourdhui)).toContainEqual({ texte: '1 fiche à compléter (grade ou date d’entrée manquants)', lien: '/agents' });

		const vide = await baseDeTest();
		expect(await aDecider(vide, superAdmin, aujourdhui)).toEqual([]);
	});

	it('refusé à qui n’a pas « Le centre »', async () => {
		const { base, nouvelle } = await jeu();
		const id = await nouvelle('David');
		await expect(aDecider(base, acteur(id), aujourdhui)).rejects.toThrow(RefusDroit);
	});
});

describe('contenuCasquette', () => {
	it('rôle : ce qu’il permet, en phrases', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const id = await nouvelle('Bruno');
		await nommer(id, role('Référent engins'), { type: 'centre' });
		await nommer(id, role('Référent technique'), { type: 'centre' });
		expect(await contenuCasquette(base, acteur(id), `role:${role('Référent engins')}`, aujourdhui)).toEqual({ type: 'role', permet: ['Gérer les engins et les anomalies.'] });
		expect(await contenuCasquette(base, acteur(id), `role:${role('Référent technique')}`, aujourdhui)).toEqual({
			type: 'role',
			permet: ['Gérer les comités.', 'Gérer les responsabilités.']
		});
	});

	it('comité : membres en cours avec leur rôle', async () => {
		const { base, role, idComite, nouvelle, nommer } = await jeu();
		const alice = await nouvelle('Alice');
		const bruno = await nouvelle('Bruno');
		const ancien = await nouvelle('Ancien');
		const amicale = { type: 'comite' as const, id: idComite('Amicale') };
		await nommer(alice, role('Membre de comité'), amicale);
		await nommer(bruno, role('Rapporteur de comité'), amicale);
		await nommer(ancien, role('Membre de comité'), amicale, { debut: '2025-01-01', fin: '2025-12-31' });
		expect(await contenuCasquette(base, acteur(alice), `comite:${amicale.id}`, aujourdhui)).toEqual({
			type: 'comite',
			membres: [
				{ prenom: 'Alice', nom: 'Test', role: 'Membre de comité' },
				{ prenom: 'Bruno', nom: 'Test', role: 'Rapporteur de comité' }
			]
		});
	});

	it('centre : « À décider » ; astreinte : rien encore ; casquette non tenue : null', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const chef = await nouvelle('Claire');
		await nommer(chef, role('Chef de centre'), { type: 'centre' });
		expect(await contenuCasquette(base, acteur(chef), 'centre', aujourdhui)).toEqual({ type: 'centre', aDecider: await aDecider(base, acteur(chef), aujourdhui) });
		expect(await contenuCasquette(base, acteur(chef), 'astreinte', aujourdhui)).toEqual({ type: 'astreinte' });
		expect(await contenuCasquette(base, acteur(chef), `role:${role('Référent engins')}`, aujourdhui)).toBeNull();
	});
});
