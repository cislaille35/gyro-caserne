import { and, eq, gt, gte, inArray, isNull, or } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours, exigerDateHeure } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import type { EtatDemande, GenreDemande } from '../listes.ts';
import type { Periode, Reglage } from '../planning/calendrier.ts';
import { avisRemplacement, demandeRemplacement, destinataireRemplacement, manoeuvre, personne } from '../schema.ts';
import { bandesDe, candidats, disponibles, EN_COURS, lireContexte, manque, periodesDe, requeteChefs, valideurs, type Chef, type Contexte, type LigneDemande } from './contexte.ts';
import { texteDemande } from './tranches.ts';

// Ce que montrent les écrans : Pour moi, Mes demandes, À valider, l'historique, le détail d'une demande.

export type Qui = { id: number; prenom: string; nom: string };
export type Gestes = { accepter: boolean; refuser: boolean; ouvrir: boolean; annuler: boolean; desister: boolean; valider: boolean };
export type VueDemande = {
	id: number;
	genre: GenreDemande;
	etat: EtatDemande;
	demandeur: Qui;
	cible: Qui | null;
	remplacant: Qui | null;
	periodes: Periode[];
	periodesCible: Periode[];
	manoeuvre: { id: number; theme: string; debut: string } | null;
	manoeuvreCible: { id: number; theme: string; debut: string } | null;
	texte: string;
	mot: string | null;
	motif: string | null;
	manque: string[];
	creeLe: string;
	debut: string;
	fin: string;
	ouverte: boolean;
	moi: 'demandeur' | 'remplacant' | 'destinataire' | 'valideur' | null;
	manquePourMoi: string[];
	gestes: Gestes;
};

const HISTORIQUE_MAX = 20;
const inconnu = (id: number): Qui => ({ id, prenom: '', nom: 'Agent parti' });

// La fin : la dernière période, ou le début d'une manœuvre.
const finDe = (d: LigneDemande) => [...periodesDe(d.periodes), ...periodesDe(d.periodesCible)].reduce((f, p) => (p.fin > f ? p.fin : f), d.debut);

type Lu = { personnes: Qui[]; manoeuvres: { id: number; theme: string; debut: string }[]; destinataires: { demandeId: number; personneId: number; refuseLe: string | null }[] };

function vue(d: LigneDemande, moi: number, lu: Lu, chefs: Chef[], ctx: Contexte | null, maintenant: string): VueDemande {
	const qui = (id: number | null) => (id === null ? null : (lu.personnes.find((p) => p.id === id) ?? inconnu(id)));
	const m = (id: number | null) => lu.manoeuvres.find((x) => x.id === id) ?? null;
	const avenir = d.debut > maintenant;
	const recue = lu.destinataires.some((x) => x.demandeId === d.id && x.personneId === moi && x.refuseLe === null);
	const estValideur = valideurs(chefs, d.equipeId, d.demandeurId, d.remplacantId).includes(moi);
	const pourMoi = d.etat === 'attente' && avenir && recue && d.demandeurId !== moi && (d.cibleId === null || d.cibleId === moi);
	const periodes = periodesDe(d.periodes);
	const periodesCible = periodesDe(d.periodesCible);
	const man = m(d.manoeuvreId);
	const manCible = m(d.manoeuvreCibleId);
	const texte =
		d.genre === 'manoeuvre' ? `manœuvre « ${man?.theme ?? ''} » contre « ${manCible?.theme ?? ''} »` : d.genre === 'echange' ? `${texteDemande(periodes)} contre ${texteDemande(periodesCible)}` : texteDemande(periodes);
	let manquePourMoi: string[] = [];
	if (pourMoi && ctx && d.genre !== 'manoeuvre') {
		manquePourMoi = manque(ctx, d.demandeurId, moi, d.debut.slice(0, 10));
		if (d.genre === 'echange' && periodesCible[0]) manquePourMoi = [...new Set([...manquePourMoi, ...manque(ctx, moi, d.demandeurId, periodesCible[0].debut.slice(0, 10))])];
	}
	const enCours = (EN_COURS as readonly string[]).includes(d.etat);
	return {
		id: d.id,
		genre: d.genre,
		etat: d.etat,
		demandeur: qui(d.demandeurId)!,
		cible: qui(d.cibleId),
		remplacant: qui(d.remplacantId),
		periodes,
		periodesCible,
		manoeuvre: man,
		manoeuvreCible: manCible,
		texte,
		mot: d.mot,
		motif: d.motif,
		manque: d.manque ? (JSON.parse(d.manque) as string[]) : [],
		creeLe: d.creeLe,
		debut: d.debut,
		fin: finDe(d),
		ouverte: d.genre === 'remplacement' && d.cibleId === null,
		moi: d.demandeurId === moi ? 'demandeur' : d.remplacantId === moi ? 'remplacant' : recue || d.cibleId === moi ? 'destinataire' : estValideur ? 'valideur' : null,
		manquePourMoi,
		gestes: {
			accepter: pourMoi,
			refuser: pourMoi,
			ouvrir: avenir && d.demandeurId === moi && d.genre === 'remplacement' && d.cibleId !== null && ['attente', 'refusee'].includes(d.etat),
			annuler: avenir && enCours && !(d.genre === 'manoeuvre' && d.etat === 'conclue') && ((d.demandeurId === moi && ['attente', 'refusee'].includes(d.etat)) || estValideur),
			desister: avenir && d.remplacantId === moi && d.genre !== 'manoeuvre' && ['a_valider', 'conclue'].includes(d.etat),
			valider: avenir && estValideur && d.etat === 'a_valider'
		}
	};
}

function moiDe(acteur: Acteur): number {
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux personnes ayant une fiche');
	return acteur.id;
}

const lecturesCommunes = (base: Base, depuis: string) =>
	[
		base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne),
		base.select({ id: manoeuvre.id, theme: manoeuvre.theme, debut: manoeuvre.debut }).from(manoeuvre).where(gte(manoeuvre.debut, depuis))
	] as const;

// Les écrans Remplacements. Deux requêtes : le contexte (aptitudes, chefs), puis les demandes qui touchent l'agent.
export async function remplacementsDe(base: Base, acteur: Acteur, maintenant: string, reglage: Reglage) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	const m = maintenant.slice(0, 16);
	const depuis = ajouterJours(aujourdhui, -60);
	const recues = base.select({ id: destinataireRemplacement.demandeId }).from(destinataireRemplacement).where(eq(destinataireRemplacement.personneId, moi));
	const [ctx, [demandes, destinataires, personnes, manoeuvres]] = await Promise.all([
		lireContexte(base, maintenant, reglage),
		base.batch([
			base
				.select()
				.from(demandeRemplacement)
				.where(
					and(
						gte(demandeRemplacement.debut, depuis),
						or(
							eq(demandeRemplacement.demandeurId, moi),
							eq(demandeRemplacement.remplacantId, moi),
							eq(demandeRemplacement.cibleId, moi),
							inArray(demandeRemplacement.id, recues),
							eq(demandeRemplacement.etat, 'a_valider')
						)
					)
				)
				.orderBy(demandeRemplacement.debut, demandeRemplacement.id),
			base.select().from(destinataireRemplacement).where(eq(destinataireRemplacement.personneId, moi)),
			...lecturesCommunes(base, depuis)
		])
	]);
	const vues = demandes.map((d) => vue(d, moi, { personnes, manoeuvres, destinataires }, ctx.chefs, ctx, m));
	const active = (v: VueDemande) => (EN_COURS as readonly string[]).includes(v.etat) && v.fin > m;
	const impliques = vues.filter((v) => v.moi === 'demandeur' || v.moi === 'remplacant' || (v.moi === 'destinataire' && v.cible?.id === moi));
	return {
		pourMoi: vues.filter((v) => v.gestes.accepter),
		miennes: impliques.filter(active),
		aValider: vues.filter((v) => v.gestes.valider),
		historique: impliques
			.filter((v) => !active(v))
			.sort((a, b) => b.debut.localeCompare(a.debut))
			.slice(0, HISTORIQUE_MAX),
		valideur: ctx.chefs.some((c) => c.personneId === moi)
	};
}

// Le détail d'une demande, pour qui y a part. Le demandeur d'une demande ouverte voit les disponibles, ceux qui ont ses aptitudes d'abord.
export async function demandeVue(base: Base, acteur: Acteur, id: number, maintenant: string, reglage: Reglage) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	if (!Number.isInteger(id) || id < 1) throw new DonneeInvalide('Demande introuvable');
	const [ctx, [lignes, destinataires, personnes, manoeuvres]] = await Promise.all([
		lireContexte(base, maintenant, reglage),
		base.batch([
			base.select().from(demandeRemplacement).where(eq(demandeRemplacement.id, id)),
			base.select().from(destinataireRemplacement).where(eq(destinataireRemplacement.demandeId, id)),
			...lecturesCommunes(base, ajouterJours(aujourdhui, -400)),
			// Ouvrir la demande marque lus ses avis, pour qui l'ouvre, dans le même envoi à la base.
			base.update(avisRemplacement).set({ lueLe: maintenant }).where(and(eq(avisRemplacement.personneId, moi), eq(avisRemplacement.demandeId, id), isNull(avisRemplacement.lueLe)))
		])
	]);
	const d = lignes[0];
	if (!d) throw new DonneeInvalide('Demande introuvable');
	const v = vue(d, moi, { personnes, manoeuvres, destinataires }, ctx.chefs, ctx, maintenant.slice(0, 16));
	// Un destinataire qui n'a pas pris la demande ne la voit que tant qu'elle attend : ensuite, elle ne regarde que les intéressés.
	const partie = d.demandeurId === moi || d.remplacantId === moi || d.cibleId === moi || valideurs(ctx.chefs, d.equipeId, d.demandeurId, d.remplacantId).includes(moi);
	const recue = destinataires.some((x) => x.personneId === moi && x.refuseLe === null) && d.etat === 'attente';
	if (!partie && !recue) throw new RefusDroit('DEMANDER_REMPLACEMENT', { type: 'centre' }, 'Cette demande ne vous concerne pas');
	const voitDisponibles = v.moi === 'demandeur' && d.genre === 'remplacement' && d.etat === 'attente' && d.debut > maintenant.slice(0, 16);
	return {
		demande: v,
		disponibles: voitDisponibles && d.cibleId === null ? disponibles(ctx, d.demandeurId, v.periodes, d.id) : [],
		recue: d.cibleId === null ? destinataires.filter((x) => x.refuseLe === null).length : null,
		valideurs: valideurs(ctx.chefs, d.equipeId, d.demandeurId, d.remplacantId).map((x) => personnes.find((p) => p.id === x) ?? inconnu(x))
	};
}

// La cloche du chef : les demandes à valider qu'il n'a pas tranchées. Une requête.
export async function nombreRemplacementsAValider(base: Base, acteur: Acteur, maintenant: string): Promise<number> {
	return (await remplacementsAValider(base, acteur, maintenant)).length;
}

// Les demandes à valider par l'acteur, pour l'accueil et la cloche. Une requête.
export async function remplacementsAValider(base: Base, acteur: Acteur, maintenant: string): Promise<{ id: number; equipeId: number | null; texte: string }[]> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') return [];
	const [demandes, chefs, personnes] = await base.batch([
		base
			.select()
			.from(demandeRemplacement)
			.where(and(eq(demandeRemplacement.etat, 'a_valider'), gt(demandeRemplacement.debut, maintenant.slice(0, 16)))),
		requeteChefs(base, aujourdhui),
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom })
			.from(personne)
			.where(inArray(personne.id, base.select({ id: demandeRemplacement.demandeurId }).from(demandeRemplacement).where(eq(demandeRemplacement.etat, 'a_valider'))))
	]);
	const nom = (id: number | null) => {
		const p = personnes.find((x) => x.id === id);
		return p ? `${p.prenom} ${p.nom}` : '';
	};
	return demandes
		.filter((d) => valideurs(chefs, d.equipeId, d.demandeurId, d.remplacantId).includes(acteur.id))
		.map((d) => ({ id: d.id, equipeId: d.equipeId, texte: `Remplacement à valider, ${nom(d.demandeurId)}, ${texteDemande(periodesDe(d.periodes))}` }));
}

// Les demandes reçues qui attendent une réponse de l'acteur (À ne pas manquer). Une requête.
export const requetePourMoi = (base: Base, moi: number, maintenant: string) =>
	base
		.select({ id: demandeRemplacement.id, genre: demandeRemplacement.genre, periodes: demandeRemplacement.periodes, periodesCible: demandeRemplacement.periodesCible, debut: demandeRemplacement.debut, prenom: personne.prenom, nom: personne.nom })
		.from(destinataireRemplacement)
		.innerJoin(demandeRemplacement, eq(demandeRemplacement.id, destinataireRemplacement.demandeId))
		.innerJoin(personne, eq(personne.id, demandeRemplacement.demandeurId))
		.where(
			and(
				eq(destinataireRemplacement.personneId, moi),
				isNull(destinataireRemplacement.refuseLe),
				eq(demandeRemplacement.etat, 'attente'),
				gt(demandeRemplacement.debut, maintenant.slice(0, 16)),
				or(isNull(demandeRemplacement.cibleId), eq(demandeRemplacement.cibleId, moi))
			)
		)
		.orderBy(demandeRemplacement.debut);

// Le parcours « Me faire remplacer » ou « Échanger » : mes semaines (toutes leurs tranches), les collègues libres sur les périodes
// choisies (gardées seulement si elles sont à moi et libres). Pour un échange : les collègues qui ont une période à me donner,
// ses semaines vues par moi, et les aptitudes contrôlées du collègue qui me manquent pour ses périodes (`periodesAvec`).
export async function pourDemander(base: Base, acteur: Acteur, maintenant: string, reglage: Reglage, choix: { periodes?: Periode[]; echange?: boolean; avec?: number | null; periodesAvec?: Periode[] } = {}) {
	exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	const ctx = await lireContexte(base, maintenant, reglage);
	const semaines = bandesDe(ctx, moi);
	const libres = semaines.flatMap((s) => s.tranches).filter((t) => t.etat === 'libre');
	const choisies = libres.filter((t) => (choix.periodes ?? []).some((p) => p.debut === t.debut && p.fin === t.fin)).map(({ debut, fin }) => ({ debut, fin }));
	const libresPour = candidats(ctx, moi, choisies);
	const echangeables = choix.echange ? libresPour.filter((c) => bandesDe(ctx, c.id, moi).some((s) => s.tranches.some((t) => t.etat === 'libre'))) : [];
	const avec = echangeables.find((c) => c.id === choix.avec) ?? null;
	const semainesAvec = avec ? bandesDe(ctx, avec.id, moi) : [];
	const siennes = semainesAvec.flatMap((s) => s.tranches).filter((t) => t.etat === 'libre' && (choix.periodesAvec ?? []).some((p) => p.debut === t.debut && p.fin === t.fin));
	const manqueMoi = avec && siennes[0] ? manque(ctx, avec.id, moi, siennes[0].debut.slice(0, 10)) : [];
	return { semaines, choisies, candidats: libresPour, echangeables, avec, semainesAvec, manqueMoi };
}
