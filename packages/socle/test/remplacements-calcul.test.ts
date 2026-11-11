import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import * as plages from '../src/planning/plages.ts';
import { lireContexte, mesTranches } from '../src/remplacements/contexte.ts';
import { demanderRemplacement } from '../src/remplacements/demandes.ts';
import { pourDemander } from '../src/remplacements/lectures.ts';
import * as tranches from '../src/remplacements/tranches.ts';
import { affectationEquipe, equipe, personne, profil } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

// Les heures d'astreinte d'une personne sur l'année : le calcul qui coûtait (coupure 1102 du 11/11 à l'étape « sienne » d'un échange).
vi.mock('../src/planning/plages.ts', async (original) => {
	const m = await original<typeof import('../src/planning/plages.ts')>();
	return { ...m, heuresDe: vi.fn(m.heuresDe) };
});
// Chaque comparaison de deux périodes : le travail des vérifications de disponibilité.
vi.mock('../src/remplacements/tranches.ts', async (original) => {
	const m = await original<typeof import('../src/remplacements/tranches.ts')>();
	return { ...m, chevauche: vi.fn(m.chevauche), tranchesDe: vi.fn(m.tranchesDe) };
});

const reglage = centreExemple.astreinte;
const maintenant = '2026-11-01T10:00';
const nuitLundi9 = { debut: '2026-11-09T18:00', fin: '2026-11-10T06:00' };

// Six agents sur trois équipes, l'année publiée ; `demandes` : autant de demandes en cours, d'une tranche chacune.
async function preparer(demandes = 0) {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const ids = (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
	const gens: number[] = [];
	for (const [i, prenom] of ['Alice', 'David', 'Bruno', 'Basile', 'Chloe', 'Diane'].entries()) {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning();
		await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId: ids[Math.floor(i / 2)]!, debut: '2026-01-01' });
		gens.push(p!.id);
	}
	const qui = { type: 'super', email: 'a@b.fr' } as const;
	await reglerRoulement(base, qui, 2026, ids, maintenant);
	await publierAnnee(base, qui, 2026, maintenant);
	// Chacun des cinq collègues d'Alice demande tour à tour l'une de ses tranches encore libres.
	for (let i = 0; i < demandes; i++) {
		const id = gens[1 + (i % 5)]!;
		const ctx = await lireContexte(base, maintenant, reglage);
		const libre = mesTranches(ctx, id)
			.flatMap((s) => s.tranches)
			.find((t) => !t.prise)!;
		await demanderRemplacement(base, { type: 'personne', id }, { periodes: [{ debut: libre.debut, fin: libre.fin }], cibleId: null }, maintenant, reglage);
	}
	return { base, gens, ctx: await lireContexte(base, maintenant, reglage), alice: { type: 'personne', id: gens[0]! } as const };
}

describe('Échanger : le calcul reste borné', () => {
	it('chaque personne ne voit son année calculée qu’une fois par requête, même avec un collègue choisi', async () => {
		const { base, gens, ctx, alice } = await preparer();
		vi.mocked(plages.heuresDe).mockClear();
		const lu = await pourDemander(base, alice, maintenant, reglage, { periodes: [nuitLundi9], echange: true, avec: gens[2]! });
		expect(lu.echangeables.length).toBeGreaterThanOrEqual(3);
		expect(lu.semainesAvec.length).toBeGreaterThan(0);
		// Les semaines publiées calculées au plus une fois par agent.
		expect(vi.mocked(plages.heuresDe).mock.calls.length).toBeLessThanOrEqual(ctx.semaines.length * ctx.agents.length);
	});

	it.each([4, 50])('le texte des demandes en cours est lu une fois par requête, pas à chaque tranche (%i demandes)', async (n) => {
		const { base, gens, ctx, alice } = await preparer(n);
		expect(ctx.demandes).toHaveLength(n);
		const textes = new Set(ctx.demandes.map((d) => d.periodes));
		const parse = vi.spyOn(JSON, 'parse');
		let lus = 0;
		const lu = await pourDemander(base, alice, maintenant, reglage, { periodes: [nuitLundi9], echange: true, avec: gens[2]! }).finally(() => {
			lus = parse.mock.calls.filter(([texte]) => textes.has(texte as string)).length;
			parse.mockRestore();
		});
		expect(lu.echangeables.length).toBeGreaterThanOrEqual(1);
		// Une lecture par demande à la lecture du contexte (deux au plus si un remplaçant l'a prise), quel que soit le nombre de tranches.
		expect(lus).toBeLessThanOrEqual(2 * ctx.demandes.length);
	});

	it('les tranches du collègue choisi ne sont calculées qu’une fois', async () => {
		const { base, gens, alice } = await preparer();
		vi.mocked(tranches.tranchesDe).mockClear();
		const sans = await pourDemander(base, alice, maintenant, reglage, { periodes: [nuitLundi9], echange: true });
		const nSans = vi.mocked(tranches.tranchesDe).mock.calls.length;
		vi.mocked(tranches.tranchesDe).mockClear();
		const avec = await pourDemander(base, alice, maintenant, reglage, { periodes: [nuitLundi9], echange: true, avec: gens[2]! });
		expect(avec.semainesAvec.length).toBeGreaterThan(0);
		expect(sans.echangeables.map((c) => c.id)).toContain(gens[2]!);
		// Choisir le collègue ne recalcule pas ses semaines, déjà vues pour savoir s'il a de quoi échanger.
		expect(vi.mocked(tranches.tranchesDe).mock.calls.length).toBe(nSans);
	});

	it('vérifier qu’un agent est d’astreinte ne parcourt pas toutes ses semaines', async () => {
		const { base, gens, ctx, alice } = await preparer(4);
		vi.mocked(tranches.chevauche).mockClear();
		const lu = await pourDemander(base, alice, maintenant, reglage, { periodes: [nuitLundi9], echange: true, avec: gens[2]! });
		expect(lu.semainesAvec.length).toBeGreaterThan(0);
		// Avant : chaque tranche vérifiée était comparée à toutes les heures d'astreinte de l'année (4 656 comparaisons ici, 46 après).
		expect(vi.mocked(tranches.chevauche).mock.calls.length).toBeLessThanOrEqual(ctx.agents.length * 10);
	});

	it('d’astreinte : même réponse qu’en comparant à toutes ses heures, à toute heure de l’année', async () => {
		const { ctx } = await preparer();
		const { astreintesDe, dAstreinte } = await import('../src/remplacements/contexte.ts');
		const { chevauche } = await vi.importActual<typeof import('../src/remplacements/tranches.ts')>('../src/remplacements/tranches.ts');
		const { ajouterJours } = await import('../src/dates.ts');
		const decaler = (moment: string, heures: number) => new Date(Date.parse(`${moment}:00Z`) + heures * 3_600_000).toISOString().slice(0, 16);
		let oui = 0;
		for (const a of ctx.agents) {
			const toutes = astreintesDe(ctx, a.id).flatMap((s) => s.periodes);
			for (let jour = '2025-12-25'; jour < '2027-01-08'; jour = ajouterJours(jour, 1))
				for (const [h, duree] of [['05:30', 1], ['06:00', 0], ['17:30', 1], ['18:00', 12], ['23:00', 30]] as const) {
					const p = { debut: `${jour}T${h}`, fin: decaler(`${jour}T${h}`, duree) };
					const attendu = toutes.some((x) => chevauche(x, p));
					expect(dAstreinte(ctx, a.id, p), `${a.id} ${p.debut} ${p.fin}`).toBe(attendu);
					if (attendu) oui++;
				}
			// Juste avant et juste après chacune de ses heures : les bords.
			for (const x of toutes)
				for (const p of [{ debut: decaler(x.debut, -1), fin: x.debut }, { debut: x.fin, fin: decaler(x.fin, 1) }, { debut: decaler(x.debut, -1), fin: decaler(x.debut, 1) }])
					expect(dAstreinte(ctx, a.id, p), `${a.id} ${p.debut} ${p.fin}`).toBe(toutes.some((y) => chevauche(y, p)));
		}
		expect(oui).toBeGreaterThan(1000);
	});

	it('d’astreinte : une heure dans une plus longue ne cache pas la longue', async () => {
		const { ctx, gens } = await preparer();
		const { dAstreinte } = await import('../src/remplacements/contexte.ts');
		const semaine = ctx.semaines[0]!;
		// Une garde de 24 h, et une heure plus courte qui commence dedans (un renfort d'été, par exemple).
		ctx.astreintes.set(gens[0]!, [{ ...semaine, periodes: [{ debut: '2026-11-07T00:00', fin: '2026-11-08T00:00' }, { debut: '2026-11-07T02:00', fin: '2026-11-07T03:00' }] }]);
		expect(dAstreinte(ctx, gens[0]!, { debut: '2026-11-07T05:00', fin: '2026-11-07T06:00' })).toBe(true);
		expect(dAstreinte(ctx, gens[0]!, { debut: '2026-11-08T00:00', fin: '2026-11-08T06:00' })).toBe(false);
	});
});
