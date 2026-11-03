import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { ajouterVacances, enregistrerManoeuvre, noterFete, preparerAnnee, publierAnnee, reglerRoulement, supprimerManoeuvre } from '../src/planning/annee.ts';
import { calculerAnnee, fetes, rangsDuTour, tourDesFetes } from '../src/planning/calendrier.ts';
import { planningDuMatin } from '../src/planning/manoeuvres.ts';
import { accepterProposition, memePlaceDansLeMois, ordreQuiContinue, periodeDuTour, proposerAnnee, reglerFetes, reprendreManoeuvres } from '../src/planning/suivante.ts';
import { affectationEquipe, anneePlanning, aptitude, aptitudeAgent, attribution, equipe, journal, manoeuvre, personne, profil, publication, responsabilite, semaineChangee } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const reglage = centreExemple.astreinte;
const maintenant = '2026-11-03T10:00';

// 52 semaines, roulement 1-2-3-4 : la semaine 50 (index) revient à l'équipe 3, la 51 à l'équipe 4.
const cycle = () => Array.from({ length: 52 }, (_, i) => (i % 4) + 1);
const ecarts = (a: number[], b: number[]) => a.filter((x, i) => x !== b[i]).length;
// Le tour d'une fête : la première équipe a son tour, les autres attendent moins (dans l'ordre donné).
const file = (...ids: number[]) => new Map(ids.map((id, i) => [id, i]));
const TOUS = [1, 2, 3, 4];
const avecTour = (premiere: number) => file(premiere, ...TOUS.filter((x) => x !== premiere));

describe('le tour des fêtes', () => {
	it('classe les équipes de celle qui attend le plus à celle qui l’a tenue en dernier ; jamais tenue passe devant', () => {
		const h = [
			{ annee: 2024, fete: 'noel' as const, equipeId: 1 },
			{ annee: 2025, fete: 'noel' as const, equipeId: 2 },
			{ annee: 2026, fete: 'noel' as const, equipeId: 3 },
			{ annee: 2026, fete: 'nouvel_an' as const, equipeId: 1 }
		];
		expect([...rangsDuTour(h, 'noel', TOUS, 2027)]).toEqual([[1, 1], [2, 2], [3, 3], [4, 0]]);
		expect(tourDesFetes(h, TOUS, 2027).noel).toEqual([4]);
		expect(tourDesFetes(h, TOUS, 2027).nouvelAn).toEqual([2, 3, 4]);
	});
});

describe('le roulement qui continue', () => {
	it('reprend là où le cycle s’arrête, en janvier', () => {
		// 52 semaines : un tour complet, on repart de l'équipe 1 ; 53 semaines : de l'équipe 2.
		expect(ordreQuiContinue([1, 2, 3, 4], 52, 4, TOUS)).toEqual([1, 2, 3, 4]);
		expect(ordreQuiContinue([1, 2, 3, 4], 53, 1, TOUS)).toEqual([2, 3, 4, 1]);
		expect(ordreQuiContinue([3, 1, 4, 2], 53, 3, TOUS)).toEqual([1, 4, 2, 3]);
	});

	it('jamais la même équipe de part et d’autre de la relève de janvier', () => {
		// La dernière semaine a été changée pour l'équipe 1, qui ouvrirait l'année suivante.
		expect(ordreQuiContinue([1, 2, 3, 4], 52, 1, TOUS)).toEqual([2, 3, 4, 1]);
	});

	it('une équipe archivée sort, une nouvelle équipe entre à la fin', () => {
		expect(ordreQuiContinue([1, 2, 3, 4], 52, 4, [1, 3, 4])).toEqual([1, 3, 4]);
		expect(ordreQuiContinue([1, 2, 3], 52, 3, [1, 2, 3, 5])).toEqual([2, 3, 1, 5]);
	});
});

describe('régler les fêtes', () => {
	const NOEL = 50;
	const NOUVEL_AN = 51;
	const regler = (noel: Map<number, number>, nouvelAn: Map<number, number>, equipes = cycle(), iN = NOEL, iA = NOUVEL_AN) => reglerFetes(equipes, { noel: iN, nouvelAn: iA }, { noel, nouvelAn });

	it('déjà dans le tour : rien ne change', () => {
		expect(regler(avecTour(3), avecTour(4))).toEqual(cycle());
	});

	it('toutes les équipes attendent : rien ne change', () => {
		expect(regler(new Map(TOUS.map((id) => [id, 0])), new Map(TOUS.map((id) => [id, 0])))).toEqual(cycle());
	});

	it('les deux fêtes s’échangent : deux semaines changées, pas plus', () => {
		const r = regler(avecTour(4), avecTour(3));
		expect(r[NOEL]).toBe(4);
		expect(r[NOUVEL_AN]).toBe(3);
		expect(ecarts(r, cycle())).toBe(2);
	});

	it('une seule fête hors du tour : un échange, sans deux semaines de suite', () => {
		const r = regler(avecTour(1), avecTour(4));
		expect(r[NOEL]).toBe(1);
		expect(r[NOUVEL_AN]).toBe(4);
		expect(ecarts(r, cycle())).toBe(2);
		expect(r.some((x, i) => x === r[i + 1])).toBe(false);
		expect([...r].sort()).toEqual([...cycle()].sort());
	});

	it('les deux hors du tour : trois semaines changées plutôt que quatre', () => {
		const r = regler(avecTour(4), avecTour(1));
		expect(r[NOEL]).toBe(4);
		expect(r[NOUVEL_AN]).toBe(1);
		expect(ecarts(r, cycle())).toBe(3);
		expect(r.some((x, i) => x === r[i + 1])).toBe(false);
	});

	it('quels que soient les tours, à quatre équipes : les fêtes dans le tour, sans deux semaines de suite', () => {
		for (const n of TOUS) {
			for (const a of TOUS.filter((x) => x !== n)) {
				const r = regler(avecTour(n), avecTour(a));
				expect([r[NOEL], r[NOUVEL_AN]]).toEqual([n, a]);
				expect(r.some((x, i) => x === r[i + 1]), `Noël ${n}, Nouvel An ${a}`).toBe(false);
			}
		}
	});

	it('ne touche pas aux semaines déjà commencées (année en cours)', () => {
		const r = reglerFetes(cycle(), { noel: NOEL, nouvelAn: NOUVEL_AN }, { noel: avecTour(1), nouvelAn: avecTour(4) }, 49);
		expect(r.slice(0, 49)).toEqual(cycle().slice(0, 49));
		// La semaine de l'équipe 1 est passée : Noël reste à une équipe disponible, et l'appli le dira.
		expect(r[NOEL]).not.toBe(1);
		const passe = reglerFetes(cycle(), { noel: NOEL, nouvelAn: NOUVEL_AN }, { noel: avecTour(4), nouvelAn: avecTour(3) }, 51);
		expect(passe).toEqual(cycle());
	});

	it('chaque équipe garde son nombre de semaines, et seule la fin d’année bouge', () => {
		for (const [n, a] of [[1, 2], [2, 1], [4, 2], [1, 3]] as const) {
			const r = regler(avecTour(n), avecTour(a));
			expect([...r].sort()).toEqual([...cycle()].sort());
			expect(r.slice(0, 40)).toEqual(cycle().slice(0, 40));
		}
	});

	it('la même équipe attendue aux deux fêtes : Noël pour elle, le Nouvel An pour la suivante dans la file', () => {
		const r = regler(file(2, 1, 3, 4), file(2, 1, 3, 4));
		expect(r[NOEL]).toBe(2);
		expect(r[NOUVEL_AN]).toBe(1);
	});

	it('une seule semaine pour les deux fêtes et deux équipes attendues : Noël passe d’abord', () => {
		const r = regler(avecTour(1), avecTour(2), cycle(), 51, 51);
		expect(r[51]).toBe(1);
		// Un simple échange mettrait l'équipe 4 deux semaines de suite : une troisième semaine bouge.
		expect(ecarts(r, cycle())).toBe(3);
		expect(r.some((x, i) => x === r[i + 1])).toBe(false);
	});

	it('une seule semaine, la même équipe attendue : elle tient les deux', () => {
		const r = regler(avecTour(2), avecTour(2), cycle(), 51, 51);
		expect(r[51]).toBe(2);
	});

	it('deux équipes seulement : les fêtes d’abord, même au prix de deux semaines de suite', () => {
		const deux = Array.from({ length: 52 }, (_, i) => (i % 2) + 1);
		const r = regler(file(2, 1), file(1, 2), deux);
		expect([r[NOEL], r[NOUVEL_AN]]).toEqual([2, 1]);
	});

	it('une fête sans équipe d’astreinte à ce moment : seule l’autre compte', () => {
		const r = regler(avecTour(1), avecTour(1), cycle(), 50, -1);
		expect(r[50]).toBe(1);
	});
});

describe('la place dans le mois', () => {
	it('le 2e dimanche de mars reste le 2e dimanche de mars, même heure', () => {
		expect(memePlaceDansLeMois('2026-03-08T08:30', 2027)).toBe('2027-03-14T08:30');
	});

	it('un 1er lundi, un 4e samedi', () => {
		expect(memePlaceDansLeMois('2026-06-01T19:00', 2027)).toBe('2027-06-07T19:00');
		expect(memePlaceDansLeMois('2026-10-24T09:00', 2027)).toBe('2027-10-23T09:00');
	});

	it('un 5e dimanche absent l’année suivante : le dernier dimanche du mois', () => {
		expect(memePlaceDansLeMois('2026-03-29T08:30', 2027)).toBe('2027-03-28T08:30');
		// Février 2028 : un 5e mardi le 29, absent en 2027.
		expect(memePlaceDansLeMois('2028-02-29T08:30', 2029)).toBe('2029-02-27T08:30');
	});
});

describe('le tour de rôle', () => {
	it('évident : la suite se répète, vue au moins deux fois', () => {
		expect(periodeDuTour([[1], [2], [1], [2]])).toBe(2);
		expect(periodeDuTour([[1, 2], [3, 4], [1, 2], [3, 4], [1, 2]])).toBe(2);
		expect(periodeDuTour([[1], [2], [3], [4], [1], [2], [3], [4], [1]])).toBe(4);
	});

	it('pas de tour : mêmes équipes partout, suite irrégulière, ou vue moins de deux fois', () => {
		expect(periodeDuTour([[1], [1], [1]])).toBeNull();
		expect(periodeDuTour([[1], [2], [3], [1]])).toBeNull();
		expect(periodeDuTour([[1], [2], [1]])).toBeNull();
		expect(periodeDuTour([])).toBeNull();
	});

	it('l’ordre des équipes dans une convocation ne compte pas', () => {
		expect(periodeDuTour([[1, 2], [3], [2, 1], [3]])).toBe(2);
	});
});

describe('reprendre les manœuvres', () => {
	type Source = Parameters<typeof reprendreManoeuvres>[0][number];
	const m = (debut: string, convoques: 'tous' | number[], autres: Partial<Source> = {}): Source => ({ debut, theme: 'Feux', lieu: 'Caserne', convoques, petitDejeuner: true, annulee: false, ...autres });

	it('mêmes équipes, même heure, thème, lieu et petit-déjeuner', () => {
		const r = reprendreManoeuvres([m('2026-03-08T08:30', [1, 2], { theme: 'SAP', lieu: 'Stade', petitDejeuner: false })], 2027, TOUS, maintenant, []);
		expect(r.manoeuvres).toEqual([{ debut: '2027-03-14T08:30', theme: 'SAP', lieu: 'Stade', convoques: [1, 2], petitDejeuner: false }]);
		expect(r).toMatchObject({ tourDeRole: false, annulees: 0, passees: 0, deja: 0 });
	});

	it('les annulées ne sont pas reprises, mais comptent dans le tour', () => {
		const r = reprendreManoeuvres([m('2026-01-11T08:30', [1]), m('2026-02-08T08:30', [2], { annulee: true }), m('2026-03-08T08:30', [1]), m('2026-04-12T08:30', [2]), m('2026-05-10T08:30', [1])], 2027, TOUS, maintenant, []);
		expect(r.tourDeRole).toBe(true);
		expect(r.annulees).toBe(1);
		// Cinq manœuvres : la suite 1-2-1-2-1 reprend à l'équipe 2. La deuxième (annulée) n'est pas reprise.
		expect(r.manoeuvres.map((x) => x.convoques)).toEqual([[2], [2], [1], [2]]);
	});

	it('le tour de rôle continue, « tout le centre » reste à sa place sans le rompre', () => {
		const r = reprendreManoeuvres([m('2026-01-11T08:30', [1]), m('2026-02-08T08:30', 'tous'), m('2026-03-08T08:30', [2]), m('2026-04-12T08:30', [1]), m('2026-05-10T08:30', [2]), m('2026-06-14T08:30', [1])], 2027, TOUS, maintenant, []);
		expect(r.manoeuvres.map((x) => x.convoques)).toEqual([[2], 'tous', [1], [2], [1], [2]]);
	});

	it('une équipe archivée sort de la convocation ; plus aucune : tout le centre', () => {
		const r = reprendreManoeuvres([m('2026-01-11T08:30', [1, 2]), m('2026-03-08T08:30', [2])], 2027, [1, 3, 4], maintenant, []);
		expect(r.manoeuvres.map((x) => x.convoques)).toEqual([[1], 'tous']);
	});

	it('deux manœuvres qui tomberaient au même moment : la seconde est écartée, et comptée', () => {
		const r = reprendreManoeuvres([m('2026-03-22T08:30', 'tous', { theme: 'Une' }), m('2026-03-29T08:30', 'tous', { theme: 'Deux' })], 2027, TOUS, maintenant, []);
		expect(r.manoeuvres.map((x) => x.theme)).toEqual(['Une']);
		expect(r.deja).toBe(1);
	});

	it('ni date passée, ni manœuvre déjà au même moment', () => {
		const r = reprendreManoeuvres([m('2025-01-12T08:30', [1]), m('2025-12-14T08:30', [1]), m('2025-11-09T08:30', [1])], 2026, TOUS, maintenant, ['2026-12-13T08:30']);
		expect(r.manoeuvres.map((x) => x.debut)).toEqual(['2026-11-08T08:30']);
		expect(r).toMatchObject({ passees: 1, deja: 1 });
	});
});

// Chef, quatre équipes, l'année 2026 publiée (roulement du jeu de départ).
async function jeu({ publier = true } = {}) {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const ids = (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
	const nouvelle = async (prenom: string) => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning();
		return p!.id;
	};
	const chef = await nouvelle('Chef');
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: chef, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const a = (id: number): Acteur => ({ type: 'personne', id });
	const leChef = a(chef);
	if (publier) {
		await reglerRoulement(base, leChef, 2026, ids, maintenant);
		await publierAnnee(base, leChef, 2026, maintenant);
	}
	return { base, ids, chef: leChef, alice: a(await nouvelle('Alice')), nouvelle };
}

describe('proposer l’année', () => {
	it('réservé à qui gère le planning', async () => {
		const { base, alice } = await jeu();
		await expect(proposerAnnee(base, alice, 2027, maintenant, reglage)).rejects.toThrow(RefusDroit);
		await expect(accepterProposition(base, alice, 2027, maintenant, reglage)).rejects.toThrow(RefusDroit);
	});

	it('refuse une année qui a déjà un roulement', async () => {
		const { base, chef } = await jeu();
		await expect(proposerAnnee(base, chef, 2026, maintenant, reglage)).rejects.toThrow(/déjà un roulement/);
		await expect(accepterProposition(base, chef, 2026, maintenant, reglage)).rejects.toThrow(DonneeInvalide);
	});

	it('continue le roulement sans rupture à la relève de janvier', async () => {
		const { base, chef, ids } = await jeu();
		const p = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		const avant = calculerAnnee(2026, reglage, ids, new Map());
		// 2026 : 52 relèves du vendredi, dont la dernière le 25 décembre.
		expect(avant.at(-1)!.debut).toBe('2026-12-25');
		expect(p.precedente).toBe(true);
		const i = ids.indexOf(avant.at(-1)!.equipeId);
		expect(p.ordre[0]).toBe(ids[(i + 1) % ids.length]);
		expect(p.semaines).toBe(calculerAnnee(2027, reglage, p.ordre, new Map()).length);
	});

	it('donne Noël et le Nouvel An aux équipes dont c’est le tour, et n’écrit rien', async () => {
		const { base, chef, ids } = await jeu();
		const f2026 = fetes(2026, calculerAnnee(2026, reglage, ids, new Map()));
		// Les autres équipes ont tenu chaque fête plus récemment que l'équipe voulue.
		const brut = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		const nature = fetes(2027, calculerAnnee(2027, reglage, brut.ordre, new Map()));
		const autres = (garde: number) => ids.filter((id) => id !== garde);
		const voulueNoel = ids.find((id) => id !== nature.noel && id !== nature.nouvelAn && id !== f2026.noel)!;
		const voulueAn = ids.find((id) => id !== nature.noel && id !== nature.nouvelAn && id !== voulueNoel && id !== f2026.nouvelAn) ?? nature.noel!;
		for (const [i, id] of autres(voulueNoel).entries()) await noterFete(base, chef, 2023 + i, 'noel', id, maintenant);
		for (const [i, id] of autres(voulueAn).entries()) await noterFete(base, chef, 2023 + i, 'nouvel_an', id, maintenant);
		const p = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		expect(p.fetes.noel).toMatchObject({ equipeId: voulueNoel, dansLeTour: true });
		expect(p.fetes.nouvelAn).toMatchObject({ equipeId: voulueAn, dansLeTour: true });
		expect(p.fetes.compromis).toBe(false);
		// Aucune des deux équipes voulues ne tient déjà une fête : deux échanges.
		expect(p.changees).toHaveLength(4);
		expect(await base.select().from(anneePlanning).where(eq(anneePlanning.annee, 2027))).toEqual([]);
		expect(await base.select().from(semaineChangee)).toEqual([]);
	});

	it('impossible de satisfaire les deux : il le dit, et garde le compromis', async () => {
		const { base, chef, ids } = await jeu();
		// Seule l'équipe 2 n'a jamais tenu ni Noël ni le Nouvel An.
		for (const [i, id] of ids.filter((x) => x !== ids[1]).entries()) {
			await noterFete(base, chef, 2022 + i, 'noel', id, maintenant);
			await noterFete(base, chef, 2022 + i, 'nouvel_an', id, maintenant);
		}
		// 2026 publiée tient aussi ses fêtes : on regarde l'année suivante telle que l'appli la voit.
		const p = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		expect(p.fetes.compromis).toBe(true);
		expect(p.fetes.noel.equipeId).toBe(p.fetes.noel.attendues[0]);
		expect(p.fetes.noel.equipeId).not.toBe(p.fetes.nouvelAn.equipeId);
	});

	it('l’année précédente sans planning : le roulement de base, sans manœuvre', async () => {
		const { base, chef } = await jeu({ publier: false });
		const prep = await preparerAnnee(base, chef, 2027, maintenant, reglage);
		const p = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		expect(p.precedente).toBe(false);
		expect(p.ordre).toEqual(prep.ordrePropose);
		expect(p.manoeuvres).toEqual([]);
		expect(p.changees).toEqual([]);
	});

	it('relève le lundi matin : Noël et le Nouvel An dans la même semaine, sans tour commun, c’est dit', async () => {
		const { base, chef, ids } = await jeu({ publier: false });
		const lundi = { ...reglage, debut: { jour: 'lundi', heure: '08:00' }, fin: { jour: 'lundi', heure: '08:00' }, semaine: undefined, reference: { date: '2026-01-05', equipe: 1 } } as typeof reglage;
		// 2028 : le 25 décembre tombe un lundi ; la relève de 8 h précède midi, la semaine va jusqu'au 1er janvier.
		for (const [i, id] of ids.filter((x) => x !== ids[0]).entries()) await noterFete(base, chef, 2023 + i, 'noel', id, maintenant);
		for (const [i, id] of ids.filter((x) => x !== ids[1]).entries()) await noterFete(base, chef, 2023 + i, 'nouvel_an', id, maintenant);
		const p = await proposerAnnee(base, chef, 2028, maintenant, lundi);
		expect(p.fetes.memeSemaine).toBe(true);
		expect(p.fetes.compromis).toBe(true);
		expect(p.fetes.noel.equipeId).toBe(ids[0]);
		expect(p.fetes.nouvelAn.equipeId).toBe(ids[0]);
	});

	it('reprend les manœuvres de l’année précédente, sans les annulées ; le rappel des vacances', async () => {
		const { base, chef, ids } = await jeu();
		// Annoncée puis annulée : elle reste dans la base, mais ne revient pas.
		const annulee = await enregistrerManoeuvre(base, chef, { debut: '2026-11-08T08:30', theme: 'Annulée', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, maintenant);
		await planningDuMatin(base, '2026-11-03T08:00');
		await supprimerManoeuvre(base, chef, annulee, maintenant);
		const gardee = await enregistrerManoeuvre(base, chef, { debut: '2026-12-13T08:30', theme: 'Feux de forêt', lieu: 'Stade', convoques: [ids[0]!], petitDejeuner: true }, maintenant);
		const p = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		expect(gardee).toBeGreaterThan(0);
		expect(p.manoeuvres).toEqual([{ debut: '2027-12-12T08:30', theme: 'Feux de forêt', lieu: 'Stade', convoques: [ids[0]], petitDejeuner: true }]);
		expect(p.annulees).toBe(1);
		expect(p.vacances).toBe(0);
	});

	it('les vacances à cheval sur le 1er janvier comptent pour l’année où elles commencent', async () => {
		const { base, chef } = await jeu();
		await ajouterVacances(base, chef, { nom: 'Noël 2026', debut: '2026-12-19', fin: '2027-01-03' }, maintenant);
		expect((await proposerAnnee(base, chef, 2027, maintenant, reglage)).vacances).toBe(0);
		await ajouterVacances(base, chef, { nom: 'Hiver 2027', debut: '2027-02-13', fin: '2027-03-01' }, maintenant);
		expect((await proposerAnnee(base, chef, 2027, maintenant, reglage)).vacances).toBe(1);
	});

	it('un échange de manœuvres passé ne se reprend pas : seules les équipes reviennent', async () => {
		const { base, chef, ids } = await jeu();
		await base.insert(manoeuvre).values({ debut: '2026-12-13T08:30', theme: 'Feux', lieu: 'Stade', convoques: JSON.stringify({ equipes: [ids[0]], ajoutes: [99], retires: [98] }), petitDejeuner: 0 });
		const p = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		expect(p.manoeuvres).toMatchObject([{ convoques: [ids[0]] }]);
	});

	it('année en cours sans roulement : aucune semaine commencée ne change', async () => {
		const { base, chef, ids } = await jeu({ publier: false });
		for (const [i, id] of ids.slice(1).entries()) await noterFete(base, chef, 2022 + i, 'noel', id, maintenant);
		const p = await proposerAnnee(base, chef, 2026, '2026-12-20T10:00', reglage);
		expect(p.changees.every((c) => c.debut > '2026-12-20')).toBe(true);
	});

	it('qui compte dans l’état des équipes : inapte sans poste, aptitudes retirée ou expirée sans effet, agent parti absent', async () => {
		const { base, chef, ids, nouvelle } = await jeu();
		const aptitudes = await base.select().from(aptitude);
		const apt = (nom: string) => aptitudes.find((a) => a.nom === nom)!.id;
		const entre = async (prenom: string) => {
			const id = await nouvelle(prenom);
			await base.insert(affectationEquipe).values({ personneId: id, equipeId: ids[0]!, debut: '2026-01-01' });
			return id;
		};
		const donner = (personneId: number, nom: string, expireLe: string | null = null) => base.insert(aptitudeAgent).values({ personneId, aptitudeId: apt(nom), obtenueLe: '2020-01-01', expireLe });
		const parti = await entre('Parti');
		await donner(parti, 'CE');
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, parti));
		const inapte = await entre('Inapte');
		await donner(inapte, 'CA2');
		await base.update(personne).set({ statut: 'inapte_temporaire' }).where(eq(personne.id, inapte));
		await donner(await entre('Expire'), 'COD1', '2026-12-31');
		const retire = await entre('Retire');
		await donner(retire, 'CE');
		await base.update(aptitude).set({ retireeLe: '2026-06-01' }).where(eq(aptitude.id, apt('CE')));
		const e = (await proposerAnnee(base, chef, 2027, maintenant, reglage)).equipes.find((x) => x.id === ids[0])!;
		expect(e.effectif).toBe(3);
		// Toutes les places qualifiées restent vides : seul le poste « agent » est tenu, par les trois.
		expect(e.manque).toEqual(['ca2', 'cod1', 'ce', 'ce']);
	});

	it('une équipe tient deux semaines de suite faute de mieux : le panneau peut le dire', async () => {
		const { base, chef } = await jeu({ publier: false });
		const [a, b, ...reste] = (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
		for (const id of reste) await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, id));
		// Deux équipes seulement, chacune attendue à la fête que l'autre tiendrait.
		const brut = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		const [n, an] = [brut.fetes.noel.equipeId!, brut.fetes.nouvelAn.equipeId!];
		await noterFete(base, chef, 2025, 'noel', n, maintenant);
		await noterFete(base, chef, 2025, 'nouvel_an', an, maintenant);
		const p = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		expect(p.fetes.noel.equipeId).toBe(an);
		expect(p.fetes.nouvelAn.equipeId).toBe(n);
		expect([a, b]).toContain(p.fetes.deSuite[0]);
		expect(p.fetes.deSuite).toContain(an);
	});

	it('l’état des équipes : effectif à la date de début d’année, FPT armé ou ce qui manque', async () => {
		const { base, chef, ids, nouvelle } = await jeu();
		const aptitudes = await base.select().from(aptitude);
		const apt = (nom: string) => aptitudes.find((a) => a.nom === nom)!.id;
		const entre = async (prenom: string, noms: string[], equipeId: number, debut = '2026-01-01', fin: string | null = null) => {
			const id = await nouvelle(prenom);
			await base.insert(affectationEquipe).values({ personneId: id, equipeId, debut, fin });
			for (const n of noms) await base.insert(aptitudeAgent).values({ personneId: id, aptitudeId: apt(n), obtenueLe: '2020-01-01' });
			return id;
		};
		// Équipe 1 : complète. Équipe 2 : il manque un CE. L'agent qui change d'équipe en 2027 compte dans sa nouvelle équipe.
		await entre('Ana', ['CA2'], ids[0]!);
		await entre('Ben', ['CE'], ids[0]!);
		await entre('Cid', ['CE'], ids[0]!);
		await entre('Dan', ['COD1'], ids[0]!);
		await entre('Eva', [], ids[0]!);
		await entre('Fay', [], ids[0]!);
		await entre('Gus', ['CA2'], ids[1]!);
		await entre('Hal', ['COD1'], ids[1]!);
		await entre('Ian', [], ids[1]!);
		await entre('Jon', [], ids[1]!);
		await entre('Kim', ['CE'], ids[1]!, '2026-01-01', '2026-12-31');
		await entre('Léo', ['CE'], ids[2]!, '2027-01-01');
		const p = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		expect(p.equipes.find((e) => e.id === ids[0])).toMatchObject({ effectif: 6, arme: true, manque: [] });
		// Kim a quitté l'équipe le 31 décembre : il manque les deux CE.
		expect(p.equipes.find((e) => e.id === ids[1])).toMatchObject({ effectif: 4, arme: false, manque: ['ce', 'ce'] });
		expect(p.equipes.find((e) => e.id === ids[2])).toMatchObject({ effectif: 1, arme: false });
		expect(p.equipes.find((e) => e.id === ids[3])).toMatchObject({ effectif: 0, arme: false });
	});
});

describe('accepter la proposition', () => {
	it('écrit le brouillon d’un seul bloc : roulement, semaines, manœuvres, journal ; rien de publié, rien d’annoncé', async () => {
		const { base, chef, ids } = await jeu();
		await enregistrerManoeuvre(base, chef, { debut: '2026-12-13T08:30', theme: 'Feux de forêt', lieu: 'Stade', convoques: [ids[0]!], petitDejeuner: true }, maintenant);
		const voulue = ids[0]!;
		for (const [i, id] of ids.filter((x) => x !== voulue).entries()) await noterFete(base, chef, 2023 + i, 'noel', id, maintenant);
		const p = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		await accepterProposition(base, chef, 2027, maintenant, reglage);
		const prep = await preparerAnnee(base, chef, 2027, maintenant, reglage);
		expect(prep.publiee).toBeNull();
		expect(prep.ordre).toEqual(p.ordre);
		expect(prep.fetes.noel).toBe(p.fetes.noel.equipeId);
		expect(prep.fetes.nouvelAn).toBe(p.fetes.nouvelAn.equipeId);
		expect(prep.semaines.filter((s) => s.changee).length).toBe(p.changees.length);
		expect(prep.manoeuvres).toMatchObject([{ debut: '2027-12-12T08:30', theme: 'Feux de forêt', lieu: 'Stade', convoques: [ids[0]], petitDejeuner: true, publiee: false }]);
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'accepter_proposition'));
		expect(JSON.parse(ligne!.details!)).toMatchObject({ annee: 2027, ordre: p.ordre, semaines: p.changees.length, manoeuvres: 1 });
		// Le matin de la manœuvre moins dix jours : l'année n'est pas publiée, rien n'est annoncé.
		const avantAnnonces = (await base.select().from(publication)).length;
		expect(await planningDuMatin(base, '2027-12-02T08:00')).toMatchObject({ publiees: 0 });
		expect((await base.select().from(publication)).length).toBe(avantAnnonces);
	});

	it('ne jamais écraser : la seconde acceptation est refusée, même au même moment', async () => {
		const { base, chef, ids } = await jeu();
		await enregistrerManoeuvre(base, chef, { debut: '2026-12-13T08:30', theme: 'Feux', lieu: 'Stade', convoques: [ids[0]!], petitDejeuner: true }, maintenant);
		const resultats = await Promise.allSettled([accepterProposition(base, chef, 2027, maintenant, reglage), accepterProposition(base, chef, 2027, maintenant, reglage)]);
		expect(resultats.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
		const echec = resultats.find((r) => r.status === 'rejected') as PromiseRejectedResult;
		expect(echec.reason).toBeInstanceOf(DonneeInvalide);
		expect(echec.reason.message).toMatch(/déjà un roulement/);
		expect((await base.select().from(manoeuvre)).filter((m) => m.debut.startsWith('2027-'))).toHaveLength(1);
		await expect(accepterProposition(base, chef, 2027, maintenant, reglage)).rejects.toThrow(/déjà un roulement/);
	});

	it('garde les manœuvres déjà saisies sans roulement, sans doublon', async () => {
		const { base, chef, ids } = await jeu();
		await enregistrerManoeuvre(base, chef, { debut: '2026-12-13T08:30', theme: 'Feux', lieu: 'Stade', convoques: [ids[0]!], petitDejeuner: true }, maintenant);
		await enregistrerManoeuvre(base, chef, { debut: '2027-12-12T08:30', theme: 'Déjà là', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, maintenant);
		const p = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		expect(p.deja).toBe(1);
		await accepterProposition(base, chef, 2027, maintenant, reglage);
		expect((await base.select().from(manoeuvre)).filter((m) => m.debut.startsWith('2027-')).map((m) => m.theme)).toEqual(['Déjà là']);
	});

	it('une ligne vide ou des semaines orphelines ne gênent pas : ce qui est écrit est ce qui était proposé', async () => {
		const { base, chef } = await jeu();
		await base.insert(anneePlanning).values({ annee: 2027, ordre: '[]' });
		const [{ id: autre }] = await base.select({ id: equipe.id }).from(equipe).limit(1) as [{ id: number }];
		await base.insert(semaineChangee).values({ debut: '2027-12-31', equipeId: autre });
		const p = await proposerAnnee(base, chef, 2027, maintenant, reglage);
		await accepterProposition(base, chef, 2027, maintenant, reglage);
		const prep = await preparerAnnee(base, chef, 2027, maintenant, reglage);
		expect(prep.ordre).toEqual(p.ordre);
		expect(prep.fetes.nouvelAn).toBe(p.fetes.nouvelAn.equipeId);
		expect(prep.semaines.filter((s) => s.changee)).toHaveLength(p.changees.length);
	});

	it('moins de deux équipes actives : refus clair', async () => {
		const { base, chef, ids } = await jeu();
		for (const id of ids.slice(1)) await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, id));
		await expect(proposerAnnee(base, chef, 2027, maintenant, reglage)).rejects.toThrow(/deux équipes/);
	});
});
