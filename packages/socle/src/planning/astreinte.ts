import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours, exigerDateHeure } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { affectationEquipe, anneePlanning, equipe, semaineChangee } from '../schema.ts';
import { equipeLe, semainesCalculees, type EquipePlanning } from './annee.ts';
import { semainesDe, type Periode, type Reglage, type SemaineCalculee } from './calendrier.ts';
import { groupeDeLaSemaine, nomsDeGroupes, requeteEtes } from './groupes.ts';
import { heuresDe, lirePlage, requetePlagesPubliees } from './plages.ts';

export type Astreinte = { debut: string; fin: string; equipe: EquipePlanning; enCours: boolean; mienne: boolean; periodes: Periode[] };

// La carte de l'Accueil : avec une équipe, sa semaine en cours ou la prochaine (cette année et la suivante, publiées) ;
// sans équipe, l'équipe de la semaine en cours. Rien sans année publiée.
export async function astreinteDe(base: Base, acteur: Acteur, maintenant: string, reglage: Reglage): Promise<Astreinte | null> {
	exigerDateHeure(maintenant, 'Date');
	const m = maintenant.slice(0, 16);
	const annee = Number(m.slice(0, 4));
	// La semaine en cours a pu commencer l'année d'avant.
	const [annees, changees, equipes, affectations, lignesPlages, etes] = await base.batch([
		base.select().from(anneePlanning).where(and(gte(anneePlanning.annee, annee - 1), lte(anneePlanning.annee, annee + 1))),
		base.select().from(semaineChangee).where(and(gte(semaineChangee.debut, `${annee - 1}-12-01`), lte(semaineChangee.debut, `${annee + 1}-12-31`))),
		base.select({ id: equipe.id, nom: equipe.nom, couleur: equipe.couleur, active: equipe.active }).from(equipe).orderBy(asc(equipe.ordreRotation)),
		base.select({ equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe).where(eq(affectationEquipe.personneId, acteur.type === 'personne' ? acteur.id : 0)),
		requetePlagesPubliees(base, `${annee - 1}-12-01`, `${annee + 1}-12-31`),
		requeteEtes(base)
	]);
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	const plages = lignesPlages.map(lirePlage);
	const fin = (s: SemaineCalculee) => s.periodes.at(-1)!.fin;
	const avecEquipe = equipeLe(affectations, m.slice(0, 10)) !== null;
	// Mes heures ne peuvent venir que d'une équipe (encore la mienne depuis le début de la semaine en cours, ou plus tard)
	// ou d'un renfort d'été à venir. Sans l'un ni l'autre, on ne les calcule pas (décision 0021).
	const depuis = ajouterJours(m.slice(0, 10), -15);
	const peutAvoir = affectations.some((a) => a.fin === null || a.fin >= depuis) || plages.some((p) => p.fin > m && p.ajoutes.includes(moi));
	// Les années publiées, dans l'ordre, calculées une à une jusqu'à trouver. La dernière semaine de l'année d'avant peut être
	// encore en cours : elle finit au plus tard 7 jours après sa relève.
	const finAvant = ajouterJours(semainesDe(annee - 1, reglage).at(-1)!.debut, 8);
	const publiees = annees.filter((a) => a.publieeLe !== null && (a.annee >= annee || m.slice(0, 10) <= finAvant)).sort((a, b) => a.annee - b.annee);
	let courante: SemaineCalculee | undefined;
	let mienne: SemaineCalculee | undefined;
	for (const a of publiees) {
		const semaines = semainesCalculees(a.annee, a.ordre, changees, reglage);
		courante ??= semaines.find((s) => s.periodes[0]!.debut <= m && fin(s) > m);
		if (peutAvoir)
			for (const s of semaines) {
				// Avec une équipe : mes heures (en été publié, mes plages ; un renfort compte aussi).
				const periodes = heuresDe(s, equipeLe(affectations, s.debut), moi, plages);
				if (periodes.length > 0 && periodes.at(-1)!.fin > m) {
					mienne = { ...s, periodes };
					break;
				}
			}
		if (mienne || (!peutAvoir && courante)) break;
	}
	const aMoi = avecEquipe || mienne !== undefined;
	const semaine = aMoi ? mienne : courante;
	if (!semaine) return null;
	const trouvee = equipes.find((x) => x.id === semaine.equipeId);
	const e = trouvee ? { id: trouvee.id, nom: groupeDeLaSemaine(etes, nomsDeGroupes(equipes), semaine) ?? trouvee.nom, couleur: trouvee.couleur } : { id: semaine.equipeId, nom: 'Équipe archivée', couleur: '#8a949e' };
	return { debut: semaine.periodes[0]!.debut, fin: fin(semaine), equipe: e, enCours: semaine.periodes[0]!.debut <= m, mienne: aMoi, periodes: semaine.periodes };
}
