import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours } from '../dates.ts';
import { STATUTS_AVEC_ACCES } from '../listes.ts';
import { lecturesAgents } from '../murs.ts';
import type { Periode, Reglage, SemaineCalculee } from '../planning/calendrier.ts';
import { anneesPubliees, equipeLe } from '../planning/annee.ts';
import { validesLe } from '../aptitudes.ts';
import { affectationEquipe, anneePlanning, aptitude, aptitudeAgent, attribution, demandeRemplacement, personne, responsabilite, semaineChangee } from '../schema.ts';
import { chevauche, tranchesDe } from './tranches.ts';

// Ce qu'il faut savoir pour décider d'une demande, lu d'un seul bloc : les semaines publiées, les équipes de chacun,
// les demandes en cours, les agents, les aptitudes et les chefs. Le reste est calculé ici, sans requête.

export type LigneDemande = typeof demandeRemplacement.$inferSelect;
export const EN_COURS = ['attente', 'a_valider', 'conclue', 'refusee'] as const;
const SEMAINES_PROPOSEES = 12;

export const periodesDe = (json: string | null): Periode[] => (json ? (JSON.parse(json) as Periode[]) : []);

export async function lireContexte(base: Base, maintenant: string, reglage: Reglage) {
	const aujourdhui = maintenant.slice(0, 10);
	const [annees, changees, affectations, demandes, agents, aptitudes, chefs] = await base.batch([
		base.select().from(anneePlanning),
		base.select().from(semaineChangee),
		base.select({ personneId: affectationEquipe.personneId, equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe),
		// Une demande porte sur une semaine au plus : celles commencées depuis huit jours peuvent encore courir.
		base
			.select()
			.from(demandeRemplacement)
			.where(and(inArray(demandeRemplacement.etat, [...EN_COURS]), gte(demandeRemplacement.debut, ajouterJours(aujourdhui, -8)))),
		lecturesAgents(base, aujourdhui)[0],
		base
			.select({ personneId: aptitudeAgent.personneId, aptitudeId: aptitudeAgent.aptitudeId, obtenueLe: aptitudeAgent.obtenueLe, expireLe: aptitudeAgent.expireLe, nom: aptitude.nom, controlee: aptitude.controlee, ordre: aptitude.ordre })
			.from(aptitudeAgent)
			.innerJoin(aptitude, eq(aptitude.id, aptitudeAgent.aptitudeId))
			.where(isNull(aptitude.retireeLe)),
		requeteChefs(base, aujourdhui)
	]);
	const semaines = [...anneesPubliees(annees, changees, reglage).entries()].sort(([a], [b]) => a - b).flatMap(([, s]) => s);
	return { maintenant: maintenant.slice(0, 16), reglage, semaines, affectations, demandes, agents, aptitudes, chefs };
}

export type Contexte = Awaited<ReturnType<typeof lireContexte>>;

// Les chefs en fonction (chefs d'équipe, chef de centre et adjoint) : ceux qui valident.
export function requeteChefs(base: Base, aujourdhui: string) {
	return base
		.select({ personneId: attribution.personneId, systeme: responsabilite.systeme, equipeId: attribution.perimetreId })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.innerJoin(personne, eq(personne.id, attribution.personneId))
		.where(
			and(
				inArray(responsabilite.systeme, ['chef_equipe', 'chef_centre', 'chef_centre_adjoint']),
				sql`${attribution.perimetreType} = ${responsabilite.typePerimetre}`,
				isNull(responsabilite.archiveeLe),
				inArray(personne.statut, [...STATUTS_AVEC_ACCES]),
				lte(attribution.debut, aujourdhui),
				or(isNull(attribution.fin), gte(attribution.fin, aujourdhui))
			)
		);
}
export type Chef = { personneId: number; systeme: string | null; equipeId: number | null };

const affectationsDe = (ctx: Contexte, id: number) => ctx.affectations.filter((a) => a.personneId === id);

// Les semaines d'astreinte de la personne : son équipe à la relève.
export function astreintesDe(ctx: Contexte, id: number): SemaineCalculee[] {
	const siennes = affectationsDe(ctx, id);
	return ctx.semaines.filter((s) => equipeLe(siennes, s.debut) === s.equipeId);
}

export const dAstreinte = (ctx: Contexte, id: number, p: Periode) => astreintesDe(ctx, id).some((s) => s.periodes.some((x) => chevauche(x, p)));

// Qui cède et qui prend quoi dans une demande : le demandeur cède dès qu'il demande ; le remplaçant prend une fois qu'il a accepté.
// Échange : le collègue cède les siennes et le demandeur les prend, une fois accepté.
export function engagements(d: LigneDemande): { personneId: number; periode: Periode; prend: boolean }[] {
	const liste = periodesDe(d.periodes).map((periode) => ({ personneId: d.demandeurId, periode, prend: false }));
	if (d.remplacantId === null || d.etat === 'attente' || d.etat === 'refusee') return liste;
	liste.push(...periodesDe(d.periodes).map((periode) => ({ personneId: d.remplacantId!, periode, prend: true })));
	for (const periode of periodesDe(d.periodesCible)) liste.push({ personneId: d.remplacantId, periode, prend: false }, { personneId: d.demandeurId, periode, prend: true });
	return liste;
}

// Ni engagé dans une autre demande sur ces périodes (`sauf` : celle qu'on traite).
export const sansEngagement = (ctx: Contexte, id: number, periodes: Periode[], sauf: number | null = null) =>
	!ctx.demandes.some((d) => d.id !== sauf && engagements(d).some((e) => e.personneId === id && periodes.some((p) => chevauche(p, e.periode))));

// Disponible : un agent qui a accès, ni d'astreinte sur l'une des périodes, ni engagé dans une demande qui les touche.
export const disponible = (ctx: Contexte, id: number, periodes: Periode[], sauf: number | null = null) =>
	ctx.agents.some((a) => a.id === id) && !periodes.some((p) => dAstreinte(ctx, id, p)) && sansEngagement(ctx, id, periodes, sauf);

const controleesValides = (ctx: Contexte, id: number, date: string) => {
	const siennes = ctx.aptitudes.filter((a) => a.personneId === id && a.controlee === 1);
	const valides = validesLe(siennes, date);
	return siennes.filter((a) => valides.has(a.aptitudeId)).sort((a, b) => a.ordre - b.ordre);
};

// Les aptitudes contrôlées du titulaire, valables à la date, que le remplaçant n'a pas.
export function manque(ctx: Contexte, titulaireId: number, remplacantId: number, date: string): string[] {
	const siennes = new Set(controleesValides(ctx, remplacantId, date).map((a) => a.aptitudeId));
	return controleesValides(ctx, titulaireId, date)
		.filter((a) => !siennes.has(a.aptitudeId))
		.map((a) => a.nom);
}

// Les disponibles, ceux qui ont les aptitudes contrôlées du demandeur d'abord, puis par nom.
export function disponibles(ctx: Contexte, demandeurId: number, periodes: Periode[], sauf: number | null = null) {
	const date = periodes[0]?.debut.slice(0, 10) ?? ctx.maintenant.slice(0, 10);
	return ctx.agents
		.filter((a) => a.id !== demandeurId && disponible(ctx, a.id, periodes, sauf))
		.map((a) => ({ id: a.id, prenom: a.prenom, nom: a.nom, aptitudes: manque(ctx, demandeurId, a.id, date).length === 0 }))
		.sort((a, b) => Number(b.aptitudes) - Number(a.aptitudes) || a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
}

// Qui valide : les chefs de l'équipe, sauf le demandeur ; à défaut, le chef de centre et son adjoint.
export function valideurs(chefs: Chef[], equipeId: number | null, demandeurId: number): number[] {
	const ids = (garde: (c: Chef) => boolean) => [...new Set(chefs.filter((c) => garde(c) && c.personneId !== demandeurId).map((c) => c.personneId))];
	const deLEquipe = ids((c) => c.systeme === 'chef_equipe' && c.equipeId === equipeId);
	return deLEquipe.length > 0 ? deLEquipe : ids((c) => c.systeme === 'chef_centre' || c.systeme === 'chef_centre_adjoint');
}

// Les tranches d'astreinte à venir de la personne (douze semaines), par semaine ; `prise` : déjà dans une demande en cours.
export function mesTranches(ctx: Contexte, id: number): { semaine: string; equipeId: number; tranches: (Periode & { prise: boolean })[] }[] {
	return astreintesDe(ctx, id)
		.filter((s) => s.periodes.at(-1)!.fin > ctx.maintenant)
		.slice(0, SEMAINES_PROPOSEES)
		.map((s) => ({
			semaine: s.debut,
			equipeId: s.equipeId,
			tranches: tranchesDe(s.periodes, ctx.reglage)
				.filter((t) => t.debut > ctx.maintenant)
				.map((t) => ({ ...t, prise: !sansEngagement(ctx, id, [t]) }))
		}))
		.filter((s) => s.tranches.length > 0);
}
