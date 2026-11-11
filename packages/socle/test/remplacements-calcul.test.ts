import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import * as plages from '../src/planning/plages.ts';
import { lireContexte } from '../src/remplacements/contexte.ts';
import { pourDemander } from '../src/remplacements/lectures.ts';
import { affectationEquipe, equipe, personne, profil } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

// Les heures d'astreinte d'une personne sur l'année : le calcul qui coûtait (coupure 1102 du 11/11 à l'étape « sienne » d'un échange).
vi.mock('../src/planning/plages.ts', async (original) => {
	const m = await original<typeof import('../src/planning/plages.ts')>();
	return { ...m, heuresDe: vi.fn(m.heuresDe) };
});

const reglage = centreExemple.astreinte;
const maintenant = '2026-11-01T10:00';

describe('Échanger : le calcul reste borné', () => {
	it('chaque personne ne voit son année calculée qu’une fois par requête, même avec un collègue choisi', async () => {
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
		const ctx = await lireContexte(base, maintenant, reglage);

		const nuitLundi9 = { debut: '2026-11-09T18:00', fin: '2026-11-10T06:00' };
		const alice = { type: 'personne', id: gens[0]! } as const;
		vi.mocked(plages.heuresDe).mockClear();
		const lu = await pourDemander(base, alice, maintenant, reglage, { periodes: [nuitLundi9], echange: true, avec: gens[2]! });
		expect(lu.echangeables.length).toBeGreaterThanOrEqual(3);
		expect(lu.semainesAvec.length).toBeGreaterThan(0);
		// Les semaines publiées calculées au plus une fois par agent.
		expect(vi.mocked(plages.heuresDe).mock.calls.length).toBeLessThanOrEqual(ctx.semaines.length * ctx.agents.length);
	});
});
