import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { apercuImport, type FichierLu, type Operation } from '../src/apercu-import.ts';
import { appliquerOperation } from '../src/appliquer-import.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { donneesFichier } from '../src/fichier-effectif.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { affectationEquipe, aptitude, aptitudeAgent, attribution, comite, equipe, journal, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-27';
const midi = `${aujourdhui}T12:00`;
const reservees = ['Super@Exemple.fr'];

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const profilAgent = profils.find((p) => p.typePersonne === 'agent')!;
	const responsabilites = await base.select().from(responsabilite);
	const resp = (nom: string) => responsabilites.find((r) => r.nom === nom)!.id;
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
	const equipes = await base.select().from(equipe);
	const [e1, e2, e3] = [1, 2, 3].map((n) => equipes.find((e) => e.nom === `Équipe ${n}`)!.id) as [number, number, number];

	const nouvelle = async (prenom: string, nom: string, equipeId?: number) => {
		const [p] = await base.insert(personne).values({ email: `${prenom}.${nom}@exemple.fr`.toLowerCase(), prenom, nom, profilId: profilAgent.id }).returning();
		if (equipeId) await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId, debut: '2026-01-01' });
		return p!.id;
	};
	const nommer = async (personneId: number, responsabiliteId: number, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }) => {
		const [a] = await base
			.insert(attribution)
			.values({ personneId, responsabiliteId, perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' })
			.returning();
		return a!.id;
	};

	const chef = await nouvelle('Claire', 'Chef');
	const roleChef = await nommer(chef, resp('Chef de centre'), { type: 'centre' });
	const adjoint = await nouvelle('Alain', 'Adjoint');
	await nommer(adjoint, resp('Chef de centre adjoint'), { type: 'centre' });
	const acteur: Acteur = { type: 'personne', id: chef };
	const appliquer = (op: Operation, nouvelles: Record<number, number> = {}, qui: Acteur = acteur) => appliquerOperation(base, base.photos, qui, op, nouvelles, midi, reservees);
	const journalDe = async (cibleType: string, cibleId: number) => (await base.select().from(journal).where(and(eq(journal.cibleType, cibleType), eq(journal.cibleId, cibleId)))).map((j) => j.action);
	return { base, acteur, profilAgent, resp, amicale: amicale!, e1, e2, e3, nouvelle, nommer, chef, roleChef, adjoint, appliquer, journalDe };
}

describe('appliquerOperation : chaque type', () => {
	it('ajouter : crée l’agent, renvoie son id', async () => {
		const { base, appliquer, profilAgent, journalDe, e2 } = await jeu();
		const { personneId } = await appliquer({ ligne: 2, type: 'ajouter', donnees: { email: 'nina.roux@exemple.fr', prenom: 'Nina', nom: 'Roux', profilId: profilAgent.id, equipeId: e2, statut: 'stagiaire' } });
		const [fiche] = await base.select().from(personne).where(eq(personne.id, personneId!));
		expect(fiche).toMatchObject({ email: 'nina.roux@exemple.fr', statut: 'stagiaire' });
		expect(await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, personneId!))).toMatchObject([{ equipeId: e2, debut: aujourdhui }]);
		expect(await journalDe('personne', personneId!)).toEqual(['ajouter_personne']);
	});

	it('modifier : change les champs', async () => {
		const { base, appliquer, nouvelle, journalDe } = await jeu();
		const id = await nouvelle('Paul', 'Petit');
		expect(await appliquer({ ligne: 3, type: 'modifier', personneId: id, champs: { prenom: 'Pierre', telephone: '0600000000' } })).toEqual({ personneId: null });
		const [fiche] = await base.select().from(personne).where(eq(personne.id, id));
		expect(fiche).toMatchObject({ prenom: 'Pierre', telephone: '0600000000' });
		expect(await journalDe('personne', id)).toEqual(['modifier_fiche']);
	});

	it('equipe : affecte aujourd’hui, ou retire si vide', async () => {
		const { base, appliquer, nouvelle, journalDe, e1, e3 } = await jeu();
		const id = await nouvelle('Paul', 'Petit', e1);
		await appliquer({ ligne: 3, type: 'equipe', personneId: id, equipeId: e3 });
		const affectations = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id));
		expect(affectations.find((a) => a.fin === null)).toMatchObject({ equipeId: e3, debut: aujourdhui });
		await appliquer({ ligne: 3, type: 'equipe', personneId: id, equipeId: null });
		expect((await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id))).filter((a) => a.fin === null)).toEqual([]);
		expect(await journalDe('personne', id)).toEqual(['affecter_equipe', 'retirer_equipe']);
	});

	it('statut : change le statut', async () => {
		const { base, appliquer, nouvelle, journalDe } = await jeu();
		const id = await nouvelle('Paul', 'Petit');
		await appliquer({ ligne: 0, type: 'statut', personneId: id, statut: 'parti' });
		const [fiche] = await base.select().from(personne).where(eq(personne.id, id));
		expect(fiche!.statut).toBe('parti');
		expect(await journalDe('personne', id)).toEqual(['changer_statut']);
	});

	it('attribuer : à un agent existant ou à celui créé par sa ligne', async () => {
		const { base, appliquer, nouvelle, resp, amicale } = await jeu();
		const id = await nouvelle('Paul', 'Petit');
		const nina = await nouvelle('Nina', 'Roux');
		await appliquer({ ligne: 3, type: 'attribuer', personne: { id }, responsabiliteId: resp('Référent engins'), perimetre: { type: 'centre' } });
		await appliquer({ ligne: 4, type: 'attribuer', personne: { ligne: 4 }, responsabiliteId: resp('Membre de comité'), perimetre: { type: 'comite', id: amicale.id } }, { 4: nina });
		const lignes = await base.select().from(attribution);
		expect(lignes.find((a) => a.personneId === id)).toMatchObject({ responsabiliteId: resp('Référent engins'), debut: aujourdhui, fin: null });
		expect(lignes.find((a) => a.personneId === nina)).toMatchObject({ responsabiliteId: resp('Membre de comité'), perimetreId: amicale.id, debut: aujourdhui, fin: null });
		const journaux = await base.select().from(journal).where(eq(journal.action, 'attribuer'));
		expect(journaux).toHaveLength(2);
	});

	it('attribuer : agent de la ligne non créé', async () => {
		const { appliquer, resp } = await jeu();
		const op: Operation = { ligne: 4, type: 'attribuer', personne: { ligne: 4 }, responsabiliteId: resp('Référent engins'), perimetre: { type: 'centre' } };
		await expect(appliquer(op, { 5: 99 })).rejects.toThrow(new DonneeInvalide('Agent de la ligne non créé'));
	});

	it('terminer : met fin au rôle', async () => {
		const { base, appliquer, nouvelle, nommer, resp, journalDe } = await jeu();
		const id = await nouvelle('Paul', 'Petit');
		const a = await nommer(id, resp('Référent engins'), { type: 'centre' });
		await appliquer({ ligne: 3, type: 'terminer', attributionId: a });
		const [ligne] = await base.select().from(attribution).where(eq(attribution.id, a));
		expect(ligne!.fin).toBe('2026-10-26');
		expect(await journalDe('attribution', a)).toEqual(['terminer_attribution']);
	});

	it('aptitude : donnée le jour de l’import, ou retirée', async () => {
		const { base, appliquer, nouvelle, journalDe } = await jeu();
		const id = await nouvelle('Léa', 'Durand');
		const [ca1] = await base.select().from(aptitude).where(eq(aptitude.nom, 'CA1'));
		await appliquer({ ligne: 2, type: 'aptitude', personne: { id }, aptitudeId: ca1!.id, oui: true });
		expect(await base.select().from(aptitudeAgent)).toEqual([{ personneId: id, aptitudeId: ca1!.id, obtenueLe: aujourdhui, expireLe: null }]);
		await appliquer({ ligne: 2, type: 'aptitude', personne: { id }, aptitudeId: ca1!.id, oui: false });
		expect(await base.select().from(aptitudeAgent)).toEqual([]);
		expect(await journalDe('personne', id)).toEqual(['donner_aptitude', 'oter_aptitude']);
		await expect(appliquer({ ligne: 2, type: 'aptitude', personne: { id }, aptitudeId: ca1!.id, oui: 'oui' } as never)).rejects.toThrow(DonneeInvalide);
	});

	it('les erreurs des actions remontent telles quelles', async () => {
		const { appliquer, profilAgent } = await jeu();
		await expect(appliquer({ ligne: 2, type: 'ajouter', donnees: { email: 'claire.chef@exemple.fr', prenom: 'Claire', nom: 'Bis', profilId: profilAgent.id } })).rejects.toThrow(new DonneeInvalide('Adresse déjà utilisée'));
	});
});

describe('appliquerOperation : protections', () => {
	it('refuse un acteur non gestionnaire', async () => {
		const { appliquer, nouvelle } = await jeu();
		const id = await nouvelle('Paul', 'Petit');
		await expect(appliquer({ ligne: 3, type: 'modifier', personneId: id, champs: { prenom: 'Pierre' } }, {}, { type: 'personne', id })).rejects.toBeInstanceOf(RefusDroit);
	});

	it('refuse toute opération sur le chef de centre ou l’adjoint en fonction', async () => {
		const { base, appliquer, chef, roleChef, adjoint, resp, e1 } = await jeu();
		const message = 'Le chef de centre et l’adjoint se modifient à l’écran';
		const ops: Operation[] = [
			{ ligne: 2, type: 'modifier', personneId: chef, champs: { prenom: 'Autre' } },
			{ ligne: 2, type: 'statut', personneId: adjoint, statut: 'parti' },
			{ ligne: 2, type: 'equipe', personneId: adjoint, equipeId: e1 },
			{ ligne: 2, type: 'attribuer', personne: { id: adjoint }, responsabiliteId: resp('Référent engins'), perimetre: { type: 'centre' } },
			{ ligne: 2, type: 'terminer', attributionId: roleChef }
		];
		const avant = await base.select().from(journal);
		for (const op of ops) await expect(appliquer(op), op.type).rejects.toThrow(new DonneeInvalide(message));
		expect(await base.select().from(journal)).toEqual(avant);
	});

	it('refuse d’attribuer ou de terminer les rôles de chef de centre et d’adjoint', async () => {
		const { base, appliquer, nouvelle, resp } = await jeu();
		const id = await nouvelle('Paul', 'Petit');
		// Adjoint à venir : Paul n'est pas encore protégé, mais le rôle l'est.
		const [aVenir] = await base
			.insert(attribution)
			.values({ personneId: id, responsabiliteId: resp('Chef de centre adjoint'), perimetreType: 'centre', debut: '2026-12-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' })
			.returning();
		const message = 'Le chef de centre et l’adjoint se nomment à l’écran';
		const avant = [await base.select().from(journal), await base.select().from(attribution)];
		await expect(appliquer({ ligne: 3, type: 'attribuer', personne: { id }, responsabiliteId: resp('Chef de centre adjoint'), perimetre: { type: 'centre' } })).rejects.toThrow(new DonneeInvalide(message));
		await expect(appliquer({ ligne: 3, type: 'attribuer', personne: { id }, responsabiliteId: resp('Chef de centre'), perimetre: { type: 'centre' } })).rejects.toThrow(new DonneeInvalide(message));
		await expect(appliquer({ ligne: 3, type: 'terminer', attributionId: aVenir!.id })).rejects.toThrow(new DonneeInvalide(message));
		expect([await base.select().from(journal), await base.select().from(attribution)]).toEqual(avant);
	});
});

describe('appliquerOperation : opérations mal formées', () => {
	// Chaque cas : une opération venue d'un client, refusée avant toute écriture.
	const cas: [string, unknown, unknown?][] = [
		['opération absente', null],
		['opération tableau', []],
		['type inconnu', { ligne: 2, type: 'supprimer', personneId: 5 }],
		['ligne négative', { ligne: -1, type: 'statut', personneId: 5, statut: 'parti' }],
		['ligne non entière', { ligne: 2.5, type: 'statut', personneId: 5, statut: 'parti' }],
		['ligne texte', { ligne: '2', type: 'statut', personneId: 5, statut: 'parti' }],
		['personneId texte', { ligne: 2, type: 'modifier', personneId: '5', champs: {} }],
		['personneId nul', { ligne: 2, type: 'statut', personneId: 0, statut: 'parti' }],
		['attributionId absent', { ligne: 2, type: 'terminer' }],
		['responsabiliteId négatif', { ligne: 2, type: 'attribuer', personne: { id: 5 }, responsabiliteId: -3, perimetre: { type: 'centre' } }],
		['statut inconnu', { ligne: 2, type: 'statut', personneId: 5, statut: 'retraite' }],
		['equipeId texte', { ligne: 2, type: 'equipe', personneId: 5, equipeId: '1' }],
		['equipeId absent', { ligne: 2, type: 'equipe', personneId: 5 }],
		['champs absents', { ligne: 2, type: 'modifier', personneId: 5 }],
		['champs tableau', { ligne: 2, type: 'modifier', personneId: 5, champs: ['prenom'] }],
		['donnees nulles', { ligne: 2, type: 'ajouter', donnees: null }],
		['donnees texte', { ligne: 2, type: 'ajouter', donnees: 'nina' }],
		...(
			[
				['email absent', { email: undefined }],
				['email nombre', { email: 5 }],
				['prénom objet', { prenom: {} }],
				['nom nul', { nom: null }],
				['profilId texte', { profilId: '1' }],
				['profilId nul', { profilId: 0 }],
				['profilId immense', { profilId: 1e300 }],
				['gradeId texte', { gradeId: '1' }],
				['equipeId nul', { equipeId: null }],
				['equipeId décimal', { equipeId: 1.5 }],
				['statut inconnu', { statut: 'retraite' }],
				['téléphone nombre', { telephone: 612345678 }],
				['naissance date', { naissance: new Date() }],
				['champ inconnu', { photo: 'x' }]
			] as const
		).map(([nom, champ]): [string, unknown] => [`donnees : ${nom}`, { ligne: 2, type: 'ajouter', donnees: { email: 'nina@exemple.fr', prenom: 'Nina', nom: 'Roux', profilId: 1, ...champ } }]),
		['personneId immense', { ligne: 2, type: 'statut', personneId: 1e300, statut: 'parti' }],
		['ligne immense', { ligne: 2 ** 60, type: 'terminer', attributionId: 1 }],
		['personne absente', { ligne: 2, type: 'attribuer', responsabiliteId: 1, perimetre: { type: 'centre' } }],
		['personne vide', { ligne: 2, type: 'attribuer', personne: {}, responsabiliteId: 1, perimetre: { type: 'centre' } }],
		['personne à deux clés', { ligne: 2, type: 'attribuer', personne: { id: 5, ligne: 2 }, responsabiliteId: 1, perimetre: { type: 'centre' } }],
		['personne id texte', { ligne: 2, type: 'attribuer', personne: { id: '5' }, responsabiliteId: 1, perimetre: { type: 'centre' } }],
		['périmètre absent', { ligne: 2, type: 'attribuer', personne: { id: 5 }, responsabiliteId: 1 }],
		['périmètre de type inconnu', { ligne: 2, type: 'attribuer', personne: { id: 5 }, responsabiliteId: 1, perimetre: { type: 'planete', id: 1 } }],
		['périmètre comité sans id', { ligne: 2, type: 'attribuer', personne: { id: 5 }, responsabiliteId: 1, perimetre: { type: 'comite' } }],
		['nouvelles à prototype', { ligne: 2, type: 'attribuer', personne: { ligne: 11 }, responsabiliteId: 1, perimetre: { type: 'centre' } }, Object.create({ 11: 5 })],
		['nouvelles avec id texte', { ligne: 2, type: 'attribuer', personne: { ligne: 4 }, responsabiliteId: 1, perimetre: { type: 'centre' } }, { 4: '5' }],
		['nouvelles absentes', { ligne: 2, type: 'attribuer', personne: { ligne: 4 }, responsabiliteId: 1, perimetre: { type: 'centre' } }, null]
	];

	it.each(cas)('%s : DonneeInvalide, journal inchangé', async (_nom, op, nouvelles = {}) => {
		const { base, acteur } = await jeu();
		const avant = await base.select().from(journal);
		const requetes = base.requetes;
		const erreur = await appliquerOperation(base, base.photos, acteur, op as Operation, nouvelles as Record<number, number>, midi, reservees).catch((e: unknown) => e);
		expect(erreur).toBeInstanceOf(DonneeInvalide);
		expect(base.requetes).toBe(requetes);
		expect(await base.select().from(journal)).toEqual(avant);
	});

	it('type inconnu : message dédié', async () => {
		const { appliquer } = await jeu();
		await expect(appliquer({ ligne: 2, type: 'supprimer' } as unknown as Operation)).rejects.toThrow(new DonneeInvalide('Opération inconnue'));
	});
});

describe('appliquerOperation : limites', () => {
	it('chaque appel reste sous 50 requêtes', async () => {
		const { base, appliquer, nouvelle, nommer, resp, profilAgent, amicale, e1, e2 } = await jeu();
		const id = await nouvelle('Paul', 'Petit', e1);
		const a = await nommer(id, resp('Référent engins'), { type: 'centre' });
		const ops: Operation[] = [
			{ ligne: 2, type: 'ajouter', donnees: { email: 'nina.roux@exemple.fr', prenom: 'Nina', nom: 'Roux', profilId: profilAgent.id, equipeId: e2, statut: 'stagiaire', gradeId: null, telephone: '0600000000', naissance: '2000-03-01' } },
			{ ligne: 3, type: 'modifier', personneId: id, champs: { prenom: 'Pierre', email: 'pierre.petit@exemple.fr', profilId: profilAgent.id } },
			{ ligne: 3, type: 'equipe', personneId: id, equipeId: e2 },
			{ ligne: 3, type: 'terminer', attributionId: a },
			{ ligne: 3, type: 'attribuer', personne: { ligne: 2 }, responsabiliteId: resp('Membre de comité'), perimetre: { type: 'comite', id: amicale.id } },
			{ ligne: 0, type: 'statut', personneId: id, statut: 'parti' }
		];
		const nouvelles: Record<number, number> = {};
		for (const op of ops) {
			const avant = base.requetes;
			const { personneId } = await appliquer(op, nouvelles);
			if (op.type === 'ajouter') nouvelles[op.ligne] = personneId!;
			expect(base.requetes - avant, op.type).toBeLessThanOrEqual(50);
		}
	});
});

describe('appliquerOperation : enchaînement', () => {
	it('aperçu, tout appliquer, puis nouvel aperçu du même fichier : rien de perdu, aucun départ des arrivées', async () => {
		const { base, acteur, appliquer, nouvelle, nommer, resp, e1, e3 } = await jeu();
		const paul = await nouvelle('Paul', 'Petit', e1);
		const zoe = await nouvelle('Zoé', 'Zinc', e1);
		await nommer(zoe, resp('Référent engins'), { type: 'centre' });
		const d = await donneesFichier(base, acteur, aujourdhui, false);
		const fichier: FichierLu = { entetes: d.entetes, lignes: d.lignes.map((cellules, i) => ({ numero: i + 2, cellules: [...cellules] })), repere: d.repere };
		const col = (e: string) => fichier.entetes.indexOf(e);
		// Paul change d'équipe, Zoé quitte le fichier, deux arrivées dont une avec rôles.
		fichier.lignes.find((l) => l.cellules[0] === String(paul))!.cellules[col('Équipe')] = 'Équipe 2';
		fichier.lignes = fichier.lignes.filter((l) => l.cellules[0] !== String(zoe));
		const arrivee = (numero: number, valeurs: Record<string, string>) => fichier.lignes.push({ numero, cellules: fichier.entetes.map((e) => valeurs[e] ?? '') });
		arrivee(10, { 'E-mail': 'nina.roux@exemple.fr', Prénom: 'Nina', Nom: 'Roux', Profil: 'Agent', Équipe: 'Équipe 3', 'Chef de garde': 'Oui', 'Comité : Amicale': 'Membre de comité' });
		arrivee(11, { 'E-mail': 'omar.ours@exemple.fr', Prénom: 'Omar', Nom: 'Ours', Profil: 'Agent' });

		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([]);
		expect(apercu.departs.map((p) => p.personneId)).toEqual([zoe]);
		const nouvelles: Record<number, number> = {};
		for (const op of apercu.operations) {
			const { personneId } = await appliquer(op, nouvelles);
			if (op.type === 'ajouter') nouvelles[op.ligne] = personneId!;
		}
		const nina = nouvelles[10]!;
		const omar = nouvelles[11]!;
		const statuts = new Map((await base.select().from(personne)).map((p) => [p.id, p.statut]));
		expect([statuts.get(nina), statuts.get(omar), statuts.get(paul), statuts.get(zoe)]).toEqual(['operationnel', 'operationnel', 'operationnel', 'parti']);
		const rolesNina = await base.select().from(attribution).where(eq(attribution.personneId, nina));
		expect(rolesNina.map((a) => [a.responsabiliteId, a.perimetreId, a.fin])).toEqual(
			expect.arrayContaining([
				[resp('Chef de garde'), e3, null],
				[resp('Membre de comité'), expect.any(Number), null]
			])
		);

		const photo = async () => [await base.select().from(personne), await base.select().from(attribution), await base.select().from(affectationEquipe)];
		const avant = await photo();
		const encore = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(encore.departs).toEqual([]);
		expect(encore.operations.filter((o) => o.type === 'statut')).toEqual([]);
		expect(encore.erreurs).toEqual([
			{ ligne: 10, colonne: 'E-mail', message: `Adresse déjà utilisée par l’agent n° ${nina}` },
			{ ligne: 11, colonne: 'E-mail', message: `Adresse déjà utilisée par l’agent n° ${omar}` }
		]);
		expect(encore.perimees.map((p) => p.nom)).toContain('Paul Petit');
		for (const op of encore.operations) await appliquer(op, {});
		expect(await photo()).toEqual(avant);
	});
});
