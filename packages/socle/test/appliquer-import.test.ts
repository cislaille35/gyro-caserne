import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { apercuImport, type FichierLu, type Operation } from '../src/apercu-import.ts';
import { appliquerOperation } from '../src/appliquer-import.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { donneesFichier } from '../src/fichier-effectif.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { affectationEquipe, attribution, comite, journal, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-27';
const reservees = ['Super@Exemple.fr'];

async function jeu() {
	const base = await baseDeTest({ compter: true });
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const profilAgent = profils.find((p) => p.typePersonne === 'agent')!;
	const responsabilites = await base.select().from(responsabilite);
	const resp = (nom: string) => responsabilites.find((r) => r.nom === nom)!.id;
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));

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
	const appliquer = (op: Operation, nouvelles: Record<number, number> = {}, qui: Acteur = acteur) => appliquerOperation(base, qui, op, nouvelles, aujourdhui, reservees);
	const journalDe = async (cibleType: string, cibleId: number) => (await base.select().from(journal).where(and(eq(journal.cibleType, cibleType), eq(journal.cibleId, cibleId)))).map((j) => j.action);
	return { base, acteur, profilAgent, resp, amicale: amicale!, nouvelle, nommer, chef, roleChef, adjoint, appliquer, journalDe };
}

describe('appliquerOperation : chaque type', () => {
	it('ajouter : crée l’agent, renvoie son id', async () => {
		const { base, appliquer, profilAgent, journalDe } = await jeu();
		const { personneId } = await appliquer({ ligne: 2, type: 'ajouter', donnees: { email: 'nina.roux@exemple.fr', prenom: 'Nina', nom: 'Roux', profilId: profilAgent.id, equipeId: 2, statut: 'stagiaire' } });
		const [fiche] = await base.select().from(personne).where(eq(personne.id, personneId!));
		expect(fiche).toMatchObject({ email: 'nina.roux@exemple.fr', statut: 'stagiaire' });
		expect(await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, personneId!))).toMatchObject([{ equipeId: 2, debut: aujourdhui }]);
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
		const { base, appliquer, nouvelle, journalDe } = await jeu();
		const id = await nouvelle('Paul', 'Petit', 1);
		await appliquer({ ligne: 3, type: 'equipe', personneId: id, equipeId: 3 });
		const affectations = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id));
		expect(affectations.find((a) => a.fin === null)).toMatchObject({ equipeId: 3, debut: aujourdhui });
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
		const { base, appliquer, chef, roleChef, adjoint, resp } = await jeu();
		const message = 'Le chef de centre et l’adjoint se modifient à l’écran';
		const ops: Operation[] = [
			{ ligne: 2, type: 'modifier', personneId: chef, champs: { prenom: 'Autre' } },
			{ ligne: 2, type: 'statut', personneId: adjoint, statut: 'parti' },
			{ ligne: 2, type: 'equipe', personneId: adjoint, equipeId: 1 },
			{ ligne: 2, type: 'attribuer', personne: { id: adjoint }, responsabiliteId: resp('Référent engins'), perimetre: { type: 'centre' } },
			{ ligne: 2, type: 'terminer', attributionId: roleChef }
		];
		const avant = await base.select().from(journal);
		for (const op of ops) await expect(appliquer(op), op.type).rejects.toThrow(new DonneeInvalide(message));
		expect(await base.select().from(journal)).toEqual(avant);
	});
});

describe('appliquerOperation : limites', () => {
	it('chaque appel reste sous 50 requêtes', async () => {
		const { base, appliquer, nouvelle, nommer, resp, profilAgent, amicale } = await jeu();
		const id = await nouvelle('Paul', 'Petit', 1);
		const a = await nommer(id, resp('Référent engins'), { type: 'centre' });
		const ops: Operation[] = [
			{ ligne: 2, type: 'ajouter', donnees: { email: 'nina.roux@exemple.fr', prenom: 'Nina', nom: 'Roux', profilId: profilAgent.id, equipeId: 2, statut: 'stagiaire', gradeId: null, telephone: '0600000000', naissance: '2000-03-01' } },
			{ ligne: 3, type: 'modifier', personneId: id, champs: { prenom: 'Pierre', email: 'pierre.petit@exemple.fr', profilId: profilAgent.id } },
			{ ligne: 3, type: 'equipe', personneId: id, equipeId: 2 },
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
		const { base, acteur, appliquer, nouvelle, nommer, resp } = await jeu();
		const paul = await nouvelle('Paul', 'Petit', 1);
		const zoe = await nouvelle('Zoé', 'Zinc', 1);
		await nommer(zoe, resp('Référent engins'), { type: 'centre' });
		const d = await donneesFichier(base, acteur, aujourdhui, false);
		const fichier: FichierLu = { entetes: d.entetes, lignes: d.lignes.map((cellules, i) => ({ numero: i + 2, cellules: [...cellules] })), repere: d.repere };
		const col = (e: string) => fichier.entetes.indexOf(e);
		// Paul change d'équipe, Zoé quitte le fichier, deux arrivées dont une avec rôles.
		fichier.lignes.find((l) => l.cellules[0] === String(paul))!.cellules[col('Équipe')] = 'Équipe 2';
		fichier.lignes = fichier.lignes.filter((l) => l.cellules[0] !== String(zoe));
		const arrivee = (numero: number, valeurs: Record<string, string>) => fichier.lignes.push({ numero, cellules: fichier.entetes.map((e) => valeurs[e] ?? '') });
		arrivee(10, { 'E-mail': 'nina.roux@exemple.fr', Prénom: 'Nina', Nom: 'Roux', Profil: 'Agent', Équipe: 'Équipe 3', 'Chef d’équipe': 'Oui', 'Comité : Amicale': 'Membre de comité' });
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
				[resp('Chef d’équipe'), 3, null],
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
