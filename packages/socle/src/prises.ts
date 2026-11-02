import { and, asc, desc, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { instruction, type Base, type BasePhotos } from './base.ts';
import { avecPhotos, effacerPhotos, exigerPhotos, lireOctets, type Photo } from './commun.ts';
import { ajouterJours, enCours, exigerDateHeure } from './dates.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { lireEngin, voitLesEngins, type EnginVu } from './engins.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import type { ElementFiche, ZoneFiche } from './fiches.ts';
import { avisAnomalies, quiTraite } from './anomalies-avis.ts';
import { GENRES_ECART, STATUTS_AVEC_ACCES, type EtapeAnomalie, type EtatPrise, type GenreEcart, type MotifAttente } from './listes.ts';
import { anneesPubliees } from './planning/annee.ts';
import { rangDuJour, type Reglage } from './planning/calendrier.ts';
import { affectationEquipe, anneePlanning, anomalie, engin, equipe, ficheElement, ficheVersion, ficheZone, personne, priseGarde, profil, semaineChangee, typeEngin } from './schema.ts';

// La prise de garde : à la relève, l'équipe d'astreinte vérifie chaque engin zone par zone. Un brouillon sur le serveur
// (une prise par engin et par relève), repris par n'importe qui ; à la validation, chaque écart devient une anomalie.

export type Ecart = { genre: GenreEcart; manque: number | null; note: string; photo: number | null };
// `zones` : refs des zones vues ; `ecarts` : par ref d'élément ; `retrouves` : anomalies ouvertes à clore ; `participants` : personnes.
export type Saisie = { zones: number[]; ecarts: Record<string, Ecart>; retrouves: number[]; participants: number[] };
export const SAISIE_VIDE: Saisie = { zones: [], ecarts: {}, retrouves: [], participants: [] };

export type GestePrise =
	| { quoi: 'zone'; zone: number; vue: boolean }
	| { quoi: 'ecart'; element: number; genre: GenreEcart; manque: number | null; note: string; photo?: Photo | null }
	| { quoi: 'retirer_ecart'; element: number }
	| { quoi: 'retrouve'; anomalie: number; oui: boolean }
	| { quoi: 'participants'; ids: number[] };

export type EquipeReleve = { id: number; nom: string; couleur: string };
export type Releve = { debut: string; equipe: EquipeReleve | null };
export type AnomalieVue = { id: number; ref: number | null; zone: string; libelle: string; genre: GenreEcart; manque: number | null; note: string | null; photo: number | null; signaleeLe: string; signaleePar: string; etape: EtapeAnomalie; motif: MotifAttente | null; bloquante: boolean };
export type PriseVue = { id: number; etat: EtatPrise; commenceePar: string; commenceeLe: string; modifieePar: string; modifieeLe: string; valideeLe: string | null; saisie: Saisie };
export type AgentPrise = { id: number; nom: string; astreinte: boolean };
export type VuePrise = { engin: EnginVu; releve: Releve; peutFaire: boolean; prise: PriseVue | null; zones: ZoneFiche[]; ouvertes: AnomalieVue[]; agents: AgentPrise[] };

export const LIMITES_PRISE = { note: 300, participants: 60 } as const;
// On peut commencer la prise deux heures avant la relève ; elle est en retard trois heures après.
const AVANCE_MIN = 120;
const RETARD_MIN = 180;
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// « AAAA-MM-JJTHH:MM » décalé de `minutes`.
function decaler(moment: string, minutes: number): string {
	return new Date(new Date(`${moment.slice(0, 16)}:00Z`).getTime() + minutes * 60_000).toISOString().slice(0, 16);
}

// La relève en cours : le dernier moment de prise d'astreinte commencé (deux heures d'avance comprises).
export function releveDe(maintenant: string, reglage: Reglage): string {
	exigerDateHeure(maintenant, 'Date');
	const m = decaler(maintenant, AVANCE_MIN);
	const jour = m.slice(0, 10);
	const date = ajouterJours(jour, -((rangDuJour(jour) - JOURS.indexOf(reglage.debut.jour) + 7) % 7));
	const moment = `${date}T${reglage.debut.heure}`;
	return moment <= m ? moment : `${ajouterJours(date, -7)}T${reglage.debut.heure}`;
}

// L'équipe d'astreinte d'une relève, d'après le planning publié de son année : trois lectures à placer dans un batch.
function lecturesEquipe(base: Base, releve: string) {
	const annee = Number(releve.slice(0, 4));
	return [
		base.select().from(anneePlanning).where(eq(anneePlanning.annee, annee)),
		base.select().from(semaineChangee).where(sql`substr(${semaineChangee.debut}, 1, 4) = ${String(annee)}`),
		base.select({ id: equipe.id, nom: equipe.nom, couleur: equipe.couleur }).from(equipe)
	] as const;
}
// L'équipe d'astreinte de la relève en cours (son identifiant), ou rien sans planning publié. Une requête.
export async function equipeAstreinte(base: Base, maintenant: string, reglage: Reglage): Promise<number | null> {
	const releve = releveDe(maintenant, reglage);
	const [annees, changees, equipes] = await base.batch([...lecturesEquipe(base, releve)]);
	return equipeDe(releve, annees, changees, equipes, reglage)?.id ?? null;
}
function equipeDe(releve: string, annees: (typeof anneePlanning.$inferSelect)[], changees: { debut: string; equipeId: number }[], equipes: EquipeReleve[], reglage: Reglage): EquipeReleve | null {
	const semaine = anneesPubliees(annees, changees, reglage)
		.get(Number(releve.slice(0, 4)))
		?.find((s) => s.debut === releve.slice(0, 10));
	return (semaine && equipes.find((e) => e.id === semaine.equipeId)) ?? null;
}

const nomComplet = (p: { prenom: string; nom: string } | undefined) => (p ? `${p.prenom} ${p.nom}` : 'Un ancien agent');
const lireSaisie = (texte: string): Saisie => ({ ...SAISIE_VIDE, ...(JSON.parse(texte) as Partial<Saisie>) });

// Faire la prise : FAIRE_PRISE_DE_GARDE sur le centre, et être un agent (la prise est au nom de personnes).
export async function peutFairePrise(base: Base, acteur: Acteur, aujourdhui: string): Promise<boolean> {
	return acteur.type === 'personne' && (await aLeDroit(base, acteur, 'FAIRE_PRISE_DE_GARDE', { type: 'centre' }, aujourdhui));
}
async function exigerPrise(base: Base, acteur: Acteur, maintenant: string): Promise<number> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux agents');
	if (!(await peutFairePrise(base, acteur, aujourdhui))) throw new RefusDroit('FAIRE_PRISE_DE_GARDE', { type: 'centre' });
	return acteur.id;
}

// Les zones et éléments d'une version de fiche (celle de la prise, ou la dernière du type), à placer dans un batch.
function lecturesVersion(base: Base, version: SQL<number>) {
	return [
		base.select({ id: ficheZone.id, ref: ficheZone.ref, nom: ficheZone.nom }).from(ficheZone).where(eq(ficheZone.versionId, version)).orderBy(asc(ficheZone.ordre)),
		base.select({ zoneId: ficheElement.zoneId, ref: ficheElement.ref, libelle: ficheElement.libelle, quantite: ficheElement.quantite }).from(ficheElement).where(eq(ficheElement.versionId, version)).orderBy(asc(ficheElement.ordre))
	] as const;
}
function zonesDe(zones: { id: number; ref: number; nom: string }[], elements: ({ zoneId: number } & ElementFiche)[]): ZoneFiche[] {
	return zones.map((z) => ({ ref: z.ref, nom: z.nom, elements: elements.filter((e) => e.zoneId === z.id).map(({ ref, libelle, quantite }) => ({ ref, libelle, quantite })) }));
}

const colonnesAnomalie = {
	id: anomalie.id,
	ref: anomalie.ref,
	zone: anomalie.zone,
	libelle: anomalie.libelle,
	genre: anomalie.genre,
	manque: anomalie.manque,
	note: anomalie.note,
	photo: anomalie.photoId,
	signaleeLe: anomalie.signaleeLe,
	etape: anomalie.etape,
	motif: anomalie.motifAttente,
	bloquante: anomalie.bloquante,
	prenom: personne.prenom,
	nom: personne.nom
};
const ouvertesDe = (base: Base, enginId: number) =>
	base.select(colonnesAnomalie).from(anomalie).innerJoin(personne, eq(personne.id, anomalie.signaleePar)).where(and(eq(anomalie.enginId, enginId), isNull(anomalie.closeLe))).orderBy(asc(anomalie.id));
const vueAnomalie = ({ prenom, nom, bloquante, ...a }: { prenom: string; nom: string; bloquante: number } & Omit<AnomalieVue, 'signaleePar' | 'bloquante'>): AnomalieVue => ({ ...a, bloquante: bloquante === 1, signaleePar: `${prenom} ${nom}` });

// La prise d'un engin pour la relève en cours : le brouillon (ou la prise faite), la fiche suivie, les anomalies encore ouvertes
// et les agents à cocher (l'équipe d'astreinte d'abord).
export async function lirePrise(base: Base, acteur: Acteur, enginId: number, maintenant: string, reglage: Reglage): Promise<VuePrise> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const { engin: e } = await lireEngin(base, acteur, enginId, aujourdhui);
	const releve = releveDe(maintenant, reglage);
	const laPrise = and(eq(priseGarde.enginId, enginId), eq(priseGarde.releve, releve));
	const version = sql<number>`coalesce((SELECT ${priseGarde.versionId} FROM ${priseGarde} WHERE ${laPrise}), (SELECT max(${ficheVersion.id}) FROM ${ficheVersion} WHERE ${ficheVersion.typeId} = ${e.typeId}))`;
	const [prises, zones, elements, ouvertes, annees, changees, equipes, agents, affectations] = await base.batch([
		base.select().from(priseGarde).where(laPrise),
		...lecturesVersion(base, version),
		ouvertesDe(base, enginId),
		...lecturesEquipe(base, releve),
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom })
			.from(personne)
			.innerJoin(profil, eq(profil.id, personne.profilId))
			.where(and(inArray(personne.statut, [...STATUTS_AVEC_ACCES]), eq(profil.typePersonne, 'agent')))
			.orderBy(asc(personne.nom), asc(personne.prenom)),
		base.select().from(affectationEquipe)
	]);
	const eq_ = equipeDe(releve, annees, changees, equipes, reglage);
	const p = prises[0];
	const noms = new Map(agents.map((a) => [a.id, `${a.prenom} ${a.nom}`]));
	const autres = p ? await nomsDe(base, [p.commenceePar, p.modifieePar].filter((id) => !noms.has(id))) : new Map<number, string>();
	const nom = (id: number) => noms.get(id) ?? autres.get(id) ?? 'Un ancien agent';
	const dAstreinte = (id: number) => eq_ !== null && affectations.some((a) => a.personneId === id && a.equipeId === eq_.id && enCours(a.debut, a.fin, aujourdhui));
	return {
		engin: e,
		releve: { debut: releve, equipe: eq_ },
		peutFaire: e.situation !== 'parti' && (await peutFairePrise(base, acteur, aujourdhui)),
		prise: p
			? { id: p.id, etat: p.etat, commenceePar: nom(p.commenceePar), commenceeLe: p.commenceeLe, modifieePar: nom(p.modifieePar), modifieeLe: p.modifieeLe, valideeLe: p.valideeLe, saisie: lireSaisie(p.saisie) }
			: null,
		zones: zonesDe(zones, elements),
		ouvertes: ouvertes.map(vueAnomalie),
		agents: agents.map((a) => ({ id: a.id, nom: `${a.prenom} ${a.nom}`, astreinte: dAstreinte(a.id) })).sort((a, b) => Number(b.astreinte) - Number(a.astreinte))
	};
}

async function nomsDe(base: Base, ids: number[]): Promise<Map<number, string>> {
	if (ids.length === 0) return new Map();
	const lignes = await base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne).where(inArray(personne.id, ids));
	return new Map(lignes.map((l) => [l.id, nomComplet(l)]));
}

// Commencer la prise d'un engin pour la relève en cours ; si un collègue l'a déjà commencée, c'est la sienne qu'on reprend.
// La version de fiche suivie est marquée utilisée : la modifier en crée une nouvelle, la prise garde la sienne.
// Un brouillon d'une relève passée, jamais validé, ne se reprend plus : il est effacé, ses photos aussi.
export async function commencerPrise(base: Base, basePhotos: BasePhotos, acteur: Acteur, enginId: number, maintenant: string, reglage: Reglage): Promise<number> {
	const moi = await exigerPrise(base, acteur, maintenant);
	const releve = releveDe(maintenant, reglage);
	const passes = and(eq(priseGarde.enginId, enginId), eq(priseGarde.etat, 'en_cours'), ne(priseGarde.releve, releve));
	const [[e], anciens, [version], annees, changees, equipes] = await base.batch([
		base.select({ situation: engin.situation, typeId: engin.typeId }).from(engin).where(eq(engin.id, enginId)),
		base.select({ saisie: priseGarde.saisie }).from(priseGarde).where(passes),
		base.select({ id: sql<number>`max(${ficheVersion.id})` }).from(ficheVersion).innerJoin(engin, eq(engin.typeId, ficheVersion.typeId)).where(eq(engin.id, enginId)),
		...lecturesEquipe(base, releve)
	]);
	if (!e) throw new DonneeInvalide('Engin inconnu');
	if (e.situation === 'parti') throw new DonneeInvalide('Engin parti');
	if (!version?.id) throw new DonneeInvalide('Type inconnu');
	const equipeId = equipeDe(releve, annees, changees, equipes, reglage)?.id ?? null;
	const saisie: Saisie = { ...SAISIE_VIDE, participants: [moi] };
	const [, , , [ligne]] = await base.batch([
		base.delete(priseGarde).where(passes),
		base
			.insert(priseGarde)
			.values({ enginId, releve, versionId: version.id, equipeId, saisie: JSON.stringify(saisie), commenceePar: moi, commenceeLe: maintenant, modifieePar: moi, modifieeLe: maintenant })
			.onConflictDoNothing(),
		base.update(ficheVersion).set({ utilisee: 1 }).where(sql`${ficheVersion.id} = (SELECT ${priseGarde.versionId} FROM ${priseGarde} WHERE ${priseGarde.enginId} = ${enginId} AND ${priseGarde.releve} = ${releve})`),
		base.select({ id: priseGarde.id }).from(priseGarde).where(and(eq(priseGarde.enginId, enginId), eq(priseGarde.releve, releve)))
	]);
	await effacerPhotos(basePhotos, anciens.flatMap((a) => photosDe(lireSaisie(a.saisie))));
	return ligne!.id;
}

const entier = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n);

// Applique un geste au brouillon, sans rien écrire. `ouvertes` : anomalies encore ouvertes sur l'engin ; `agents` : personnes cochables.
export function appliquerGestePrise(saisie: Saisie, geste: GestePrise, ctx: { zones: ZoneFiche[]; ouvertes: { id: number; ref: number | null }[]; agents: number[] }): Saisie {
	const element = (ref: number) => {
		const trouve = ctx.zones.flatMap((z) => z.elements).find((e) => e.ref === ref);
		if (!trouve) throw new DonneeInvalide('Élément inconnu');
		return trouve;
	};
	switch (geste.quoi) {
		case 'zone': {
			if (!ctx.zones.some((z) => z.ref === geste.zone)) throw new DonneeInvalide('Zone inconnue');
			const zones = saisie.zones.filter((z) => z !== geste.zone);
			return { ...saisie, zones: geste.vue ? [...zones, geste.zone] : zones };
		}
		case 'ecart': {
			const e = element(geste.element);
			// Un élément encore signalé : on dit d'abord s'il est retrouvé ; retrouvé, il peut avoir un nouvel écart.
			if (ctx.ouvertes.some((o) => o.ref === e.ref && !saisie.retrouves.includes(o.id))) throw new DonneeInvalide('Élément déjà signalé');
			if (!(GENRES_ECART as readonly string[]).includes(geste.genre)) throw new DonneeInvalide('Écart inconnu');
			const note = typeof geste.note === 'string' ? geste.note.trim().replace(/\s+/g, ' ') : '';
			if (note.length > LIMITES_PRISE.note) throw new DonneeInvalide('Note trop longue');
			// Le nombre manquant ne se dit que d'un élément qui se compte ; sans nombre, tout manque.
			const compte = geste.genre === 'manquant' && e.quantite !== null;
			if (compte && geste.manque !== null && !(entier(geste.manque) && geste.manque >= 1 && geste.manque <= e.quantite!)) throw new DonneeInvalide('Nombre manquant invalide');
			const avant = saisie.ecarts[String(e.ref)];
			return { ...saisie, ecarts: { ...saisie.ecarts, [String(e.ref)]: { genre: geste.genre, manque: compte ? geste.manque : null, note, photo: avant?.photo ?? null } } };
		}
		case 'retirer_ecart': {
			const { [String(geste.element)]: _, ...ecarts } = saisie.ecarts;
			return { ...saisie, ecarts };
		}
		case 'retrouve': {
			if (!ctx.ouvertes.some((o) => o.id === geste.anomalie)) throw new DonneeInvalide('Anomalie inconnue');
			const retrouves = saisie.retrouves.filter((id) => id !== geste.anomalie);
			return { ...saisie, retrouves: geste.oui ? [...retrouves, geste.anomalie] : retrouves };
		}
		case 'participants': {
			const ids = [...new Set(geste.ids)];
			if (ids.length > LIMITES_PRISE.participants || ids.some((id) => !ctx.agents.includes(id))) throw new DonneeInvalide('Participant inconnu');
			return { ...saisie, participants: ids };
		}
		default:
			throw new DonneeInvalide('Geste inconnu');
	}
}

// Le brouillon d'une prise et ce qu'il faut pour en vérifier un geste : une requête.
// `enginId` : l'engin de la page ; une prise d'un autre engin est refusée.
async function lireBrouillon(base: Base, id: number, enginId?: number) {
	const version = sql<number>`(SELECT ${priseGarde.versionId} FROM ${priseGarde} WHERE ${priseGarde.id} = ${id})`;
	const [[p], zones, elements, ouvertes, agents] = await base.batch([
		base.select({ prise: priseGarde, situation: engin.situation, nomEngin: sql<string>`${engin.nom}`.as('nom_engin') }).from(priseGarde).innerJoin(engin, eq(engin.id, priseGarde.enginId)).where(eq(priseGarde.id, id)),
		...lecturesVersion(base, version),
		base.select({ id: anomalie.id, ref: anomalie.ref, zone: anomalie.zone, libelle: anomalie.libelle, signaleePar: anomalie.signaleePar, priseEnChargePar: anomalie.priseEnChargePar }).from(anomalie).where(and(sql`${anomalie.enginId} = (SELECT ${priseGarde.enginId} FROM ${priseGarde} WHERE ${priseGarde.id} = ${id})`, isNull(anomalie.closeLe))),
		base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne).innerJoin(profil, eq(profil.id, personne.profilId)).where(and(inArray(personne.statut, [...STATUTS_AVEC_ACCES]), eq(profil.typePersonne, 'agent')))
	]);
	if (!p || (enginId !== undefined && p.prise.enginId !== enginId)) throw new DonneeInvalide('Prise inconnue');
	if (p.situation === 'parti') throw new DonneeInvalide('Engin parti');
	return { prise: p.prise, nomEngin: p.nomEngin, saisie: lireSaisie(p.prise.saisie), zones: zonesDe(zones, elements), ouvertes, agents: agents.map((a) => a.id), noms: new Map(agents.map((a) => [a.id, `${a.prenom} ${a.nom}`])) };
}

function exigerEnCours(p: { etat: EtatPrise; releve: string }, maintenant: string, reglage: Reglage) {
	if (p.etat === 'validee') throw new DonneeInvalide('Prise déjà validée');
	if (p.releve !== releveDe(maintenant, reglage)) throw new DonneeInvalide('Relève passée');
}

// Un geste sur le brouillon. Deux collègues peuvent écrire en même temps : l'écriture est gardée par le compteur et refaite une fois
// sur la saisie relue. Une photo d'écart part d'abord dans la base des photos ; celle qu'elle remplace est effacée.
export async function gestePrise(base: Base, basePhotos: BasePhotos, acteur: Acteur, id: number, geste: GestePrise, maintenant: string, reglage: Reglage, enginId?: number): Promise<void> {
	const moi = await exigerPrise(base, acteur, maintenant);
	const nouvelle = geste.quoi === 'ecart' && geste.photo ? exigerPhotos([geste.photo]) : [];
	await avecPhotos(basePhotos, nouvelle, maintenant, async ([idPhoto]) => {
		for (let essai = 0; ; essai++) {
			const b = await lireBrouillon(base, id, enginId);
			exigerEnCours(b.prise, maintenant, reglage);
			let saisie = appliquerGestePrise(b.saisie, geste, b);
			if (geste.quoi === 'ecart' && geste.photo !== undefined) {
				const cle = String(geste.element);
				saisie = { ...saisie, ecarts: { ...saisie.ecarts, [cle]: { ...saisie.ecarts[cle]!, photo: idPhoto ?? null } } };
			}
			const ecrit = await base
				.update(priseGarde)
				.set({ saisie: JSON.stringify(saisie), compteur: b.prise.compteur + 1, modifieePar: moi, modifieeLe: maintenant })
				.where(and(eq(priseGarde.id, id), eq(priseGarde.compteur, b.prise.compteur), eq(priseGarde.etat, 'en_cours')))
				.returning({ id: priseGarde.id });
			if (ecrit.length > 0) {
				await effacerPhotos(basePhotos, photosDe(b.saisie).filter((ph) => !photosDe(saisie).includes(ph)));
				return;
			}
			if (essai > 0) throw new DonneeInvalide('Prise changée entre-temps');
		}
	});
}

const photosDe = (s: Saisie) => Object.values(s.ecarts).flatMap((e) => (e.photo === null ? [] : [e.photo]));

// Abandonner un brouillon : il est effacé, ses photos aussi.
export async function abandonnerPrise(base: Base, basePhotos: BasePhotos, acteur: Acteur, id: number, maintenant: string, enginId?: number): Promise<void> {
	await exigerPrise(base, acteur, maintenant);
	const [p] = await base
		.delete(priseGarde)
		.where(and(eq(priseGarde.id, id), eq(priseGarde.etat, 'en_cours'), enginId === undefined ? undefined : eq(priseGarde.enginId, enginId)))
		.returning({ saisie: priseGarde.saisie });
	if (!p) throw new DonneeInvalide('Prise inconnue');
	await effacerPhotos(basePhotos, photosDe(lireSaisie(p.saisie)));
}

// Valider : toutes les zones vues. D'un bloc, gardé par le compteur : la prise passe validée (au nom des participants, celui qui
// valide compris), les anomalies retrouvées sont closes, chaque écart devient une anomalie (sauf une déjà ouverte sur le même élément).
// La cloche : les nouvelles anomalies à ceux qui les traitent et au chef de garde de l'équipe d'astreinte ; un élément retrouvé,
// à son déclarant et à qui l'avait pris en charge.
export async function validerPrise(base: Base, acteur: Acteur, id: number, maintenant: string, reglage: Reglage, enginAttendu?: number): Promise<void> {
	const moi = await exigerPrise(base, acteur, maintenant);
	const b = await lireBrouillon(base, id, enginAttendu);
	exigerEnCours(b.prise, maintenant, reglage);
	if (b.zones.some((z) => !b.saisie.zones.includes(z.ref))) throw new DonneeInvalide('Zones à voir');
	const saisie: Saisie = { ...b.saisie, participants: [...new Set([moi, ...b.saisie.participants])] };
	const compteur = b.prise.compteur + 1;
	const validee = sql`EXISTS (SELECT 1 FROM ${priseGarde} WHERE ${priseGarde.id} = ${id} AND ${priseGarde.compteur} = ${compteur} AND ${priseGarde.etat} = 'validee')`;
	const ecarts = JSON.stringify(
		b.zones.flatMap((z) =>
			z.elements.flatMap((e) => {
				const x = saisie.ecarts[String(e.ref)];
				return x ? [{ ref: e.ref, zone: z.nom, libelle: e.libelle, genre: x.genre, manque: x.manque, note: x.note || null, photo: x.photo }] : [];
			})
		)
	);
	const enginId = b.prise.enginId;
	// Un écart sur un élément encore signalé (et non retrouvé) ne crée pas d'anomalie.
	const nouvelles = b.zones.flatMap((z) => z.elements).filter((e) => saisie.ecarts[String(e.ref)] && !b.ouvertes.some((o) => o.ref === e.ref && !saisie.retrouves.includes(o.id)));
	const traitent = nouvelles.length ? (await quiTraite(base, maintenant.slice(0, 10), b.prise.equipeId)).filter((x) => x !== moi) : [];
	const qui = b.noms.get(moi) ?? 'un agent';
	const avis = [
		...avisAnomalies(
			base,
			traitent,
			{ titre: `Prise de garde · ${b.nomEngin}`, texte: `${nouvelles.length} ${nouvelles.length > 1 ? 'anomalies signalées' : 'anomalie signalée'} par ${qui} : ${nouvelles.map((e) => e.libelle).join(', ')}`, url: `/engins/anomalies?engin=${enginId}` },
			maintenant,
			validee
		),
		...b.ouvertes
			.filter((o) => saisie.retrouves.includes(o.id))
			// Seulement si c'est bien cette prise qui l'a close (un collègue a pu la clore entre-temps).
			.flatMap((o) => avisAnomalies(base, [...new Set([o.signaleePar, o.priseEnChargePar])].filter((x): x is number => x !== null && x !== moi), { titre: `${b.nomEngin} · ${o.libelle}`, texte: `Retrouvée à la prise de garde par ${qui}`, url: `/engins/anomalies/${o.id}` }, maintenant, sql`${validee} AND EXISTS (SELECT 1 FROM ${anomalie} WHERE ${anomalie.id} = ${o.id} AND ${anomalie.closePriseId} = ${id})`))
	];
	const [ecrit] = await base.batch([
		base
			.update(priseGarde)
			.set({ etat: 'validee', valideeLe: maintenant, saisie: JSON.stringify(saisie), compteur, modifieePar: moi, modifieeLe: maintenant })
			.where(and(eq(priseGarde.id, id), eq(priseGarde.compteur, b.prise.compteur), eq(priseGarde.etat, 'en_cours')))
			.returning({ id: priseGarde.id }),
		base
			.update(anomalie)
			.set({ closePar: moi, closeLe: maintenant, closePriseId: id })
			.where(and(inArray(anomalie.id, saisie.retrouves.length ? saisie.retrouves : [0]), eq(anomalie.enginId, enginId), isNull(anomalie.closeLe), validee)),
		instruction(
		base,
			sql`INSERT INTO ${anomalie} (engin_id, ref, zone, libelle, genre, manque, note, photo_id, prise_id, signalee_par, signalee_le)
				SELECT ${enginId}, json_extract(value, '$.ref'), json_extract(value, '$.zone'), json_extract(value, '$.libelle'), json_extract(value, '$.genre'),
					json_extract(value, '$.manque'), json_extract(value, '$.note'), json_extract(value, '$.photo'), ${id}, ${moi}, ${maintenant}
				FROM json_each(${ecarts})
				WHERE ${validee} AND NOT EXISTS (SELECT 1 FROM ${anomalie} a WHERE a.engin_id = ${enginId} AND a.ref = json_extract(value, '$.ref') AND a.close_le IS NULL)`
		),
		...avis
	]);
	if (ecrit.length === 0) {
		// Un collègue a validé juste avant : rien n'a été écrit deux fois (anomalies déjà closes ou déjà ouvertes).
		const [relue] = await base.select({ etat: priseGarde.etat }).from(priseGarde).where(eq(priseGarde.id, id));
		throw new DonneeInvalide(relue?.etat === 'validee' ? 'Prise déjà validée' : 'Prise changée entre-temps');
	}
}

export type PriseDeLaReleve = { engin: EnginVu; prise: { etat: EtatPrise; valideeLe: string | null; equipe: string | null; par: string } | null; ouvertes: number };

// La relève en cours, engin par engin (partis exclus) : prise faite (par quelle équipe, quand), en cours ou à faire ; anomalies ouvertes.
export async function prisesDeLaReleve(base: Base, acteur: Acteur, maintenant: string, reglage: Reglage): Promise<{ releve: Releve; peutFaire: boolean; engins: PriseDeLaReleve[] }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await voitLesEngins(base, acteur, aujourdhui))) throw new RefusDroit('VOIR_ENGINS', { type: 'centre' });
	const releve = releveDe(maintenant, reglage);
	const [engins, prises, ouvertes, annees, changees, equipes] = await base.batch([
		base
			// Pas deux colonnes du même nom dans un batch (D1 n'en garde qu'une) : le nom du type est renommé.
			.select({ id: engin.id, nom: engin.nom, immatriculation: engin.immatriculation, typeId: engin.typeId, type: sql<string>`${typeEngin.nom}`.as('type'), ordreType: typeEngin.ordre, situation: engin.situation, provenance: engin.provenance, etat: engin.etat, partiLe: engin.partiLe })
			.from(engin)
			.innerJoin(typeEngin, eq(typeEngin.id, engin.typeId))
			.where(ne(engin.situation, 'parti')),
		base
			.select({ enginId: priseGarde.enginId, etat: priseGarde.etat, valideeLe: priseGarde.valideeLe, equipeId: priseGarde.equipeId, prenom: personne.prenom, nom: personne.nom })
			.from(priseGarde)
			.innerJoin(personne, eq(personne.id, priseGarde.modifieePar))
			.where(eq(priseGarde.releve, releve)),
		base.select({ enginId: anomalie.enginId, n: sql<number>`count(*)` }).from(anomalie).where(isNull(anomalie.closeLe)).groupBy(anomalie.enginId),
		...lecturesEquipe(base, releve)
	]);
	return {
		releve: { debut: releve, equipe: equipeDe(releve, annees, changees, equipes, reglage) },
		peutFaire: await peutFairePrise(base, acteur, aujourdhui),
		engins: engins
			.sort((a, b) => a.ordreType - b.ordreType || a.nom.localeCompare(b.nom, 'fr', { numeric: true }))
			.map(({ ordreType: _, ...e }) => {
				const p = prises.find((x) => x.enginId === e.id);
				return {
					engin: e,
					prise: p ? { etat: p.etat, valideeLe: p.valideeLe, equipe: equipes.find((x) => x.id === p.equipeId)?.nom ?? null, par: `${p.prenom} ${p.nom}` } : null,
					ouvertes: ouvertes.find((o) => o.enginId === e.id)?.n ?? 0
				};
			})
	};
}

// Les engins dont la prise n'est pas validée trois heures après la relève, et l'équipe d'astreinte (à qui le dire). Rien sinon.
// Une requête. Le retard est seulement signalé : jamais d'indisponibilité.
export async function prisesEnRetard(base: Base, maintenant: string, reglage: Reglage): Promise<{ equipeId: number | null; engins: string[] } | null> {
	const releve = releveDe(maintenant, reglage);
	if (maintenant.slice(0, 16) < decaler(releve, RETARD_MIN)) return null;
	const [engins, annees, changees, equipes] = await base.batch([
		base
			.select({ nom: engin.nom, ordreType: typeEngin.ordre })
			.from(engin)
			.innerJoin(typeEngin, eq(typeEngin.id, engin.typeId))
			.where(and(ne(engin.situation, 'parti'), sql`NOT EXISTS (SELECT 1 FROM ${priseGarde} WHERE ${priseGarde.enginId} = ${engin.id} AND ${priseGarde.releve} = ${releve} AND ${priseGarde.etat} = 'validee')`)),
		...lecturesEquipe(base, releve)
	]);
	if (engins.length === 0) return null;
	const noms = engins.sort((a, b) => a.ordreType - b.ordreType || a.nom.localeCompare(b.nom, 'fr', { numeric: true })).map((e) => e.nom);
	return { equipeId: equipeDe(releve, annees, changees, equipes, reglage)?.id ?? null, engins: noms };
}

export type PriseHistorique = { id: number; releve: string; valideeLe: string; equipe: string | null; par: string; signalees: number; retrouvees: number };

// Les dernières prises validées d'un engin (accès vérifié par l'appelant, avec l'engin).
export async function historiquePrises(base: Base, enginId: number): Promise<PriseHistorique[]> {
	const lignes = await base
		.select({
			id: priseGarde.id,
			releve: priseGarde.releve,
			valideeLe: priseGarde.valideeLe,
			equipe: equipe.nom,
			prenom: personne.prenom,
			nom: personne.nom,
			signalees: sql<number>`(SELECT count(*) FROM ${anomalie} WHERE ${anomalie.priseId} = ${priseGarde.id})`,
			retrouvees: sql<number>`(SELECT count(*) FROM ${anomalie} WHERE ${anomalie.closePriseId} = ${priseGarde.id})`
		})
		.from(priseGarde)
		.innerJoin(personne, eq(personne.id, priseGarde.modifieePar))
		.leftJoin(equipe, eq(equipe.id, priseGarde.equipeId))
		.where(and(eq(priseGarde.enginId, enginId), eq(priseGarde.etat, 'validee')))
		.orderBy(desc(priseGarde.releve))
		.limit(20);
	return lignes.map(({ prenom, nom, ...l }) => ({ ...l, valideeLe: l.valideeLe!, par: `${prenom} ${nom}` }));
}

export type PriseFaite = {
	id: number;
	engin: EnginVu;
	releve: string;
	valideeLe: string;
	equipe: string | null;
	participants: string[];
	zones: ZoneFiche[];
	signalees: AnomalieVue[];
	retrouvees: AnomalieVue[];
	dejaOuvertes: number[];
};

// Une prise validée, telle qu'elle a été faite : la fiche de son époque, les écarts signalés et les anomalies retrouvées.
export async function lirePriseFaite(base: Base, acteur: Acteur, id: number): Promise<PriseFaite> {
	const [p] = await base.select().from(priseGarde).where(and(eq(priseGarde.id, id), eq(priseGarde.etat, 'validee')));
	if (!p) throw new DonneeInvalide('Prise inconnue');
	const { engin: e } = await lireEngin(base, acteur, p.enginId, p.valideeLe!.slice(0, 10));
	const saisie = lireSaisie(p.saisie);
	const [zones, elements, liees, [eq_], gens] = await base.batch([
		...lecturesVersion(base, sql<number>`${p.versionId}`),
		base.select(colonnesAnomalie).from(anomalie).innerJoin(personne, eq(personne.id, anomalie.signaleePar)).where(or(eq(anomalie.priseId, id), eq(anomalie.closePriseId, id))).orderBy(asc(anomalie.id)),
		base.select({ nom: equipe.nom }).from(equipe).where(eq(equipe.id, p.equipeId ?? 0)),
		base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne).where(inArray(personne.id, saisie.participants.length ? saisie.participants : [0]))
	]);
	const signalees = liees.filter((a) => !saisie.retrouves.includes(a.id)).map(vueAnomalie);
	// Un écart noté sur un élément déjà signalé et ouvert n'a pas créé d'anomalie de plus.
	const dejaOuvertes = Object.keys(saisie.ecarts).map(Number).filter((ref) => !signalees.some((a) => a.ref === ref));
	return {
		id,
		engin: e,
		releve: p.releve,
		valideeLe: p.valideeLe!,
		equipe: eq_?.nom ?? null,
		participants: saisie.participants.map((pid) => nomComplet(gens.find((g) => g.id === pid))),
		zones: zonesDe(zones, elements),
		signalees,
		retrouvees: liees.filter((a) => saisie.retrouves.includes(a.id)).map(vueAnomalie),
		dejaOuvertes
	};
}

// La photo d'un écart (brouillon ou anomalie), à qui voit les engins.
export async function photoAnomalie(base: Base, basePhotos: BasePhotos, acteur: Acteur, idPhoto: number, aujourdhui: string): Promise<Photo> {
	if (!(await voitLesEngins(base, acteur, aujourdhui))) throw new RefusDroit('VOIR_ENGINS', { type: 'centre' });
	const [connue] = await base.all<{ x: number }>(
		sql`SELECT 1 AS x WHERE EXISTS (SELECT 1 FROM ${anomalie} WHERE ${anomalie.photoId} = ${idPhoto})
			OR EXISTS (SELECT 1 FROM ${priseGarde}, json_each(${priseGarde.saisie}, '$.ecarts') e WHERE ${priseGarde.etat} = 'en_cours' AND json_extract(e.value, '$.photo') = ${idPhoto})`
	);
	if (!connue) throw new DonneeInvalide('Photo inconnue');
	return lireOctets(basePhotos, idPhoto);
}
