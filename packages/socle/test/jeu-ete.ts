import { eq } from 'drizzle-orm';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import { affectationEquipe, aptitude, aptitudeAgent, attribution, equipe, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

// Chef de centre ; Alice et David (équipe 1), Bruno (équipe 2), Chloé sans équipe. Année 2027 publiée.
export async function jeuEte() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const ids = (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
	const nouvelle = async (prenom: string, equipeNo: number | null) => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning();
		if (equipeNo) await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId: ids[equipeNo - 1]!, debut: '2026-01-01' });
		return p!.id;
	};
	const chef = await nouvelle('Chef', null);
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: chef, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const a = (id: number): Acteur => ({ type: 'personne', id });
	const qui = { type: 'super', email: 'a@b.fr' } as const;
	await reglerRoulement(base, qui, 2027, ids, '2026-11-01T10:00');
	await publierAnnee(base, qui, 2027, '2026-11-01T10:00');
	// Donne des aptitudes (par nom) à un agent.
	const apte = async (id: number, ...noms: string[]) => {
		for (const nom of noms) {
			const [x] = await base.select().from(aptitude).where(eq(aptitude.nom, nom));
			await base.insert(aptitudeAgent).values({ personneId: id, aptitudeId: x!.id, obtenueLe: '2020-01-01' });
		}
	};
	return { base, ids, nouvelle, apte, chef: a(chef), a };
}

