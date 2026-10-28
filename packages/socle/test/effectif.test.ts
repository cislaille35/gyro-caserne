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

	const nouvelle = async (prenom: string, nom: string, options: { profilId?: number; statut?: StatutOperationnel; equipeId?: number; sansGrade?: boolean; entreeCentre?: string | null } = {}) => {
		const [p] = await base
			.insert(personne)
			.values({
				email: `${prenom}.${nom}@Exemple.fr`.toLowerCase(),
				prenom,
				nom,
				profilId: options.profilId ?? profilAgent.id,
				gradeId: options.sansGrade ? null : sap!.id,
				entreeCentre: options.entreeCentre === undefined ? '2020-01-01' : options.entreeCentre,
				statut: options.statut ?? 'operationnel'
			})
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

	it('donne à chaque équipe sa couleur et ses chefs en cours (un chef parti ne compte pas)', async () => {
		const { base, nouvelle, fonction } = await jeu();
		const alice = await nouvelle('Alice', 'Martin', { equipeId: 1 });
		const parti = await nouvelle('Paul', 'Parti', { equipeId: 2, statut: 'parti' });
		await nouvelle('Léa', 'Durand', { equipeId: 2 });
		await nouvelle('Sans', 'Equipe');
		await fonction(alice, 'chef_equipe', { type: 'equipe', id: 1 });
		await fonction(parti, 'chef_equipe', { type: 'equipe', id: 2 });
		const [e1] = await base.select().from(equipe).where(eq(equipe.id, 1));
		expect(await vueEffectif(base, aujourdhui)).toMatchObject([
			{ titre: 'Équipe 1', equipe: { couleur: e1!.couleur, chefs: ['A. Martin'] } },
			{ titre: 'Équipe 2', equipe: { chefs: [] } },
			{ titre: 'Sans équipe', equipe: null }
		]);
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
		expect((await listeGestion(base, acteur(chef), {}, aujourdhui)).groupes).toHaveLength(1);
		expect((await listeGestion(base, superAdmin, {}, aujourdhui)).groupes).toHaveLength(1);
	});

	const titresEtNoms = (liste: Awaited<ReturnType<typeof listeGestion>>) => liste.groupes.map((g) => [g.titre, g.personnes.map((p) => p.nom)]);

	it('groupe par équipe, puis sans équipe, extérieurs et partis, avec e-mail, statut et rôles', async () => {
		const { base, profilExt, nouvelle, fonction } = await jeu();
		const lea = await nouvelle('Léa', 'Durand', { equipeId: 1 });
		await fonction(lea, 'chef_equipe', { type: 'equipe', id: 1 });
		await nouvelle('Paul', 'Bernard');
		await nouvelle('Gone', 'Away', { statut: 'parti', equipeId: 1 });
		await nouvelle('Ext', 'Erieur', { profilId: profilExt.id });
		const liste = await listeGestion(base, superAdmin, {}, aujourdhui);
		expect(titresEtNoms(liste)).toEqual([
			['Équipe 1', ['Durand']],
			['Sans équipe', ['Bernard']],
			['Extérieurs', ['Erieur']],
			['Partis', ['Away']]
		]);
		expect(liste.groupes[0]).toMatchObject({ equipe: { chefs: ['L. Durand'] } });
		expect(liste.groupes[0]!.personnes[0]).toEqual({ id: lea, prenom: 'Léa', nom: 'Durand', email: 'léa.durand@exemple.fr', grade: 'Jeune sapeur-pompier', statut: 'operationnel', roles: ['Chef d’équipe (Équipe 1)'], aCompleter: false });
	});

	it('cherche dans le nom, le prénom et l’e-mail (casse ignorée)', async () => {
		const { base, nouvelle } = await jeu();
		await nouvelle('Léa', 'Durand', { equipeId: 1 });
		await nouvelle('Paul', 'Bernard');
		const noms = async (texte: string) => (await listeGestion(base, superAdmin, { texte }, aujourdhui)).groupes.flatMap((g) => g.personnes.map((p) => p.nom));
		expect(await noms('DURAND')).toEqual(['Durand']);
		expect(await noms('léa')).toEqual(['Durand']);
		expect(await noms('paul.bernard@EXEMPLE')).toEqual(['Bernard']);
	});

	it('filtre : à compléter (sans grade ou sans date d’entrée, hors partis et extérieurs), indisponibles, partis ; et les compte', async () => {
		const { base, profilExt, nouvelle } = await jeu();
		await nouvelle('Complet', 'Ok', { equipeId: 1 });
		await nouvelle('Sans', 'Grade', { equipeId: 1, sansGrade: true });
		await nouvelle('Sans', 'Entree', { entreeCentre: null });
		await nouvelle('Ext', 'Erieur', { profilId: profilExt.id, entreeCentre: null });
		await nouvelle('Gone', 'Away', { statut: 'parti', entreeCentre: null });
		await nouvelle('Stag', 'Iaire', { statut: 'stagiaire' });
		await nouvelle('Sus', 'Pendu', { statut: 'suspendu', equipeId: 1 });
		const liste = (filtre?: 'a-completer' | 'indisponibles' | 'partis') => listeGestion(base, superAdmin, { filtre }, aujourdhui);
		expect(titresEtNoms(await liste('a-completer'))).toEqual([
			['Équipe 1', ['Grade']],
			['Sans équipe', ['Entree']]
		]);
		expect(titresEtNoms(await liste('indisponibles'))).toEqual([
			['Équipe 1', ['Pendu']],
			['Sans équipe', ['Iaire']]
		]);
		expect(titresEtNoms(await liste('partis'))).toEqual([['Partis', ['Away']]]);
		const tous = await liste();
		expect(tous.comptes).toEqual({ 'a-completer': 2, indisponibles: 2, partis: 1 });
		expect(tous.groupes.flatMap((g) => g.personnes.filter((p) => p.aCompleter).map((p) => p.nom))).toEqual(['Grade', 'Entree']);
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
