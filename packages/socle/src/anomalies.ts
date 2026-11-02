import { and, asc, desc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import type { ReglageAnomalies } from '@gyro-caserne/centre';
import { instruction, type Base, type BasePhotos } from './base.ts';
import { avisAnomalies, quiTraite } from './anomalies-avis.ts';
import type { ADecider } from './casquettes.ts';
import { avecPhotos, exigerPhotos, type Photo } from './commun.ts';
import { exigerDateHeure } from './dates.ts';
import { aLeDroit, droitsDe, occupe, type Acteur } from './droits.ts';
import { voitLesEngins } from './engins.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { ETAPES_ANOMALIE, GENRES_ECART, MOTIFS_ATTENTE, type EtapeAnomalie, type EtatEngin, type GenreEcart, type MotifAttente, type SituationEngin, type SuiviAnomalie } from './listes.ts';
import type { Reglage } from './planning/calendrier.ts';
import { equipeAstreinte } from './prises.ts';
import { anomalie, anomalieSuivi, avisAnomalie, engin, personne, responsabiliteDroit, typeEngin } from './schema.ts';

// Le suivi des anomalies : signalée, prise en charge, en attente (pièce, garage, prestataire), réparée, vérifiée (si le centre
// le veut), close. L'indisponibilité de l'engin est une décision à part, de ceux qui traitent les anomalies ; jamais automatique.

export const LIBELLES_ETAPE: Record<EtapeAnomalie, string> = { signalee: 'Signalée', prise_en_charge: 'Prise en charge', en_attente: 'En attente', reparee: 'Réparée', verifiee: 'Vérifiée' };
export const LIBELLES_MOTIF: Record<MotifAttente, string> = { piece: 'Pièce commandée', garage: 'Au garage', prestataire: 'Chez un prestataire' };
export const REGLAGE_ANOMALIES: ReglageAnomalies = { enAttente: true, verifiee: false, libelles: {} };
export const LIMITES_ANOMALIE = { libelle: 120, note: 300 } as const;

export const libelleEtape = (etape: EtapeAnomalie, r: ReglageAnomalies = REGLAGE_ANOMALIES) => r.libelles[etape] ?? LIBELLES_ETAPE[etape];
// Les étapes suivies par le centre, dans l'ordre.
export const etapesDu = (r: ReglageAnomalies): EtapeAnomalie[] => ETAPES_ANOMALIE.filter((e) => (e !== 'en_attente' || r.enAttente) && (e !== 'verifiee' || r.verifiee));

const GENRES: Record<GenreEcart, string> = { manquant: 'manquant', abime: 'abîmé', a_remplacer: 'à remplacer' };
const propre = (texte: unknown) => (typeof texte === 'string' ? texte.trim().replace(/\s+/g, ' ') : '');
const nomDe = (p: { prenom: string; nom: string } | undefined) => (p ? `${p.prenom} ${p.nom}` : 'Un ancien agent');

// Traiter les anomalies (rendre un engin indisponible, le remettre en service, clore) : TRAITER_ANOMALIE sur le centre
// (chef de centre, adjoint, référent engins), ou être chef de garde (il tient ce droit sur son équipe).
export async function traiteLesAnomalies(base: Base, acteur: Acteur, aujourdhui: string): Promise<boolean> {
	const droits = (await droitsDe(base, acteur, aujourdhui)).filter((d) => d.droit === 'TRAITER_ANOMALIE');
	if (droits.some((d) => d.perimetre.type === 'centre')) return true;
	return acteur.type === 'personne' && droits.some((d) => d.perimetre.type === 'equipe') && occupe(base, acteur.id, 'chef_equipe', aujourdhui);
}

async function droitsAnomalie(base: Base, acteur: Acteur, aujourdhui: string) {
	const centre = { type: 'centre' } as const;
	const traite = await traiteLesAnomalies(base, acteur, aujourdhui);
	const prend = traite || (await aLeDroit(base, acteur, 'PRENDRE_EN_CHARGE_ANOMALIE', centre, aujourdhui));
	const signale = acteur.type === 'personne' && (await aLeDroit(base, acteur, 'SIGNALER_ANOMALIE', centre, aujourdhui));
	return { traite, prend, signale, moi: acteur.type === 'personne' ? acteur.id : null };
}

export type GesteAnomalie =
	| { quoi: 'prendre' }
	| { quoi: 'attente'; motif: MotifAttente; texte: string }
	| { quoi: 'reparee'; texte: string }
	| { quoi: 'verifiee' }
	| { quoi: 'clore'; texte: string }
	| { quoi: 'indisponible' }
	| { quoi: 'remettre' };
export type QuoiGeste = GesteAnomalie['quoi'];

export type EtatAnomalie = { etape: EtapeAnomalie; close: boolean; preneur: number | null; reparateur: number | null; bloquante: boolean; enginIndisponible: boolean; enginParti: boolean };
type Qui = { moi: number | null; traite: boolean; prend: boolean };

// Les gestes permis sur une anomalie. Avancer (en attente, réparée) : qui l'a prise en charge, ou qui traite ; depuis « signalée »,
// qui peut la prendre en charge (il la prend du même coup). Vérifier : un autre que le réparateur. Clore, rendre l'engin
// indisponible : qui traite. Remettre en service : qui traite, l'anomalie close.
export function gestesPermis(a: EtatAnomalie, qui: Qui, r: ReglageAnomalies): QuoiGeste[] {
	if (qui.moi === null) return [];
	if (a.close) return qui.traite && a.bloquante && a.enginIndisponible ? ['remettre'] : [];
	const gestes: QuoiGeste[] = [];
	const avance = qui.traite || a.preneur === qui.moi || (a.etape === 'signalee' && qui.prend);
	if (a.etape === 'signalee' && qui.prend) gestes.push('prendre');
	if (r.enAttente && (a.etape === 'signalee' || a.etape === 'prise_en_charge') && avance) gestes.push('attente');
	if ((a.etape === 'signalee' || a.etape === 'prise_en_charge' || a.etape === 'en_attente') && avance) gestes.push('reparee');
	if (a.etape === 'reparee' && qui.prend && a.reparateur !== qui.moi) gestes.push('verifiee');
	if (qui.traite) gestes.push('clore');
	if (qui.traite && !a.bloquante && !a.enginParti) gestes.push('indisponible');
	return gestes;
}

// Une anomalie et ce qu'il faut pour en vérifier un geste : une requête.
async function lireEtat(base: Base, id: number, moi: number) {
	const [[a], [reparation], [compte], [auteur]] = await base.batch([
		base
			.select({ anomalie, nomEngin: sql<string>`${engin.nom}`.as('nom_engin'), etatEngin: engin.etat, situation: engin.situation })
			.from(anomalie)
			.innerJoin(engin, eq(engin.id, anomalie.enginId))
			.where(eq(anomalie.id, id)),
		base.select({ par: anomalieSuivi.par }).from(anomalieSuivi).where(and(eq(anomalieSuivi.anomalieId, id), eq(anomalieSuivi.quoi, 'reparee'))).orderBy(desc(anomalieSuivi.id)).limit(1),
		base.select({ n: sql<number>`count(*)` }).from(anomalieSuivi).where(eq(anomalieSuivi.anomalieId, id)),
		base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.id, moi))
	]);
	if (!a) throw new DonneeInvalide('Anomalie inconnue');
	const etat: EtatAnomalie = {
		etape: a.anomalie.etape,
		close: a.anomalie.closeLe !== null,
		preneur: a.anomalie.priseEnChargePar,
		reparateur: reparation?.par ?? null,
		bloquante: a.anomalie.bloquante === 1,
		enginIndisponible: a.etatEngin === 'indisponible',
		enginParti: a.situation === 'parti'
	};
	return { a: a.anomalie, nomEngin: a.nomEngin, etatEngin: a.etatEngin, etat, suivis: compte?.n ?? 0, nom: nomDe(auteur) };
}

const SUIVI: Record<QuoiGeste, SuiviAnomalie> = { prendre: 'prise_en_charge', attente: 'en_attente', reparee: 'reparee', verifiee: 'verifiee', clore: 'close', indisponible: 'indisponible', remettre: 'remise_en_service' };

// Un geste du suivi, d'un bloc : la ligne d'historique, l'anomalie, l'engin et la cloche (le déclarant et qui l'a prise en charge,
// jamais l'auteur du geste). Gardé par l'état relu : si un collègue a agi entre-temps, rien n'est écrit.
export async function gesteAnomalie(base: Base, acteur: Acteur, id: number, geste: GesteAnomalie, maintenant: string, r: ReglageAnomalies): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux agents');
	const moi = acteur.id;
	const qui = await droitsAnomalie(base, acteur, aujourdhui);
	const lu = await lireEtat(base, id, moi);
	if (!gestesPermis(lu.etat, qui, r).includes(geste.quoi)) {
		if (['clore', 'indisponible', 'remettre'].includes(geste.quoi) && !qui.traite) throw new RefusDroit('TRAITER_ANOMALIE', { type: 'centre' });
		if (!qui.prend) throw new RefusDroit('PRENDRE_EN_CHARGE_ANOMALIE', { type: 'centre' });
		throw new DonneeInvalide('Geste impossible');
	}
	const texte = 'texte' in geste ? propre(geste.texte) : '';
	if (texte.length > LIMITES_ANOMALIE.note) throw new DonneeInvalide('Texte trop long');
	if (geste.quoi === 'attente' && !(MOTIFS_ATTENTE as readonly string[]).includes(geste.motif)) throw new DonneeInvalide('Motif inconnu');

	const quoi = SUIVI[geste.quoi];
	const a = lu.a;
	const preneur = a.priseEnChargePar ?? moi;
	const close = { closePar: moi, closeLe: maintenant };
	const changement =
		geste.quoi === 'prendre' ? { etape: 'prise_en_charge' as const, priseEnChargePar: moi }
		: geste.quoi === 'attente' ? { etape: 'en_attente' as const, motifAttente: geste.motif, priseEnChargePar: preneur }
		: geste.quoi === 'reparee' ? { etape: 'reparee' as const, priseEnChargePar: preneur, ...(r.verifiee ? {} : close) }
		: geste.quoi === 'verifiee' ? { etape: 'verifiee' as const, ...close }
		: geste.quoi === 'clore' ? close
		: geste.quoi === 'indisponible' ? { bloquante: 1 }
		: null;

	// Avant : l'état relu, inchangé ; après : notre ligne d'historique est la dernière.
	const nombre = sql`(SELECT count(*) FROM ${anomalieSuivi} WHERE ${anomalieSuivi.anomalieId} = ${id})`;
	const avant = sql`${anomalie.id} = ${id} AND ${anomalie.etape} = ${a.etape} AND (${anomalie.closeLe} IS NULL) = ${a.closeLe === null ? 1 : 0} AND ${anomalie.bloquante} = ${a.bloquante}
		AND ${nombre} = ${lu.suivis} AND (SELECT ${engin.etat} FROM ${engin} WHERE ${engin.id} = ${a.enginId}) = ${lu.etatEngin}`;
	const fait = sql`${nombre} = ${lu.suivis + 1} AND (SELECT ${anomalieSuivi.par} || '|' || ${anomalieSuivi.quoi} || '|' || ${anomalieSuivi.le} FROM ${anomalieSuivi} WHERE ${anomalieSuivi.anomalieId} = ${id} ORDER BY ${anomalieSuivi.id} DESC LIMIT 1) = ${`${moi}|${quoi}|${maintenant}`}`;

	const titre = `${lu.nomEngin} · ${a.libelle}`;
	const lien = `/engins/anomalies/${id}`;
	const avec = texte ? ` : ${texte}` : '';
	const textes: Record<QuoiGeste, string> = {
		prendre: `${libelleEtape('prise_en_charge', r)} par ${lu.nom}`,
		attente: `${libelleEtape('en_attente', r)} (${LIBELLES_MOTIF[geste.quoi === 'attente' ? geste.motif : 'piece'].toLocaleLowerCase('fr')}), par ${lu.nom}${avec}`,
		reparee: `${libelleEtape('reparee', r)} par ${lu.nom}${avec}`,
		verifiee: `${libelleEtape('verifiee', r)} par ${lu.nom}`,
		clore: `Close par ${lu.nom}${avec}`,
		indisponible: `Engin rendu indisponible par ${lu.nom}`,
		remettre: `Engin remis en service par ${lu.nom}`
	};
	const prevenus = [...new Set([a.signaleePar, geste.quoi === 'prendre' ? null : a.priseEnChargePar].filter((x): x is number => x !== null && x !== moi))];

	// Rendre indisponible, remettre en service : l'engin change ; la remise en service lève toutes ses anomalies bloquantes.
	const etatEngin = geste.quoi === 'indisponible' ? 'indisponible' : geste.quoi === 'remettre' ? 'disponible' : null;
	const resultats = await base.batch([
		instruction(
			base,
			sql`INSERT INTO ${anomalieSuivi} (anomalie_id, quoi, texte, par, le) SELECT ${id}, ${quoi}, ${texte || null}, ${moi}, ${maintenant} FROM ${anomalie} WHERE ${avant}`
		),
		changement ? base.update(anomalie).set(changement).where(and(eq(anomalie.id, id), fait)) : base.update(anomalie).set({ bloquante: 0 }).where(and(eq(anomalie.enginId, a.enginId), fait)),
		base
			.update(engin)
			.set({ etat: etatEngin ?? lu.etatEngin })
			.where(and(eq(engin.id, a.enginId), etatEngin ? fait : sql`0`)),
		...avisAnomalies(base, prevenus, { titre, texte: textes[geste.quoi], url: lien }, maintenant, fait),
		base.select({ ok: sql<number>`${fait}` }).from(anomalie).where(eq(anomalie.id, id))
	]);
	const [verif] = resultats.at(-1) as { ok: number }[];
	if (!verif?.ok) throw new DonneeInvalide('Anomalie changée entre-temps');
}

export type SignalementAnomalie = { enginId: number; libelle: string; genre: GenreEcart; note: string; photo?: Photo | null };

// Un signalement direct, hors prise de garde : l'engin, le problème, une note et une photo facultatives. L'engin reste disponible ;
// ceux qui traitent les anomalies et le chef de garde de l'équipe d'astreinte sont prévenus.
export async function signalerAnomalie(base: Base, basePhotos: BasePhotos, acteur: Acteur, s: SignalementAnomalie, maintenant: string, reglage: Reglage): Promise<number> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux agents');
	const moi = acteur.id;
	if (!(await aLeDroit(base, acteur, 'SIGNALER_ANOMALIE', { type: 'centre' }, aujourdhui))) throw new RefusDroit('SIGNALER_ANOMALIE', { type: 'centre' });
	const libelle = propre(s.libelle);
	const note = propre(s.note);
	if (!libelle) throw new DonneeInvalide('Problème vide');
	if (libelle.length > LIMITES_ANOMALIE.libelle) throw new DonneeInvalide('Problème trop long');
	if (note.length > LIMITES_ANOMALIE.note) throw new DonneeInvalide('Note trop longue');
	if (!(GENRES_ECART as readonly string[]).includes(s.genre)) throw new DonneeInvalide('Écart inconnu');
	const photos = s.photo ? exigerPhotos([s.photo]) : [];
	const [[e], [auteur]] = await base.batch([
		base.select({ nom: engin.nom, situation: engin.situation }).from(engin).where(eq(engin.id, s.enginId)),
		base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.id, moi))
	]);
	if (!e) throw new DonneeInvalide('Engin inconnu');
	if (e.situation === 'parti') throw new DonneeInvalide('Engin parti');
	const prevenus = (await quiTraite(base, aujourdhui, await equipeAstreinte(base, maintenant, reglage))).filter((id) => id !== moi);
	return avecPhotos(basePhotos, photos, maintenant, async ([photo]) => {
		const [cree] = await base
			.insert(anomalie)
			.values({ enginId: s.enginId, ref: null, zone: '', libelle, genre: s.genre, manque: null, note: note || null, photoId: photo ?? null, priseId: null, signaleePar: moi, signaleeLe: maintenant })
			.returning({ id: anomalie.id });
		const avis = avisAnomalies(base, prevenus, { titre: `Anomalie signalée · ${e.nom}`, texte: `${libelle}, ${GENRES[s.genre]} (${nomDe(auteur)})`, url: `/engins/anomalies/${cree!.id}` }, maintenant);
		// La cloche après coup : un échec n'annule pas le signalement.
		if (avis.length) await base.batch([avis[0]!, avis[1]!]).catch(() => {});
		return cree!.id;
	});
}

export type EtapeHistorique = { quoi: SuiviAnomalie | 'signalee' | 'retrouvee'; par: string; le: string; texte: string | null };
export type VueAnomalie = {
	id: number;
	engin: { id: number; nom: string; type: string; etat: EtatEngin; situation: SituationEngin };
	zone: string;
	libelle: string;
	genre: GenreEcart;
	manque: number | null;
	note: string | null;
	photo: number | null;
	etape: EtapeAnomalie;
	motif: MotifAttente | null;
	close: { le: string; par: string; aLaPrise: boolean } | null;
	bloquante: boolean;
	priseId: number | null;
	signaleeLe: string;
	signaleePar: string;
	prisePar: string | null;
	historique: EtapeHistorique[];
	gestes: QuoiGeste[];
	// Les autres anomalies ouvertes qui ont aussi rendu l'engin indisponible.
	autresBloquantes: number;
};

// Une anomalie : où elle en est, son historique, et les gestes permis à l'acteur. Ouvrir l'anomalie marque lue sa cloche.
export async function lireAnomalie(base: Base, acteur: Acteur, id: number, maintenant: string, r: ReglageAnomalies): Promise<VueAnomalie> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await voitLesEngins(base, acteur, aujourdhui))) throw new RefusDroit('VOIR_ENGINS', { type: 'centre' });
	const qui = await droitsAnomalie(base, acteur, aujourdhui);
	const gens = sql`${personne.id} IN (SELECT signalee_par FROM ${anomalie} WHERE ${anomalie.id} = ${id} UNION SELECT prise_en_charge_par FROM ${anomalie} WHERE ${anomalie.id} = ${id} UNION SELECT close_par FROM ${anomalie} WHERE ${anomalie.id} = ${id})`;
	const lectures = [
		base
			.select({ anomalie, nomEngin: sql<string>`${engin.nom}`.as('nom_engin'), type: sql<string>`${typeEngin.nom}`.as('type'), etatEngin: engin.etat, situation: engin.situation })
			.from(anomalie)
			.innerJoin(engin, eq(engin.id, anomalie.enginId))
			.innerJoin(typeEngin, eq(typeEngin.id, engin.typeId))
			.where(eq(anomalie.id, id)),
		base
			.select({ quoi: anomalieSuivi.quoi, texte: anomalieSuivi.texte, le: anomalieSuivi.le, par: anomalieSuivi.par, prenom: personne.prenom, nom: personne.nom })
			.from(anomalieSuivi)
			.innerJoin(personne, eq(personne.id, anomalieSuivi.par))
			.where(eq(anomalieSuivi.anomalieId, id))
			.orderBy(asc(anomalieSuivi.id)),
		base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne).where(gens),
		base
			.select({ n: sql<number>`count(*)` })
			.from(anomalie)
			.where(and(sql`${anomalie.enginId} = (SELECT engin_id FROM ${anomalie} WHERE ${anomalie.id} = ${id})`, ne(anomalie.id, id), eq(anomalie.bloquante, 1), isNull(anomalie.closeLe)))
	] as const;
	const [[l], suivis, personnes, [autres]] = await base.batch([
		...lectures,
		base.update(avisAnomalie).set({ lueLe: maintenant }).where(and(eq(avisAnomalie.personneId, qui.moi ?? 0), eq(avisAnomalie.url, `/engins/anomalies/${id}`), isNull(avisAnomalie.lueLe)))
	]);
	if (!l) throw new DonneeInvalide('Anomalie inconnue');
	const a = l.anomalie;
	const nom = (pid: number | null) => (pid === null ? null : nomDe(personnes.find((p) => p.id === pid)));
	const reparateur = suivis.filter((s) => s.quoi === 'reparee').at(-1)?.par ?? null;
	const etat: EtatAnomalie = { etape: a.etape, close: a.closeLe !== null, preneur: a.priseEnChargePar, reparateur, bloquante: a.bloquante === 1, enginIndisponible: l.etatEngin === 'indisponible', enginParti: l.situation === 'parti' };
	const historique: EtapeHistorique[] = [
		{ quoi: 'signalee', par: nom(a.signaleePar)!, le: a.signaleeLe, texte: a.note },
		...suivis.map((s) => ({ quoi: s.quoi, par: nomDe(s), le: s.le, texte: s.texte })),
		...(a.closePriseId !== null && a.closeLe ? [{ quoi: 'retrouvee' as const, par: nom(a.closePar)!, le: a.closeLe, texte: null }] : [])
	];
	return {
		id,
		engin: { id: a.enginId, nom: l.nomEngin, type: l.type, etat: l.etatEngin, situation: l.situation },
		zone: a.zone,
		libelle: a.libelle,
		genre: a.genre,
		manque: a.manque,
		note: a.note,
		photo: a.photoId,
		etape: a.etape,
		motif: a.motifAttente,
		close: a.closeLe ? { le: a.closeLe, par: nom(a.closePar)!, aLaPrise: a.closePriseId !== null } : null,
		bloquante: a.bloquante === 1,
		priseId: a.priseId,
		signaleeLe: a.signaleeLe,
		signaleePar: nom(a.signaleePar)!,
		prisePar: nom(a.priseEnChargePar),
		historique,
		gestes: gestesPermis(etat, qui, r),
		autresBloquantes: autres?.n ?? 0
	};
}

export type AnomalieListee = {
	id: number;
	enginId: number;
	engin: string;
	zone: string;
	libelle: string;
	genre: GenreEcart;
	manque: number | null;
	etape: EtapeAnomalie;
	motif: MotifAttente | null;
	signaleeLe: string;
	bloquante: boolean;
	closeLe: string | null;
	photo: number | null;
};
const CLOSES_MAX = 30;

// Les anomalies : les ouvertes d'abord (par engin, rangés comme la liste des engins), puis les 30 dernières closes.
// `enginId` : celles d'un engin seulement.
export async function listerAnomalies(base: Base, acteur: Acteur, aujourdhui: string, enginId: number | null): Promise<{ ouvertes: AnomalieListee[]; closes: AnomalieListee[]; engins: { id: number; nom: string }[]; peutSignaler: boolean }> {
	if (!(await voitLesEngins(base, acteur, aujourdhui))) throw new RefusDroit('VOIR_ENGINS', { type: 'centre' });
	const { signale } = await droitsAnomalie(base, acteur, aujourdhui);
	const colonnes = {
		id: anomalie.id,
		enginId: anomalie.enginId,
		engin: sql<string>`${engin.nom}`.as('nom_engin'),
		ordreType: typeEngin.ordre,
		zone: anomalie.zone,
		libelle: anomalie.libelle,
		genre: anomalie.genre,
		manque: anomalie.manque,
		etape: anomalie.etape,
		motif: anomalie.motifAttente,
		signaleeLe: anomalie.signaleeLe,
		bloquante: anomalie.bloquante,
		closeLe: anomalie.closeLe,
		photo: anomalie.photoId
	};
	const de = enginId === null ? undefined : eq(anomalie.enginId, enginId);
	const lecture = () => base.select(colonnes).from(anomalie).innerJoin(engin, eq(engin.id, anomalie.enginId)).innerJoin(typeEngin, eq(typeEngin.id, engin.typeId));
	const [ouvertes, closes, engins] = await base.batch([
		lecture().where(and(isNull(anomalie.closeLe), de)),
		lecture().where(and(isNotNull(anomalie.closeLe), de)).orderBy(desc(anomalie.closeLe), desc(anomalie.id)).limit(CLOSES_MAX),
		base.select({ id: engin.id, nom: engin.nom, ordreType: typeEngin.ordre }).from(engin).innerJoin(typeEngin, eq(typeEngin.id, engin.typeId)).where(ne(engin.situation, 'parti'))
	]);
	const vue = ({ ordreType: _, bloquante, ...x }: (typeof ouvertes)[number]): AnomalieListee => ({ ...x, bloquante: bloquante === 1 });
	const parEngin = (a: { ordreType: number; engin: string }, b: { ordreType: number; engin: string }) => a.ordreType - b.ordreType || a.engin.localeCompare(b.engin, 'fr', { numeric: true });
	return {
		ouvertes: ouvertes.sort((a, b) => parEngin(a, b) || b.bloquante - a.bloquante || a.id - b.id).map(vue),
		closes: closes.map(vue),
		engins: engins.sort((a, b) => parEngin({ ordreType: a.ordreType, engin: a.nom }, { ordreType: b.ordreType, engin: b.nom })).map(({ id, nom }) => ({ id, nom })),
		peutSignaler: signale
	};
}

// « À décider » pour ceux qui traitent : les anomalies signalées à prendre en charge, et les engins indisponibles dont l'anomalie
// est close (remettre en service ?). Avec l'équipe d'astreinte (son chef de garde) et, parmi `roles`, ceux qui traitent. Une requête.
export async function anomaliesADecider(base: Base, maintenant: string, reglage: Reglage, roles: number[]): Promise<{ equipeId: number | null; items: ADecider[]; roles: number[] }> {
	const ouverteBloquante = sql`EXISTS (SELECT 1 FROM ${anomalie} a WHERE a.engin_id = ${engin.id} AND a.bloquante = 1 AND a.close_le IS NULL)`;
	const [signalees, indisponibles, traitent] = await base.batch([
		base
			.select({ nom: engin.nom, ordreType: typeEngin.ordre })
			.from(anomalie)
			.innerJoin(engin, eq(engin.id, anomalie.enginId))
			.innerJoin(typeEngin, eq(typeEngin.id, engin.typeId))
			.where(and(isNull(anomalie.closeLe), eq(anomalie.etape, 'signalee'), ne(engin.situation, 'parti'))),
		base
			.select({ nom: engin.nom, derniere: sql<number | null>`(SELECT max(a.id) FROM ${anomalie} a WHERE a.engin_id = ${engin.id} AND a.bloquante = 1 AND a.close_le IS NOT NULL)` })
			.from(engin)
			.where(and(eq(engin.etat, 'indisponible'), ne(engin.situation, 'parti'), sql`NOT ${ouverteBloquante}`))
			.orderBy(asc(engin.nom)),
		base.select({ id: responsabiliteDroit.responsabiliteId }).from(responsabiliteDroit).where(and(eq(responsabiliteDroit.droit, 'TRAITER_ANOMALIE'), sql`${responsabiliteDroit.responsabiliteId} IN (SELECT value FROM json_each(${JSON.stringify(roles)}))`))
	]);
	const items: ADecider[] = [];
	if (signalees.length) {
		const noms = [...new Map(signalees.sort((a, b) => a.ordreType - b.ordreType || a.nom.localeCompare(b.nom, 'fr', { numeric: true })).map((s) => [s.nom, s.nom])).values()];
		const n = signalees.length;
		items.push({ texte: `${n} ${n > 1 ? 'anomalies signalées' : 'anomalie signalée'} à prendre en charge : ${noms.join(', ')}`, lien: '/engins/anomalies' });
	}
	for (const e of indisponibles) if (e.derniere !== null) items.push({ texte: `${e.nom} indisponible, anomalie close : remettre en service ?`, lien: `/engins/anomalies/${e.derniere}` });
	return { equipeId: items.length ? await equipeAstreinte(base, maintenant, reglage) : null, items, roles: traitent.map((t) => t.id) };
}

// Données fictives (préprod et développement local) : le treuil du VTU, au garage. Relançable, sans doublon.
export async function chargerAnomaliesFictives(base: Base, maintenant: string): Promise<void> {
	const [[vtu], [agent], [deja]] = await base.batch([
		base.select({ id: engin.id }).from(engin).where(eq(engin.nom, 'VTU')),
		base.select({ id: personne.id }).from(personne).where(eq(personne.statut, 'operationnel')).orderBy(asc(personne.id)).limit(1),
		base.select({ id: anomalie.id }).from(anomalie).where(eq(anomalie.libelle, 'Treuil hors service'))
	]);
	if (!vtu || !agent || deja) return;
	const [a] = await base
		.insert(anomalie)
		.values({ enginId: vtu.id, zone: '', libelle: 'Treuil hors service', genre: 'abime', note: 'Le câble ne se déroule plus.', signaleePar: agent.id, signaleeLe: maintenant, etape: 'en_attente', motifAttente: 'garage', priseEnChargePar: agent.id })
		.returning({ id: anomalie.id });
	await base.insert(anomalieSuivi).values([
		{ anomalieId: a!.id, quoi: 'prise_en_charge', par: agent.id, le: maintenant },
		{ anomalieId: a!.id, quoi: 'en_attente', texte: 'Retour prévu sous huit jours.', par: agent.id, le: maintenant }
	]);
}
