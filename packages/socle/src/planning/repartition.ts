import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDateHeure } from '../dates.ts';
import { aLeDroit, type Acteur } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { armement, ENGIN_CALCULE, LIBELLES_POSTE, lireArmement, postesDe, postesTenus, type Poste, type Postes, type ReglageArmement } from '../armement.ts';
import { validesLe } from '../aptitudes.ts';
import { ligneJournal } from '../journal.ts';
import { nomActeur } from '../actions/personnes.ts';
import { STATUTS_AVEC_ACCES } from '../listes.ts';
import { effectifs, requeteConclues } from '../remplacements/effectifs.ts';
import { chevauche, jourEnLettres, texteTranche, tranchesDe } from '../remplacements/tranches.ts';
import { affectationEquipe, anneePlanning, aptitude, aptitudeAgent, avisEte, equipe, ete, personne, plageEte, reponseEte, semaineChangee, vacancesAgent } from '../schema.ts';
import { equipeLe, exigerAnnee, semainesCalculees } from './annee.ts';
import { dansLaSemaine, enVacances, heuresDe, lirePlage, type PlageLue } from './plages.ts';
import type { Periode, Reglage, SemaineCalculee } from './calendrier.ts';
import { nomsDeGroupes } from './groupes.ts';
import { agentsDeLete, avis, periodeParDefaut, requeteRelance, vueEte, type EteVue, type Reponse } from './ete.ts';

// La répartition de l'été : plage par plage, l'équipe de base de la semaine, moins les écarts (`retires`), plus les renforts (`ajoutes`).
// Proposée par l'appli pour armer le FPT, ajustée puis publiée par le chef. Publiée, elle fait foi pour le planning, l'agenda et les remplacements.

export type PlageEte = Periode & { semaine: string; equipeId: number };

// La proposition, plage par plage : l'équipe de base moins les agents en vacances ; si le FPT n'est pas armé, des renforts pris parmi
// les autres agents qui ne sont pas en vacances, ceux qui ont le moins été en renfort cet été d'abord (puis par nom), tant qu'un renfort
// comble une place. Les plages qui restent impossibles sont rendues avec ce qui manque.
export function proposer(e: {
	plages: PlageEte[];
	base: (p: PlageEte) => number[];
	candidats: number[];
	enVacances: (id: number, p: Periode) => boolean;
	postes: (id: number, date: string) => Set<Poste>;
	fpt: Postes;
}): { ecarts: PlageLue[]; impossibles: (Periode & { manque: Poste[] })[] } {
	const renforts = new Map<number, number>();
	const ecarts: PlageLue[] = [];
	const impossibles: (Periode & { manque: Poste[] })[] = [];
	for (const p of e.plages) {
		const date = p.debut.slice(0, 10);
		const deBase = e.base(p);
		const retires = deBase.filter((id) => e.enVacances(id, p));
		const presents = deBase.filter((id) => !retires.includes(id));
		const ajoutes: number[] = [];
		const calcul = () => armement(e.fpt, [...presents, ...ajoutes].map((id) => ({ id, postes: e.postes(id, date) })));
		let r = calcul();
		while (!r.arme) {
			const libres = e.candidats.filter((id) => !presents.includes(id) && !ajoutes.includes(id) && !e.enVacances(id, p)).sort((a, b) => (renforts.get(a) ?? 0) - (renforts.get(b) ?? 0));
			const avant = r.manque.length;
			const utile = libres.find((id) => {
				ajoutes.push(id);
				const essai = calcul();
				if (essai.manque.length < avant) {
					r = essai;
					return true;
				}
				ajoutes.pop();
				return false;
			});
			if (utile === undefined) break;
			renforts.set(utile, (renforts.get(utile) ?? 0) + 1);
		}
		ecarts.push({ debut: p.debut, fin: p.fin, ajoutes, retires });
		if (!r.arme) impossibles.push({ debut: p.debut, fin: p.fin, manque: r.manque });
	}
	return { ecarts, impossibles };
}

// « Nuit du lundi 12 juillet : pas de CA tout engins disponible » ; plusieurs places : « manque CA tout engins, 2 agents ».
export function texteManque(p: Periode, manque: Poste[]): string {
	const comptes = [...new Set(manque)].map((x) => {
		const n = manque.filter((y) => y === x).length;
		return n > 1 ? `${n} ${LIBELLES_POSTE[x]}${x === 'agent' ? 's' : ''}` : LIBELLES_POSTE[x];
	});
	const texte = texteTranche(p);
	const debut = `${texte[0]!.toUpperCase()}${texte.slice(1)}`;
	return manque.length === 1 ? `${debut} : pas de ${comptes[0]} disponible` : `${debut} : manque ${comptes.join(', ')}`;
}

async function exigerGestion(base: Base, acteur: Acteur, maintenant: string) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await aLeDroit(base, acteur, 'GERER_PLANNING', { type: 'centre' }, aujourdhui))) throw new RefusDroit('GERER_PLANNING', { type: 'centre' });
	return aujourdhui;
}

// Le reste de l'été : les vacances, les réponses, les équipes, les remplacements conclus.
const lecturesDuReste = (base: Base, annee: number) =>
	[
		base.select().from(vacancesAgent).where(eq(vacancesAgent.annee, annee)).orderBy(asc(vacancesAgent.debut)),
		base.select().from(reponseEte).where(eq(reponseEte.annee, annee)),
		base.select({ id: equipe.id, nom: equipe.nom, couleur: equipe.couleur, active: equipe.active }).from(equipe).orderBy(asc(equipe.ordreRotation)),
		requeteConclues(base, `${annee}-01-01`, `${annee}-12-31`)
	] as const;

// Tout ce qu'il faut pour l'été d'une année, lu d'un bloc. `toutLEte` faux : seulement ce que demande le compte des plages à revoir
// (l'accueil du chef), sans les vacances, les réponses, les équipes ni les remplacements conclus.
async function lireEte(base: Base, annee: number, aujourdhui: string, reglage: Reglage, toutLEte = true) {
	const [[lignesEte, lignesAnnee, changees, agents, affectations, aptitudes, plages, vacances = [], reponses = [], equipes = [], conclues = []], fpt] = await Promise.all([
		base.batch([
			base.select().from(ete).where(eq(ete.annee, annee)),
			base.select().from(anneePlanning).where(eq(anneePlanning.annee, annee)),
			base.select().from(semaineChangee).where(and(gte(semaineChangee.debut, `${annee}-01-01`), lte(semaineChangee.debut, `${annee}-12-31`))),
			base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, statut: personne.statut }).from(personne).where(inArray(personne.statut, [...STATUTS_AVEC_ACCES])),
			base.select({ personneId: affectationEquipe.personneId, equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe),
			base.select({ personneId: aptitudeAgent.personneId, aptitudeId: aptitudeAgent.aptitudeId, obtenueLe: aptitudeAgent.obtenueLe, expireLe: aptitudeAgent.expireLe }).from(aptitudeAgent).innerJoin(aptitude, eq(aptitude.id, aptitudeAgent.aptitudeId)).where(isNull(aptitude.retireeLe)),
			base.select().from(plageEte).where(eq(plageEte.annee, annee)).orderBy(asc(plageEte.debut)),
			...(toutLEte ? lecturesDuReste(base, annee) : ([] as unknown as ReturnType<typeof lecturesDuReste>))
		]),
		lireArmement(base)
	]);
	const e = lignesEte[0] ? vueEte(lignesEte[0]) : null;
	// Seules les semaines de l'été sont calculées.
	const lesSemaines = e && lignesAnnee[0] ? semainesCalculees(annee, lignesAnnee[0].ordre, changees, reglage, e) : [];
	const plagesEte: PlageEte[] = lesSemaines.flatMap((s) => tranchesDe(s.periodes, reglage).map((t) => ({ ...t, semaine: s.debut, equipeId: s.equipeId })));
	// Rangés une fois par personne, et l'équipe de base gardée par semaine : chaque plage les relisait pour tous les agents (décision 0021).
	const parPersonne = <T extends { personneId: number }>(lignes: T[]) => {
		const m = new Map<number, T[]>();
		for (const l of lignes) {
			const siennes = m.get(l.personneId);
			if (siennes) siennes.push(l);
			else m.set(l.personneId, [l]);
		}
		return (id: number) => m.get(id) ?? [];
	};
	const affectationsDe = parPersonne(affectations);
	const aptitudesDe = parPersonne(aptitudes);
	const agentsParId = new Map(agents.map((a) => [a.id, a]));
	// Inapte temporaire : présent, mais ne tient aucun poste. Les postes d'un agent ne changent qu'au début ou à la fin d'une aptitude :
	// si rien ne change pendant l'été, ils sont calculés une fois pour tout l'été.
	const du = plagesEte[0]?.debut.slice(0, 10) ?? '';
	const au = plagesEte.at(-1)?.debut.slice(0, 10) ?? '';
	const fixes = new Map<number, boolean>();
	const fixe = (id: number) => {
		let f = fixes.get(id);
		if (f === undefined) fixes.set(id, (f = !aptitudesDe(id).some((l) => (du < l.obtenueLe && l.obtenueLe <= au) || (l.expireLe !== null && du <= l.expireLe && l.expireLe < au))));
		return f;
	};
	const postesLus = new Map<string, Set<Poste>>();
	const postes = (id: number, date: string) => {
		const cle = du <= date && date <= au && fixe(id) ? `${id}` : `${id} ${date}`;
		let p = postesLus.get(cle);
		if (!p) {
			const a = agentsParId.get(id);
			p = !a || a.statut === 'inapte_temporaire' ? new Set<Poste>() : postesDe(fpt.niveaux, validesLe(aptitudesDe(id), date));
			postesLus.set(cle, p);
		}
		return p;
	};
	const deBase = new Map<string, number[]>();
	const base_ = (p: PlageEte) => {
		const cle = `${p.semaine} ${p.equipeId}`;
		let ids = deBase.get(cle);
		if (!ids) deBase.set(cle, (ids = agents.filter((a) => equipeLe(affectationsDe(a.id), p.semaine) === p.equipeId).map((a) => a.id)));
		return ids;
	};
	const plagesLues = plages.map(lirePlage);
	const ecarts = new Map(plagesLues.map((x) => [x.debut, x]));
	return { e, semaines: lesSemaines, sansRoulement: !lignesAnnee[0] || lignesAnnee[0].ordre === '[]', plagesEte, agents, affectations, vacances, reponses, plages: plagesLues, ecartDe: (p: Periode) => ecarts.get(p.debut), equipes, conclues, fpt, postes, base: base_, affectationsDe };
}

type Lu = Awaited<ReturnType<typeof lireEte>>;

// « du Groupe B » ; une équipe archivée n'a pas de groupe.
const duGroupe = (lu: Lu, equipeId: number) => {
	const nom = nomsDeGroupes(lu.equipes).get(equipeId);
	return nom ? `du ${nom}` : 'de l’équipe';
};
const enginFpt = (r: ReglageArmement) => r.engins.find((x) => x.nom === ENGIN_CALCULE)!.postes;

// Les présents d'une plage, d'après les écarts enregistrés.
const presentsDe = (lu: Lu, p: PlageEte, ecart: PlageLue | undefined) => {
	const deBase = lu.base(p);
	return [...deBase.filter((id) => !ecart?.retires.includes(id)), ...(ecart?.ajoutes ?? []).filter((id) => !deBase.includes(id))];
};

export type VuePlage = Periode & { presents: { id: number; prenom: string; nom: string; renfort: boolean }[]; arme: boolean; manque: Poste[] };

const nomDe = (lu: Lu, id: number) => lu.agents.find((a) => a.id === id) ?? { id, prenom: '', nom: 'Agent parti' };

// Une plage du tableau : ses présents (renforts après), FPT armé ou ce qui manque.
function vueDe(lu: Lu, fpt: Postes, p: PlageEte): VuePlage & { semaine: string; equipeId: number } {
	const ids = presentsDe(lu, p, lu.ecartDe(p));
	const r = armement(fpt, ids.map((id) => ({ id, postes: lu.postes(id, p.debut.slice(0, 10)) })));
	const deBase = lu.base(p);
	const presents = ids.map((id) => ({ ...pick(nomDe(lu, id)), renfort: !deBase.includes(id) })).sort((a, b) => Number(a.renfort) - Number(b.renfort) || a.nom.localeCompare(b.nom, 'fr'));
	return { debut: p.debut, fin: p.fin, semaine: p.semaine, equipeId: p.equipeId, presents, arme: r.arme, manque: r.manque };
}

// L'écran du chef : la période, qui a répondu, le tableau de l'été (s'il est proposé), les plages impossibles et les conflits.
export async function eteAPreparer(base: Base, acteur: Acteur, annee: number, maintenant: string, reglage: Reglage) {
	exigerAnnee(annee);
	const aujourdhui = await exigerGestion(base, acteur, maintenant);
	// Ouvrir l'été marque lus les avis qui y mènent (vacances changées), dans le même envoi à la base.
	const lus = acteur.type === 'personne' ? [base.update(avisEte).set({ lueLe: maintenant }).where(and(eq(avisEte.personneId, acteur.id), sql`${avisEte.url} like '/planning/ete%'`, isNull(avisEte.lueLe)))] : [];
	const [lu, [relance]] = await Promise.all([lireEte(base, annee, aujourdhui, reglage), base.batch([requeteRelance(base, annee, aujourdhui), ...lus])]);
	const fpt = enginFpt(lu.fpt);
	const date = lu.e && lu.e.debut > aujourdhui ? lu.e.debut : aujourdhui;
	const concernes = agentsDeLete(lu.agents, lu.affectations, date);
	const reponses = concernes.map((a) => {
		const r = lu.reponses.find((x) => x.personneId === a.id);
		return { id: a.id, prenom: a.prenom, nom: a.nom, equipeId: a.equipeId, reponse: (r ? (r.toutEte === 1 ? 'tout' : 'vacances') : null) as Reponse, periodes: lu.vacances.filter((v) => v.personneId === a.id).map(({ debut, fin }) => ({ debut, fin })) };
	});
	const proposee = lu.plages.length > 0;
	const vues = proposee ? lu.plagesEte.map((p) => vueDe(lu, fpt, p)) : [];
	// Les remplacements conclus que la répartition contredit.
	const conflits: string[] = [];
	if (proposee) {
		for (const r of effectifs(lu.conclues)) {
			const s = lu.semaines.find((x) => x.periodes.some((y) => y.debut <= r.debut && r.debut < y.fin));
			if (!s) continue;
			const ecarts = lu.plages.filter((x) => dansLaSemaine(s, x));
			const heures = heuresDe(s, equipeLe(lu.affectationsDe(r.titulaireId), s.debut), r.titulaireId, ecarts);
			if (!heures.some((h) => chevauche(h, r))) conflits.push(`${texteTranche(r)} : ${r.titulaire} est remplacé par ${r.remplacant}, mais n’est plus d’astreinte`);
			else if (enVacances(lu.vacances, r.remplacantId, r)) conflits.push(`${texteTranche(r)} : ${r.remplacant} remplace ${r.titulaire}, mais est en vacances`);
		}
	}
	// Un agent en vacances qui se retrouve présent (équipe changée, vacances données après la proposition).
	for (const v of vues) for (const x of v.presents) if (enVacances(lu.vacances, x.id, v)) conflits.push(`${texteTranche(v)} : ${x.prenom} ${x.nom} est en vacances, mais présent`);
	return {
		annee,
		ete: lu.e,
		defaut: periodeParDefaut(annee, reglage),
		sansRoulement: lu.sansRoulement,
		relanceeAujourdhui: relance.length > 0,
		// Proposé ou publié : les groupes A, B, C, D.
		equipes: lu.equipes.map(({ id, nom, couleur }) => ({ id, couleur, nom: lu.e?.publiee || proposee ? (nomsDeGroupes(lu.equipes).get(id) ?? nom) : nom })),
		reponses,
		proposee,
		semaines: lu.semaines.map((s) => ({ debut: s.debut, equipeId: s.equipeId, plages: vues.filter((v) => v.semaine === s.debut).map(({ semaine: _s, equipeId: _e, ...v }) => v) })),
		impossibles: vues.filter((v) => !v.arme).map((v) => texteManque(v, v.manque)),
		conflits
	};
}

// Le panneau d'une plage (?plage=), calculé seul : sans le reste de l'été, que la page garde. Le poste de chaque présent ;
// pour ajouter, ceux qui comblent un poste manquant d'abord. Nul sans proposition ou si la plage n'existe pas.
export async function plageAPreparer(base: Base, acteur: Acteur, annee: number, maintenant: string, reglage: Reglage, plage: string) {
	exigerAnnee(annee);
	const aujourdhui = await exigerGestion(base, acteur, maintenant);
	const lu = await lireEte(base, annee, aujourdhui, reglage);
	const ouverte = lu.plages.length > 0 ? lu.plagesEte.find((p) => p.debut === plage) : undefined;
	if (!ouverte) return null;
	const fpt = enginFpt(lu.fpt);
	const { semaine: _s, equipeId: _e, ...vue } = vueDe(lu, fpt, ouverte);
	const date = ouverte.debut.slice(0, 10);
	// Dans l'ordre des ids : le poste affiché ne change pas d'un chargement à l'autre.
	const tenus = postesTenus(fpt, [...vue.presents].sort((a, b) => a.id - b.id).map((x) => ({ id: x.id, postes: lu.postes(x.id, date) })));
	return {
		...vue,
		presents: vue.presents.map((x) => ({ ...x, poste: tenus.get(x.id) ?? null })),
		candidats: lu.agents
			.filter((a) => !vue.presents.some((x) => x.id === a.id) && a.statut === 'operationnel')
			.map((a) => {
				const siens = lu.postes(a.id, date);
				return { id: a.id, prenom: a.prenom, nom: a.nom, equipeId: equipeLe(lu.affectationsDe(a.id), ouverte.semaine), vacances: enVacances(lu.vacances, a.id, ouverte), utile: vue.manque.some((m) => siens.has(m)), postes: [...siens].filter((x) => x !== 'agent') };
			})
			.sort((a, b) => Number(b.utile) - Number(a.utile) || Number(a.vacances) - Number(b.vacances) || b.postes.length - a.postes.length || a.nom.localeCompare(b.nom, 'fr'))
	};
}

// Les plages où la répartition enregistrée n'arme pas le FPT : pour l'accueil du chef, comme l'écran Été les compte.
export async function plagesARevoir(base: Base, annee: number, aujourdhui: string, reglage: Reglage): Promise<number> {
	const lu = await lireEte(base, annee, aujourdhui, reglage, false);
	const fpt = enginFpt(lu.fpt);
	// Des présents qui tiennent les mêmes postes arment le FPT de la même façon : une équipe garde souvent les mêmes d'une plage à
	// l'autre, le calcul est fait une fois par combinaison.
	const armees = new Map<string, boolean>();
	const noms = new Map<Set<Poste>, string>();
	const nom = (x: Set<Poste>) => noms.get(x) ?? noms.set(x, [...x].join()).get(x)!;
	return lu.plagesEte.filter((p) => {
		const postes = presentsDe(lu, p, lu.ecartDe(p)).map((id) => lu.postes(id, p.debut.slice(0, 10)));
		const cle = postes.map(nom).sort().join(' ');
		let arme = armees.get(cle);
		if (arme === undefined) armees.set(cle, (arme = armement(fpt, postes.map((x, id) => ({ id, postes: x }))).arme));
		return !arme;
	}).length;
}

const pick = (a: { id: number; prenom: string; nom: string }) => ({ id: a.id, prenom: a.prenom, nom: a.nom });

const journal = (base: Base, acteur: Acteur, action: string, details: object, maintenant: string) => ligneJournal(base, { acteur: nomActeur(acteur), action, cibleType: 'planning', cibleId: null, details }, maintenant);

// Calcule la proposition et l'enregistre (elle remplace la précédente). Seulement avant la publication.
export async function proposerEte(base: Base, acteur: Acteur, annee: number, maintenant: string, reglage: Reglage): Promise<{ impossibles: string[] }> {
	exigerAnnee(annee);
	const aujourdhui = await exigerGestion(base, acteur, maintenant);
	const lu = await lireEte(base, annee, aujourdhui, reglage);
	if (!lu.e) throw new DonneeInvalide('Été pas encore ouvert');
	if (lu.e.publiee) throw new DonneeInvalide('Été déjà publié');
	if (lu.plagesEte.length === 0) throw new DonneeInvalide('Réglez d’abord le roulement');
	const candidats = [...lu.agents].filter((a) => a.statut === 'operationnel').sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr')).map((a) => a.id);
	const { ecarts, impossibles } = proposer({ plages: lu.plagesEte, base: lu.base, candidats, enVacances: (id, p) => enVacances(lu.vacances, id, p), postes: lu.postes, fpt: enginFpt(lu.fpt) });
	await base.batch([
		base.delete(plageEte).where(eq(plageEte.annee, annee)),
		...ecarts.map((x) => base.insert(plageEte).values({ debut: x.debut, fin: x.fin, annee, ajoutes: JSON.stringify(x.ajoutes), retires: JSON.stringify(x.retires) })),
		journal(base, acteur, 'proposer_ete', { annee, impossibles: impossibles.length }, maintenant)
	]);
	return { impossibles: impossibles.map((x) => texteManque(x, x.manque)) };
}

// Ajoute (présent) ou retire un agent d'une plage. Été publié : le changement vaut tout de suite et l'agent est prévenu.
export async function ajusterPlage(base: Base, acteur: Acteur, annee: number, debut: string, personneId: number, present: boolean, maintenant: string, reglage: Reglage): Promise<void> {
	exigerAnnee(annee);
	const aujourdhui = await exigerGestion(base, acteur, maintenant);
	const lu = await lireEte(base, annee, aujourdhui, reglage);
	const p = lu.plagesEte.find((x) => x.debut === debut);
	const ecart = lu.plages.find((x) => x.debut === debut);
	if (!lu.e || !p || !ecart) throw new DonneeInvalide('Plage inconnue');
	if (!lu.agents.some((a) => a.id === personneId)) throw new DonneeInvalide('Agent inconnu');
	if (lu.e.publiee && p.debut <= maintenant.slice(0, 16)) throw new DonneeInvalide('Plage commencée');
	const deBase = lu.base(p).includes(personneId);
	const ajoutes = ecart.ajoutes.filter((id) => id !== personneId);
	const retires = ecart.retires.filter((id) => id !== personneId);
	if (present && !deBase) ajoutes.push(personneId);
	if (!present && deBase) retires.push(personneId);
	const texte = !present ? `Vous n’êtes plus d’astreinte : ${texteTranche(p)}.` : deBase ? `Vous êtes de nouveau d’astreinte : ${texteTranche(p)}.` : `Vous êtes en renfort ${duGroupe(lu, p.equipeId)} : ${texteTranche(p)}.`;
	await base.batch([
		base.update(plageEte).set({ ajoutes: JSON.stringify(ajoutes), retires: JSON.stringify(retires) }).where(eq(plageEte.debut, debut)),
		journal(base, acteur, present ? 'ajouter_plage_ete' : 'retirer_plage_ete', { debut, personneId }, maintenant),
		...(lu.e.publiee ? avis(base, [personneId], 'repartition', texte, '/planning', maintenant) : [])
	]);
}

// Publie l'été : le planning, l'agenda et les remplacements le suivent. Les renforts et les agents retirés (hors vacances) sont prévenus,
// semaine par semaine.
export async function publierEte(base: Base, acteur: Acteur, annee: number, maintenant: string, reglage: Reglage): Promise<void> {
	exigerAnnee(annee);
	const aujourdhui = await exigerGestion(base, acteur, maintenant);
	const lu = await lireEte(base, annee, aujourdhui, reglage);
	if (!lu.e || lu.plages.length === 0 || lu.plagesEte.some((p) => !lu.plages.some((x) => x.debut === p.debut))) throw new DonneeInvalide('Proposez d’abord l’été');
	if (lu.e.publiee) return;
	// Les avis ne partent que si c'est cette publication-ci qui a eu lieu (deux clics ne préviennent pas deux fois).
	const si = sql`exists (select 1 from ${ete} where ${ete.annee} = ${annee} and ${ete.publieeLe} = ${maintenant})`;
	const textes = new Map<number, string[]>();
	const dire = (id: number, t: string) => textes.set(id, [...(textes.get(id) ?? []), t]);
	for (const s of lu.semaines) {
		const plages = lu.plagesEte.filter((p) => p.semaine === s.debut);
		const ecarts = plages.map((p) => lu.plages.find((x) => x.debut === p.debut)).filter((x): x is PlageLue => x !== undefined);
		for (const id of new Set(ecarts.flatMap((x) => x.ajoutes))) dire(id, `vous êtes en renfort ${duGroupe(lu, s.equipeId)} la semaine du ${jourEnLettres(s.debut)}`);
		for (const id of new Set(ecarts.flatMap((x) => x.retires.filter((r) => !enVacances(lu.vacances, r, x))))) dire(id, `vous n’êtes pas d’astreinte sur une partie de la semaine du ${jourEnLettres(s.debut)}`);
	}
	await base.batch([
		base.update(ete).set({ publieeLe: maintenant }).where(and(eq(ete.annee, annee), isNull(ete.publieeLe))),
		journal(base, acteur, 'publier_ete', { annee }, maintenant),
		...[...textes].flatMap(([id, t]) => avis(base, [id], 'repartition', `Planning d’été : ${t.join(' ; ')}.`, '/planning', maintenant, si))
	]);
}

// L'onglet « Été » du fichier du planning : une ligne par agent, une colonne par plage (« 25/06 nuit »), « X » s'il est présent.
const colonnePlage = (p: Periode) => {
	const duree = (Date.parse(`${p.fin}:00Z`) - Date.parse(`${p.debut}:00Z`)) / 3_600_000;
	return `${p.debut.slice(8, 10)}/${p.debut.slice(5, 7)} ${duree === 24 ? '24 h' : p.debut.slice(11, 16) >= '17:00' ? 'nuit' : p.debut.slice(11, 16)}`;
};
export const ENTETES_ETE = ['N°', 'Agent', 'Groupe'];

// Rien tant que l'été n'est pas proposé.
export async function feuilleEte(base: Base, annee: number, aujourdhui: string, reglage: Reglage) {
	const lu = await lireEte(base, annee, aujourdhui, reglage);
	if (lu.plages.length === 0) return null;
	const presences = lu.plagesEte.map((p) => new Set(presentsDe(lu, p, lu.ecartDe(p))));
	const agents = [...lu.agents].sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
	const groupes = nomsDeGroupes(lu.equipes);
	const equipeDe = (id: number) => groupes.get(equipeLe(lu.affectationsDe(id), lu.plagesEte[0]!.semaine) ?? 0) ?? '';
	return {
		entetes: [...ENTETES_ETE, ...lu.plagesEte.map(colonnePlage)],
		lignes: agents.map((a) => [String(a.id), `${a.prenom} ${a.nom}`, equipeDe(a.id), ...presences.map((s) => (s.has(a.id) ? 'X' : ''))])
	};
}

// Les changements de présence voulus par le fichier, et les écritures qui les appliquent. Un agent absent du fichier ne change pas.
export async function analyserFeuilleEte(base: Base, annee: number, entetes: string[], lignes: { numero: number; cellules: string[] }[], maintenant: string, reglage: Reglage) {
	const lu = await lireEte(base, annee, maintenant.slice(0, 10), reglage);
	const erreurs: { ligne: number; message: string }[] = [];
	if (lu.plages.length === 0) return { erreurs: [{ ligne: 1, message: 'Proposez d’abord la répartition de l’été dans l’appli' }], changements: [], ecritures: () => [] };
	const colonnes = entetes.slice(ENTETES_ETE.length).map((t) => lu.plagesEte.find((p) => colonnePlage(p) === t.trim()));
	entetes.slice(ENTETES_ETE.length).forEach((t, i) => {
		if (!colonnes[i]) erreurs.push({ ligne: 1, message: `Colonne « ${t} » : pas une plage de l’été` });
	});
	const ecarts = new Map(lu.plages.map((x) => [x.debut, { ajoutes: [...x.ajoutes], retires: [...x.retires] }]));
	const changements: { debut: string; personneId: number; present: boolean }[] = [];
	for (const l of lignes) {
		const id = Number(l.cellules[0]);
		if (!/^\d+$/.test((l.cellules[0] ?? '').trim())) {
			erreurs.push({ ligne: l.numero, message: `N° « ${l.cellules[0] ?? ''} » : agent inconnu` });
			continue;
		}
		// Parti depuis l'export : sa ligne ne compte plus.
		if (!lu.agents.some((a) => a.id === id)) continue;
		colonnes.forEach((p, i) => {
			if (!p) return;
			const voulu = (l.cellules[ENTETES_ETE.length + i] ?? '').trim() !== '';
			const ecart = ecarts.get(p.debut)!;
			const deBase = lu.base(p).includes(id);
			const present = deBase ? !ecart.retires.includes(id) : ecart.ajoutes.includes(id);
			if (voulu === present) return;
			if (lu.e!.publiee && p.debut <= maintenant.slice(0, 16)) {
				erreurs.push({ ligne: l.numero, message: `${colonnePlage(p)} : plage commencée, elle ne change plus` });
				return;
			}
			if (deBase) ecart.retires = voulu ? ecart.retires.filter((x) => x !== id) : [...ecart.retires, id];
			else ecart.ajoutes = voulu ? [...ecart.ajoutes, id] : ecart.ajoutes.filter((x) => x !== id);
			changements.push({ debut: p.debut, personneId: id, present: voulu });
		});
	}
	const touchees = [...new Set(changements.map((c) => c.debut))];
	const ecritures = () => [
		...touchees.map((debut) => base.update(plageEte).set({ ajoutes: JSON.stringify(ecarts.get(debut)!.ajoutes), retires: JSON.stringify(ecarts.get(debut)!.retires) }).where(eq(plageEte.debut, debut))),
		// Été publié : chaque agent touché est prévenu une fois.
		...(lu.e!.publiee ? [...new Set(changements.map((c) => c.personneId))].flatMap((id) => avis(base, [id], 'repartition', 'Planning d’été : vos plages ont changé. Voyez votre planning.', '/planning', maintenant)) : [])
	];
	return { erreurs, changements, ecritures };
}
