import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDateHeure } from '../dates.ts';
import { aLeDroit, type Acteur } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { armement, ENGIN_CALCULE, LIBELLES_POSTE, lireArmement, postesDe, type Poste, type Postes, type ReglageArmement } from '../armement.ts';
import { validesLe } from '../aptitudes.ts';
import { ligneJournal } from '../journal.ts';
import { nomActeur } from '../actions/personnes.ts';
import { STATUTS_AVEC_ACCES } from '../listes.ts';
import { effectifs, requeteConclues } from '../remplacements/effectifs.ts';
import { chevauche, jourEnLettres, texteTranche, tranchesDe } from '../remplacements/tranches.ts';
import { affectationEquipe, anneePlanning, aptitude, aptitudeAgent, equipe, ete, personne, plageEte, reponseEte, semaineChangee, vacancesAgent } from '../schema.ts';
import { equipeLe, exigerAnnee, semainesCalculees } from './annee.ts';
import { dansLaSemaine, enVacances, heuresDe, lirePlage, type PlageLue } from './plages.ts';
import type { Periode, Reglage, SemaineCalculee } from './calendrier.ts';
import { agentsDeLete, avis, periodeParDefaut, vueEte, type EteVue, type Reponse } from './ete.ts';

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

// Tout ce qu'il faut pour l'été d'une année, lu d'un bloc.
async function lireEte(base: Base, annee: number, aujourdhui: string, reglage: Reglage) {
	const [[lignesEte, lignesAnnee, changees, agents, affectations, aptitudes, vacances, reponses, plages, equipes, conclues], fpt] = await Promise.all([
		base.batch([
			base.select().from(ete).where(eq(ete.annee, annee)),
			base.select().from(anneePlanning).where(eq(anneePlanning.annee, annee)),
			base.select().from(semaineChangee).where(and(gte(semaineChangee.debut, `${annee}-01-01`), lte(semaineChangee.debut, `${annee}-12-31`))),
			base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, statut: personne.statut }).from(personne).where(inArray(personne.statut, [...STATUTS_AVEC_ACCES])),
			base.select({ personneId: affectationEquipe.personneId, equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe),
			base.select({ personneId: aptitudeAgent.personneId, aptitudeId: aptitudeAgent.aptitudeId, obtenueLe: aptitudeAgent.obtenueLe, expireLe: aptitudeAgent.expireLe }).from(aptitudeAgent).innerJoin(aptitude, eq(aptitude.id, aptitudeAgent.aptitudeId)).where(isNull(aptitude.retireeLe)),
			base.select().from(vacancesAgent).where(eq(vacancesAgent.annee, annee)).orderBy(asc(vacancesAgent.debut)),
			base.select().from(reponseEte).where(eq(reponseEte.annee, annee)),
			base.select().from(plageEte).where(eq(plageEte.annee, annee)).orderBy(asc(plageEte.debut)),
			base.select({ id: equipe.id, nom: equipe.nom, couleur: equipe.couleur }).from(equipe).orderBy(asc(equipe.ordreRotation)),
			requeteConclues(base, `${annee}-06-01`, `${annee}-09-30`)
		]),
		lireArmement(base)
	]);
	const e = lignesEte[0] ? vueEte(lignesEte[0]) : null;
	const semaines = lignesAnnee[0] ? semainesCalculees(annee, lignesAnnee[0].ordre, changees, reglage) : [];
	const lesSemaines = e ? semaines.filter((s) => s.debut >= e.debut && s.debut < e.fin) : [];
	const plagesEte: PlageEte[] = lesSemaines.flatMap((s) => tranchesDe(s.periodes, reglage).map((t) => ({ ...t, semaine: s.debut, equipeId: s.equipeId })));
	const affectationsDe = (id: number) => affectations.filter((a) => a.personneId === id);
	// Inapte temporaire : présent, mais ne tient aucun poste.
	const postes = (id: number, date: string) => {
		const a = agents.find((x) => x.id === id);
		if (!a || a.statut === 'inapte_temporaire') return new Set<Poste>();
		return postesDe(fpt.niveaux, validesLe(aptitudes.filter((x) => x.personneId === id), date));
	};
	const base_ = (p: PlageEte) => agents.filter((a) => equipeLe(affectationsDe(a.id), p.semaine) === p.equipeId).map((a) => a.id);
	return { e, semaines: lesSemaines, sansRoulement: !lignesAnnee[0] || lignesAnnee[0].ordre === '[]', plagesEte, agents, affectations, vacances, reponses, plages: plages.map(lirePlage), equipes, conclues, fpt, postes, base: base_, affectationsDe };
}

type Lu = Awaited<ReturnType<typeof lireEte>>;

const enginFpt = (r: ReglageArmement) => r.engins.find((x) => x.nom === ENGIN_CALCULE)!.postes;

// Les présents d'une plage, d'après les écarts enregistrés.
const presentsDe = (lu: Lu, p: PlageEte, ecart: PlageLue | undefined) => [...lu.base(p).filter((id) => !ecart?.retires.includes(id)), ...(ecart?.ajoutes ?? []).filter((id) => !lu.base(p).includes(id))];

export type VuePlage = Periode & { presents: { id: number; prenom: string; nom: string; renfort: boolean }[]; arme: boolean; manque: Poste[] };

// L'écran du chef : la période, qui a répondu, le tableau de l'été (s'il est proposé), les plages impossibles et les conflits.
// `plage` : celle ouverte, avec les agents qu'on peut y ajouter.
export async function eteAPreparer(base: Base, acteur: Acteur, annee: number, maintenant: string, reglage: Reglage, plage: string | null = null) {
	exigerAnnee(annee);
	const aujourdhui = await exigerGestion(base, acteur, maintenant);
	const lu = await lireEte(base, annee, aujourdhui, reglage);
	const fpt = enginFpt(lu.fpt);
	const nom = (id: number) => lu.agents.find((a) => a.id === id) ?? { id, prenom: '', nom: 'Agent parti' };
	const date = lu.e && lu.e.debut > aujourdhui ? lu.e.debut : aujourdhui;
	const concernes = agentsDeLete(lu.agents, lu.affectations, date);
	const reponses = concernes.map((a) => {
		const r = lu.reponses.find((x) => x.personneId === a.id);
		return { id: a.id, prenom: a.prenom, nom: a.nom, equipeId: a.equipeId, reponse: (r ? (r.toutEte === 1 ? 'tout' : 'vacances') : null) as Reponse, periodes: lu.vacances.filter((v) => v.personneId === a.id).map(({ debut, fin }) => ({ debut, fin })) };
	});
	const proposee = lu.plages.length > 0;
	const vues: (VuePlage & { semaine: string; equipeId: number })[] = proposee
		? lu.plagesEte.map((p) => {
				const ecart = lu.plages.find((x) => x.debut === p.debut);
				const ids = presentsDe(lu, p, ecart);
				const r = armement(fpt, ids.map((id) => ({ id, postes: lu.postes(id, p.debut.slice(0, 10)) })));
				const presents = ids.map((id) => ({ ...pick(nom(id)), renfort: !lu.base(p).includes(id) })).sort((a, b) => Number(a.renfort) - Number(b.renfort) || a.nom.localeCompare(b.nom, 'fr'));
				return { debut: p.debut, fin: p.fin, semaine: p.semaine, equipeId: p.equipeId, presents, arme: r.arme, manque: r.manque };
			})
		: [];
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
	const ouverte = plage ? lu.plagesEte.find((p) => p.debut === plage) : undefined;
	const detail = ouverte
		? {
				...vues.find((v) => v.debut === ouverte.debut)!,
				candidats: lu.agents
					.filter((a) => !vues.find((v) => v.debut === ouverte.debut)?.presents.some((x) => x.id === a.id) && a.statut === 'operationnel')
					.map((a) => ({ id: a.id, prenom: a.prenom, nom: a.nom, equipeId: equipeLe(lu.affectationsDe(a.id), ouverte.semaine), vacances: enVacances(lu.vacances, a.id, ouverte), postes: [...lu.postes(a.id, ouverte.debut.slice(0, 10))].filter((x) => x !== 'agent') }))
					.sort((a, b) => Number(a.vacances) - Number(b.vacances) || b.postes.length - a.postes.length || a.nom.localeCompare(b.nom, 'fr'))
			}
		: null;
	return {
		annee,
		ete: lu.e,
		defaut: periodeParDefaut(annee, reglage),
		sansRoulement: lu.sansRoulement,
		equipes: lu.equipes,
		reponses,
		proposee,
		semaines: lu.semaines.map((s) => ({ debut: s.debut, equipeId: s.equipeId, plages: vues.filter((v) => v.semaine === s.debut).map(({ semaine: _s, equipeId: _e, ...v }) => v) })),
		impossibles: vues.filter((v) => !v.arme).map((v) => texteManque(v, v.manque)),
		conflits,
		detail
	};
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
	const equipeNom = lu.equipes.find((x) => x.id === p.equipeId)?.nom ?? 'l’équipe';
	const texte = present ? `Vous êtes en renfort de l’${equipeNom} : ${texteTranche(p)}.` : `Vous n’êtes plus d’astreinte : ${texteTranche(p)}.`;
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
	if (!lu.e || lu.plages.length === 0) throw new DonneeInvalide('Proposez d’abord l’été');
	if (lu.e.publiee) return;
	const textes = new Map<number, string[]>();
	const dire = (id: number, t: string) => textes.set(id, [...(textes.get(id) ?? []), t]);
	for (const s of lu.semaines) {
		const plages = lu.plagesEte.filter((p) => p.semaine === s.debut);
		const ecarts = plages.map((p) => lu.plages.find((x) => x.debut === p.debut)).filter((x): x is PlageLue => x !== undefined);
		const equipeNom = lu.equipes.find((x) => x.id === s.equipeId)?.nom ?? 'l’équipe';
		for (const id of new Set(ecarts.flatMap((x) => x.ajoutes))) dire(id, `vous êtes en renfort de l’${equipeNom} la semaine du ${jourEnLettres(s.debut)}`);
		for (const id of new Set(ecarts.flatMap((x) => x.retires.filter((r) => !enVacances(lu.vacances, r, x))))) dire(id, `vous n’êtes pas d’astreinte sur une partie de la semaine du ${jourEnLettres(s.debut)}`);
	}
	await base.batch([
		base.update(ete).set({ publieeLe: maintenant }).where(and(eq(ete.annee, annee), isNull(ete.publieeLe))),
		journal(base, acteur, 'publier_ete', { annee }, maintenant),
		...[...textes].flatMap(([id, t]) => avis(base, [id], 'repartition', `Planning d’été : ${t.join(' ; ')}.`, '/planning', maintenant))
	]);
}

// L'onglet « Été » du fichier du planning : une ligne par agent, une colonne par plage (« 25/06 nuit »), « X » s'il est présent.
const colonnePlage = (p: Periode) => {
	const duree = (Date.parse(`${p.fin}:00Z`) - Date.parse(`${p.debut}:00Z`)) / 3_600_000;
	return `${p.debut.slice(8, 10)}/${p.debut.slice(5, 7)} ${duree === 24 ? '24 h' : p.debut.slice(11, 16) >= '17:00' ? 'nuit' : p.debut.slice(11, 16)}`;
};
export const ENTETES_ETE = ['N°', 'Agent', 'Équipe'];

// Rien tant que l'été n'est pas proposé.
export async function feuilleEte(base: Base, annee: number, aujourdhui: string, reglage: Reglage) {
	const lu = await lireEte(base, annee, aujourdhui, reglage);
	if (lu.plages.length === 0) return null;
	const presences = lu.plagesEte.map((p) => new Set(presentsDe(lu, p, lu.plages.find((x) => x.debut === p.debut))));
	const agents = [...lu.agents].sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
	const equipeDe = (id: number) => lu.equipes.find((e) => e.id === equipeLe(lu.affectationsDe(id), lu.plagesEte[0]!.semaine))?.nom ?? '';
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
		if (!lu.agents.some((a) => a.id === id)) {
			erreurs.push({ ligne: l.numero, message: `N° « ${l.cellules[0] ?? ''} » : agent inconnu` });
			continue;
		}
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
