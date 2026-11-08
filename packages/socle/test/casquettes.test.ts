import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { accueilDe, aDecider, casquettesDe } from '../src/casquettes.ts';
import type { Acteur } from '../src/droits.ts';
import { RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { ajouterRessource, refuser, reserver } from '../src/reservations.ts';
import { anneePlanning, attribution, comite, equipe, grade, personne, profil, responsabilite, responsabiliteDroit, ressource } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';
import { periodeParDefaut, reglerEte } from '../src/planning/ete.ts';
import { eteAPreparer, proposerEte, publierEte } from '../src/planning/repartition.ts';
import { jeuEte } from './jeu-ete.ts';

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

	it('chef de garde, référent pharmacie et membre de l’Amicale : quatre casquettes dans l’ordre', async () => {
		const { base, role, idComite, nouvelle, nommer } = await jeu();
		const alice = await nouvelle('Alice');
		const [equipe1] = await base.select().from(equipe).where(eq(equipe.nom, 'Équipe 1'));
		await nommer(alice, role('Membre de comité'), { type: 'comite', id: idComite('Amicale') });
		await nommer(alice, role('Référent pharmacie'), { type: 'centre' });
		await nommer(alice, role('Chef de garde'), { type: 'equipe', id: equipe1!.id });
		expect(await casquettesDe(base, acteur(alice), aujourdhui)).toEqual([
			{ id: `equipe:${equipe1!.id}`, nom: 'Chef de garde · Équipe 1', icone: 'casque', compte: 0 },
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

	it('icône d’un rôle : celle choisie, sinon celle de son modèle, sinon selon le nom', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const bruno = await nouvelle('Bruno');
		const [a] = await base.insert(responsabilite).values({ nom: 'Référent engins 2', nature: 'mission', typePerimetre: 'centre', modele: 'referent_pharmacie', icone: 'ballon' }).returning();
		const [b] = await base.insert(responsabilite).values({ nom: 'Référent engins 3', nature: 'mission', typePerimetre: 'centre', modele: 'referent_pharmacie' }).returning();
		await nommer(bruno, a!.id, { type: 'centre' });
		await nommer(bruno, b!.id, { type: 'centre' });
		await nommer(bruno, role('Référent engins'), { type: 'centre' });
		const casquettes = await casquettesDe(base, acteur(bruno), aujourdhui);
		expect(casquettes.filter((c) => c.id.startsWith('role:')).map((c) => [c.nom, c.icone])).toEqual([
			['Référent engins', 'camion'],
			['Référent engins 2', 'ballon'],
			['Référent engins 3', 'croix']
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
});

describe('aDecider', () => {
	it('équipes sans chef, rôles sans titulaire (hors système et hors comités), fiches à compléter', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const equipes = await base.select().from(equipe);
		const idEquipe = (nom: string) => equipes.find((e) => e.nom === nom)!.id;
		const chef = await nouvelle('Claire');
		await nommer(chef, role('Chef de centre'), { type: 'centre' });
		await nommer(chef, role('Chef de garde'), { type: 'equipe', id: idEquipe('Équipe 1') });
		await nommer(chef, role('Chef de garde'), { type: 'equipe', id: idEquipe('Équipe 2') }, { debut: '2025-01-01', fin: '2025-12-31' });
		await nommer(chef, role('Référent engins'), { type: 'centre' });
		await base.update(responsabilite).set({ archiveeLe: '2026-06-01' }).where(eq(responsabilite.id, role('Référent technique')));
		// Un agent parti ne tient plus rien.
		const parti = await nouvelle('Ancien', { statut: 'parti' });
		await nommer(parti, role('Chef de garde'), { type: 'equipe', id: idEquipe('Équipe 3') });
		await nommer(parti, role('Référent pharmacie'), { type: 'centre' });
		await nouvelle('Sansgrade', { complete: false });
		await nouvelle('Sansdate', { complete: false });
		await nouvelle('Parti', { complete: false, statut: 'parti' });
		await nouvelle('Exterieur', { complete: false, exterieur: true });

		// « Membre de comité » et « Rapporteur de comité » n'ont aucun titulaire, mais ne sont pas listés. En septembre, pas encore de planning à préparer.
		expect(await aDecider(base, acteur(chef), '2026-09-25')).toEqual([
			{ texte: 'Équipe 2 sans chef de garde', lien: '/nominations' },
			{ texte: 'Équipe 3 sans chef de garde', lien: '/nominations' },
			{ texte: 'Équipe 4 sans chef de garde', lien: '/nominations' },
			{ texte: 'Référent habillement : aucun titulaire', lien: '/nominations' },
			{ texte: 'Référent pharmacie : aucun titulaire', lien: '/nominations' },
			{ texte: '2 fiches à compléter (grade ou date d’entrée manquants)', lien: '/agents?filtre=a-completer' }
		]);
	});

	it('une équipe inactive n’est pas listée', async () => {
		const { base, nouvelle } = await jeu();
		await nouvelle('Claire');
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.nom, 'Équipe 3'));
		const textes = (await aDecider(base, superAdmin, aujourdhui)).map((e) => e.texte);
		expect(textes).toContain('Équipe 1 sans chef de garde');
		expect(textes).not.toContain('Équipe 3 sans chef de garde');
	});

	it('une seule fiche : au singulier ; rien à décider : liste vide', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const chef = await nouvelle('Claire', { complete: false });
		await nommer(chef, role('Chef de centre'), { type: 'centre' });
		expect(await aDecider(base, acteur(chef), aujourdhui)).toContainEqual({ texte: '1 fiche à compléter (grade ou date d’entrée manquants)', lien: '/agents?filtre=a-completer' });

		const vide = await baseDeTest();
		expect(await aDecider(vide, superAdmin, '2026-09-25')).toEqual([]);
	});

	it('à partir du 1er octobre, tant que l’année suivante n’est pas publiée : « Planning N à préparer » en tête', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const chef = await nouvelle('Claire');
		await nommer(chef, role('Chef de centre'), { type: 'centre' });
		const ligne = { texte: 'Planning 2027 à préparer', lien: '/planning/preparer?annee=2027' };
		expect(await aDecider(base, acteur(chef), '2026-09-30')).not.toContainEqual(ligne);
		expect((await aDecider(base, acteur(chef), '2026-10-01'))[0]).toEqual(ligne);
		await base.insert(anneePlanning).values({ annee: 2027, ordre: '[1,2]' });
		expect((await aDecider(base, acteur(chef), '2026-12-31'))[0]).toEqual(ligne);
		await base.update(anneePlanning).set({ publieeLe: '2026-11-01T10:00' });
		expect(await aDecider(base, acteur(chef), '2026-12-31')).not.toContainEqual(ligne);
	});

	it('refusé à qui n’a pas « Le centre », même règle que les casquettes', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const david = await nouvelle('David');
		await expect(aDecider(base, acteur(david), aujourdhui)).rejects.toThrow(RefusDroit);

		// Chef de centre sur un mauvais périmètre : ni casquette, ni « À décider ».
		const [equipe1] = await base.select().from(equipe).limit(1);
		const hugo = await nouvelle('Hugo');
		await nommer(hugo, role('Chef de centre'), { type: 'equipe', id: equipe1!.id });
		await expect(aDecider(base, acteur(hugo), aujourdhui)).rejects.toThrow(RefusDroit);

		// Rôle d'adjoint archivé : pareil.
		const ines = await nouvelle('Inès');
		await nommer(ines, role('Chef de centre adjoint'), { type: 'centre' });
		await base.update(responsabilite).set({ archiveeLe: '2026-06-01' }).where(eq(responsabilite.id, role('Chef de centre adjoint')));
		await expect(aDecider(base, acteur(ines), aujourdhui)).rejects.toThrow(RefusDroit);
		for (const id of [hugo, ines]) expect((await casquettesDe(base, acteur(id), aujourdhui)).map((c) => c.id)).toEqual(['astreinte']);
	});
});

describe('accueilDe', () => {
	it('rôle : ce qu’il permet, en phrases', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const id = await nouvelle('Bruno');
		await nommer(id, role('Référent engins'), { type: 'centre' });
		await nommer(id, role('Référent technique'), { type: 'centre' });
		expect((await accueilDe(base, acteur(id), `role:${role('Référent engins')}`, aujourdhui, `${aujourdhui}T00:00`, centreExemple.astreinte)).contenu).toEqual({ type: 'role', permet: ['Gérer les engins et les anomalies.'], aDecider: [] });
		expect((await accueilDe(base, acteur(id), `role:${role('Référent technique')}`, aujourdhui, `${aujourdhui}T00:00`, centreExemple.astreinte)).contenu).toEqual({
			type: 'role',
			permet: ['Gérer les comités.', 'Gérer les responsabilités.'],
			aDecider: []
		});
	});

	it('rôle : rien n’est dit des droits sans effet (motifs d’absence, annuaire)', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const id = await nouvelle('Bruno');
		const permet = async (r: number) => ((await accueilDe(base, acteur(id), `role:${r}`, aujourdhui, `${aujourdhui}T00:00`, centreExemple.astreinte)).contenu as { permet: string[] }).permet;
		await base.insert(responsabiliteDroit).values({ responsabiliteId: role('Référent engins'), droit: 'VOIR_MOTIFS_ABSENCE' });
		await nommer(id, role('Référent engins'), { type: 'centre' });
		expect(await permet(role('Référent engins'))).toEqual(['Gérer les engins et les anomalies.']);
		const [seul] = await base.insert(responsabilite).values({ nom: 'Lecteur', nature: 'mission', typePerimetre: 'centre' }).returning();
		await base.insert(responsabiliteDroit).values([
			{ responsabiliteId: seul!.id, droit: 'VOIR_MOTIFS_ABSENCE' },
			{ responsabiliteId: seul!.id, droit: 'VOIR_ANNUAIRE' }
		]);
		await nommer(id, seul!.id, { type: 'centre' });
		expect(await permet(seul!.id)).toEqual([]);
	});

	it('comité : membres en cours avec leur rôle, sans les partis', async () => {
		const { base, role, idComite, nouvelle, nommer } = await jeu();
		const alice = await nouvelle('Alice');
		const bruno = await nouvelle('Bruno');
		const ancien = await nouvelle('Ancien');
		const parti = await nouvelle('Parti', { statut: 'parti' });
		const amicale = { type: 'comite' as const, id: idComite('Amicale') };
		await nommer(alice, role('Membre de comité'), amicale);
		await nommer(bruno, role('Rapporteur de comité'), amicale);
		await nommer(ancien, role('Membre de comité'), amicale, { debut: '2025-01-01', fin: '2025-12-31' });
		await nommer(parti, role('Membre de comité'), amicale);
		expect((await accueilDe(base, acteur(alice), `comite:${amicale.id}`, aujourdhui, `${aujourdhui}T00:00`, centreExemple.astreinte)).contenu).toEqual({
			type: 'comite',
			membres: [
				{ personneId: alice, prenom: 'Alice', nom: 'Test', role: 'Membre de comité' },
				{ personneId: bruno, prenom: 'Bruno', nom: 'Test', role: 'Rapporteur de comité' }
			],
			aDecider: []
		});
	});

	it('un comité dont on n’est pas membre, ou dissous, ne s’ouvre pas', async () => {
		const { base, role, idComite, nouvelle, nommer } = await jeu();
		const alice = await nouvelle('Alice');
		const bruno = await nouvelle('Bruno');
		await nommer(bruno, role('Membre de comité'), { type: 'comite', id: idComite('Amicale') });
		expect(await accueilDe(base, acteur(alice), `comite:${idComite('Amicale')}`, aujourdhui, `${aujourdhui}T00:00`, centreExemple.astreinte)).toMatchObject({ choisie: 'astreinte', contenu: { type: 'astreinte' } });

		await nommer(alice, role('Membre de comité'), { type: 'comite', id: idComite('Amicale') });
		await base.update(comite).set({ dissousLe: '2026-06-01' }).where(eq(comite.id, idComite('Amicale')));
		expect(await accueilDe(base, acteur(alice), `comite:${idComite('Amicale')}`, aujourdhui, `${aujourdhui}T00:00`, centreExemple.astreinte)).toMatchObject({ choisie: 'astreinte', contenu: { type: 'astreinte' } });
	});

	it('qui gère une ressource : ses demandes de réservation à décider, comptées sur sa casquette (comité ou rôle)', async () => {
		const { base, role, idComite, nouvelle, nommer } = await jeu();
		const alice = await nouvelle('Alice');
		const bruno = await nouvelle('Bruno');
		const remi = await nouvelle('Remi');
		const amicale = idComite('Amicale');
		await nommer(bruno, role('Membre de comité'), { type: 'comite', id: amicale });
		await nommer(remi, role('Référent engins'), { type: 'centre' });
		const maintenant = `${aujourdhui}T10:00`;
		const bancs = await ajouterRessource(base, acteur(bruno), { nom: 'Bancs', stock: 12, icone: 'groupe', comiteId: amicale }, maintenant);
		const [vl] = await base.select().from(ressource).where(eq(ressource.forme, 'creneau'));
		await reserver(base, acteur(alice), bancs, { debut: '2026-11-12', fin: '2026-11-14', quantite: 4 }, maintenant);
		const { id: refusee } = await reserver(base, acteur(alice), bancs, { debut: '2026-11-20', fin: '2026-11-20', quantite: 1 }, maintenant);
		await refuser(base, acteur(bruno), refusee, null, maintenant);
		await reserver(base, acteur(alice), vl!.id, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant);
		await reserver(base, acteur(bruno), vl!.id, { debut: '2026-11-07T10:00', fin: '2026-11-07T11:00' }, maintenant);

		const deBruno = await accueilDe(base, acteur(bruno), null, aujourdhui, `${aujourdhui}T00:00`, centreExemple.astreinte);
		expect(deBruno.casquettes.find((c) => c.id === `comite:${amicale}`)!.compte).toBe(1);
		expect(deBruno).toMatchObject({ choisie: `comite:${amicale}`, contenu: { type: 'comite', aDecider: [{ texte: 'Bancs, 4, du 12 au 14 nov., Alice Test', lien: '/reservations/a-valider' }] } });
		const deRemi = await accueilDe(base, acteur(remi), null, aujourdhui, `${aujourdhui}T00:00`, centreExemple.astreinte);
		expect(deRemi).toMatchObject({ choisie: `role:${role('Référent engins')}`, contenu: { type: 'role', aDecider: [{ texte: 'VL, 7 nov., 10 h – 11 h, Bruno Test', lien: '/reservations/a-valider' }] } });
		// Alice, sans rien à gérer : aucune requête de plus, rien à décider.
		expect((await casquettesDe(base, acteur(alice), aujourdhui)).every((c) => c.compte === 0)).toBe(true);
	});

	it('par défaut : où quelque chose attend, sinon la principale ; centre : « À décider » lu une fois', async () => {
		const { base, role, nouvelle, nommer } = await jeu();
		const chef = await nouvelle('Claire');
		await nommer(chef, role('Chef de centre'), { type: 'centre' });
		const accueil = await accueilDe(base, acteur(chef), null, aujourdhui, `${aujourdhui}T00:00`, centreExemple.astreinte);
		expect(accueil).toMatchObject({ choisie: 'centre', contenu: { type: 'centre', aDecider: await aDecider(base, acteur(chef), aujourdhui) } });
		expect(accueil.casquettes[0]!.compte).toBe((accueil.contenu as { aDecider: unknown[] }).aDecider.length);
		expect((await accueilDe(base, acteur(chef), 'astreinte', aujourdhui, `${aujourdhui}T00:00`, centreExemple.astreinte)).contenu).toEqual({ type: 'astreinte' });

		const [equipe1] = await base.select().from(equipe).limit(1);
		const alice = await nouvelle('Alice');
		await nommer(alice, role('Chef de garde'), { type: 'equipe', id: equipe1!.id });
		expect(await accueilDe(base, acteur(alice), null, aujourdhui, `${aujourdhui}T00:00`, centreExemple.astreinte)).toMatchObject({ choisie: `equipe:${equipe1!.id}`, contenu: { type: 'equipe' } });
	});
});

describe('À décider : l’été', () => {
	const reglage = centreExemple.astreinte;
	const ete = (base: Awaited<ReturnType<typeof jeuEte>>['base'], chef: Acteur, jour: string) =>
		aDecider(base, chef, jour, reglage).then((l) => l.filter((x) => x.texte.startsWith('Été')));

	it('à ouvrir à partir du 1er mars ; ouvert : rien jusqu’à la date limite ; puis à publier ; publié : plus rien', async () => {
		const { base, chef } = await jeuEte();
		const lien = '/planning/ete?annee=2027';
		expect(await ete(base, chef, '2027-02-28')).toEqual([]);
		expect(await ete(base, chef, '2027-03-01')).toEqual([{ texte: 'Été 2027 à ouvrir', lien }]);
		expect(await ete(base, chef, '2027-08-31')).toEqual([{ texte: 'Été 2027 à ouvrir', lien }]);
		expect(await ete(base, chef, '2027-09-01')).toEqual([]);
		// Sans l'astreinte du centre : rien sur l'été.
		expect((await aDecider(base, chef, '2027-03-01')).filter((x) => x.texte.startsWith('Été'))).toEqual([]);
		await reglerEte(base, chef, 2027, periodeParDefaut(2027, reglage), '2027-03-01T10:00', reglage);
		expect(await ete(base, chef, '2027-05-15')).toEqual([]);
		expect(await ete(base, chef, '2027-05-16')).toEqual([{ texte: 'Été 2027 à publier', lien }]);
		await proposerEte(base, chef, 2027, '2027-05-16T10:00', reglage);
		await publierEte(base, chef, 2027, '2027-05-16T10:00', reglage);
		expect(await ete(base, chef, '2027-05-16')).toEqual([]);
		// Après l'été : rien.
		expect(await ete(base, { type: 'super', email: 'a@b.fr' }, '2027-09-10')).toEqual([]);
	});

	it('proposé, non publié : les plages à revoir, comptées comme l’écran Été ; la casquette les compte', async () => {
		const { base, chef, nouvelle, apte } = await jeuEte();
		await reglerEte(base, chef, 2027, periodeParDefaut(2027, reglage), '2027-03-01T10:00', reglage);
		// Il manque un CE partout : toutes les plages sont à revoir.
		for (const [prenom, ...aptitudes] of [['Hugo', 'CA2'], ['Léa', 'CE'], ['Inès', 'COD1'], ['Jules'], ['Sarah']] as [string, ...string[]][]) await apte(await nouvelle(prenom, 1), ...aptitudes);
		await proposerEte(base, chef, 2027, '2027-04-01T10:00', reglage);
		const n = (await eteAPreparer(base, chef, 2027, '2027-04-01T10:00', reglage)).impossibles.length;
		expect(n).toBeGreaterThan(1);
		expect(await ete(base, chef, '2027-04-01')).toEqual([{ texte: `Été 2027 : ${n} plages à revoir`, lien: '/planning/ete?annee=2027' }]);
		const centre = (await accueilDe(base, chef, 'centre', '2027-04-01', '2027-04-01T10:00', reglage)).casquettes.find((c) => c.id === 'centre');
		expect(centre!.compte).toBe((await aDecider(base, chef, '2027-04-01', reglage)).length);
	});

	it('l’été de l’an prochain, déjà ouvert et proposé : dit dès maintenant', async () => {
		const { base, chef } = await jeuEte();
		await reglerEte(base, chef, 2027, periodeParDefaut(2027, reglage), '2026-11-02T10:00', reglage);
		await proposerEte(base, chef, 2027, '2026-11-02T10:00', reglage);
		expect((await ete(base, chef, '2026-11-02'))[0]!.texte).toMatch(/^Été 2027 : \d+ plages à revoir$/);
	});
});
