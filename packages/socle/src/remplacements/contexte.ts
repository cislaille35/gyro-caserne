import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours } from '../dates.ts';
import { STATUTS_AVEC_ACCES } from '../listes.ts';
import { lecturesAgents } from '../murs.ts';
import type { Periode, Reglage, SemaineCalculee } from '../planning/calendrier.ts';
import { anneesPubliees, equipeLe } from '../planning/annee.ts';
import { validesLe } from '../aptitudes.ts';
import { affectationEquipe, anneePlanning, aptitude, aptitudeAgent, attribution, demandeRemplacement, equipe, personne, responsabilite, semaineChangee, vacancesAgent } from '../schema.ts';
import { enVacances, heuresDe, lirePlage, requetePlagesPubliees } from '../planning/plages.ts';
import { chevauche, tranchesDe } from './tranches.ts';

// Ce qu'il faut savoir pour décider d'une demande, lu d'un seul bloc : les semaines publiées, les équipes de chacun,
// les demandes en cours, les agents, les aptitudes et les chefs. Le reste est calculé ici, sans requête.

export type LigneDemande = typeof demandeRemplacement.$inferSelect;
export const EN_COURS = ['attente', 'a_valider', 'conclue', 'refusee'] as const;
const SEMAINES_PROPOSEES = 12;

export const periodesDe = (json: string | null): Periode[] => (json ? (JSON.parse(json) as Periode[]) : []);

export async function lireContexte(base: Base, maintenant: string, reglage: Reglage) {
	const aujourdhui = maintenant.slice(0, 10);
	const [annees, changees, affectations, demandes, agents, aptitudes, chefs, equipes, plages, vacances] = await base.batch([
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
		requeteChefs(base, aujourdhui),
		base.select({ id: equipe.id, nom: equipe.nom, couleur: equipe.couleur }).from(equipe),
		// L'été publié et les vacances des agents.
		requetePlagesPubliees(base, ajouterJours(aujourdhui, -8), '9999-12-31'),
		base.select({ personneId: vacancesAgent.personneId, debut: vacancesAgent.debut, fin: vacancesAgent.fin }).from(vacancesAgent).where(gte(vacancesAgent.fin, ajouterJours(aujourdhui, -8)))
	]);
	const semaines = [...anneesPubliees(annees, changees, reglage).entries()].sort(([a], [b]) => a - b).flatMap(([, s]) => s);
	return { maintenant: maintenant.slice(0, 16), reglage, semaines, affectations, demandes, agents, aptitudes, chefs, equipes, plages: plages.map(lirePlage), vacances, astreintes: new Map<number, SemaineCalculee[]>() };
}

export type Contexte = Awaited<ReturnType<typeof lireContexte>>;

// Les chefs en fonction (chefs de garde, chef de centre et adjoint) : ceux qui valident.
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

// Les semaines d'astreinte de la personne : son équipe à la relève ; en été publié, ses plages (renfort compris).
// `periodes` : ses heures à elle. Calculées une fois par personne et par requête : un échange compare chaque collègue
// à chaque tranche, et refaire l'année à chaque fois dépassait le temps de calcul de Cloudflare (décision 0021).
export function astreintesDe(ctx: Contexte, id: number): SemaineCalculee[] {
	const deja = ctx.astreintes.get(id);
	if (deja) return deja;
	const siennes = affectationsDe(ctx, id);
	const calculees = ctx.semaines.map((s) => ({ ...s, periodes: heuresDe(s, equipeLe(siennes, s.debut), id, ctx.plages) })).filter((s) => s.periodes.length > 0);
	ctx.astreintes.set(id, calculees);
	return calculees;
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

// Disponible : un agent qui a accès, ni d'astreinte ni en vacances sur l'une des périodes, ni engagé dans une demande qui les touche.
export const disponible = (ctx: Contexte, id: number, periodes: Periode[], sauf: number | null = null) =>
	ctx.agents.some((a) => a.id === id) && !periodes.some((p) => dAstreinte(ctx, id, p) || enVacances(ctx.vacances, id, p)) && sansEngagement(ctx, id, periodes, sauf);

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

// Qui valide : les chefs de l'équipe, ni demandeur ni remplaçant ; à défaut, le chef de centre et son adjoint.
export function valideurs(chefs: Chef[], equipeId: number | null, demandeurId: number, remplacantId: number | null = null): number[] {
	const ids = (garde: (c: Chef) => boolean) => [...new Set(chefs.filter((c) => garde(c) && c.personneId !== demandeurId && c.personneId !== remplacantId).map((c) => c.personneId))];
	const deLEquipe = ids((c) => c.systeme === 'chef_equipe' && c.equipeId === equipeId);
	return deLEquipe.length > 0 ? deLEquipe : ids((c) => c.systeme === 'chef_centre' || c.systeme === 'chef_centre_adjoint');
}

// Les tranches d'astreinte de la personne dans les douze semaines à venir, par semaine ; `prise` : déjà dans une demande en cours.
export function mesTranches(ctx: Contexte, id: number): { semaine: string; equipeId: number; tranches: (Periode & { prise: boolean })[] }[] {
	const limite = `${ajouterJours(ctx.maintenant.slice(0, 10), SEMAINES_PROPOSEES * 7)}T00:00`;
	return astreintesDe(ctx, id)
		.filter((s) => s.periodes.at(-1)!.fin > ctx.maintenant && s.periodes[0]!.debut < limite)
		.map((s) => ({
			semaine: s.debut,
			equipeId: s.equipeId,
			tranches: tranchesDe(s.periodes, ctx.reglage)
				.filter((t) => t.debut > ctx.maintenant)
				.map((t) => ({ ...t, prise: !sansEngagement(ctx, id, [t]) }))
		}))
		.filter((s) => s.tranches.length > 0);
}

export type EtatTranche = 'libre' | 'prise' | 'passee' | 'occupe';

// Le parcours guidé : ses semaines d'astreinte des douze prochaines semaines, avec toutes leurs tranches, même passées ou
// déjà demandées (l'écran les montre inactives, avec la raison). `pour` : qui les prendrait (échange) ; « occupe » s'il n'est pas libre.
export function bandesDe(ctx: Contexte, id: number, pour: number | null = null): { semaine: string; equipeId: number; tranches: (Periode & { etat: EtatTranche })[] }[] {
	const limite = `${ajouterJours(ctx.maintenant.slice(0, 10), SEMAINES_PROPOSEES * 7)}T00:00`;
	const etat = (t: Periode): EtatTranche => (t.debut <= ctx.maintenant ? 'passee' : !sansEngagement(ctx, id, [t]) ? 'prise' : pour !== null && !disponible(ctx, pour, [t]) ? 'occupe' : 'libre');
	return astreintesDe(ctx, id)
		.filter((s) => s.periodes.at(-1)!.fin > ctx.maintenant && s.periodes[0]!.debut < limite)
		.map((s) => ({ semaine: s.debut, equipeId: s.equipeId, tranches: tranchesDe(s.periodes, ctx.reglage).map((t) => ({ ...t, etat: etat(t) })) }))
		.filter((s) => s.tranches.some((t) => t.etat !== 'passee'));
}

// Les collègues libres sur ces périodes : leur équipe du jour, leurs aptitudes valables, et les aptitudes contrôlées du demandeur qui leur manquent.
// Ceux à qui rien ne manque d'abord, puis par nom.
export function candidats(ctx: Contexte, demandeurId: number, periodes: Periode[]) {
	if (periodes.length === 0) return [];
	const date = periodes[0]!.debut.slice(0, 10);
	const aujourdhui = ctx.maintenant.slice(0, 10);
	return ctx.agents
		.filter((a) => a.id !== demandeurId && disponible(ctx, a.id, periodes))
		.map((a) => {
			const siennes = ctx.aptitudes.filter((x) => x.personneId === a.id).sort((x, y) => x.ordre - y.ordre);
			const valides = validesLe(siennes, date);
			const equipeId = equipeLe(affectationsDe(ctx, a.id), aujourdhui);
			return {
				id: a.id,
				prenom: a.prenom,
				nom: a.nom,
				equipe: ctx.equipes.find((e) => e.id === equipeId) ?? null,
				aptitudes: siennes.filter((x) => valides.has(x.aptitudeId)).map((x) => x.nom),
				manque: manque(ctx, demandeurId, a.id, date)
			};
		})
		.sort((a, b) => Number(a.manque.length > 0) - Number(b.manque.length > 0) || a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
}
