import { and, eq, inArray, ne, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import type { Base } from './base.ts';
import { ajouterJours, enCours, exigerDateHeure } from './dates.ts';
import { ligneJournal } from './journal.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { mettreEnFile, type DonneesPush } from './notifications.ts';
import { rangDuJour, type Reglage } from './planning/calendrier.ts';
import { equipeDe, lecturesEquipe } from './prises.ts';
import { attribution, journal, personne, responsabilite } from './schema.ts';
import { estChefOuAdjointSql } from './suivi.ts';

// Les urgences du centre : au téléphone du chef de centre et de l'adjoint, à toute heure (lieu « urgences », coupé par « urgences » ou « tout »).
// Une liste fixe : un engin indisponible, un remplacement sans remplaçant la veille, une équipe sans chef de garde la veille de sa relève.

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
// Comme l'annonce des manœuvres : à 8 h, et à 8 h 10 si le passage de 8 h a manqué.
const PASSAGES = ['08:00', '08:10'];

// Le chef de centre et l'adjoint en fonction, sauf `sauf` (l'auteur du geste) : une sous-requête d'identifiants.
export const chefsDuCentre = (base: Base, aujourdhui: string, sauf: number | null = null) =>
	base
		.select({ id: personne.id })
		.from(personne)
		.where(and(inArray(personne.statut, [...STATUTS_AVEC_ACCES]), estChefOuAdjointSql(sql`"personne"."id"`, aujourdhui), sauf === null ? undefined : ne(personne.id, sauf)));

// L'envoi d'une urgence, à placer dans le batch du geste. `ligne` : la ligne de la cloche écrite juste avant (voir mettreEnFile).
export const avisUrgence = (base: Base, ids: number[] | SQLWrapper, donnees: DonneesPush, maintenant: string, si?: SQL, ligne?: 'anomalie') => mettreEnFile(base, ids, 'urgences', donnees, maintenant, si, ligne);

// Au réveil de 8 h (et 8 h 10), la veille d'une relève : l'équipe qui prend l'astreinte n'a pas de chef de garde en fonction.
// Hors de ces passages, rien n'est lu. Une alerte par relève : la ligne du journal (dans le suivi des chefs) en est la marque.
export async function equipeSansChefDemain(base: Base, maintenant: string, reglage: Reglage): Promise<number> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const demain = ajouterJours(aujourdhui, 1);
	if (!PASSAGES.includes(maintenant.slice(11, 16)) || JOURS[rangDuJour(demain)] !== reglage.debut.jour) return 0;
	const releve = `${demain}T${reglage.debut.heure}`;
	const [annees, changees, equipes, chefsDeGarde, deja] = await base.batch([
		...lecturesEquipe(base, releve),
		base
			.select({ equipeId: attribution.perimetreId, debut: attribution.debut, fin: attribution.fin })
			.from(attribution)
			.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
			.innerJoin(personne, eq(personne.id, attribution.personneId))
			.where(and(eq(responsabilite.systeme, 'chef_equipe'), eq(attribution.perimetreType, 'equipe'), inArray(personne.statut, [...STATUTS_AVEC_ACCES]))),
		base.select({ id: journal.id }).from(journal).where(and(eq(journal.action, 'alerter_sans_chef'), sql`substr(${journal.quand}, 1, 10) = ${aujourdhui}`))
	]);
	const e = equipeDe(releve, annees, changees, equipes, reglage);
	if (!e || deja.length > 0 || chefsDeGarde.some((c) => c.equipeId === e.id && enCours(c.debut, c.fin, demain))) return 0;
	const donnees = { titre: `${e.nom} sans chef de garde demain`, texte: `Relève de demain, ${Number(reglage.debut.heure.slice(0, 2))} h : aucun chef de garde nommé pour l’équipe.`, url: '/nominations', tag: `urgence:sans-chef:${releve}` };
	await base.batch([ligneJournal(base, { acteur: 'planning', action: 'alerter_sans_chef', cibleType: 'equipe', cibleId: e.id, details: { releve } }, maintenant), avisUrgence(base, chefsDuCentre(base, aujourdhui), donnees, maintenant)]);
	return 1;
}
