import { eq, inArray, sql } from 'drizzle-orm';

const parmi = (ids: number[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;
import { MANOEUVRES_PAR_DEFAUT, type ReglageManoeuvres } from '@gyro-caserne/centre';
import type { Base } from '../base.ts';
import { texte } from '../commun.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide } from '../erreurs.ts';
import { dateFichier, dateIso } from '../fichier-effectif.ts';
import { ligneJournal } from '../journal.ts';
import { nomActeur } from '../actions/personnes.ts';
import { anneePlanning, manoeuvre, publication, semaineChangee, vacancesScolaires } from '../schema.ts';
import { avisSemainesChangees, colonnesExistante, ecrituresModification, ecrituresRetrait, exigerAVenir, preparerAnnee, type Preparation } from './annee.ts';
import { calculerAnnee, fetes, type Fete, type Reglage } from './calendrier.ts';
import { analyserFeuilleEte, feuilleEte } from './repartition.ts';

// Le fichier du planning : l'année dans un classeur (Semaines, Manœuvres, Vacances scolaires), relu avec un aperçu avant d'être appliqué.
// Les fériés sont calculés : ils ne sont pas dans le fichier.

export const FEUILLES = { semaines: 'Semaines', manoeuvres: 'Manœuvres', vacances: 'Vacances scolaires', ete: 'Été' } as const;
export const ENTETES_PLANNING = {
	semaines: ['N°', 'Du', 'Au', 'Équipe'],
	// « Réf. » : le numéro de la manœuvre dans l'appli ; vide pour une nouvelle.
	manoeuvres: ['Réf.', 'Date', 'Début', 'Fin', 'Thème', 'Lieu', 'Équipes', 'Petit-déjeuner'],
	vacances: ['Nom', 'Du', 'Au']
} as const;
export const TOUTES = 'Toutes';

export type Feuille = { nom: string; entetes: string[]; lignes: string[][]; listes: Record<string, string[]> };
export type DonneesFichierPlanning = { annee: number; feuilles: Feuille[] };
// `entetes` : la première ligne de chaque feuille (l'onglet Été en a besoin : une colonne par plage).
export type FichierPlanningLu = { feuilles: Record<string, { numero: number; cellules: string[] }[]>; entetes?: Record<string, string[]> };

export type ApercuPlanning = {
	semaines: { debut: string; numero: number; avant: string; apres: string }[];
	manoeuvres: { ajoutees: { debut: string; theme: string }[]; modifiees: { debut: string; theme: string }[]; retirees: { debut: string; theme: string; annoncee: boolean }[] };
	vacances: { ajoutees: { nom: string; debut: string; fin: string }[]; retirees: { nom: string; debut: string; fin: string }[] };
	// Une fête qui change d'équipe ; `horsTour` : la nouvelle n'est pas parmi celles dont c'est le tour.
	fetes: { fete: Fete; avant: string | null; apres: string | null; horsTour: boolean }[];
	// L'onglet Été : présences ajoutées et retirées.
	ete: { ajouts: number; retraits: number };
	erreurs: { feuille: string; ligne: number; message: string }[];
};

const nomEquipe = (p: Preparation, id: number | null) => (id === null ? null : (p.equipes.find((e) => e.id === id)?.nom ?? 'Équipe archivée'));

// Les semaines de l'année : celles enregistrées, ou le roulement proposé pour une année vide.
const semainesDe = (p: Preparation, reglage: Reglage) => (p.semaines.length ? p.semaines : calculerAnnee(p.annee, reglage, p.ordrePropose, new Map()));

// Les équipes actives (celles de l'ordre proposé), numérotées dans l'ordre du centre : « 1, 3 ».
const actives = (p: Preparation) => p.equipes.filter((e) => p.ordrePropose.includes(e.id));

export async function donneesFichierPlanning(base: Base, acteur: Acteur, annee: number, maintenant: string, reglage: Reglage): Promise<DonneesFichierPlanning> {
	const p = await preparerAnnee(base, acteur, annee, maintenant, reglage);
	const ete = await feuilleEte(base, annee, maintenant.slice(0, 10), reglage);
	const equipes = actives(p);
	const numero = (id: number) => String(equipes.findIndex((e) => e.id === id) + 1);
	const fin = (debut: string) => {
		const d = new Date(`${debut}T00:00:00Z`);
		d.setUTCDate(d.getUTCDate() + 7);
		return d.toISOString().slice(0, 10);
	};
	return {
		annee,
		feuilles: [
			{
				nom: FEUILLES.semaines,
				entetes: [...ENTETES_PLANNING.semaines],
				lignes: semainesDe(p, reglage).map((s) => [`S${s.numero}`, dateFichier(s.debut), dateFichier(fin(s.debut)), nomEquipe(p, s.equipeId) ?? '']),
				listes: { Équipe: equipes.map((e) => e.nom) }
			},
			{
				nom: FEUILLES.manoeuvres,
				entetes: [...ENTETES_PLANNING.manoeuvres],
				lignes: p.manoeuvres
					.filter((m) => !m.annulee)
					.map((m) => [String(m.id), dateFichier(m.debut.slice(0, 10)), m.debut.slice(11, 16), memeJour(m) ? m.fin.slice(11, 16) : '', m.theme, m.lieu, m.convoques === 'tous' ? TOUTES : m.convoques.map(numero).filter((n) => n !== '0').join(', '), m.petitDejeuner ? 'Oui' : 'Non']),
				listes: { 'Petit-déjeuner': ['Oui', 'Non'] }
			},
			{ nom: FEUILLES.vacances, entetes: [...ENTETES_PLANNING.vacances], lignes: p.vacances.map((v) => [v.nom, dateFichier(v.debut), dateFichier(v.fin)]), listes: {} },
			// L'été, une fois la répartition proposée.
			...(ete ? [{ nom: FEUILLES.ete, entetes: ete.entetes, lignes: ete.lignes, listes: {} }] : [])
		]
	};
}

// Lit une heure « 8:30 », « 08:30 » ou « 8 h 30 ».
function heureDe(brut: string): string | null {
	const m = /^(\d{1,2})\s*(?::|h)\s*(\d{2})?$/i.exec(brut.trim());
	if (!m) return null;
	const h = Number(m[1]);
	const min = Number(m[2] ?? '0');
	return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
}

const memeJour = (m: { debut: string; fin: string }) => m.fin.slice(0, 10) === m.debut.slice(0, 10);
const enMinutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
// Au-delà de minuit : rendu tel quel (« 24:15 »), donc refusé comme fin.
const minutesEnHeure = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

type Analyse = Awaited<ReturnType<typeof analyser>>;

async function analyser(base: Base, acteur: Acteur, annee: number, lu: FichierPlanningLu, maintenant: string, reglage: Reglage, reglageManoeuvres: ReglageManoeuvres) {
	const p = await preparerAnnee(base, acteur, annee, maintenant, reglage);
	const erreurs: ApercuPlanning['erreurs'] = [];
	const equipes = actives(p);
	const parNom = (nom: string) => p.equipes.find((e) => e.nom.toLocaleLowerCase('fr') === nom.trim().toLocaleLowerCase('fr'));
	const m = maintenant.slice(0, 16);

	lu = { ...lu, feuilles: { ...lu.feuilles } };
	// Les colonnes de chaque onglet, dans l'ordre de l'export : une colonne déplacée décalerait les données.
	for (const cle of ['semaines', 'manoeuvres', 'vacances'] as const) {
		const lues = lu.entetes?.[FEUILLES[cle]];
		const attendues = ENTETES_PLANNING[cle];
		if (lu.feuilles[FEUILLES[cle]] && lues && attendues.some((t, i) => (lues[i] ?? '').trim() !== t)) {
			erreurs.push({ feuille: FEUILLES[cle], ligne: 1, message: `Colonnes attendues, dans l’ordre : ${attendues.join(', ')}` });
			delete lu.feuilles[FEUILLES[cle]];
		}
	}

	// Semaines : l'équipe voulue pour chaque jour de relève.
	const semaines = semainesDe(p, reglage);
	const choix = new Map<string, number>();
	for (const l of lu.feuilles[FEUILLES.semaines] ?? []) {
		const [, du = '', , nom = ''] = l.cellules;
		const debut = dateIso(du);
		const s = debut ? semaines.find((x) => x.debut === debut) : undefined;
		const e = parNom(nom);
		if (!s) erreurs.push({ feuille: FEUILLES.semaines, ligne: l.numero, message: `« ${du} » n’est pas un jour de relève de ${annee}` });
		else if (!e) erreurs.push({ feuille: FEUILLES.semaines, ligne: l.numero, message: nom ? `Équipe « ${nom} » inconnue` : 'Équipe vide' });
		else choix.set(s.debut, e.id);
	}
	const ordre = p.ordre.length ? p.ordre : p.ordrePropose;
	const changees = new Map(semaines.filter((s) => s.changee).map((s) => [s.debut, s.equipeId]));
	for (const [debut, id] of choix) changees.set(debut, id);
	const nouvelles = calculerAnnee(annee, reglage, ordre, changees);
	const semainesChangees = nouvelles
		.map((s, i) => ({ s, avant: semaines[i]!.equipeId }))
		.filter(({ s, avant }) => s.equipeId !== avant)
		.map(({ s, avant }) => ({ debut: s.debut, numero: s.numero, avant: nomEquipe(p, avant) ?? '', apres: nomEquipe(p, s.equipeId) ?? '' }));
	// Année publiée : une semaine commencée ne change plus d'équipe.
	const changements = nouvelles.map((s, i) => ({ semaine: semaines[i]!, apres: s.equipeId })).filter((c) => c.semaine.equipeId !== c.apres);
	if (p.publiee) {
		for (const c of changements) {
			try {
				exigerAVenir(c.semaine, maintenant);
			} catch (e) {
				const l = (lu.feuilles[FEUILLES.semaines] ?? []).find((x) => dateIso(x.cellules[1] ?? '') === c.semaine.debut);
				erreurs.push({ feuille: FEUILLES.semaines, ligne: l?.numero ?? 1, message: (e as Error).message });
			}
		}
	}

	// Fêtes : celles qui changent d'équipe, et si c'est hors du tour.
	const fAvant = fetes(annee, semaines);
	const fApres = fetes(annee, nouvelles);
	const fetesChangees: ApercuPlanning['fetes'] = [];
	for (const [fete, avant, apres, attendues] of [
		['noel', fAvant.noel, fApres.noel, p.fetes.attendues.noel],
		['nouvel_an', fAvant.nouvelAn, fApres.nouvelAn, p.fetes.attendues.nouvelAn]
	] as const) {
		if (avant !== apres) fetesChangees.push({ fete, avant: nomEquipe(p, avant), apres: nomEquipe(p, apres), horsTour: apres !== null && attendues.length > 0 && !attendues.includes(apres) });
	}

	// Manœuvres : une ligne avec Réf. modifie, sans Réf. ajoute ; une manœuvre à venir absente du fichier est retirée.
	const existantes = new Map(p.manoeuvres.filter((x) => !x.annulee).map((x) => [x.id, x]));
	const vues = new Set<number>();
	const ajouts: { debut: string; fin: string; theme: string; lieu: string; convoques: string; petitDejeuner: number }[] = [];
	const modifications: (typeof ajouts[number] & { id: number })[] = [];
	for (const l of lu.feuilles[FEUILLES.manoeuvres] ?? []) {
		const [ref = '', jour = '', h = '', f = '', theme = '', lieu = '', pour = '', pdj = ''] = l.cellules;
		const erreur = (message: string) => erreurs.push({ feuille: FEUILLES.manoeuvres, ligne: l.numero, message });
		const id = ref.trim() === '' ? null : Number(ref);
		const existante = id === null ? undefined : existantes.get(id);
		if (id !== null && !existante) {
			erreur(`Réf. ${ref} inconnue : laissez-la vide pour une nouvelle manœuvre`);
			continue;
		}
		if (id !== null) vues.add(id);
		const date = dateIso(jour);
		const heure = heureDe(h);
		if (!date) {
			erreur(`Date « ${jour} » invalide (JJ/MM/AAAA)`);
			continue;
		}
		if (!date.startsWith(`${annee}-`)) {
			erreur(`Date hors de ${annee}`);
			continue;
		}
		if (!heure) {
			erreur(`Heure « ${h} » invalide (HH:MM)`);
			continue;
		}
		// Fin vide : celle d'une manœuvre déjà là (une ancienne du soir peut finir le lendemain), sinon la durée réglée par le centre.
		const vide = f.trim() === '';
		const garder = vide && existante && !memeJour(existante) && existante.debut === `${date}T${heure}`;
		const fin = vide ? minutesEnHeure(enMinutes(heure) + enMinutes(reglageManoeuvres.fin) - enMinutes(reglageManoeuvres.debut)) : heureDe(f);
		if (fin === null) {
			erreur(`Fin « ${f} » invalide (HH:MM)`);
			continue;
		}
		if (!garder && vide && fin >= '24:00') {
			erreur('Fin vide : la durée réglée par le centre passerait minuit, indiquez la fin');
			continue;
		}
		if (!garder && (fin <= heure || fin >= '24:00')) {
			erreur('La fin doit suivre le début, le même jour');
			continue;
		}
		let convoques: 'tous' | number[] = 'tous';
		if (pour.trim() !== '' && pour.trim().toLocaleLowerCase('fr') !== TOUTES.toLocaleLowerCase('fr')) {
			const morceaux = pour.split(',').map((x) => x.trim()).filter(Boolean);
			const trouvees = morceaux.map((x) => (/^\d+$/.test(x) ? equipes[Number(x) - 1] : parNom(x)));
			const inconnue = morceaux.find((_, i) => !trouvees[i]);
			if (inconnue !== undefined) {
				erreur(`Équipe « ${inconnue} » inconnue`);
				continue;
			}
			convoques = [...new Set(trouvees.map((e) => e!.id))];
		}
		const petitDejeuner = /^oui$/i.test(pdj.trim()) ? 1 : 0;
		let valeurs;
		try {
			valeurs = { debut: `${date}T${heure}`, fin: garder ? existante.fin : `${date}T${fin}`, theme: texte(theme, 'Thème', 100), lieu: texte(lieu, 'Lieu', 200), convoques: JSON.stringify(convoques), petitDejeuner };
		} catch (e) {
			erreur(e instanceof Error ? e.message : String(e));
			continue;
		}
		if (existante) {
			const pareil = existante.debut === valeurs.debut && existante.fin === valeurs.fin && existante.theme === valeurs.theme && existante.lieu === valeurs.lieu && JSON.stringify(existante.convoques) === valeurs.convoques && Number(existante.petitDejeuner) === petitDejeuner;
			if (pareil) continue;
			if (existante.debut < m) erreur('Manœuvre passée : elle ne se modifie plus');
			else if (valeurs.debut < m) erreur('Cette date est déjà passée');
			else modifications.push({ ...valeurs, id: existante.id });
		} else if (valeurs.debut < m) erreur('Cette date est déjà passée');
		else ajouts.push(valeurs);
	}
	// Une feuille absente du fichier ne change rien.
	const retraits = lu.feuilles[FEUILLES.manoeuvres] ? [...existantes.values()].filter((x) => !vues.has(x.id) && x.debut >= m) : [];

	// Vacances scolaires : comparées ligne à ligne (nom, du, au).
	const cle = (v: { nom: string; debut: string; fin: string }) => `${v.nom}|${v.debut}|${v.fin}`;
	const voulues = new Map<string, { nom: string; debut: string; fin: string }>();
	for (const l of lu.feuilles[FEUILLES.vacances] ?? []) {
		const [nom = '', du = '', au = ''] = l.cellules;
		const debut = dateIso(du);
		const fin = dateIso(au);
		const erreur = (message: string) => erreurs.push({ feuille: FEUILLES.vacances, ligne: l.numero, message });
		if (!nom.trim()) erreur('Nom vide');
		else if (nom.trim().length > 60) erreur('Nom trop long');
		else if (!debut || !fin) erreur('Dates invalides (JJ/MM/AAAA)');
		else if (fin < debut) erreur('Fin avant le début');
		else voulues.set(cle({ nom: nom.trim(), debut, fin }), { nom: nom.trim(), debut, fin });
	}
	const enPlace = new Map(p.vacances.map((v) => [cle(v), v]));
	if (!lu.feuilles[FEUILLES.vacances]) for (const [k, v] of enPlace) voulues.set(k, v);

	// L'été : seulement si l'onglet est dans le fichier.
	const feuille = lu.feuilles[FEUILLES.ete];
	const ete = feuille ? await analyserFeuilleEte(base, annee, lu.entetes?.[FEUILLES.ete] ?? [], feuille, maintenant, reglage) : null;
	for (const x of ete?.erreurs ?? []) erreurs.push({ feuille: FEUILLES.ete, ligne: x.ligne, message: x.message });

	const apercu: ApercuPlanning = {
		semaines: semainesChangees,
		manoeuvres: {
			ajoutees: ajouts.map(({ debut, theme }) => ({ debut, theme })),
			modifiees: modifications.map(({ debut, theme }) => ({ debut, theme })),
			retirees: retraits.map((x) => ({ debut: x.debut, theme: x.theme, annoncee: x.publiee }))
		},
		vacances: { ajoutees: [...voulues].filter(([k]) => !enPlace.has(k)).map(([, v]) => v), retirees: [...enPlace].filter(([k]) => !voulues.has(k)).map(([, v]) => ({ nom: v.nom, debut: v.debut, fin: v.fin })) },
		fetes: fetesChangees,
		ete: { ajouts: ete?.changements.filter((c) => c.present).length ?? 0, retraits: ete?.changements.filter((c) => !c.present).length ?? 0 },
		erreurs
	};
	return { p, apercu, changements, ecrituresEte: ete?.ecritures ?? (() => []), ordre, choix, semaines, ajouts, modifications, retraits, vacancesRetirees: [...enPlace].filter(([k]) => !voulues.has(k)).map(([, v]) => v.id) };
}

// `reglageManoeuvres` : celui du centre (durée d'une manœuvre sans fin, choix du petit-déjeuner).
export async function apercuPlanning(base: Base, acteur: Acteur, annee: number, lu: FichierPlanningLu, maintenant: string, reglage: Reglage, reglageManoeuvres: ReglageManoeuvres = MANOEUVRES_PAR_DEFAUT): Promise<ApercuPlanning> {
	return (await analyser(base, acteur, annee, lu, maintenant, reglage, reglageManoeuvres)).apercu;
}

// Applique le fichier d'un bloc : tout ou rien. Rend les manœuvres annoncées qui ont changé, pour prévenir leurs convoqués.
export async function appliquerPlanning(base: Base, acteur: Acteur, annee: number, lu: FichierPlanningLu, maintenant: string, reglage: Reglage, reglageManoeuvres: ReglageManoeuvres = MANOEUVRES_PAR_DEFAUT): Promise<{ changees: number[] }> {
	const a: Analyse = await analyser(base, acteur, annee, lu, maintenant, reglage, reglageManoeuvres);
	if (a.apercu.erreurs.length > 0) throw new DonneeInvalide('Le fichier a des erreurs');
	const ecritures = [];
	// Année vide : le roulement proposé est enregistré.
	if (a.p.ordre.length === 0) ecritures.push(base.insert(anneePlanning).values({ annee, ordre: JSON.stringify(a.ordre) }).onConflictDoUpdate({ target: anneePlanning.annee, set: { ordre: JSON.stringify(a.ordre) } }));
	a.semaines.forEach((s, i) => {
		const voulue = a.choix.get(s.debut);
		if (voulue === undefined || voulue === s.equipeId) return;
		ecritures.push(
			voulue === a.ordre[i % a.ordre.length]
				? base.delete(semaineChangee).where(eq(semaineChangee.debut, s.debut))
				: base.insert(semaineChangee).values({ debut: s.debut, equipeId: voulue }).onConflictDoUpdate({ target: semaineChangee.debut, set: { equipeId: voulue } })
		);
	});
	for (const v of a.ajouts) ecritures.push(base.insert(manoeuvre).values(v));
	const lues = a.modifications.length ? await base.select({ id: manoeuvre.id, ...colonnesExistante }).from(manoeuvre).leftJoin(publication, eq(publication.id, manoeuvre.publicationId)).where(inArray(manoeuvre.id, parmi(a.modifications.map((x) => x.id)))) : [];
	for (const { id, ...v } of a.modifications) ecritures.push(...ecrituresModification(base, id, lues.find((x) => x.id === id)!, v, maintenant, reglageManoeuvres.petitDejeuner));
	for (const x of a.retraits) ecritures.push(...ecrituresRetrait(base, x.id, x.publicationId, maintenant));
	for (const v of a.apercu.vacances.ajoutees) ecritures.push(base.insert(vacancesScolaires).values(v));
	if (a.vacancesRetirees.length) ecritures.push(base.delete(vacancesScolaires).where(inArray(vacancesScolaires.id, parmi(a.vacancesRetirees))));
	ecritures.push(...a.ecrituresEte());
	if (a.p.publiee) ecritures.push(...(await avisSemainesChangees(base, a.changements, maintenant)));
	const { semaines, manoeuvres, vacances } = a.apercu;
	const details = { annee, ete: a.apercu.ete.ajouts + a.apercu.ete.retraits, semaines: semaines.length, manoeuvres: manoeuvres.ajoutees.length + manoeuvres.modifiees.length + manoeuvres.retirees.length, vacances: vacances.ajoutees.length + vacances.retirees.length };
	await base.batch([ligneJournal(base, { acteur: nomActeur(acteur), action: 'importer_planning', cibleType: 'planning', cibleId: null, details }, maintenant), ...ecritures]);
	return { changees: [...a.modifications.map((x) => x.id), ...a.retraits.map((x) => x.id)].filter((id) => a.p.manoeuvres.find((x) => x.id === id)?.publiee) };
}
