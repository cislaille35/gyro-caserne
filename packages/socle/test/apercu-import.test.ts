import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { modifierFiche } from '../src/actions/personnes.ts';
import { apercuImport, type FichierLu } from '../src/apercu-import.ts';
import type { Acteur } from '../src/droits.ts';
import { RefusDroit } from '../src/erreurs.ts';
import { donneesFichier, ENTETES } from '../src/fichier-effectif.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import type { StatutOperationnel } from '../src/listes.ts';
import { affectationEquipe, attribution, comite, equipe, grade, journal, personne, profil, profilDroit, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-27';
const reservees = ['Super@Exemple.fr'];

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const profilAgent = profils.find((p) => p.typePersonne === 'agent')!;
	const grades = await base.select().from(grade);
	const sap = grades.find((g) => g.code === 'Sap')!;
	const responsabilites = await base.select().from(responsabilite);
	const resp = (nom: string) => responsabilites.find((r) => r.nom === nom)!.id;
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));

	const nouvelle = async (prenom: string, nom: string, options: { profilId?: number; statut?: StatutOperationnel; equipeId?: number } = {}) => {
		const [p] = await base
			.insert(personne)
			.values({ email: `${prenom}.${nom}@exemple.fr`.toLowerCase(), prenom, nom, profilId: options.profilId ?? profilAgent.id, gradeId: sap.id, statut: options.statut ?? 'operationnel' })
			.returning();
		if (options.equipeId) await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId: options.equipeId, debut: '2026-01-01' });
		return p!.id;
	};
	const nommer = async (personneId: number, responsabiliteId: number, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }, fin: string | null = null) => {
		const [a] = await base
			.insert(attribution)
			.values({ personneId, responsabiliteId, perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: '2026-01-01', fin, saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' })
			.returning();
		return a!.id;
	};

	const chef = await nouvelle('Claire', 'Chef');
	await nommer(chef, resp('Chef de centre'), { type: 'centre' });
	const adjoint = await nouvelle('Alain', 'Adjoint');
	await nommer(adjoint, resp('Chef de centre adjoint'), { type: 'centre' });
	const acteur: Acteur = { type: 'personne', id: chef };
	// Gestionnaire sans droit d'attribuer : GERER_ACCES seulement.
	const secretaire = async () => {
		const [secretariat] = await base.insert(profil).values({ nom: 'Secrétariat', typePersonne: 'agent' }).returning();
		await base.insert(profilDroit).values({ profilId: secretariat!.id, droit: 'GERER_ACCES', perimetreType: 'centre', perimetreId: null });
		return nouvelle('Sam', 'Secret', { profilId: secretariat!.id });
	};
	return { secretaire, base, profilAgent, sap, grades, resp, amicale: amicale!, nouvelle, nommer, chef, adjoint, acteur };
}

// Le fichier tel qu'exporté : une ligne de tableur par agent, à partir de la ligne 2.
async function exporter(base: Awaited<ReturnType<typeof jeu>>['base'], acteur: Acteur, modele = false, le = aujourdhui): Promise<FichierLu> {
	const d = await donneesFichier(base, acteur, le, modele);
	return { entetes: d.entetes, lignes: d.lignes.map((cellules, i) => ({ numero: i + 2, cellules: [...cellules] })), repere: d.repere };
}

function changer(fichier: FichierLu, numeroAgent: number, valeurs: Record<string, string>) {
	const ligne = fichier.lignes.find((l) => l.cellules[0] === String(numeroAgent))!;
	for (const [entete, valeur] of Object.entries(valeurs)) ligne.cellules[fichier.entetes.indexOf(entete)] = valeur;
}

function ajouter(fichier: FichierLu, valeurs: Record<string, string>): number {
	const numero = Math.max(1, ...fichier.lignes.map((l) => l.numero)) + 1;
	fichier.lignes.push({ numero, cellules: fichier.entetes.map((e) => valeurs[e] ?? '') });
	return numero;
}

const arrivee = { 'E-mail': 'nina.roux@exemple.fr', Prénom: 'Nina', Nom: 'Roux', Profil: 'Agent' };

describe('apercuImport : arrivées', () => {
	it('arrivée avec équipe, statut et deux rôles', async () => {
		const { base, acteur, sap, profilAgent, resp, amicale } = await jeu();
		const fichier = await exporter(base, acteur);
		const ligne = ajouter(fichier, { ...arrivee, Grade: 'Sapeur', Équipe: 'Équipe 2', Statut: 'Stagiaire', Naissance: '1/3/2000', 'Référent engins': 'Oui', 'Comité : Amicale': 'Membre de comité' });

		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([]);
		expect(apercu.arrivees).toEqual([{ ligne, nom: 'Nina Roux' }]);
		expect(apercu.operations).toEqual([
			{
				ligne,
				type: 'ajouter',
				donnees: { email: 'nina.roux@exemple.fr', prenom: 'Nina', nom: 'Roux', profilId: profilAgent.id, equipeId: 2, statut: 'stagiaire', gradeId: sap.id, dateGrade: null, telephone: null, naissance: '2000-03-01', entreeCentre: null, engagementSpv: null }
			},
			{ ligne, type: 'attribuer', personne: { ligne }, responsabiliteId: resp('Référent engins'), perimetre: { type: 'centre' } },
			{ ligne, type: 'attribuer', personne: { ligne }, responsabiliteId: resp('Membre de comité'), perimetre: { type: 'comite', id: amicale.id } }
		]);
	});

	it('modèle vierge : arrivées seulement, aucun départ', async () => {
		const { base, acteur, nouvelle } = await jeu();
		await nouvelle('Léa', 'Durand');
		const fichier = await exporter(base, acteur, true);
		ajouter(fichier, arrivee);
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.departs).toEqual([]);
		expect(apercu.arrivees).toHaveLength(1);
		expect(apercu.operations.map((o) => o.type)).toEqual(['ajouter']);
	});

	it('ligne avec N° sans repère : « Partez d’un export »', async () => {
		const { base, acteur, nouvelle } = await jeu();
		const id = await nouvelle('Léa', 'Durand');
		const fichier = await exporter(base, acteur, true);
		const ligne = ajouter(fichier, { ...arrivee, 'N°': String(id) });
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([{ ligne, colonne: 'N°', message: 'Partez d’un export pour modifier un agent' }]);
		expect(apercu.operations).toEqual([]);
	});
});

describe('apercuImport : modifications', () => {
	it('liste les changements champ par champ, avant → après', async () => {
		const { base, acteur, nouvelle, grades } = await jeu();
		const id = await nouvelle('Léa', 'Durand');
		await base.update(personne).set({ naissance: '1990-03-01' }).where(eq(personne.id, id));
		const fichier = await exporter(base, acteur);
		changer(fichier, id, { Prénom: 'Léna', Grade: 'Caporal', Naissance: '' });

		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([]);
		expect(apercu.modifications).toEqual([
			{
				ligne: 2,
				nom: 'Léna Durand',
				changements: [
					{ colonne: 'Prénom', avant: 'Léa', apres: 'Léna' },
					{ colonne: 'Grade', avant: 'Sapeur', apres: 'Caporal' },
					{ colonne: 'Naissance', avant: '01/03/1990', apres: '' }
				]
			}
		]);
		expect(apercu.operations).toEqual([{ ligne: 2, type: 'modifier', personneId: id, champs: { prenom: 'Léna', gradeId: grades.find((g) => g.libelle === 'Caporal')!.id, naissance: null } }]);
	});

	it('ligne sans changement : aucune opération, rien dans les modifications', async () => {
		const { base, acteur, nouvelle, nommer, resp, amicale } = await jeu();
		const id = await nouvelle('Léa', 'Durand', { equipeId: 1 });
		await nommer(id, resp('Membre de comité'), { type: 'comite', id: amicale.id });
		await nommer(id, resp('Chef d’équipe'), { type: 'equipe', id: 1 });
		const apercu = await apercuImport(base, acteur, await exporter(base, acteur), aujourdhui, reservees);
		expect(apercu).toMatchObject({ modifications: [], erreurs: [], operations: [], departs: [], perimees: [] });
	});

	it('équipe vidée : equipe null ; équipe inactive non exportée : inchangée', async () => {
		const { base, acteur, nouvelle } = await jeu();
		const id = await nouvelle('Léa', 'Durand', { equipeId: 1 });
		const inactive = await nouvelle('Paul', 'Martin', { equipeId: 3 });
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, 3));
		const fichier = await exporter(base, acteur);
		changer(fichier, id, { Équipe: '' });

		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.operations).toEqual([{ ligne: expect.any(Number), type: 'equipe', personneId: id, equipeId: null }]);
		expect(apercu.modifications[0]!.changements).toEqual([{ colonne: 'Équipe', avant: 'Équipe 1', apres: '' }]);
		expect(apercu.operations.some((o) => 'personneId' in o && o.personneId === inactive)).toBe(false);
	});

	it('change le statut, dans l’ordre : modifier, équipe, statut', async () => {
		const { base, acteur, nouvelle } = await jeu();
		const id = await nouvelle('Léa', 'Durand');
		const fichier = await exporter(base, acteur);
		changer(fichier, id, { Statut: 'Suspendu', Équipe: 'Équipe 3', Téléphone: '0600000000' });
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.operations).toEqual([
			{ ligne: 2, type: 'modifier', personneId: id, champs: { telephone: '0600000000' } },
			{ ligne: 2, type: 'equipe', personneId: id, equipeId: 3 },
			{ ligne: 2, type: 'statut', personneId: id, statut: 'suspendu' }
		]);
	});

	it('passage à « Parti » : seul le statut change, équipe et rôles suivent le départ', async () => {
		const { base, acteur, nouvelle, nommer, resp } = await jeu();
		const id = await nouvelle('Léa', 'Durand', { equipeId: 1 });
		await nommer(id, resp('Chef d’équipe'), { type: 'equipe', id: 1 });
		const fichier = await exporter(base, acteur);
		changer(fichier, id, { Statut: 'Parti', Équipe: 'Équipe 2' });
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.operations).toEqual([{ ligne: 2, type: 'statut', personneId: id, statut: 'parti' }]);
		expect(apercu.departs).toEqual([{ personneId: id, nom: 'Léa Durand' }]);
		expect(apercu.modifications).toEqual([]);
	});

	it('« Parti » sur une ligne : avec les départs, à la fin des opérations', async () => {
		const { base, acteur, nouvelle } = await jeu();
		const lea = await nouvelle('Léa', 'Durand');
		const paul = await nouvelle('Paul', 'Martin');
		const fichier = await exporter(base, acteur);
		changer(fichier, lea, { Statut: 'Parti', Téléphone: '0600000000' });
		changer(fichier, paul, { Prénom: 'Paulo' });
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.operations).toEqual([
			{ ligne: 2, type: 'modifier', personneId: lea, champs: { telephone: '0600000000' } },
			{ ligne: 3, type: 'modifier', personneId: paul, champs: { prenom: 'Paulo' } },
			{ ligne: 2, type: 'statut', personneId: lea, statut: 'parti' }
		]);
		expect(apercu.departs).toEqual([{ personneId: lea, nom: 'Léa Durand' }]);
		expect(apercu.modifications.map((m) => m.changements.map((c) => c.colonne))).toEqual([['Téléphone'], ['Prénom']]);
	});

	it('chef d’équipe qui change d’équipe : terminer l’ancien rôle, attribuer le nouveau', async () => {
		const { base, acteur, nouvelle, nommer, resp } = await jeu();
		const id = await nouvelle('Léa', 'Durand', { equipeId: 1 });
		const ancien = await nommer(id, resp('Chef d’équipe'), { type: 'equipe', id: 1 });
		const fichier = await exporter(base, acteur);
		changer(fichier, id, { Équipe: 'Équipe 2' });

		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([]);
		expect(apercu.operations).toEqual([
			{ ligne: 2, type: 'equipe', personneId: id, equipeId: 2 },
			{ ligne: 2, type: 'terminer', attributionId: ancien },
			{ ligne: 2, type: 'attribuer', personne: { id }, responsabiliteId: resp('Chef d’équipe'), perimetre: { type: 'equipe', id: 2 } }
		]);
	});

	it('case vidée : termine le rôle ; rôle de comité changé : terminer puis attribuer', async () => {
		const { base, acteur, nouvelle, nommer, resp, amicale } = await jeu();
		const id = await nouvelle('Léa', 'Durand');
		const engins = await nommer(id, resp('Référent engins'), { type: 'centre' });
		const membre = await nommer(id, resp('Membre de comité'), { type: 'comite', id: amicale.id });
		const fichier = await exporter(base, acteur);
		changer(fichier, id, { 'Référent engins': '', 'Comité : Amicale': 'Rapporteur de comité' });

		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.operations).toEqual([
			{ ligne: 2, type: 'terminer', attributionId: engins },
			{ ligne: 2, type: 'terminer', attributionId: membre },
			{ ligne: 2, type: 'attribuer', personne: { id }, responsabiliteId: resp('Rapporteur de comité'), perimetre: { type: 'comite', id: amicale.id } }
		]);
		expect(apercu.modifications[0]!.changements).toEqual([
			{ colonne: 'Référent engins', avant: 'Oui', apres: '' },
			{ colonne: 'Comité : Amicale', avant: 'Membre de comité', apres: 'Rapporteur de comité' }
		]);
	});
});

describe('apercuImport : erreurs', () => {
	it('rôle d’équipe tenu sur une autre équipe : erreur', async () => {
		const { base, acteur, nouvelle, nommer, resp } = await jeu();
		const id = await nouvelle('Léa', 'Durand', { equipeId: 1 });
		await nommer(id, resp('Chef d’équipe'), { type: 'equipe', id: 2 });
		const apercu = await apercuImport(base, acteur, await exporter(base, acteur), aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([{ ligne: 2, colonne: 'Chef d’équipe', message: 'rôle tenu sur une autre équipe : à traiter à l’écran' }]);
		expect(apercu.operations).toEqual([]);
	});

	it('deux rôles dans un même comité, ou rôle inconnu : erreur', async () => {
		const { base, acteur, nouvelle, nommer, resp, amicale } = await jeu();
		const id = await nouvelle('Léa', 'Durand');
		await nommer(id, resp('Membre de comité'), { type: 'comite', id: amicale.id });
		await nommer(id, resp('Rapporteur de comité'), { type: 'comite', id: amicale.id });
		const fichier = await exporter(base, acteur);
		const ligne = ajouter(fichier, { ...arrivee, 'Comité : Amicale': 'Trésorier' });

		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([
			{ ligne: 2, colonne: 'Comité : Amicale', message: 'deux rôles dans ce comité : à traiter à l’écran' },
			{ ligne, colonne: 'Comité : Amicale', message: '« Trésorier » n’est pas un rôle de comité' }
		]);
		expect(apercu.operations).toEqual([]);
	});

	it('profil vide, date invalide, grade, équipe, statut et profil inconnus', async () => {
		const { base, acteur } = await jeu();
		const fichier = await exporter(base, acteur);
		fichier.lignes.push({ numero: 12, cellules: fichier.entetes.map((e) => ({ ...arrivee, Profil: '', Naissance: '31/02/2000' } as Record<string, string>)[e] ?? '') });
		ajouter(fichier, { ...arrivee, 'E-mail': 'b@exemple.fr', Grade: 'Général', Équipe: 'Equipe 5', Statut: 'En vacances', Profil: 'Pompier' });

		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([
			{ ligne: 12, colonne: 'Profil', message: 'Indiquez le profil' },
			{ ligne: 12, colonne: 'Naissance', message: 'date invalide' },
			{ ligne: 13, colonne: 'Grade', message: '« Général » n’existe pas' },
			{ ligne: 13, colonne: 'Équipe', message: '« Equipe 5 » n’existe pas' },
			{ ligne: 13, colonne: 'Statut', message: '« En vacances » n’existe pas' },
			{ ligne: 13, colonne: 'Profil', message: '« Pompier » n’existe pas' }
		]);
		expect(apercu.operations).toEqual([]);
	});

	it('e-mail réservé, déjà pris par un autre agent, ou en double dans le fichier', async () => {
		const { base, acteur, nouvelle } = await jeu();
		const lea = await nouvelle('Léa', 'Durand');
		const fichier = await exporter(base, acteur);
		const reservee = ajouter(fichier, { ...arrivee, 'E-mail': ' SUPER@exemple.fr' });
		const prise = ajouter(fichier, { ...arrivee, 'E-mail': 'Léa.Durand@exemple.fr' });
		const double1 = ajouter(fichier, { ...arrivee, 'E-mail': 'x@exemple.fr' });
		const double2 = ajouter(fichier, { ...arrivee, 'E-mail': 'X@exemple.fr' });

		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([
			{ ligne: 2, colonne: 'E-mail', message: `Même e-mail qu’à la ligne ${prise}` },
			{ ligne: reservee, colonne: 'E-mail', message: 'Adresse réservée au super administrateur' },
			{ ligne: prise, colonne: 'E-mail', message: `Adresse déjà utilisée par l’agent n° ${lea}` },
			{ ligne: double1, colonne: 'E-mail', message: `Même e-mail qu’à la ligne ${double2}` },
			{ ligne: double2, colonne: 'E-mail', message: `Même e-mail qu’à la ligne ${double1}` }
		]);
		expect(apercu.arrivees).toEqual([]);
	});

	it('N° inconnu, ou du chef de centre ou de l’adjoint : erreur', async () => {
		const { base, acteur, chef, adjoint } = await jeu();
		const fichier = await exporter(base, acteur);
		const inconnu = ajouter(fichier, { ...arrivee, 'N°': '999' });
		const duChef = ajouter(fichier, { ...arrivee, 'N°': String(chef), 'E-mail': 'claire.chef@exemple.fr' });
		const deLAdjoint = ajouter(fichier, { ...arrivee, 'N°': String(adjoint), 'E-mail': 'alain.adjoint@exemple.fr' });
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([
			{ ligne: inconnu, colonne: 'N°', message: 'Aucun agent n° 999' },
			{ ligne: duChef, colonne: 'N°', message: 'Le chef de centre et l’adjoint se modifient à l’écran' },
			{ ligne: deLAdjoint, colonne: 'N°', message: 'Le chef de centre et l’adjoint se modifient à l’écran' }
		]);
		expect(apercu.departs).toEqual([]);
	});

	it('rôle que l’acteur ne peut pas attribuer : erreur', async () => {
		const { base, chef, secretaire } = await jeu();
		const acteur: Acteur = { type: 'personne', id: await secretaire() };
		const fichier = await exporter(base, { type: 'personne', id: chef });
		const ligne = ajouter(fichier, { ...arrivee, 'Référent engins': 'Oui' });
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toContainEqual({ ligne, colonne: 'Référent engins', message: 'Vous ne pouvez pas attribuer ce rôle' });
	});

	it('rôle que l’acteur ne peut pas retirer : erreur', async () => {
		const { base, chef, nouvelle, nommer, resp, secretaire } = await jeu();
		const acteur: Acteur = { type: 'personne', id: await secretaire() };
		const lea = await nouvelle('Léa', 'Durand');
		await nommer(lea, resp('Référent engins'), { type: 'centre' });
		const fichier = await exporter(base, { type: 'personne', id: chef });
		changer(fichier, lea, { 'Référent engins': '' });
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([{ ligne: 2, colonne: 'Référent engins', message: 'Vous ne pouvez pas retirer ce rôle' }]);
	});

	it('même N° sur deux lignes, chef d’équipe sans équipe, arrivée « Parti », téléphone trop long', async () => {
		const { base, acteur, nouvelle } = await jeu();
		const lea = await nouvelle('Léa', 'Durand');
		const fichier = await exporter(base, acteur);
		const copie = ajouter(fichier, { ...arrivee, 'N°': String(lea) });
		const sansEquipe = ajouter(fichier, { ...arrivee, 'E-mail': 'a@exemple.fr', 'Chef d’équipe': 'Oui' });
		const partie = ajouter(fichier, { ...arrivee, 'E-mail': 'b@exemple.fr', Statut: 'Parti' });
		const telephone = ajouter(fichier, { ...arrivee, 'E-mail': 'c@exemple.fr', Téléphone: '0'.repeat(21) });
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([
			{ ligne: 2, colonne: 'N°', message: `Même N° qu’à la ligne ${copie}` },
			{ ligne: copie, colonne: 'N°', message: 'Même N° qu’à la ligne 2' },
			{ ligne: sansEquipe, colonne: 'Chef d’équipe', message: 'Indiquez l’équipe' },
			{ ligne: partie, colonne: 'Statut', message: 'Un nouvel agent ne peut pas être « Parti »' },
			{ ligne: telephone, colonne: 'Téléphone', message: 'Téléphone trop long' }
		]);
		expect(apercu.departs).toEqual([]);
	});

	it('N° « 12.0 » ou entouré d’espaces : lu comme 12', async () => {
		const { base, acteur, nouvelle } = await jeu();
		const lea = await nouvelle('Léa', 'Durand');
		const fichier = await exporter(base, acteur);
		changer(fichier, lea, { 'N°': ` ${lea}.0 `, Prénom: 'Léna' });
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([]);
		expect(apercu.operations).toEqual([{ ligne: 2, type: 'modifier', personneId: lea, champs: { prenom: 'Léna' } }]);
		fichier.lignes[0]!.cellules[0] = `${lea}.5`;
		expect((await apercuImport(base, acteur, fichier, aujourdhui, reservees)).erreurs).toContainEqual({ ligne: 2, colonne: 'N°', message: `Aucun agent n° ${lea}.5` });
	});

	it('ligne en erreur reconnue par son e-mail : pas de départ', async () => {
		const { base, acteur, nouvelle } = await jeu();
		const lea = await nouvelle('Léa', 'Durand');
		const fichier = await exporter(base, acteur);
		changer(fichier, lea, { 'N°': '' });
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([{ ligne: 2, colonne: 'E-mail', message: `Adresse déjà utilisée par l’agent n° ${lea}` }]);
		expect(apercu.departs).toEqual([]);
		expect(apercu.operations).toEqual([]);
	});

	it('le gestionnaire ne peut pas se mettre au départ par le fichier', async () => {
		const { base, chef, secretaire } = await jeu();
		const moi = await secretaire();
		const acteur: Acteur = { type: 'personne', id: moi };
		const fichier = await exporter(base, { type: 'personne', id: chef });
		changer(fichier, moi, { Statut: 'Parti' });
		let apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([{ ligne: 2, colonne: 'Statut', message: 'Vous ne pouvez pas vous mettre au départ par le fichier' }]);
		expect(apercu.departs).toEqual([]);

		fichier.lignes = [];
		apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([{ ligne: 0, colonne: null, message: 'Vous ne pouvez pas vous mettre au départ par le fichier' }]);
		expect(apercu.departs).toEqual([]);
		expect(apercu.operations).toEqual([]);
	});

	it('en-tête manquant ou en double : erreur de fichier, aucune opération', async () => {
		const { base, acteur, nouvelle } = await jeu();
		await nouvelle('Léa', 'Durand');
		const sansProfil = await exporter(base, acteur);
		sansProfil.entetes[ENTETES.indexOf('Profil')] = 'Profils';
		let apercu = await apercuImport(base, acteur, sansProfil, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([{ ligne: 0, colonne: 'Profil', message: 'Colonne « Profil » absente' }]);
		expect(apercu).toMatchObject({ operations: [], departs: [] });

		const double = await exporter(base, acteur);
		double.entetes.push('Grade');
		apercu = await apercuImport(base, acteur, double, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([{ ligne: 0, colonne: 'Grade', message: 'Colonne « Grade » en double' }]);
		expect(apercu.operations).toEqual([]);
	});

	it('colonne inconnue : signalée puis ignorée', async () => {
		const { base, acteur, nouvelle } = await jeu();
		const id = await nouvelle('Léa', 'Durand');
		const fichier = await exporter(base, acteur);
		fichier.entetes.push('Permis poids lourd', 'Comité : Fanfare');
		for (const l of fichier.lignes) l.cellules.push('Oui', 'Membre de comité');
		changer(fichier, id, { Prénom: 'Léna' });
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.colonnesIgnorees).toEqual(['Permis poids lourd', 'Comité : Fanfare']);
		expect(apercu.erreurs).toEqual([]);
		expect(apercu.operations).toHaveLength(1);
	});

	it('refuse un agent ordinaire', async () => {
		const { base, acteur, nouvelle } = await jeu();
		const agent = await nouvelle('Léa', 'Durand');
		const fichier = await exporter(base, acteur);
		await expect(apercuImport(base, { type: 'personne', id: agent }, fichier, aujourdhui, reservees)).rejects.toThrow(RefusDroit);
	});
});

describe('apercuImport : départs et lignes périmées', () => {
	it('agent absent : départ, sauf déjà parti, créé après l’export ou périmé ; départs à la fin', async () => {
		const { base, acteur, nouvelle } = await jeu();
		const absent = await nouvelle('Paul', 'Absent');
		await nouvelle('Jean', 'Parti', { statut: 'parti' });
		const perime = await nouvelle('Marc', 'Perime');
		const reste = await nouvelle('Léa', 'Durand');
		const fichier = await exporter(base, acteur);
		fichier.lignes = fichier.lignes.filter((l) => l.cellules[0] === String(reste));
		changer(fichier, reste, { Prénom: 'Léna' });
		await nouvelle('Tom', 'Nouveau');
		await modifierFiche(base, acteur, perime, { telephone: '0611111111' }, aujourdhui, reservees);

		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.departs).toEqual([{ personneId: absent, nom: 'Paul Absent' }]);
		expect(apercu.perimees).toEqual([{ ligne: 0, nom: 'Marc Perime' }]);
		expect(apercu.operations.map((o) => o.type)).toEqual(['modifier', 'statut']);
		expect(apercu.operations.at(-1)).toEqual({ ligne: 0, type: 'statut', personneId: absent, statut: 'parti' });
	});

	it('ligne périmée : agent modifié après l’export, ou l’une de ses attributions', async () => {
		const { base, acteur, nouvelle, nommer, resp } = await jeu();
		const lea = await nouvelle('Léa', 'Durand');
		const paul = await nouvelle('Paul', 'Martin');
		const role = await nommer(paul, resp('Référent engins'), { type: 'centre' });
		const fichier = await exporter(base, acteur);
		changer(fichier, lea, { Prénom: 'Léna' });
		changer(fichier, paul, { Prénom: 'Paulo' });
		await modifierFiche(base, acteur, lea, { telephone: '0611111111' }, aujourdhui, reservees);
		await base.insert(journal).values({ quand: aujourdhui, acteur: 'super:a@b.fr', action: 'terminer_attribution', cibleType: 'attribution', cibleId: role });

		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.perimees).toEqual([
			{ ligne: 2, nom: 'Léna Durand' },
			{ ligne: 3, nom: 'Paulo Martin' }
		]);
		expect(apercu.operations).toEqual([]);
		expect(apercu.modifications).toEqual([]);
	});
});

describe('apercuImport : depuis la date de l’export', () => {
	it('adjoint pendant la période, absent du fichier : jamais au départ', async () => {
		const { base, acteur, nouvelle, nommer, resp } = await jeu();
		const ancien = await nouvelle('Marc', 'Ancien');
		await nommer(ancien, resp('Chef de centre adjoint'), { type: 'centre' }, '2026-10-25');
		const fichier = await exporter(base, acteur, false, '2026-10-20');
		expect(fichier.lignes.some((l) => l.cellules[0] === String(ancien))).toBe(false);
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.departs).toEqual([]);
	});

	it('rôle terminé seul depuis l’export, encore « Oui » dans le fichier : ligne périmée', async () => {
		const { base, acteur, nouvelle, nommer, resp } = await jeu();
		const lea = await nouvelle('Léa', 'Durand');
		await nommer(lea, resp('Référent engins'), { type: 'centre' }, '2026-10-25');
		const fichier = await exporter(base, acteur, false, '2026-10-20');
		expect(fichier.lignes[0]!.cellules[fichier.entetes.indexOf('Référent engins')]).toBe('Oui');
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.perimees).toEqual([{ ligne: 2, nom: 'Léa Durand' }]);
		expect(apercu.operations).toEqual([]);
	});

	it('rôle terminé avant l’export : ligne normale', async () => {
		const { base, acteur, nouvelle, nommer, resp } = await jeu();
		const lea = await nouvelle('Léa', 'Durand');
		await nommer(lea, resp('Référent engins'), { type: 'centre' }, '2026-10-19');
		const fichier = await exporter(base, acteur, false, '2026-10-20');
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu).toMatchObject({ perimees: [], erreurs: [], operations: [] });
	});
});

describe('apercuImport : sans écriture, en peu de requêtes', () => {
	it('laisse la base inchangée', async () => {
		const { base, acteur, nouvelle } = await jeu();
		await nouvelle('Paul', 'Absent', { equipeId: 1 });
		const fichier = await exporter(base, acteur);
		fichier.lignes = [];
		ajouter(fichier, { ...arrivee, 'Référent engins': 'Oui' });
		const photo = async () => [await base.select().from(personne), await base.select().from(attribution), await base.select().from(affectationEquipe), await base.select().from(journal)];
		const avant = await photo();
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.operations.length).toBeGreaterThan(0);
		expect(await photo()).toEqual(avant);
	});

	it('reste sous 50 requêtes avec 150 lignes', async () => {
		const { base, acteur, profilAgent, resp, amicale } = await jeu();
		const personnes = await base
			.insert(personne)
			.values(Array.from({ length: 150 }, (_, i) => ({ email: `agent${i}@exemple.fr`, prenom: 'Agent', nom: `N${i}`, profilId: profilAgent.id })))
			.returning();
		await base.insert(affectationEquipe).values(personnes.map((p, i) => ({ personneId: p.id, equipeId: (i % 3) + 1, debut: '2026-01-01' })));
		await base.insert(attribution).values(
			personnes.map((p) => ({ personneId: p.id, responsabiliteId: resp('Membre de comité'), perimetreType: 'comite' as const, perimetreId: amicale.id, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' }))
		);
		const fichier = await exporter(base, acteur);
		for (const l of fichier.lignes) l.cellules[fichier.entetes.indexOf('Équipe')] = 'Équipe 1';

		const avant = base.requetes;
		const apercu = await apercuImport(base, acteur, fichier, aujourdhui, reservees);
		expect(apercu.erreurs).toEqual([]);
		expect(apercu.operations).toHaveLength(100);
		expect(base.requetes - avant).toBeLessThanOrEqual(50);
	});
});

