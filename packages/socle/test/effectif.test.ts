import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { estGestionnaire, ficheAgent, listeGestion, vueEffectif } from '../src/effectif.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { affectationEquipe, attribution, comite, equipe, grade, personne, profil, responsabilite } from '../src/schema.ts';
import type { StatutOperationnel } from '../src/listes.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-25';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const profilAgent = profils.find((p) => p.typePersonne === 'agent')!;
	const profilExt = profils.find((p) => p.typePersonne === 'exterieur')!;
	const [sap] = await base.select().from(grade).limit(1);

	const nouvelle = async (prenom: string, nom: string, options: { profilId?: number; statut?: StatutOperationnel; equipeId?: number } = {}) => {
		const [p] = await base
			.insert(personne)
			.values({ email: `${prenom}.${nom}@Exemple.fr`.toLowerCase(), prenom, nom, profilId: options.profilId ?? profilAgent.id, gradeId: sap!.id, statut: options.statut ?? 'operationnel' })
			.returning();
		if (options.equipeId) await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId: options.equipeId, debut: '2026-01-01' });
		return p!.id;
	};
	const fonction = async (personneId: number, systeme: 'chef_centre' | 'chef_centre_adjoint' | 'chef_equipe', perimetre: { type: 'centre' | 'equipe'; id?: number }) => {
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, systeme));
		await base.insert(attribution).values({ personneId, responsabiliteId: r!.id, perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	};
	return { base, profilAgent, profilExt, nouvelle, fonction };
}

const acteur = (id: number): Acteur => ({ type: 'personne', id });

describe('vueEffectif', () => {
	it('groupe par équipe, puis sans équipe, puis extérieurs, sans groupe vide', async () => {
		const { base, profilExt, nouvelle } = await jeu();
		await nouvelle('Zoé', 'Martin', { equipeId: 3 });
		await nouvelle('Léa', 'Durand', { equipeId: 1 });
		await nouvelle('Paul', 'Bernard', { equipeId: 2 });
		await nouvelle('Sans', 'Equipe');
		await nouvelle('Ext', 'Erieur', { profilId: profilExt.id });
		expect((await vueEffectif(base, aujourdhui)).map((g) => g.titre)).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3', 'Sans équipe', 'Extérieurs']);

		const vide = await baseDeTest();
		await chargerJeuDeDepart(vide, centreExemple);
		expect(await vueEffectif(vide, aujourdhui)).toEqual([]);
	});

	it('omet les partis, garde les suspendus', async () => {
		const { base, nouvelle } = await jeu();
		await nouvelle('Parti', 'Loin', { statut: 'parti', equipeId: 1 });
		await nouvelle('Suspendu', 'Ici', { statut: 'suspendu', equipeId: 1 });
		const noms = (await vueEffectif(base, aujourdhui)).flatMap((g) => g.personnes.map((p) => p.nom));
		expect(noms).toEqual(['Ici']);
	});

	it('range un extérieur affecté à une équipe dans Extérieurs', async () => {
		const { base, profilExt, nouvelle } = await jeu();
		await nouvelle('Ext', 'Affecté', { profilId: profilExt.id, equipeId: 1 });
		expect(await vueEffectif(base, aujourdhui)).toMatchObject([{ titre: 'Extérieurs' }]);
	});

	it('ignore une affectation terminée et trie par nom puis prénom', async () => {
		const { base, nouvelle } = await jeu();
		const ancien = await nouvelle('Ancien', 'Zèbre');
		await base.insert(affectationEquipe).values({ personneId: ancien, equipeId: 1, debut: '2025-01-01', fin: '2025-12-31' });
		await nouvelle('Bob', 'Dupont', { equipeId: 1 });
		await nouvelle('Alice', 'Dupont', { equipeId: 1 });
		await nouvelle('Chloé', 'Albert', { equipeId: 1 });
		const vue = await vueEffectif(base, aujourdhui);
		expect(vue[0]!.personnes.map((p) => p.prenom)).toEqual(['Chloé', 'Alice', 'Bob']);
		expect(vue[1]).toMatchObject({ titre: 'Sans équipe' });
	});

	it('n’expose que id, prénom, nom et grade (libellé)', async () => {
		const { base, nouvelle } = await jeu();
		await nouvelle('Léa', 'Durand', { equipeId: 1 });
		const [p] = (await vueEffectif(base, aujourdhui))[0]!.personnes;
		expect(Object.keys(p!).sort()).toEqual(['grade', 'id', 'nom', 'prenom', 'roles']);
		expect(p!.grade).toBe('Jeune sapeur-pompier');
	});

	describe('rôles en cours', () => {
		const attribuer = async (base: Awaited<ReturnType<typeof jeu>>['base'], personneId: number, responsabiliteId: number, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }, debut: string, fin: string | null = null) => {
			await base.insert(attribution).values({ personneId, responsabiliteId, perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut, fin, saisiePar: 'super:secret@b.fr', saisieLe: '2026-01-01' });
		};
		const nouvelleResp = async (base: Awaited<ReturnType<typeof jeu>>['base'], nom: string, typePerimetre: 'centre' | 'equipe' | 'comite') => {
			const [r] = await base.insert(responsabilite).values({ nom, nature: 'fonction', typePerimetre }).returning();
			return r!.id;
		};
		const rolesDe = async (base: Awaited<ReturnType<typeof jeu>>['base'], id: number) =>
			(await vueEffectif(base, aujourdhui)).flatMap((g) => g.personnes).find((p) => p.id === id)!.roles;

		it('liste les rôles en cours, libellés selon le périmètre, triés', async () => {
			const { base, nouvelle } = await jeu();
			const p = await nouvelle('Léa', 'Durand', { equipeId: 1 });
			const [amicale] = await base.insert(comite).values({ nom: 'Amicale', theme: 'vie' }).returning();
			await attribuer(base, p, await nouvelleResp(base, 'Rapporteur', 'comite'), { type: 'comite', id: amicale!.id }, '2026-01-01');
			await attribuer(base, p, await nouvelleResp(base, 'Chef d’agrès', 'equipe'), { type: 'equipe', id: 2 }, '2026-01-01', '2026-10-25');
			await attribuer(base, p, await nouvelleResp(base, 'Référent engins', 'centre'), { type: 'centre' }, '2026-01-01');
			expect(await rolesDe(base, p)).toEqual(['Chef d’agrès (Équipe 2)', 'Rapporteur (Amicale)', 'Référent engins']);
		});

		it('omet le passé, l’à venir, le comité dissous et la responsabilité archivée', async () => {
			const { base, nouvelle } = await jeu();
			const p = await nouvelle('Léa', 'Durand', { equipeId: 1 });
			const passe = await nouvelleResp(base, 'Passé', 'centre');
			const avenir = await nouvelleResp(base, 'À venir', 'centre');
			const archivee = await nouvelleResp(base, 'Archivée', 'centre');
			const dansComite = await nouvelleResp(base, 'Dans comité', 'comite');
			await base.update(responsabilite).set({ archiveeLe: '2026-06-01' }).where(eq(responsabilite.id, archivee));
			const [dissous] = await base.insert(comite).values({ nom: 'Ancien', theme: 'vie', dissousLe: '2026-06-01' }).returning();
			await attribuer(base, p, passe, { type: 'centre' }, '2026-01-01', '2026-10-24');
			await attribuer(base, p, avenir, { type: 'centre' }, '2026-10-26');
			await attribuer(base, p, archivee, { type: 'centre' }, '2026-01-01');
			await attribuer(base, p, dansComite, { type: 'comite', id: dissous!.id }, '2026-01-01');
			expect(await rolesDe(base, p)).toEqual([]);
		});

		it('n’expose ni date ni auteur', async () => {
			const { base, nouvelle } = await jeu();
			const p = await nouvelle('Léa', 'Durand', { equipeId: 1 });
			await attribuer(base, p, await nouvelleResp(base, 'Référent engins', 'centre'), { type: 'centre' }, '2026-01-01');
			const texte = JSON.stringify(await vueEffectif(base, aujourdhui));
			expect(texte).not.toContain('2026-01-01');
			expect(texte).not.toContain('secret@b.fr');
			expect(texte).not.toContain('super:');
		});
	});

	it('une équipe inactive n’a pas de groupe', async () => {
		const { base, nouvelle } = await jeu();
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, 1));
		await nouvelle('Léa', 'Durand', { equipeId: 1 });
		expect((await vueEffectif(base, aujourdhui)).map((g) => g.titre)).toEqual(['Sans équipe']);
	});
});

describe('estGestionnaire et listeGestion', () => {
	it('refuse l’agent ordinaire et le chef d’équipe', async () => {
		const { base, nouvelle, fonction } = await jeu();
		const simple = await nouvelle('Simple', 'Agent', { equipeId: 1 });
		const chefEquipe = await nouvelle('Chef', 'Equipe', { equipeId: 1 });
		await fonction(chefEquipe, 'chef_equipe', { type: 'equipe', id: 1 });
		for (const id of [simple, chefEquipe]) {
			expect(await estGestionnaire(base, acteur(id), aujourdhui)).toBe(false);
			await expect(listeGestion(base, acteur(id), {}, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		}
	});

	it('accepte le chef de centre et le super', async () => {
		const { base, nouvelle, fonction } = await jeu();
		const chef = await nouvelle('Chef', 'Centre');
		await fonction(chef, 'chef_centre', { type: 'centre' });
		expect(await estGestionnaire(base, acteur(chef), aujourdhui)).toBe(true);
		expect(await estGestionnaire(base, superAdmin, aujourdhui)).toBe(true);
		expect(await listeGestion(base, acteur(chef), {}, aujourdhui)).toHaveLength(1);
		expect(await listeGestion(base, superAdmin, {}, aujourdhui)).toHaveLength(1);
	});

	it('filtre par texte (casse ignorée), équipe, statut', async () => {
		const { base, profilExt, nouvelle } = await jeu();
		await nouvelle('Léa', 'Durand', { equipeId: 1 });
		await nouvelle('Paul', 'Bernard');
		await nouvelle('Gone', 'Away', { statut: 'parti' });
		await nouvelle('Ext', 'Erieur', { profilId: profilExt.id });
		const noms = async (f: Parameters<typeof listeGestion>[2]) => (await listeGestion(base, superAdmin, f, aujourdhui)).map((l) => l.nom);
		expect(await noms({ texte: 'DURAND' })).toEqual(['Durand']);
		expect(await noms({ texte: 'léa' })).toEqual(['Durand']);
		expect(await noms({ texte: 'paul.bernard@EXEMPLE' })).toEqual(['Bernard']);
		expect(await noms({ equipeId: 1 })).toEqual(['Durand']);
		expect(await noms({ equipeId: 'aucune' })).toEqual(['Away', 'Bernard', 'Erieur']);
		expect(await noms({ statut: 'parti' })).toEqual(['Away']);
		const lignes = await listeGestion(base, superAdmin, { texte: 'durand' }, aujourdhui);
		expect(lignes[0]).toMatchObject({ prenom: 'Léa', equipe: { id: 1, nom: 'Équipe 1' }, exterieur: false, statut: 'operationnel' });
		expect((await listeGestion(base, superAdmin, { texte: 'erieur' }, aujourdhui))[0]!.exterieur).toBe(true);
	});
});

describe('ficheAgent', () => {
	it('indique la protection selon la fonction en cours', async () => {
		const { base, nouvelle, fonction } = await jeu();
		const chef = await nouvelle('Chef', 'Centre');
		const adjoint = await nouvelle('Adj', 'Oint');
		const simple = await nouvelle('Simple', 'Agent', { equipeId: 2 });
		await fonction(chef, 'chef_centre', { type: 'centre' });
		await fonction(adjoint, 'chef_centre_adjoint', { type: 'centre' });
		expect((await ficheAgent(base, superAdmin, chef, aujourdhui)).protection).toBe('chef');
		expect((await ficheAgent(base, superAdmin, adjoint, aujourdhui)).protection).toBe('adjoint');
		const fiche = await ficheAgent(base, superAdmin, simple, aujourdhui);
		expect(fiche.protection).toBeNull();
		expect(fiche.equipe).toMatchObject({ id: 2, nom: 'Équipe 2' });
		expect(fiche.grade).toMatchObject({ libelle: 'Jeune sapeur-pompier' });
		expect(fiche.profil).toMatchObject({ nom: 'Agent' });
		expect(fiche).not.toHaveProperty('photo');
	});

	it('une fonction terminée ne protège plus', async () => {
		const { base, nouvelle, fonction } = await jeu();
		const ancien = await nouvelle('Ancien', 'Chef');
		await fonction(ancien, 'chef_centre', { type: 'centre' });
		await base.update(attribution).set({ fin: '2026-06-30' });
		expect((await ficheAgent(base, superAdmin, ancien, aujourdhui)).protection).toBeNull();
	});

	it('refuse l’agent ordinaire, signale une personne inconnue', async () => {
		const { base, nouvelle } = await jeu();
		const simple = await nouvelle('Simple', 'Agent');
		await expect(ficheAgent(base, acteur(simple), simple, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(ficheAgent(base, superAdmin, 999, aujourdhui)).rejects.toThrow(new DonneeInvalide('Personne inconnue'));
	});
});
