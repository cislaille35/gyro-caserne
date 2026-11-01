import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { RefusDroit } from '../src/erreurs.ts';
import { dateFichier, dateIso, donneesFichier, ENTETES } from '../src/fichier-effectif.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { affectationEquipe, attribution, comite, grade, journal, personne, profil, responsabilite } from '../src/schema.ts';
import type { StatutOperationnel } from '../src/listes.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-27';

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const profilAgent = profils.find((p) => p.typePersonne === 'agent')!;
	const profilExt = profils.find((p) => p.typePersonne === 'exterieur')!;
	const [sap] = await base.select().from(grade).where(eq(grade.code, 'Sap'));
	const responsabilites = await base.select().from(responsabilite);
	const resp = (nom: string) => responsabilites.find((r) => r.nom === nom)!.id;
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));

	const nouvelle = async (prenom: string, nom: string, options: { profilId?: number; statut?: StatutOperationnel; equipeId?: number } = {}) => {
		const [p] = await base
			.insert(personne)
			.values({ email: `${prenom}.${nom}@exemple.fr`.toLowerCase(), prenom, nom, profilId: options.profilId ?? profilAgent.id, gradeId: sap!.id, statut: options.statut ?? 'operationnel' })
			.returning();
		if (options.equipeId) await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId: options.equipeId, debut: '2026-01-01' });
		return p!.id;
	};
	const nommer = async (personneId: number, responsabiliteId: number, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }, fin: string | null = null) => {
		await base.insert(attribution).values({ personneId, responsabiliteId, perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: '2026-01-01', fin, saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	};

	const chef = await nouvelle('Claire', 'Chef');
	await nommer(chef, resp('Chef de centre'), { type: 'centre' });
	const adjoint = await nouvelle('Alain', 'Adjoint');
	await nommer(adjoint, resp('Chef de centre adjoint'), { type: 'centre' });
	return { base, profilAgent, profilExt, resp, amicale: amicale!, nouvelle, nommer, chef: { type: 'personne', id: chef } as Acteur };
}

describe('donneesFichier', () => {
	it('exporte tous sauf le chef de centre et l’adjoint en fonction, partis et extérieurs compris, triés par nom', async () => {
		const { base, profilExt, resp, nouvelle, nommer, chef } = await jeu();
		await nouvelle('Zoé', 'Martin', { equipeId: 1 });
		await nouvelle('Paul', 'Bernard', { statut: 'parti' });
		await nouvelle('Ext', 'Durand', { profilId: profilExt.id });
		const ancien = await nouvelle('Ancien', 'Adjoint');
		await nommer(ancien, resp('Chef de centre adjoint'), { type: 'centre' }, '2026-06-30');

		const { lignes } = await donneesFichier(base, chef, aujourdhui, false);
		expect(lignes.map((l) => l[3])).toEqual(['Adjoint', 'Bernard', 'Durand', 'Martin']);
		expect(lignes[1]![7]).toBe('Parti');
		expect(lignes[2]![8]).toBe('Réserve citoyenne');
	});

	it('met les colonnes de responsabilités puis de comités, et leurs listes', async () => {
		const { base, chef } = await jeu();
		await base.insert(responsabilite).values({ nom: 'Archivée', nature: 'mission', typePerimetre: 'centre', archiveeLe: '2026-06-01' });
		await base.insert(comite).values({ nom: 'Dissous', theme: 'vie', dissousLe: '2026-06-01' });

		const donnees = await donneesFichier(base, chef, aujourdhui, false);
		expect(donnees.entetes).toEqual([
			...ENTETES,
			'Chef d’équipe',
			'Référent engins',
			'Référent pharmacie',
			'Référent technique',
			'Comité : Amicale',
			'Comité : Comité du centre'
		]);
		expect(donnees.colonnesListe).toEqual({
			Grade: 'grades',
			Équipe: 'equipes',
			Statut: 'statuts',
			Profil: 'profils',
			'Chef d’équipe': 'oui',
			'Référent engins': 'oui',
			'Référent pharmacie': 'oui',
			'Référent technique': 'oui',
			'Comité : Amicale': 'rolesComite',
			'Comité : Comité du centre': 'rolesComite'
		});
		expect(donnees.listes.equipes).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3', 'Équipe 4']);
		expect(donnees.listes.statuts).toEqual(['Opérationnel', 'Stagiaire', 'Inapte temporaire', 'Suspendu', 'Parti']);
		expect(donnees.listes.profils).toEqual(['Agent', 'Réserve citoyenne']);
		expect(donnees.listes.rolesComite).toEqual(['Membre de comité', 'Rapporteur de comité']);
		expect(donnees.listes.grades[0]).toBe('Jeune sapeur-pompier');
	});

	it('remplit la ligne : fiche, équipe, rôles et dates en JJ/MM/AAAA', async () => {
		const { base, resp, amicale, nouvelle, nommer, chef } = await jeu();
		const id = await nouvelle('Léa', 'Durand', { equipeId: 2 });
		await base
			.update(personne)
			.set({ telephone: '0600000000', naissance: '1990-03-01', dateGrade: '2020-12-31', entreeCentre: '2015-09-01', engagementSpv: '2016-01-15' })
			.where(eq(personne.id, id));
		await nommer(id, resp('Chef d’équipe'), { type: 'equipe', id: 2 });
		await nommer(id, resp('Membre de comité'), { type: 'comite', id: amicale.id });
		await nommer(id, resp('Référent engins'), { type: 'centre' }, '2026-10-26');

		const donnees = await donneesFichier(base, chef, aujourdhui, false);
		const ligne = Object.fromEntries(donnees.entetes.map((e, i) => [e, donnees.lignes[0]![i]]));
		expect(ligne).toEqual({
			'N°': String(id),
			'E-mail': 'léa.durand@exemple.fr',
			Prénom: 'Léa',
			Nom: 'Durand',
			Grade: 'Sapeur',
			'Date de grade': '31/12/2020',
			Équipe: 'Équipe 2',
			Statut: 'Opérationnel',
			Profil: 'Agent',
			Téléphone: '0600000000',
			Naissance: '01/03/1990',
			'Entrée au centre': '01/09/2015',
			'Engagement SPV': '15/01/2016',
			'Chef d’équipe': 'Oui',
			'Référent engins': '',
			'Référent pharmacie': '',
			'Référent technique': '',
			'Comité : Amicale': 'Membre de comité',
			'Comité : Comité du centre': ''
		});
	});

	it('donne le repère : plus grands n° du journal et des personnes, date de l’export', async () => {
		const { base, nouvelle, chef } = await jeu();
		const dernier = await nouvelle('Léa', 'Durand');
		const [ligne] = await base.insert(journal).values({ quand: '2026-10-27', acteur: 'super:a@b.fr', action: 'essai', cibleType: 'personne', cibleId: null }).returning();
		expect((await donneesFichier(base, chef, aujourdhui, false)).repere).toEqual({ journal: ligne!.id, personne: dernier, date: aujourdhui });
	});

	it('modèle vierge : en-têtes et listes, sans ligne ni repère', async () => {
		const { base, nouvelle, chef } = await jeu();
		await nouvelle('Léa', 'Durand');
		const modele = await donneesFichier(base, chef, aujourdhui, true);
		expect(modele.lignes).toEqual([]);
		expect(modele.repere).toBeNull();
		expect(modele.entetes.length).toBeGreaterThan(ENTETES.length);
	});

	it('refuse un agent ordinaire', async () => {
		const { base, nouvelle } = await jeu();
		const agent = await nouvelle('Léa', 'Durand');
		await expect(donneesFichier(base, { type: 'personne', id: agent }, aujourdhui, false)).rejects.toThrow(RefusDroit);
	});

	it('reste sous 50 requêtes avec 150 agents', async () => {
		const { base, profilAgent, resp, amicale, chef } = await jeu();
		const personnes = await base
			.insert(personne)
			.values(Array.from({ length: 150 }, (_, i) => ({ email: `agent${i}@exemple.fr`, prenom: 'Agent', nom: `N${i}`, profilId: profilAgent.id })))
			.returning();
		await base.insert(affectationEquipe).values(personnes.map((p, i) => ({ personneId: p.id, equipeId: (i % 3) + 1, debut: '2026-01-01' })));
		await base.insert(attribution).values(
			personnes.map((p) => ({ personneId: p.id, responsabiliteId: resp('Membre de comité'), perimetreType: 'comite' as const, perimetreId: amicale.id, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' }))
		);

		const avant = base.requetes;
		const { lignes } = await donneesFichier(base, chef, aujourdhui, false);
		expect(lignes).toHaveLength(150);
		expect(base.requetes - avant).toBeLessThanOrEqual(50);
	});
});

describe('dates du fichier', () => {
	it('écrit JJ/MM/AAAA, vide pour une date absente', () => {
		expect(dateFichier('2024-03-01')).toBe('01/03/2024');
		expect(dateFichier(null)).toBe('');
	});

	it('lit JJ/MM/AAAA et J/M/AAAA, refuse une date impossible', () => {
		expect(dateIso('1/3/2024')).toBe('2024-03-01');
		expect(dateIso('01/03/2024')).toBe('2024-03-01');
		expect(dateIso('31/02/2024')).toBeNull();
		expect(dateIso('2024-03-01')).toBeNull();
		expect(dateIso('')).toBeNull();
	});
});

describe('baseDeTest', () => {
	it('compte les requêtes, un batch pour une', async () => {
		const base = await baseDeTest();
		const avant = base.requetes;
		await base.select().from(personne);
		await base.batch([base.select().from(personne), base.select().from(grade)]);
		expect(base.requetes - avant).toBe(2);
	});
});
