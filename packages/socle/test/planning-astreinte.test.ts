import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import { astreinteDe } from '../src/planning/astreinte.ts';
import { affectationEquipe, attribution, equipe, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const reglage = centreExemple.astreinte;

// Chef de centre (sans équipe), Alice (équipe 1) ; 2026 publiée, roulement 1-2-3-4 (le 2 janvier, équipe 1).
async function jeu({ publier = true } = {}) {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const ids = (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
	const nouvelle = async (prenom: string) => (await base.insert(personne).values({ email: `${prenom}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning())[0]!.id;
	const chef = await nouvelle('chef');
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: chef, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const alice = await nouvelle('alice');
	await base.insert(affectationEquipe).values({ personneId: alice, equipeId: ids[0]!, debut: '2026-01-01' });
	const a = (id: number): Acteur => ({ type: 'personne', id });
	await reglerRoulement(base, a(chef), 2026, ids, '2026-01-01T10:00');
	if (publier) await publierAnnee(base, a(chef), 2026, '2026-01-01T10:00');
	return { base, ids, chef: a(chef), alice: a(alice) };
}

describe('astreinte de l’accueil', () => {
	it('agent d’équipe : sa prochaine semaine, avec ses plages', async () => {
		const { base, alice, ids } = await jeu();
		const a = await astreinteDe(base, alice, '2026-11-01T10:00', reglage);
		expect(a).toMatchObject({ debut: '2026-11-06T18:00', fin: '2026-11-13T06:00', enCours: false, mienne: true, equipe: { id: ids[0], nom: 'Équipe 1' } });
		expect(a!.periodes[0]).toEqual({ debut: '2026-11-06T18:00', fin: '2026-11-09T06:00' });
	});

	it('pendant sa semaine : en cours', async () => {
		const { base, alice } = await jeu();
		expect(await astreinteDe(base, alice, '2026-11-10T14:00', reglage)).toMatchObject({ debut: '2026-11-06T18:00', enCours: true, mienne: true });
	});

	it('sans équipe : l’équipe de la semaine en cours', async () => {
		const { base, chef, ids } = await jeu();
		expect(await astreinteDe(base, chef, '2026-11-01T10:00', reglage)).toMatchObject({ debut: '2026-10-30T18:00', mienne: false, enCours: true, equipe: { id: ids[3] } });
	});

	it('année non publiée : rien', async () => {
		const { base, alice } = await jeu({ publier: false });
		expect(await astreinteDe(base, alice, '2026-11-01T10:00', reglage)).toBeNull();
	});

	it('fin d’année : la semaine de l’année suivante, si elle est publiée', async () => {
		const { base, alice, chef, ids } = await jeu();
		// Dernière semaine de l'équipe 1 en 2026 : le 25 décembre ; ensuite, rien sans 2027.
		expect(await astreinteDe(base, alice, '2027-01-02T10:00', reglage)).toBeNull();
		await reglerRoulement(base, chef, 2027, [ids[1]!, ids[2]!, ids[3]!, ids[0]!], '2026-11-01T10:00');
		await publierAnnee(base, chef, 2027, '2026-11-01T10:00');
		expect(await astreinteDe(base, alice, '2027-01-02T10:00', reglage)).toMatchObject({ debut: '2027-01-22T18:00', mienne: true });
	});
});
