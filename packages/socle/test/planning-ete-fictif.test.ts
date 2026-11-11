import { and, count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { chargerEteFictif, chargerPlanningFictif } from '../src/planning/fictif.ts';
import { periodeParDefaut } from '../src/planning/ete.ts';
import { armement, lireArmement, postesDe } from '../src/armement.ts';
import { validesLe } from '../src/aptitudes.ts';
import { eteAPreparer, plagesARevoir } from '../src/planning/repartition.ts';
import { chargerRemplacementsFictifs } from '../src/remplacements/fictif.ts';
import { aptitude, aptitudeAgent, ete, personne, plageEte, reponseEte, vacancesAgent } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const reglage = centreExemple.astreinte;
const maintenant = '2026-11-02T10:00';
const super_ = { type: 'super', email: 'a@b.fr' } as const;

async function jeu(avecPlanning = true) {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	if (avecPlanning) await chargerPlanningFictif(base, centreExemple, maintenant);
	return base;
}

const comptes = async (base: Awaited<ReturnType<typeof jeu>>) => {
	const [[p], [v], [r], [pl]] = await base.batch([
		base.select({ n: count() }).from(personne),
		base.select({ n: count() }).from(vacancesAgent),
		base.select({ n: count() }).from(reponseEte),
		base.select({ n: count() }).from(plageEte)
	]);
	return [p!.n, v!.n, r!.n, pl!.n];
};

describe('été fictif (local et préprod)', () => {
	it('l’été qui vient ouvert, proposé, non publié : FPT armé la plupart du temps, quelques plages à revoir', async () => {
		const base = await jeu();
		await chargerEteFictif(base, maintenant, reglage);
		const [e] = await base.select().from(ete);
		expect(e).toMatchObject({ annee: 2027, ...periodeParDefaut(2027, reglage), publieeLe: null });
		const vue = await eteAPreparer(base, super_, 2027, maintenant, reglage);
		expect(vue.proposee).toBe(true);
		const plages = vue.semaines.flatMap((s) => s.plages);
		expect(vue.impossibles.length).toBeGreaterThanOrEqual(2);
		expect(vue.impossibles.length).toBeLessThanOrEqual(6);
		expect(vue.impossibles.length / plages.length).toBeLessThan(0.15);
		// Des renforts, des vacances, des réponses de chaque sorte.
		expect(plages.some((p) => p.presents.some((x) => x.renfort))).toBe(true);
		expect(new Set(vue.reponses.map((r) => r.reponse))).toEqual(new Set(['tout', 'vacances', null]));
	});

	it('avec les autres agents fictifs et leurs aptitudes : toujours quelques plages à revoir', async () => {
		const base = await jeu();
		await chargerRemplacementsFictifs(base, maintenant, reglage);
		await chargerEteFictif(base, maintenant, reglage);
		const vue = await eteAPreparer(base, super_, 2027, maintenant, reglage);
		expect(vue.impossibles.length).toBeGreaterThanOrEqual(2);
	});

	it('des aptitudes qui commencent ou expirent en plein été : le compte de l’accueil suit l’écran Été, jour par jour', async () => {
		const base = await jeu();
		await chargerRemplacementsFictifs(base, maintenant, reglage);
		await chargerEteFictif(base, maintenant, reglage);
		const avant = (await eteAPreparer(base, super_, 2027, maintenant, reglage)).impossibles.length;
		const apts = await base.select().from(aptitude);
		const id = (nom: string) => apts.find((a) => a.nom === nom)!.id;
		const lignes = await base.select().from(aptitudeAgent);
		const de = (apt: number) => lignes.filter((l) => l.aptitudeId === apt);
		const changer = (l: { personneId: number; aptitudeId: number }, valeurs: { obtenueLe?: string; expireLe?: string }) =>
			base.update(aptitudeAgent).set(valeurs).where(and(eq(aptitudeAgent.personneId, l.personneId), eq(aptitudeAgent.aptitudeId, l.aptitudeId)));
		await changer(de(id('CA2'))[0]!, { expireLe: '2027-07-14' });
		await changer(de(id('CE'))[0]!, { expireLe: '2027-07-20' });
		await changer(de(id('CE'))[1]!, { obtenueLe: '2027-07-27' });
		await changer(de(id('CA2'))[1]!, { obtenueLe: '2027-08-09' });
		const vue = await eteAPreparer(base, super_, 2027, maintenant, reglage);
		expect(vue.impossibles.length).toBeGreaterThan(avant);
		expect(await plagesARevoir(base, 2027, maintenant.slice(0, 10), reglage)).toBe(vue.impossibles.length);
		// Chaque plage, recalculée à part avec les aptitudes valables ce jour-là.
		const r = await lireArmement(base);
		const fpt = r.engins.find((e) => e.nom === 'FPT')!.postes;
		const toutes = await base.select().from(aptitudeAgent);
		const statuts = new Map((await base.select().from(personne)).map((p) => [p.id, p.statut]));
		const plages = vue.semaines.flatMap((x) => x.plages);
		for (const p of plages) {
			const jour = p.debut.slice(0, 10);
			const postes = (pid: number) => (statuts.get(pid) === 'inapte_temporaire' ? new Set<never>() : postesDe(r.niveaux, validesLe(toutes.filter((l) => l.personneId === pid), jour)));
			expect(p.arme, p.debut).toBe(armement(fpt, p.presents.map((x) => ({ id: x.id, postes: postes(x.id) }))).arme);
		}
	});

	it('relançable sans doublon', async () => {
		const base = await jeu();
		await chargerEteFictif(base, maintenant, reglage);
		const avant = await comptes(base);
		await chargerEteFictif(base, maintenant, reglage);
		expect(await comptes(base)).toEqual(avant);
	});

	it('sans roulement de l’année : l’été est ouvert, sans proposition', async () => {
		const base = await jeu(false);
		await chargerEteFictif(base, maintenant, reglage);
		expect(await base.select({ annee: ete.annee }).from(ete)).toEqual([{ annee: 2027 }]);
		expect(await base.select().from(plageEte)).toEqual([]);
		expect((await base.select().from(vacancesAgent)).length).toBeGreaterThan(0);
	});

	it('avant septembre : l’été de l’année en cours', async () => {
		const base = await jeu();
		await chargerEteFictif(base, '2026-03-02T10:00', reglage);
		expect(await base.select({ annee: ete.annee }).from(ete).where(eq(ete.annee, 2026))).toEqual([{ annee: 2026 }]);
	});
});
