import { eq } from 'drizzle-orm';
import centreExemple from '../../../centres/exemple/centre.ts';
import { chargerAnomaliesFictives } from '../src/anomalies.ts';
import { chargerComptesDeTest } from '../src/comptes-de-test.ts';
import { acteurDe } from '../src/connexion.ts';
import { chargerEnginsFictifs } from '../src/engins.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { ordrePropose, publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import { chargerEteFictif, chargerPlanningFictif } from '../src/planning/fictif.ts';
import { accepterDemande, demanderRemplacement } from '../src/remplacements/demandes.ts';
import { candidats, lireContexte, mesTranches } from '../src/remplacements/contexte.ts';
import { chargerRemplacementsFictifs } from '../src/remplacements/fictif.ts';
import { affectationEquipe, aptitude, aptitudeAgent, equipe, personne, profil } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

// Un centre grossi, pour borner le calcul : le jeu de la préprod (comptes de test, planning, été proposé), six années publiées
// (quatre passées, la courante, la suivante : rien n'est jamais effacé), 60 agents et une cinquantaine de demandes de remplacement.
export const MAINTENANT_GROSSI = '2026-11-11T10:00';
const reglage = centreExemple.astreinte;
const FICTIFS = [
	['alice.martin', 'Alice', 'Martin', 'Équipe 1'],
	['bruno.petit', 'Bruno', 'Petit', 'Équipe 2'],
	['chloe.durand', 'Chloé', 'Durand', 'Équipe 3'],
	['david.leroy', 'David', 'Leroy', 'Équipe 1']
] as const;
const APTITUDES = ['CA1', 'CE', 'SAP', 'COD1', 'INC', 'CA2', 'SAP', 'CE'];

export async function jeuGrossi() {
	const m = MAINTENANT_GROSSI;
	const annee = Number(m.slice(0, 4));
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select({ id: profil.id }).from(profil).where(eq(profil.nom, 'Agent'));
	const equipes = await base.select({ id: equipe.id, nom: equipe.nom, active: equipe.active }).from(equipe).orderBy(equipe.ordreRotation);
	for (const [e, prenom, nom, nomEquipe] of FICTIFS) {
		const [p] = await base.insert(personne).values({ email: `${e}@exemple.fr`, prenom, nom, profilId: agent!.id }).returning({ id: personne.id });
		await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId: equipes.find((x) => x.nom === nomEquipe)!.id, debut: '2020-01-01' });
	}
	await chargerEnginsFictifs(base, m);
	await chargerAnomaliesFictives(base, m);
	await chargerPlanningFictif(base, centreExemple, m);
	await chargerRemplacementsFictifs(base, m, reglage);
	await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', m);
	await chargerEteFictif(base, m, reglage);
	// Les quatre années passées, publiées.
	const qui = { type: 'super', email: 'grossi@exemple.fr' } as const;
	for (let a = annee - 4; a < annee; a++) {
		await reglerRoulement(base, qui, a, ordrePropose(a, reglage, equipes), m);
		await publierAnnee(base, qui, a, m);
	}
	// Jusqu'à 60 agents, répartis sur les équipes actives, avec deux aptitudes chacun.
	const actives = equipes.filter((e) => e.active === 1);
	const aptitudes = await base.select({ id: aptitude.id, nom: aptitude.nom }).from(aptitude);
	const deja = (await base.select({ id: personne.id }).from(personne)).length;
	for (let i = 0; deja + i < 60; i++) {
		const [p] = await base.insert(personne).values({ email: `grossi${i}@exemple.fr`, prenom: `Agent${i}`, nom: `Grossi${i}`, profilId: agent!.id }).returning({ id: personne.id });
		await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId: actives[i % actives.length]!.id, debut: '2020-01-01' });
		const noms = [APTITUDES[i % APTITUDES.length]!, APTITUDES[(i + 3) % APTITUDES.length]!];
		const lignes = aptitudes.filter((a) => noms.includes(a.nom)).map((a) => ({ personneId: p!.id, aptitudeId: a.id, obtenueLe: '2022-06-01' }));
		if (lignes.length) await base.insert(aptitudeAgent).values(lignes).onConflictDoNothing();
	}
	// Une cinquantaine de demandes : chacun demande l'une de ses tranches, une sur trois est acceptée.
	const personnes = await base.select({ id: personne.id }).from(personne).orderBy(personne.id);
	let demandes = 0;
	for (let tour = 0; tour < 3 && demandes < 50; tour++)
		for (const p of personnes) {
			if (demandes >= 50) break;
			const ctx = await lireContexte(base, m, reglage);
			const t = mesTranches(ctx, p.id)
				.flatMap((s) => s.tranches)
				.filter((x) => !x.prise && x.debut > `${m.slice(0, 10)}T23:59`)[tour * 7 + (p.id % 5)];
			if (!t) continue;
			const id = await demanderRemplacement(base, { type: 'personne', id: p.id }, { periodes: [{ debut: t.debut, fin: t.fin }], cibleId: null, mot: 'Grossi' }, m, reglage);
			demandes++;
			if (demandes % 3 !== 0) continue;
			const c = candidats(await lireContexte(base, m, reglage), p.id, [{ debut: t.debut, fin: t.fin }])[0];
			if (c) await accepterDemande(base, { type: 'personne', id: c.id }, id, m, reglage).catch(() => null);
		}
	const acteur = async (role: string) => (await acteurDe(base, `caserne+${role}@exemple.fr`, []))!;
	const acteurs = { chef: await acteur('chef'), agent: await acteur('agent'), chefGarde: await acteur('chef-equipe'), referent: await acteur('referent') };
	return { base, m, annee, reglage, acteurs, agents: personnes.length, demandes };
}
