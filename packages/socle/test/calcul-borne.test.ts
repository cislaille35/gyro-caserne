import { beforeAll, describe, expect, it, vi } from 'vitest';
import { accueilDe } from '../src/casquettes.ts';
import * as calendrier from '../src/planning/calendrier.ts';
import * as annee from '../src/planning/annee.ts';
import * as plages from '../src/planning/plages.ts';
import { astreinteDe } from '../src/planning/astreinte.ts';
import { agendaDe, monLienAgenda } from '../src/planning/agenda.ts';
import { eteAPreparer, plageAPreparer } from '../src/planning/repartition.ts';
import { lirePrise, prisesDeLaReleve } from '../src/prises.ts';
import { manoeuvresEchangeables } from '../src/remplacements/demandes.ts';
import { demandeVue, pourDemander, remplacementsDe } from '../src/remplacements/lectures.ts';
import { demandeRemplacement, engin } from '../src/schema.ts';
import { jeuGrossi } from './jeu-grossi.ts';

// Le garde-fou du temps de calcul (offre gratuite de Cloudflare : 10 ms par requête, décision 0021). On compte le travail, pas les
// millisecondes : c'est stable en CI. Données grossies : 60 agents, 6 années publiées, une cinquantaine de demandes en cours.
vi.mock('../src/planning/calendrier.ts', async (original) => {
	const m = await original<typeof import('../src/planning/calendrier.ts')>();
	return { ...m, calculerAnnee: vi.fn(m.calculerAnnee) };
});
vi.mock('../src/planning/plages.ts', async (original) => {
	const m = await original<typeof import('../src/planning/plages.ts')>();
	return { ...m, heuresDe: vi.fn(m.heuresDe) };
});
// L'équipe de chacun à une date : le travail de l'été, agent par agent.
vi.mock('../src/planning/annee.ts', async (original) => {
	const m = await original<typeof import('../src/planning/annee.ts')>();
	return { ...m, equipeLe: vi.fn(m.equipeLe) };
});

type Jeu = Awaited<ReturnType<typeof jeuGrossi>>;
let jeu: Jeu;
let lien: string;
let textes: Set<string>;
let demande: { id: number; demandeurId: number };
let enginId: number;
let demandes: number;
// Trois tranches libres de Rémi, pour les étapes « qui » et « sienne », à chaque date essayée.
const periodes = new Map<string, { debut: string; fin: string }[]>();
const DATES = ['2026-11-11T10:00', '2027-01-03T10:00'];
beforeAll(async () => {
	jeu = await jeuGrossi();
	lien = await monLienAgenda(jeu.base, jeu.acteurs.agent, jeu.m);
	const lignes = await jeu.base.select().from(demandeRemplacement);
	textes = new Set(lignes.flatMap((d) => [d.periodes, d.periodesCible].filter((t): t is string => t !== null)));
	demande = lignes.find((d) => d.genre === 'remplacement' && d.etat === 'attente' && d.cibleId === null)!;
	enginId = (await jeu.base.select({ id: engin.id }).from(engin))[0]!.id;
	demandes = lignes.length;
	for (const m of DATES)
		periodes.set(
			m,
			(await pourDemander(jeu.base, jeu.acteurs.referent, m, jeu.reglage, { echange: true })).semaines
				.flatMap((s) => s.tranches)
				.filter((t) => t.etat === 'libre')
				.slice(0, 3)
		);
}, 120_000);

// Ce que coûte un chargement : années calculées, heures d'astreinte calculées, textes de demandes relus, équipes cherchées.
async function compter(f: () => Promise<unknown>) {
	vi.mocked(calendrier.calculerAnnee).mockClear();
	vi.mocked(plages.heuresDe).mockClear();
	vi.mocked(annee.equipeLe).mockClear();
	const parse = vi.spyOn(JSON, 'parse');
	let demandes = 0;
	try {
		await f();
	} finally {
		demandes = parse.mock.calls.filter(([texte]) => textes.has(texte as string)).length;
		parse.mockRestore();
	}
	return { annees: vi.mocked(calendrier.calculerAnnee).mock.calls.length, heures: vi.mocked(plages.heuresDe).mock.calls.length, demandes, equipes: vi.mocked(annee.equipeLe).mock.calls.length };
}

// Les chargements les plus exposés, tels que les pages les font (`maintenant` : un jour ordinaire, puis aux premiers jours de janvier,
// quand la semaine en cours a commencé l'année d'avant).
const chargements = (m: string): [string, () => Promise<unknown>][] => {
	const { base, reglage, acteurs } = jeu;
	const a = Number(m.slice(0, 4));
	const jour = m.slice(0, 10);
	const accueil = (acteur: (typeof acteurs)['chef']) => Promise.all([accueilDe(base, acteur, null, jour, m, reglage), astreinteDe(base, acteur, m, reglage)]);
	return [
		['accueil, agent', () => accueil(acteurs.agent)],
		['accueil, chef de centre', () => accueil(acteurs.chef)],
		['accueil, chef de garde', () => accueil(acteurs.chefGarde)],
		['planning, agent', () => Promise.all([planningDe(acteurs.agent, a), remplacementsDe(base, acteurs.agent, m, reglage)])],
		['planning, année suivante', () => Promise.all([planningDe(acteurs.chef, a + 1), remplacementsDe(base, acteurs.chef, m, reglage)])],
		['remplacements', () => remplacementsDe(base, acteurs.agent, m, reglage)],
		['une demande', () => demandeVue(base, { type: 'personne', id: demande.demandeurId }, demande.id, m, reglage)],
		['demander : quand', () => pourDemander(base, acteurs.referent, m, reglage, {})],
		['demander : qui', () => pourDemander(base, acteurs.referent, m, reglage, { periodes: periodes.get(m)! })],
		['échange : sienne', () => pourDemander(base, acteurs.referent, m, reglage, { periodes: periodes.get(m)!, echange: true, avec: acteurs.agent.type === 'personne' ? acteurs.agent.id : 0 })],
		['échange de manœuvre', () => manoeuvresEchangeables(base, acteurs.agent, m, reglage)],
		['prise de garde', () => Promise.all([prisesDeLaReleve(base, acteurs.chefGarde, m, reglage), lirePrise(base, acteurs.chefGarde, enginId, m, reglage)])],
		['agenda', () => agendaDe(base, lien, m, reglage)]
	];
	function planningDe(acteur: (typeof acteurs)['chef'], an: number) {
		return annee.planningDe(base, acteur, an, m, reglage);
	}
};

describe('Le calcul reste borné, avec 60 agents, 6 années publiées et 50 demandes', () => {
	it('le jeu est bien grossi', async () => {
		expect(jeu.agents).toBe(60);
		expect(jeu.demandes).toBeGreaterThanOrEqual(45);
		const publiees = (await jeu.base.select().from((await import('../src/schema.ts')).anneePlanning)).filter((x) => x.publieeLe !== null);
		expect(publiees).toHaveLength(6);
	});

	const noms = ['accueil, agent', 'accueil, chef de centre', 'accueil, chef de garde', 'planning, agent', 'planning, année suivante', 'remplacements', 'une demande', 'demander : quand', 'demander : qui', 'échange : sienne', 'échange de manœuvre', 'prise de garde', 'agenda'];
	for (const m of DATES)
		it.each(noms)(`${m} : %s`, async (nom) => {
			const [, f] = chargements(m).find(([x]) => x === nom)!;
			const n = await compter(f);
			// Au plus 3 années calculées par requête, quel que soit le nombre d'années publiées.
			expect(n.annees, 'années calculées').toBeLessThanOrEqual(3);
			// Les heures d'astreinte : seize semaines par agent au plus (la fenêtre des remplacements).
			expect(n.heures, 'heures d’astreinte').toBeLessThanOrEqual(jeu.agents * 16);
			// Le texte des demandes : quelques lectures par demande (contexte et affichage), jamais une par tranche vérifiée.
			expect(n.demandes, 'textes des demandes').toBeLessThanOrEqual(4 * demandes);
		});

	it.each(['2026-11-11T10:00', '2027-06-01T10:00'])('l’été et une plage : l’équipe de chacun cherchée une fois par semaine (%s)', async (m) => {
		const { base, reglage, acteurs } = jeu;
		const e = await eteAPreparer(base, acteurs.chef, 2027, m, reglage);
		const plage = e.semaines.flatMap((s) => s.plages)[0]!;
		expect(e.semaines.length).toBeGreaterThan(8);
		const semaines = e.semaines.length;
		const ete = await compter(() => eteAPreparer(base, acteurs.chef, 2027, m, reglage));
		const une = await compter(() => plageAPreparer(base, acteurs.chef, 2027, m, reglage, plage.debut));
		for (const n of [ete, une]) {
			expect(n.annees).toBeLessThanOrEqual(1);
			// Avant : pour chaque plage, plusieurs fois tous les agents (plus de 40 000 recherches).
			expect(n.equipes, 'équipes cherchées').toBeLessThanOrEqual(jeu.agents * (semaines + 2));
		}
		// L'accueil du chef refait le compte des plages à revoir : même borne.
		const accueil = await compter(() => accueilDe(base, acteurs.chef, null, m.slice(0, 10), m, reglage));
		expect(accueil.equipes).toBeLessThanOrEqual(jeu.agents * (semaines + 2));
	});

	it('ce qui n’a pas besoin des semaines ne les calcule pas ; l’accueil d’un agent, une année', async () => {
		const { base, reglage, acteurs, m } = jeu;
		expect((await compter(() => remplacementsDe(base, acteurs.agent, m, reglage))).annees).toBe(0);
		expect((await compter(() => manoeuvresEchangeables(base, acteurs.agent, m, reglage))).annees).toBe(0);
		expect((await compter(() => astreinteDe(base, acteurs.agent, m, reglage))).annees).toBe(1);
	});

	it('l’équipe d’une relève, lue sans calculer l’année : la même que celle du planning, semaine changée comprise', async () => {
		const { base, reglage, acteurs } = jeu;
		const { changerSemaines, anneesPubliees } = await import('../src/planning/annee.ts');
		const { equipeAstreinte, releveDe } = await import('../src/prises.ts');
		const { anneePlanning, semaineChangee } = await import('../src/schema.ts');
		const semaines = (await base.select().from(anneePlanning)).find((a) => a.annee === 2027)!;
		const ordre = JSON.parse(semaines.ordre) as number[];
		await changerSemaines(base, acteurs.chef, 2027, { '2027-03-05': ordre.find((id) => id !== ordre[9 % ordre.length])! }, '2026-11-11T10:00', reglage);
		const publiees = anneesPubliees(await base.select().from(anneePlanning), await base.select().from(semaineChangee), reglage);
		vi.mocked(calendrier.calculerAnnee).mockClear();
		let changee = 0;
		for (const s of [...publiees.get(2026)!, ...publiees.get(2027)!]) {
			const m = `${s.debut}T${reglage.debut.heure}`;
			expect(releveDe(m, reglage)).toBe(m);
			expect(await equipeAstreinte(base, m, reglage), m).toBe(s.equipeId);
			if (s.changee) changee++;
		}
		expect(changee).toBeGreaterThan(0);
		expect(vi.mocked(calendrier.calculerAnnee)).not.toHaveBeenCalled();
	});
});
