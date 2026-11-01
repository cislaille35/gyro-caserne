import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDateHeure } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { affectationEquipe, anneePlanning, equipe, semaineChangee } from '../schema.ts';
import { anneesPubliees, equipeLe, type EquipePlanning } from './annee.ts';
import type { Periode, Reglage } from './calendrier.ts';
import { heuresDe, lirePlage, requetePlagesPubliees } from './plages.ts';

export type Astreinte = { debut: string; fin: string; equipe: EquipePlanning; enCours: boolean; mienne: boolean; periodes: Periode[] };

// La carte de l'Accueil : avec une équipe, sa semaine en cours ou la prochaine (cette année et la suivante, publiées) ;
// sans équipe, l'équipe de la semaine en cours. Rien sans année publiée.
export async function astreinteDe(base: Base, acteur: Acteur, maintenant: string, reglage: Reglage): Promise<Astreinte | null> {
	exigerDateHeure(maintenant, 'Date');
	const m = maintenant.slice(0, 16);
	const annee = Number(m.slice(0, 4));
	// La semaine en cours a pu commencer l'année d'avant.
	const [annees, changees, equipes, affectations, lignesPlages] = await base.batch([
		base.select().from(anneePlanning).where(and(gte(anneePlanning.annee, annee - 1), lte(anneePlanning.annee, annee + 1))),
		base.select().from(semaineChangee).where(and(gte(semaineChangee.debut, `${annee - 1}-12-01`), lte(semaineChangee.debut, `${annee + 1}-12-31`))),
		base.select({ id: equipe.id, nom: equipe.nom, couleur: equipe.couleur }).from(equipe).orderBy(asc(equipe.ordreRotation)),
		base.select({ equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe).where(eq(affectationEquipe.personneId, acteur.type === 'personne' ? acteur.id : 0)),
		requetePlagesPubliees(base, `${annee - 1}-12-01`, `${annee + 1}-12-31`)
	]);
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	const plages = lignesPlages.map(lirePlage);
	const semaines = [...anneesPubliees(annees, changees, reglage).entries()].sort(([a], [b]) => a - b).flatMap(([, s]) => s);
	const fin = (s: (typeof semaines)[number]) => s.periodes.at(-1)!.fin;
	const avecEquipe = equipeLe(affectations, m.slice(0, 10)) !== null;
	// Avec une équipe : mes heures (en été publié, mes plages ; un renfort compte aussi).
	const miennes = semaines.map((s) => ({ ...s, periodes: heuresDe(s, equipeLe(affectations, s.debut), moi, plages) })).filter((s) => s.periodes.length > 0);
	const aMoi = avecEquipe || miennes.some((s) => fin(s) > m);
	const semaine = aMoi ? miennes.find((s) => fin(s) > m) : semaines.find((s) => s.periodes[0]!.debut <= m && fin(s) > m);
	if (!semaine) return null;
	const e = equipes.find((x) => x.id === semaine.equipeId) ?? { id: semaine.equipeId, nom: 'Équipe archivée', couleur: '#8a949e' };
	return { debut: semaine.periodes[0]!.debut, fin: fin(semaine), equipe: e, enCours: semaine.periodes[0]!.debut <= m, mienne: aMoi, periodes: semaine.periodes };
}
