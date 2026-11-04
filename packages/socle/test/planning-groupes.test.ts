import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { agendaDe, monLienAgenda } from '../src/planning/agenda.ts';
import { planningDe } from '../src/planning/annee.ts';
import { astreinteDe } from '../src/planning/astreinte.ts';
import { reglerEte } from '../src/planning/ete.ts';
import { donneesFichierPlanning } from '../src/planning/fichier.ts';
import { nomsDeGroupes, semaineEnGroupes } from '../src/planning/groupes.ts';
import { eteAPreparer, proposerEte, publierEte } from '../src/planning/repartition.ts';
import { avisEte } from '../src/schema.ts';
import { jeuEte } from './jeu-ete.ts';

const reglage = centreExemple.astreinte;
const maintenant = '2027-03-01T10:00';
const ETE = '2027-06-25';
const HORS_ETE = '2027-07-02';

describe('la correspondance (calcul)', () => {
	it('A, B, C, D dans l’ordre du roulement, équipes actives seulement', () => {
		const noms = nomsDeGroupes([
			{ id: 7, active: 1 },
			{ id: 3, active: 0 },
			{ id: 4, active: 1 },
			{ id: 9, active: 1 },
			{ id: 2, active: 1 }
		]);
		expect([...noms]).toEqual([
			[7, 'Groupe A'],
			[4, 'Groupe B'],
			[9, 'Groupe C'],
			[2, 'Groupe D']
		]);
	});

	it('une semaine compte en groupes si l’été est proposé ou publié, de sa première à sa dernière relève', () => {
		const ete = { debut: '2027-06-25', fin: '2027-08-27', publieeLe: null, proposee: 1 };
		expect(semaineEnGroupes([ete], '2027-06-25')).toBe(true);
		expect(semaineEnGroupes([ete], '2027-08-27')).toBe(true);
		expect(semaineEnGroupes([ete], '2027-06-18')).toBe(false);
		expect(semaineEnGroupes([ete], '2027-09-03')).toBe(false);
		expect(semaineEnGroupes([{ ...ete, proposee: 0 }], '2027-06-25')).toBe(false);
		expect(semaineEnGroupes([{ ...ete, proposee: 0, publieeLe: '2027-05-20T10:00' }], '2027-06-25')).toBe(true);
	});
});

// La semaine du 25 juin 2027 revient à l'Équipe 2 (voir jeu-ete.ts) ; été d'une seule semaine.
async function jeu() {
	const j = await jeuEte();
	const { nouvelle, apte, base, chef } = j;
	const p = { bruno: await nouvelle('Bruno', 2), alice: await nouvelle('Alice', 1) };
	await apte(p.alice, 'CA2');
	await reglerEte(base, chef, 2027, { debut: ETE, fin: ETE, dateLimite: '2027-05-15' }, maintenant, reglage);
	return { ...j, p };
}
const nomDe = (planning: Awaited<ReturnType<typeof planningDe>>, debut: string) => (planning.publiee ? planning.semaines.find((s) => s.debut === debut)!.groupe : 'non publié');

describe('l’été ouvert, pas encore proposé : rien ne change', () => {
	it('équipes partout', async () => {
		const { base, chef, a, p } = await jeu();
		expect((await eteAPreparer(base, chef, 2027, maintenant, reglage)).equipes.map((e) => e.nom)).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3', 'Équipe 4']);
		expect(nomDe(await planningDe(base, a(p.bruno), 2027, maintenant, reglage), ETE)).toBeNull();
		expect((await astreinteDe(base, a(p.bruno), `${ETE}T10:00`, reglage))!.equipe.nom).toBe('Équipe 2');
	});
});

describe('l’été proposé', () => {
	it('tableau de l’été, planning et carte astreinte en groupes ; le reste de l’année en équipes', async () => {
		const { base, chef, a, p } = await jeu();
		await proposerEte(base, chef, 2027, maintenant, reglage);
		expect((await eteAPreparer(base, chef, 2027, maintenant, reglage)).equipes.map((e) => e.nom)).toEqual(['Groupe A', 'Groupe B', 'Groupe C', 'Groupe D']);
		const planning = await planningDe(base, a(p.bruno), 2027, maintenant, reglage);
		expect(nomDe(planning, ETE)).toBe('Groupe B');
		expect(nomDe(planning, HORS_ETE)).toBeNull();
		expect((await astreinteDe(base, a(p.bruno), `${ETE}T10:00`, reglage))!.equipe.nom).toBe('Groupe B');
		expect((await astreinteDe(base, a(p.bruno), '2027-03-01T10:00', reglage))!.equipe.nom).toBe('Équipe 2');
	});

	it('le fichier : onglet Été en groupes, onglet Semaines en équipes', async () => {
		const { base, chef, p } = await jeu();
		await proposerEte(base, chef, 2027, maintenant, reglage);
		const { feuilles } = await donneesFichierPlanning(base, chef, 2027, maintenant, reglage);
		const ete = feuilles.find((f) => f.nom === 'Été')!;
		expect(ete.entetes.slice(0, 3)).toEqual(['N°', 'Agent', 'Groupe']);
		expect(ete.lignes.find((l) => l[0] === String(p.bruno))![2]).toBe('Groupe B');
		expect(ete.lignes.find((l) => l[0] === String(p.alice))![2]).toBe('Groupe A');
		expect(feuilles.find((f) => f.nom === 'Semaines')!.lignes.some((l) => l.includes('Équipe 2'))).toBe(true);
	});
});

describe('l’été publié', () => {
	it('notifications de renfort et agenda en groupes', async () => {
		const { base, chef, a, p } = await jeu();
		await proposerEte(base, chef, 2027, maintenant, reglage);
		await publierEte(base, chef, 2027, maintenant, reglage);
		const avis = await base.select().from(avisEte);
		expect(avis.find((x) => x.personneId === p.alice)?.texte).toBe('Planning d’été : vous êtes en renfort du Groupe B la semaine du vendredi 25 juin.');
		expect(nomDe(await planningDe(base, a(p.alice), 2027, maintenant, reglage), ETE)).toBe('Groupe B');
		const lien = await monLienAgenda(base, a(p.bruno), maintenant);
		const ics = await agendaDe(base, lien, maintenant, reglage);
		expect(ics).toContain('Astreinte · Groupe B');
		expect(ics).toContain('Astreinte · Équipe 2');
	});
});
