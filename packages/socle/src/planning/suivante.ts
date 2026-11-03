import { and, eq, gte, lte } from 'drizzle-orm';
import { armement, ENGIN_CALCULE, lireArmement, postesDe, type Poste } from '../armement.ts';
import { validesLe } from '../aptitudes.ts';
import type { Base } from '../base.ts';
import { ajouterJours } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide } from '../erreurs.ts';
import { STATUTS_AVEC_ACCES } from '../listes.ts';
import { affectationEquipe, anneePlanning, aptitude, aptitudeAgent, manoeuvre, personne, semaineChangee } from '../schema.ts';
import { equipeLe, exigerAnnee, exigerGestion, historiqueDesFetes, journalPlanning, lectures, ordrePropose, semainesCalculees, vueManoeuvre, type Convoques } from './annee.ts';
import { calculerAnnee, momentsDesFetes, rangDuJour, rangsDuTour, type Reglage, type SemaineCalculee } from './calendrier.ts';

// « Partir d'une proposition » : une année sans roulement, pré-remplie d'après la précédente. Rien n'est écrit avant d'accepter.

// L'ordre qui continue le cycle à la relève de janvier. Une équipe archivée sort, une nouvelle entre à la fin.
// Si la dernière semaine, changée, redonnerait la même équipe à la relève : on passe à la suivante.
export function ordreQuiContinue(precedent: number[], semainesPrecedentes: number, derniere: number, actives: number[]): number[] {
	const k = semainesPrecedentes % precedent.length;
	const suite = [...precedent.slice(k), ...precedent.slice(0, k)].filter((id) => actives.includes(id));
	const ordre = [...suite, ...actives.filter((id) => !suite.includes(id))];
	return ordre[0] === derniere ? [...ordre.slice(1), derniere] : ordre;
}

type Rangs = { noel: Map<number, number>; nouvelAn: Map<number, number> };

const echanger = (equipes: number[], [a, b]: [number, number]) => {
	const r = [...equipes];
	[r[a], r[b]] = [r[b]!, r[a]!];
	return r;
};

// Le coût d'un réglage, à comparer dans l'ordre : une équipe aux deux fêtes de semaines différentes, fêtes hors du tour,
// puis attente dans la file, Noël hors du tour, deux semaines de suite pour une équipe, semaines changées, éloignement des fêtes.
function cout(essai: number[], depart: number[], i: { noel: number; nouvelAn: number }, rangs: Rangs): number[] {
	const noel = i.noel >= 0 ? rangs.noel.get(essai[i.noel]!) ?? 0 : 0;
	const nouvelAn = i.nouvelAn >= 0 ? rangs.nouvelAn.get(essai[i.nouvelAn]!) ?? 0 : 0;
	const deuxFetes = i.noel >= 0 && i.nouvelAn >= 0 && i.noel !== i.nouvelAn && essai[i.noel] === essai[i.nouvelAn];
	const changees = essai.flatMap((id, j) => (id === depart[j] ? [] : [j]));
	const proche = Math.max(i.noel, i.nouvelAn);
	return [deuxFetes ? 1 : 0, (noel > 0 ? 1 : 0) + (nouvelAn > 0 ? 1 : 0), noel + nouvelAn, noel > 0 ? 1 : 0, essai.filter((id, j) => id === essai[j + 1]).length, changees.length, changees.reduce((n, j) => n + proche - j, 0)];
}

const plusPetit = (a: number[], b: number[]) => {
	const j = a.findIndex((x, n) => x !== b[n]);
	return j >= 0 && a[j]! < b[j]!;
};

// Donne les fêtes aux équipes dont c'est le tour, en échangeant des semaines de fin d'année : chaque équipe garde son nombre de semaines.
// Deux échanges touchant une semaine de fête, puis au besoin un dernier ailleurs pour défaire deux semaines de suite : on essaie tout, le moins coûteux gagne.
// `premiere` : la première semaine qui peut encore changer (année en cours).
export function reglerFetes(equipes: number[], i: { noel: number; nouvelAn: number }, rangs: Rangs, premiere = 0): number[] {
	const fin = Math.max(premiere, equipes.length - (2 * new Set(equipes).size + 2));
	const fetes = [...new Set([i.noel, i.nouvelAn])].filter((x) => x >= fin);
	const fenetre = equipes.flatMap((_, j) => (j >= fin ? [j] : []));
	const echanges: [number, number][] = fetes.flatMap((f) => fenetre.flatMap((j) => (j !== f ? [[f, j] as [number, number]] : [])));
	let meilleur = equipes;
	let meilleurCout = cout(equipes, equipes, i, rangs);
	const essayer = (essai: number[]) => {
		const c = cout(essai, equipes, i, rangs);
		if (plusPetit(c, meilleurCout)) {
			meilleur = essai;
			meilleurCout = c;
		}
	};
	for (const a of echanges) {
		const un = echanger(equipes, a);
		essayer(un);
		for (const b of echanges) essayer(echanger(un, b));
	}
	if (meilleur.some((id, j) => id === meilleur[j + 1])) {
		const autres = fenetre.filter((j) => !fetes.includes(j));
		const retenu = meilleur;
		for (const a of autres) for (const b of autres) if (a < b) essayer(echanger(retenu, [a, b]));
	}
	return meilleur;
}

// Le 2e dimanche de mars reste le 2e dimanche de mars, à la même heure. Un 5e absent cette année-là : le dernier du mois.
export function memePlaceDansLeMois(debut: string, annee: number): string {
	const mois = debut.slice(5, 7);
	const premier = `${annee}-${mois}-01`;
	const decalage = (rangDuJour(debut.slice(0, 10)) - rangDuJour(premier) + 7) % 7;
	const rang = Math.floor((Number(debut.slice(8, 10)) - 1) / 7);
	const jour = ajouterJours(premier, decalage + rang * 7);
	return `${jour.startsWith(`${annee}-${mois}`) ? jour : ajouterJours(jour, -7)}${debut.slice(10, 16)}`;
}

// Un tour de rôle évident : la suite des équipes convoquées se répète à l'identique, vue au moins deux fois. Rend sa longueur, ou null.
export function periodeDuTour(suite: number[][]): number | null {
	const cles = suite.map((c) => [...c].sort((a, b) => a - b).join(','));
	for (let p = 2; p * 2 <= cles.length; p++) {
		if (new Set(cles.slice(0, p)).size > 1 && cles.every((c, i) => i < p || c === cles[i - p])) return p;
	}
	return null;
}

type ManoeuvreSource = { debut: string; theme: string; lieu: string; convoques: Convoques; petitDejeuner: boolean; annulee: boolean };
export type ManoeuvreReprise = { debut: string; theme: string; lieu: string; convoques: Convoques; petitDejeuner: boolean };

// Les manœuvres de l'année précédente, pour `annee`. Les annulées gardent leur place dans le tour de rôle, mais ne reviennent pas.
export function reprendreManoeuvres(precedentes: ManoeuvreSource[], annee: number, actives: number[], maintenant: string, existantes: string[]) {
	const triees = [...precedentes].sort((a, b) => a.debut.localeCompare(b.debut));
	const suite = triees.flatMap((m) => (m.convoques === 'tous' ? [] : [m.convoques]));
	const periode = periodeDuTour(suite);
	let rang = 0;
	const manoeuvres: ManoeuvreReprise[] = [];
	let annulees = 0;
	let passees = 0;
	let deja = 0;
	const prises = new Set(existantes);
	for (const m of triees) {
		const voulues = m.convoques === 'tous' ? 'tous' : periode ? suite[(rang + suite.length) % periode]! : m.convoques;
		if (m.convoques !== 'tous') rang++;
		if (m.annulee) {
			annulees++;
			continue;
		}
		const debut = memePlaceDansLeMois(m.debut, annee);
		if (debut < maintenant.slice(0, 16)) passees++;
		else if (prises.has(debut)) deja++;
		else {
			prises.add(debut);
			const restantes = voulues === 'tous' ? [] : voulues.filter((id) => actives.includes(id));
			manoeuvres.push({ debut, theme: m.theme, lieu: m.lieu, convoques: restantes.length ? restantes : 'tous', petitDejeuner: m.petitDejeuner });
		}
	}
	return { manoeuvres, tourDeRole: periode !== null, annulees, passees, deja };
}

const DEJA_PREPAREE = 'Cette année a déjà un roulement : la proposition n’écrase rien. Modifiez-la étape par étape.';

export type PropositionAnnee = Awaited<ReturnType<typeof calculer>>;

// Le calcul commun à l'aperçu et à l'acceptation.
async function calculer(base: Base, annee: number, maintenant: string, reglage: Reglage) {
	const debutAnnee = `${annee}-01-01`;
	const [[annees, changees, lignesManoeuvres, vacances, equipes, saisies, agents, affectations, aptitudes], reglageArmement] = await Promise.all([
		base.batch([
			...lectures(base, `${annee - 3}-01-01`, `${annee}-12-31`),
			base.select({ id: personne.id, statut: personne.statut }).from(personne),
			base.select({ personneId: affectationEquipe.personneId, equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe),
			base.select({ personneId: aptitudeAgent.personneId, aptitudeId: aptitudeAgent.aptitudeId, obtenueLe: aptitudeAgent.obtenueLe, expireLe: aptitudeAgent.expireLe, retiree: aptitude.retireeLe }).from(aptitudeAgent).innerJoin(aptitude, eq(aptitude.id, aptitudeAgent.aptitudeId))
		]),
		lireArmement(base)
	]);
	if (annees.some((a) => a.annee === annee && a.ordre !== '[]')) throw new DonneeInvalide(DEJA_PREPAREE);
	const actives = equipes.filter((e) => e.active === 1);
	const ids = actives.map((e) => e.id);
	if (ids.length < 2) throw new DonneeInvalide('Au moins deux équipes actives pour proposer un roulement.');

	const lignePrecedente = annees.find((a) => a.annee === annee - 1 && a.ordre !== '[]');
	const semainesPrecedentes = semainesCalculees(annee - 1, lignePrecedente?.ordre, changees, reglage);
	const ordre = lignePrecedente ? ordreQuiContinue(JSON.parse(lignePrecedente.ordre) as number[], semainesPrecedentes.length, semainesPrecedentes.at(-1)!.equipeId, ids) : ordrePropose(annee, reglage, equipes);

	// Les fêtes : l'équipe d'astreinte à chaque garde, puis le réglage d'après le tour.
	const semaines = calculerAnnee(annee, reglage, ordre, new Map());
	const moments = momentsDesFetes(annee);
	const dansLaSemaine = (moment: string) => (s: SemaineCalculee) => s.periodes.some((p) => p.debut <= moment && moment < p.fin);
	const i = { noel: semaines.findIndex(dansLaSemaine(moments.noel)), nouvelAn: semaines.findIndex(dansLaSemaine(moments.nouvelAn)) };
	const historique = historiqueDesFetes(annee, annees, changees, saisies, reglage);
	const rangs = { noel: rangsDuTour(historique, 'noel', ids, annee), nouvelAn: rangsDuTour(historique, 'nouvel_an', ids, annee) };
	const depart = semaines.map((s) => s.equipeId);
	// Une semaine commencée (année en cours) ne change plus.
	const aVenir = semaines.findIndex((s) => (s.periodes[0]?.debut ?? s.debut) > maintenant.slice(0, 16));
	const regle = reglerFetes(depart, i, rangs, aVenir < 0 ? semaines.length : aVenir);
	const changements = semaines.flatMap((s, j) => (regle[j] === s.equipeId ? [] : [{ debut: s.debut, numero: s.numero, avant: s.equipeId, apres: regle[j]! }]));
	const fete = (j: number, r: Map<number, number>) => (j < 0 ? { equipeId: null, dansLeTour: true, attendues: [] as number[] } : { equipeId: regle[j]!, dansLeTour: (r.get(regle[j]!) ?? 0) === 0, attendues: ids.filter((id) => r.get(id) === 0) });
	const noel = fete(i.noel, rangs.noel);
	const nouvelAn = fete(i.nouvelAn, rangs.nouvelAn);

	const reprise = lignePrecedente
		? reprendreManoeuvres(
				lignesManoeuvres.filter((m) => m.debut.startsWith(`${annee - 1}-`)).map(vueManoeuvre),
				annee,
				ids,
				maintenant,
				lignesManoeuvres.filter((m) => m.debut.startsWith(`${annee}-`) && m.annuleeLe === null).map((m) => m.debut)
			)
		: { manoeuvres: [], tourDeRole: false, annulees: 0, passees: 0, deja: 0 };

	// L'état des équipes à la date de début d'année : on signale, on ne déplace personne.
	const fpt = reglageArmement.engins.find((e) => e.nom === ENGIN_CALCULE)!.postes;
	const presents = agents.filter((a) => (STATUTS_AVEC_ACCES as readonly string[]).includes(a.statut));
	const etat = actives.map((e) => {
		const membres = presents.filter((a) => equipeLe(affectations.filter((x) => x.personneId === a.id), debutAnnee) === e.id);
		// Inapte temporaire : compté dans l'effectif, mais ne tient aucun poste.
		const avecPostes = membres.map((a) => ({ id: a.id, postes: a.statut === 'inapte_temporaire' ? new Set<Poste>() : postesDe(reglageArmement.niveaux, validesLe(aptitudes.filter((x) => x.personneId === a.id && x.retiree === null), debutAnnee)) }));
		const { arme, manque } = armement(fpt, avecPostes);
		return { id: e.id, nom: e.nom, couleur: e.couleur, effectif: membres.length, arme, manque };
	});

	return {
		annee,
		precedente: lignePrecedente !== undefined,
		ordre,
		semaines: semaines.length,
		changees: changements,
		fetes: { noel, nouvelAn, compromis: !noel.dansLeTour || !nouvelAn.dansLeTour, memeSemaine: i.noel >= 0 && i.noel === i.nouvelAn, deSuite: [...new Set(regle.filter((id, j) => id === regle[j + 1] && depart[j] !== depart[j + 1]))] },
		...reprise,
		vacances: vacances.filter((v) => v.debut.startsWith(`${annee}-`)).length,
		equipes: etat
	};
}

export async function proposerAnnee(base: Base, acteur: Acteur, annee: number, maintenant: string, reglage: Reglage): Promise<PropositionAnnee> {
	exigerAnnee(annee);
	await exigerGestion(base, acteur, maintenant);
	return calculer(base, annee, maintenant, reglage);
}

// Écrit le brouillon d'un seul bloc. L'année n'est pas publiée : rien n'est annoncé (voir planningDuMatin).
export async function accepterProposition(base: Base, acteur: Acteur, annee: number, maintenant: string, reglage: Reglage): Promise<void> {
	exigerAnnee(annee);
	await exigerGestion(base, acteur, maintenant);
	const p = await calculer(base, annee, maintenant, reglage);
	try {
		await base.batch([
			// Rien d'orphelin ne reste (une ligne sans ordre, des semaines sans roulement) : on écrit ce qui a été proposé.
			base.delete(anneePlanning).where(and(eq(anneePlanning.annee, annee), eq(anneePlanning.ordre, '[]'))),
			base.delete(semaineChangee).where(and(gte(semaineChangee.debut, `${annee}-01-01`), lte(semaineChangee.debut, `${annee}-12-31`))),
			// Une insertion simple : si une autre acceptation est passée entre-temps, tout le bloc échoue.
			base.insert(anneePlanning).values({ annee, ordre: JSON.stringify(p.ordre) }),
			journalPlanning(base, acteur, 'accepter_proposition', { annee, ordre: p.ordre, semaines: p.changees.length, manoeuvres: p.manoeuvres.length }, maintenant),
			...p.changees.map((c) => base.insert(semaineChangee).values({ debut: c.debut, equipeId: c.apres })),
			...p.manoeuvres.map((m) => base.insert(manoeuvre).values({ debut: m.debut, theme: m.theme, lieu: m.lieu, convoques: JSON.stringify(m.convoques), petitDejeuner: m.petitDejeuner ? 1 : 0 }))
		]);
	} catch (erreur) {
		const [ligne] = await base.select({ annee: anneePlanning.annee }).from(anneePlanning).where(eq(anneePlanning.annee, annee));
		if (ligne) throw new DonneeInvalide(DEJA_PREPAREE);
		throw erreur;
	}
}
