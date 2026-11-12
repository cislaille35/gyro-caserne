import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { ajouterVacances, enregistrerManoeuvre, preparerAnnee, publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import { planningDuMatin } from '../src/planning/manoeuvres.ts';
import { apercuPlanning, appliquerPlanning, donneesFichierPlanning, type DonneesFichierPlanning, type FichierPlanningLu } from '../src/planning/fichier.ts';
import { anneePlanning, attribution, equipe, manoeuvre, personne, profil, publication, responsabilite, semaineChangee, vacancesScolaires } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const reglage = centreExemple.astreinte;
const maintenant = '2026-11-01T10:00';

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const ids = (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const [p] = await base.insert(personne).values({ email: 'chef@exemple.fr', prenom: 'Chef', nom: 'Test', profilId: agent!.id }).returning();
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: p!.id, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const [a] = await base.insert(personne).values({ email: 'alice@exemple.fr', prenom: 'Alice', nom: 'Test', profilId: agent!.id }).returning();
	return { base, ids, chef: { type: 'personne', id: p!.id } as const, alice: { type: 'personne', id: a!.id } as const };
}

// Le classeur relu tel qu'exporté, chaque ligne numérotée comme dans le tableur (en-têtes en ligne 1).
const relu = (d: DonneesFichierPlanning, retouche: (f: Record<string, string[][]>) => void = () => {}): FichierPlanningLu => {
	const f = Object.fromEntries(d.feuilles.map((x) => [x.nom, x.lignes.map((l) => [...l])]));
	retouche(f);
	return { feuilles: Object.fromEntries(Object.entries(f).map(([nom, lignes]) => [nom, lignes.map((cellules, i) => ({ numero: i + 2, cellules }))])) };
};

describe('fichier du planning', () => {
	it('réservé à qui gère le planning', async () => {
		const { base, alice } = await jeu();
		await expect(donneesFichierPlanning(base, alice, 2027, maintenant, reglage)).rejects.toThrow(RefusDroit);
		await expect(apercuPlanning(base, alice, 2027, { feuilles: {} }, maintenant, reglage)).rejects.toThrow(RefusDroit);
	});

	it('année vide : le modèle donne le roulement calculé ; relu sans changement, rien ne change', async () => {
		const { base, chef } = await jeu();
		const d = await donneesFichierPlanning(base, chef, 2027, maintenant, reglage);
		expect(d.feuilles.map((f) => f.nom)).toEqual(['Semaines', 'Manœuvres', 'Vacances scolaires']);
		const semaines = d.feuilles[0]!;
		expect(semaines.entetes).toEqual(['N°', 'Du', 'Au', 'Équipe']);
		expect(semaines.lignes[0]).toEqual(['S53', '01/01/2027', '08/01/2027', expect.stringMatching(/^Équipe \d$/)]);
		expect(semaines.listes['Équipe']).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3', 'Équipe 4']);
		const apercu = await apercuPlanning(base, chef, 2027, relu(d), maintenant, reglage);
		expect(apercu).toMatchObject({ semaines: [], erreurs: [], fetes: [], manoeuvres: { ajoutees: [], modifiees: [], retirees: [] } });
		await appliquerPlanning(base, chef, 2027, relu(d), maintenant, reglage);
		const [ligne] = await base.select().from(anneePlanning).where(eq(anneePlanning.annee, 2027));
		expect(JSON.parse(ligne!.ordre)).toHaveLength(4);
	});

	it('aperçu puis application : semaines, manœuvres, vacances, fête qui change d’équipe', async () => {
		const { base, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2027, ids, maintenant);
		const m1 = await enregistrerManoeuvre(base, chef, { debut: '2027-03-07T08:30', theme: 'Feux de forêt', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, maintenant);
		const m2 = await enregistrerManoeuvre(base, chef, { debut: '2027-04-04T08:30', theme: 'Secours routier', lieu: 'Caserne', convoques: [ids[0]!], petitDejeuner: false }, maintenant);
		await ajouterVacances(base, chef, { nom: 'Vacances d’hiver', debut: '2027-02-13', fin: '2027-03-01' }, maintenant);
		const d = await donneesFichierPlanning(base, chef, 2027, maintenant, reglage);
		expect(d.feuilles[1]!.lignes).toEqual([
			[String(m1), '07/03/2027', '08:30', '11:30', 'Feux de forêt', 'Caserne', 'Toutes', 'Non'],
			[String(m2), '04/04/2027', '08:30', '11:30', 'Secours routier', 'Caserne', '1', 'Non']
		]);
		const prep = await preparerAnnee(base, chef, 2027, maintenant, reglage);
		const noel = prep.semaines.findIndex((s) => s.debut === '2027-12-24');
		const autre = prep.equipes.find((e) => e.id !== prep.semaines[noel]!.equipeId)!;
		const lu = relu(d, (f) => {
			f['Semaines']![0]![3] = autre.nom === f['Semaines']![0]![3] ? 'Équipe 1' : f['Semaines']![0]![3]!;
			f['Semaines']![noel]![3] = autre.nom;
			f['Semaines']![1]![3] = f['Semaines']![2]![3]!;
			f['Manœuvres'] = [
				[String(m1), '07/03/2027', '9 h 00', '12:00', 'Feux de forêt', 'Caserne', '1, 3', 'Oui'],
				['', '02/05/2027', '08:30', '11:30', 'Incendie', 'Caserne', 'Toutes', 'Non']
			];
			f['Vacances scolaires'] = [['Vacances de printemps', '10/04/2027', '26/04/2027']];
		});
		const apercu = await apercuPlanning(base, chef, 2027, lu, maintenant, reglage);
		expect(apercu.erreurs).toEqual([]);
		expect(apercu.semaines.map((s) => s.debut)).toEqual(['2027-01-08', '2027-12-24']);
		expect(apercu.fetes).toEqual([expect.objectContaining({ fete: 'noel', apres: autre.nom })]);
		expect(apercu.manoeuvres).toEqual({ ajoutees: [{ debut: '2027-05-02T08:30', theme: 'Incendie' }], modifiees: [{ debut: '2027-03-07T09:00', theme: 'Feux de forêt' }], retirees: [{ debut: '2027-04-04T08:30', theme: 'Secours routier', annoncee: false }] });
		expect(apercu.vacances).toEqual({ ajoutees: [{ nom: 'Vacances de printemps', debut: '2027-04-10', fin: '2027-04-26' }], retirees: [{ nom: 'Vacances d’hiver', debut: '2027-02-13', fin: '2027-03-01' }] });

		expect(await appliquerPlanning(base, chef, 2027, lu, maintenant, reglage)).toEqual({ changees: [] });
		expect((await base.select().from(semaineChangee)).map((s) => s.debut).sort()).toEqual(['2027-01-08', '2027-12-24']);
		const manoeuvres = await base.select().from(manoeuvre).orderBy(manoeuvre.debut);
		expect(manoeuvres.map((x) => [x.debut, x.fin, x.convoques, x.petitDejeuner])).toEqual([
			['2027-03-07T09:00', '2027-03-07T12:00', JSON.stringify([ids[0], ids[2]]), 1],
			['2027-05-02T08:30', '2027-05-02T11:30', '"tous"', 0]
		]);
		expect((await base.select().from(vacancesScolaires)).map((v) => v.nom)).toEqual(['Vacances de printemps']);
		// Relu après coup : plus rien à faire.
		const encore = await apercuPlanning(base, chef, 2027, relu(await donneesFichierPlanning(base, chef, 2027, maintenant, reglage)), maintenant, reglage);
		expect(encore).toMatchObject({ semaines: [], fetes: [], manoeuvres: { ajoutees: [], modifiees: [], retirees: [] }, vacances: { ajoutees: [], retirees: [] } });
	});

	it('une manœuvre annoncée retirée du fichier est annulée, sa publication le dit ; elle est rendue pour prévenir les convoqués', async () => {
		const { base, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2026, ids, maintenant);
		await publierAnnee(base, chef, 2026, maintenant);
		const id = await enregistrerManoeuvre(base, chef, { debut: '2026-11-08T08:30', theme: 'Feux de forêt', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, maintenant);
		await planningDuMatin(base, '2026-11-02T08:00');
		const d = await donneesFichierPlanning(base, chef, 2026, '2026-11-02T09:00', reglage);
		const lu = relu(d, (f) => (f['Manœuvres'] = []));
		expect((await apercuPlanning(base, chef, 2026, lu, '2026-11-02T09:00', reglage)).manoeuvres.retirees).toEqual([{ debut: '2026-11-08T08:30', theme: 'Feux de forêt', annoncee: true }]);
		expect(await appliquerPlanning(base, chef, 2026, lu, '2026-11-02T09:00', reglage)).toEqual({ changees: [id] });
		const [m] = await base.select().from(manoeuvre);
		expect(m!.annuleeLe).toBe('2026-11-02T09:00');
		expect((await base.select().from(publication).where(eq(publication.id, m!.publicationId!)))[0]!.annuleeLe).toBe('2026-11-02T09:00');
	});

	it('erreurs avec la ligne fautive ; rien n’est appliqué ; une feuille absente ne change rien', async () => {
		const { base, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2027, ids, maintenant);
		await ajouterVacances(base, chef, { nom: 'Vacances d’hiver', debut: '2027-02-13', fin: '2027-03-01' }, maintenant);
		const lu: FichierPlanningLu = {
			feuilles: {
				Semaines: [
					{ numero: 2, cellules: ['S1', '02/01/2027', '', 'Équipe 1'] },
					{ numero: 3, cellules: ['S2', '08/01/2027', '', 'Équipe 9'] }
				],
				Manœuvres: [
					{ numero: 2, cellules: ['', '31/02/2027', '08:30', '', 'Incendie', 'Caserne', 'Toutes', 'Non'] },
					{ numero: 3, cellules: ['', '02/05/2027', '08:30', '', '', 'Caserne', '7', 'Non'] },
					{ numero: 4, cellules: ['99', '02/05/2027', '08:30', '', 'Incendie', 'Caserne', '', 'Non'] }
				]
			}
		};
		const apercu = await apercuPlanning(base, chef, 2027, lu, maintenant, reglage);
		expect(apercu.erreurs).toEqual([
			{ feuille: 'Semaines', ligne: 2, message: '« 02/01/2027 » n’est pas un jour de relève de 2027' },
			{ feuille: 'Semaines', ligne: 3, message: 'Équipe « Équipe 9 » inconnue' },
			{ feuille: 'Manœuvres', ligne: 2, message: 'Date « 31/02/2027 » invalide (JJ/MM/AAAA)' },
			{ feuille: 'Manœuvres', ligne: 3, message: 'Équipe « 7 » inconnue' },
			{ feuille: 'Manœuvres', ligne: 4, message: 'Réf. 99 inconnue : laissez-la vide pour une nouvelle manœuvre' }
		]);
		expect(apercu.vacances).toEqual({ ajoutees: [], retirees: [] });
		await expect(appliquerPlanning(base, chef, 2027, lu, maintenant, reglage)).rejects.toThrow(DonneeInvalide);
		expect(await base.select().from(manoeuvre)).toEqual([]);
	});

	it('un fichier sans onglet Manœuvres ni Vacances scolaires : appliqué, il n’y touche pas', async () => {
		const { base, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2027, ids, maintenant);
		await enregistrerManoeuvre(base, chef, { debut: '2027-03-07T08:30', theme: 'Feux de forêt', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, maintenant);
		await ajouterVacances(base, chef, { nom: 'Vacances d’hiver', debut: '2027-02-13', fin: '2027-03-01' }, maintenant);
		const d = await donneesFichierPlanning(base, chef, 2027, maintenant, reglage);
		const lu = relu(d, (f) => {
			delete f['Manœuvres'];
			delete f['Vacances scolaires'];
			f['Semaines']![1]![3] = f['Semaines']![2]![3]!;
		});
		await appliquerPlanning(base, chef, 2027, lu, maintenant, reglage);
		expect(await base.select().from(semaineChangee)).toHaveLength(1);
		expect(await base.select().from(manoeuvre)).toHaveLength(1);
		expect(await base.select().from(vacancesScolaires)).toHaveLength(1);
	});

	it('des colonnes déplacées dans un onglet : erreur en ligne 1, l’onglet n’est pas lu', async () => {
		const { base, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2027, ids, maintenant);
		const lu: FichierPlanningLu = {
			feuilles: { Manœuvres: [{ numero: 2, cellules: ['', '02/05/2027', '08:30', 'Caserne', 'Incendie', 'Toutes', 'Non'] }] },
			entetes: { Manœuvres: ['Réf.', 'Date', 'Début', 'Fin', 'Lieu', 'Thème', 'Équipes', 'Petit-déjeuner'] }
		};
		const apercu = await apercuPlanning(base, chef, 2027, lu, maintenant, reglage);
		expect(apercu.erreurs).toEqual([{ feuille: 'Manœuvres', ligne: 1, message: 'Colonnes attendues, dans l’ordre : Réf., Date, Début, Fin, Thème, Lieu, Équipes, Petit-déjeuner' }]);
		expect(apercu.manoeuvres.ajoutees).toEqual([]);
	});

	it('la fin des manœuvres : colonne « Fin » ; vide, la durée réglée par le centre ; contrôlée', async () => {
		const { base, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2027, ids, maintenant);
		const reglageManoeuvres = { debut: '07:45', fin: '12:00', petitDejeuner: ['Croissant', 'Rien pour moi'] };
		const d = await donneesFichierPlanning(base, chef, 2027, maintenant, reglage);
		expect(d.feuilles[1]!.entetes).toEqual(['Réf.', 'Date', 'Début', 'Fin', 'Thème', 'Lieu', 'Équipes', 'Petit-déjeuner']);
		const lu = relu(d, (f) => {
			f['Manœuvres'] = [
				['', '07/03/2027', '07:45', '12:00', 'Feux de forêt', 'Caserne', 'Toutes', 'Oui'],
				['', '04/04/2027', '08:00', '', 'Secours routier', 'Caserne', 'Toutes', 'Non']
			];
		});
		expect((await apercuPlanning(base, chef, 2027, lu, maintenant, reglage, reglageManoeuvres)).erreurs).toEqual([]);
		await appliquerPlanning(base, chef, 2027, lu, maintenant, reglage, reglageManoeuvres);
		// Fin vide : 4 h 15, comme de 7 h 45 à 12 h.
		expect((await base.select().from(manoeuvre).orderBy(manoeuvre.debut)).map((x) => [x.debut, x.fin])).toEqual([
			['2027-03-07T07:45', '2027-03-07T12:00'],
			['2027-04-04T08:00', '2027-04-04T12:15']
		]);
		const fautif = relu(d, (f) => {
			f['Manœuvres'] = [
				['', '07/03/2027', '07:45', 'midi', 'Feux', 'Caserne', 'Toutes', 'Non'],
				['', '04/04/2027', '12:00', '07:45', 'Feux', 'Caserne', 'Toutes', 'Non'],
				['', '02/05/2027', '23:00', '23:30', 'Feux', 'Caserne', 'Toutes', 'Non']
			];
		});
		expect((await apercuPlanning(base, chef, 2027, fautif, maintenant, reglage, reglageManoeuvres)).erreurs).toEqual([
			{ feuille: 'Manœuvres', ligne: 2, message: 'Fin « midi » invalide (HH:MM)' },
			{ feuille: 'Manœuvres', ligne: 3, message: 'La fin doit suivre le début, le même jour' }
		]);
		// Seule la fin change : c'est une modification.
		const apres = await donneesFichierPlanning(base, chef, 2027, maintenant, reglage);
		const fin = relu(apres, (f) => (f['Manœuvres']![0]![3] = '11:00'));
		expect((await apercuPlanning(base, chef, 2027, fin, maintenant, reglage, reglageManoeuvres)).manoeuvres.modifiees).toEqual([{ debut: '2027-03-07T07:45', theme: 'Feux de forêt' }]);
	});

	it('une ancienne manœuvre du soir sans fin (3 h, passé minuit) : « Fin » vide à l’export, et le fichier se relit sans erreur', async () => {
		const { base, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2027, ids, maintenant);
		const id = await enregistrerManoeuvre(base, chef, { debut: '2027-03-07T22:00', theme: 'Nuit', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, maintenant);
		const d = await donneesFichierPlanning(base, chef, 2027, maintenant, reglage);
		expect(d.feuilles[1]!.lignes).toEqual([[String(id), '07/03/2027', '22:00', '', 'Nuit', 'Caserne', 'Toutes', 'Non']]);
		expect(await apercuPlanning(base, chef, 2027, relu(d), maintenant, reglage)).toMatchObject({ erreurs: [], manoeuvres: { ajoutees: [], modifiees: [], retirees: [] } });
		// Une nouvelle sans fin dont la durée du centre passerait minuit : un message qui le dit.
		const nouvelle = relu(d, (f) => (f['Manœuvres'] = [['', '04/04/2027', '22:00', '', 'Nuit', 'Caserne', 'Toutes', 'Non']]));
		expect((await apercuPlanning(base, chef, 2027, nouvelle, maintenant, reglage)).erreurs).toEqual([{ feuille: 'Manœuvres', ligne: 2, message: 'Fin vide : la durée réglée par le centre passerait minuit, indiquez la fin' }]);
	});
});
