import { and, eq, gt, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDateHeure } from '../dates.ts';
import { aLeDroit, type Acteur } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import type { EtatDemande } from '../listes.ts';
import type { Periode, Reglage } from '../planning/calendrier.ts';
import type { Convocation } from '../murs.ts';
import { convoque, equipeLe } from '../planning/annee.ts';
import { anneePlanning, demandeRemplacement, destinataireRemplacement, manoeuvre, personne, publication, reponseEvenement } from '../schema.ts';
import { avis } from './avis.ts';
import { astreintesDe, disponible, disponibles, lireContexte, manque, mesTranches, periodesDe, exigerRemplacants, peutRemplacer, valideurs, type Contexte, type LigneDemande } from './contexte.ts';
import { texteDemande } from './tranches.ts';

// Les gestes d'une demande de remplacement ou d'échange. Chaque écriture vérifie l'état attendu : deux gestes simultanés
// ne s'appliquent jamais tous les deux (une seule acceptation d'une demande ouverte).

const MOT_MAX = 200;
const PERIODES_MAX = 21;
const parmi = (ids: number[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;
const derniere = sql<number>`(select max(${demandeRemplacement.id}) from ${demandeRemplacement})`;

function moiDe(acteur: Acteur): number {
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux personnes ayant une fiche');
	return acteur.id;
}

const journalDemande = (base: Base, moi: number, action: string, cibleId: number | SQL, details: object, maintenant: string) =>
	ligneJournal(base, { acteur: `personne:${moi}`, action, cibleType: 'demande_remplacement', cibleId, details }, maintenant);

function motDe(valeur: unknown): string | null {
	const propre = typeof valeur === 'string' ? valeur.trim() : '';
	if (propre.length > MOT_MAX) throw new DonneeInvalide('Mot trop long');
	return propre || null;
}

export const nomDe = (ctx: Contexte, id: number | null) => {
	const a = ctx.agents.find((x) => x.id === id);
	return a ? `${a.prenom} ${a.nom}` : 'Un collègue';
};

// Les périodes demandées doivent être des tranches à venir de son astreinte, libres de toute autre demande.
function exigerTranches(ctx: Contexte, id: number, periodes: Periode[]): Periode[] {
	if (!Array.isArray(periodes) || periodes.length === 0) throw new DonneeInvalide('Choisissez au moins une période');
	if (periodes.length > PERIODES_MAX) throw new DonneeInvalide('Trop de périodes');
	const siennes = mesTranches(ctx, id).flatMap((s) => s.tranches);
	const choisies = [...new Map(periodes.map((p) => [`${p?.debut}|${p?.fin}`, p])).values()];
	for (const p of choisies) {
		const t = siennes.find((x) => x.debut === p?.debut && x.fin === p?.fin);
		if (!t) throw new DonneeInvalide('Période inconnue ou déjà commencée');
		if (t.prise) throw new DonneeInvalide('Période déjà dans une demande');
	}
	return choisies.map((p) => ({ debut: p.debut, fin: p.fin })).sort((a, b) => a.debut.localeCompare(b.debut));
}

// L'équipe d'astreinte de la première période : son chef valide.
const equipeDe = (ctx: Contexte, id: number, p: Periode) => astreintesDe(ctx, id).find((s) => s.periodes.some((x) => x.debut <= p.debut && p.debut < x.fin))?.equipeId ?? null;

async function exigerDemander(base: Base, acteur: Acteur, maintenant: string) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	if (!(await aLeDroit(base, acteur, 'DEMANDER_REMPLACEMENT', { type: 'centre' }, aujourdhui))) throw new RefusDroit('DEMANDER_REMPLACEMENT', { type: 'centre' });
	return moi;
}

const URL_POUR_MOI = '/remplacements?onglet=pour-moi';

// Une demande de remplacement : ciblée (un collègue disponible) ou ouverte (tous les disponibles la reçoivent).
export async function demanderRemplacement(base: Base, acteur: Acteur, d: { periodes: Periode[]; cibleId: number | null; mot?: string | null }, maintenant: string, reglage: Reglage): Promise<number> {
	const moi = await exigerDemander(base, acteur, maintenant);
	const ctx = await lireContexte(base, maintenant, reglage);
	const periodes = exigerTranches(ctx, moi, d.periodes);
	const mot = motDe(d.mot);
	let destinataires: number[];
	if (d.cibleId !== null) {
		if (!Number.isInteger(d.cibleId) || d.cibleId === moi) throw new DonneeInvalide('Collègue indisponible sur ces périodes');
		exigerRemplacants(ctx, d.cibleId);
		if (!disponible(ctx, d.cibleId, periodes)) throw new DonneeInvalide('Collègue indisponible sur ces périodes');
		destinataires = [d.cibleId];
	} else destinataires = disponibles(ctx, moi, periodes).map((a) => a.id);
	const texte = `${nomDe(ctx, moi)} · ${texteDemande(periodes)}`;
	const [lignes] = await base.batch([
		base
			.insert(demandeRemplacement)
			.values({ genre: 'remplacement', demandeurId: moi, cibleId: d.cibleId, periodes: JSON.stringify(periodes), equipeId: equipeDe(ctx, moi, periodes[0]!), debut: periodes[0]!.debut, mot, etat: 'attente', creeLe: maintenant })
			.returning({ id: demandeRemplacement.id }),
		ecrireDestinataires(base, derniere, destinataires),
		journalDemande(base, moi, 'demander_remplacement', derniere, { periodes: periodes.length, ciblee: d.cibleId !== null, destinataires: destinataires.length }, maintenant),
		...avis(base, destinataires, derniere, 'recue', texte, URL_POUR_MOI, maintenant)
	]);
	return lignes[0]!.id;
}

const ecrireDestinataires = (base: Base, demandeId: number | SQL, ids: number[], si?: SQL) =>
	base
		.insert(destinataireRemplacement)
		.select(
			base
				.select({ demandeId: sql<number>`${demandeId}`.as('demande_id'), personneId: personne.id, refuseLe: sql<string | null>`null`.as('refuse_le') })
				.from(personne)
				.where(and(inArray(personne.id, parmi(ids)), si))
		)
		.onConflictDoNothing();

// Un échange : ses périodes contre des périodes de l'astreinte d'un collègue, en même temps. Lui seul la reçoit.
export async function proposerEchange(base: Base, acteur: Acteur, d: { periodes: Periode[]; cibleId: number; periodesCible: Periode[]; mot?: string | null }, maintenant: string, reglage: Reglage): Promise<number> {
	const moi = await exigerDemander(base, acteur, maintenant);
	const ctx = await lireContexte(base, maintenant, reglage);
	const periodes = exigerTranches(ctx, moi, d.periodes);
	if (!Number.isInteger(d.cibleId) || d.cibleId === moi || !ctx.agents.some((a) => a.id === d.cibleId)) throw new DonneeInvalide('Collègue inconnu');
	exigerRemplacants(ctx, moi, d.cibleId);
	const periodesCible = exigerTranches(ctx, d.cibleId, d.periodesCible);
	if (!disponible(ctx, d.cibleId, periodes) || !disponible(ctx, moi, periodesCible)) throw new DonneeInvalide('Collègue indisponible sur ces périodes');
	const mot = motDe(d.mot);
	const debut = [periodes[0]!.debut, periodesCible[0]!.debut].sort()[0]!;
	const texte = `${nomDe(ctx, moi)} propose d’échanger : ${texteDemande(periodes)} contre ${texteDemande(periodesCible)}`;
	const [lignes] = await base.batch([
		base
			.insert(demandeRemplacement)
			.values({ genre: 'echange', demandeurId: moi, cibleId: d.cibleId, periodes: JSON.stringify(periodes), periodesCible: JSON.stringify(periodesCible), equipeId: equipeDe(ctx, moi, periodes[0]!), debut, mot, etat: 'attente', creeLe: maintenant })
			.returning({ id: demandeRemplacement.id }),
		ecrireDestinataires(base, derniere, [d.cibleId]),
		journalDemande(base, moi, 'proposer_echange', derniere, { periodes: periodes.length, periodesCible: periodesCible.length }, maintenant),
		...avis(base, [d.cibleId], derniere, 'recue', texte, URL_POUR_MOI, maintenant)
	]);
	return lignes[0]!.id;
}

// Les manœuvres à venir, non annulées, d'une année publiée : les seules qui s'échangent. Un brouillon reste invisible des agents.
const lireManoeuvres = (base: Base, maintenant: string) =>
	base
		.select({ id: manoeuvre.id, debut: manoeuvre.debut, theme: manoeuvre.theme, convoques: manoeuvre.convoques, publicationId: manoeuvre.publicationId })
		.from(manoeuvre)
		.innerJoin(anneePlanning, and(eq(anneePlanning.annee, sql`cast(substr(${manoeuvre.debut}, 1, 4) as integer)`), isNotNull(anneePlanning.publieeLe)))
		.where(and(isNull(manoeuvre.annuleeLe), gt(manoeuvre.debut, maintenant.slice(0, 16))));
type ManoeuvreLue = Awaited<ReturnType<typeof lireManoeuvres>>[number];

const convoqueA = (ctx: Contexte, m: ManoeuvreLue, id: number) => {
	const c = JSON.parse(m.convoques) as Convocation;
	return c !== 'tous' && convoque(c, equipeLe(ctx.affectations.filter((a) => a.personneId === id), m.debut.slice(0, 10)), id);
};

// Pour l'écran : mes manœuvres échangeables, et celles de chaque collègue (où je ne suis pas convoqué). Rien pour un non-opérationnel, ni avec lui.
export async function manoeuvresEchangeables(base: Base, acteur: Acteur, maintenant: string, reglage: Reglage) {
	const moi = moiDe(acteur);
	const [ctx, manoeuvres] = await Promise.all([lireContexte(base, maintenant, reglage), lireManoeuvres(base, maintenant)]);
	const vue = (m: ManoeuvreLue) => ({ id: m.id, debut: m.debut, theme: m.theme });
	const miennes = peutRemplacer(ctx, moi) ? manoeuvres.filter((m) => convoqueA(ctx, m, moi)) : [];
	return {
		miennes: miennes.map(vue),
		collegues: ctx.agents
			.filter((a) => a.id !== moi && peutRemplacer(ctx, moi) && peutRemplacer(ctx, a.id))
			// `aussiA` : mes manœuvres où il est aussi convoqué (il ne peut pas y prendre ma place).
			.map((a) => ({ id: a.id, prenom: a.prenom, nom: a.nom, manoeuvres: manoeuvres.filter((m) => convoqueA(ctx, m, a.id) && !convoqueA(ctx, m, moi)).map(vue), aussiA: miennes.filter((m) => convoqueA(ctx, m, a.id)).map((m) => m.id) }))
			.filter((a) => a.manoeuvres.length > 0)
			.sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'))
	};
}

// Chacun convoqué à la manœuvre de l'autre : vérifié à la proposition et à l'acceptation.
function exigerEchangeManoeuvre(ctx: Contexte, manoeuvres: ManoeuvreLue[], d: { demandeurId: number; cibleId: number; manoeuvreId: number; manoeuvreCibleId: number }) {
	const m1 = manoeuvres.find((m) => m.id === d.manoeuvreId);
	const m2 = manoeuvres.find((m) => m.id === d.manoeuvreCibleId);
	if (!m1 || !m2 || m1.id === m2.id) throw new DonneeInvalide('Manœuvre inconnue, passée ou annulée');
	if (JSON.parse(m1.convoques) === 'tous' || JSON.parse(m2.convoques) === 'tous') throw new DonneeInvalide('Une manœuvre de tout le centre ne s’échange pas');
	const ok = convoqueA(ctx, m1, d.demandeurId) && !convoqueA(ctx, m2, d.demandeurId) && convoqueA(ctx, m2, d.cibleId) && !convoqueA(ctx, m1, d.cibleId);
	if (!ok) throw new DonneeInvalide('Chacun doit être convoqué à sa manœuvre, et pas à celle de l’autre');
	return { m1, m2 };
}

// Échanger sa place à une manœuvre contre celle d'un collègue à une autre. Pas de validation : le chef de garde est informé.
export async function proposerEchangeManoeuvre(base: Base, acteur: Acteur, d: { manoeuvreId: number; cibleId: number; manoeuvreCibleId: number; mot?: string | null }, maintenant: string, reglage: Reglage): Promise<number> {
	const moi = await exigerDemander(base, acteur, maintenant);
	const [ctx, manoeuvres] = await Promise.all([lireContexte(base, maintenant, reglage), lireManoeuvres(base, maintenant)]);
	if (!Number.isInteger(d.cibleId) || d.cibleId === moi || !ctx.agents.some((a) => a.id === d.cibleId)) throw new DonneeInvalide('Collègue inconnu');
	exigerRemplacants(ctx, moi, d.cibleId);
	const { m1, m2 } = exigerEchangeManoeuvre(ctx, manoeuvres, { demandeurId: moi, cibleId: d.cibleId, manoeuvreId: d.manoeuvreId, manoeuvreCibleId: d.manoeuvreCibleId });
	const deja = ctx.demandes.some((x) => x.genre === 'manoeuvre' && x.etat === 'attente' && x.demandeurId === moi && x.manoeuvreId === m1.id);
	if (deja) throw new DonneeInvalide('Échange déjà proposé pour cette manœuvre');
	const mot = motDe(d.mot);
	const texte = `${nomDe(ctx, moi)} propose d’échanger la manœuvre « ${m1.theme} » contre « ${m2.theme} »`;
	const [lignes] = await base.batch([
		base
			.insert(demandeRemplacement)
			.values({
				genre: 'manoeuvre',
				demandeurId: moi,
				cibleId: d.cibleId,
				manoeuvreId: m1.id,
				manoeuvreCibleId: m2.id,
				equipeId: equipeLe(ctx.affectations.filter((a) => a.personneId === moi), m1.debut.slice(0, 10)),
				debut: [m1.debut, m2.debut].sort()[0]!,
				mot,
				etat: 'attente',
				creeLe: maintenant
			})
			.returning({ id: demandeRemplacement.id }),
		ecrireDestinataires(base, derniere, [d.cibleId]),
		journalDemande(base, moi, 'proposer_echange_manoeuvre', derniere, { manoeuvreId: m1.id, manoeuvreCibleId: m2.id }, maintenant),
		...avis(base, [d.cibleId], derniere, 'recue', texte, URL_POUR_MOI, maintenant)
	]);
	return lignes[0]!.id;
}

// L'un prend la place de l'autre : retiré de sa convocation, ajouté à celle de l'autre.
export function echangerPlace(c: Convocation, part: number, vient: number): Convocation {
	if (c === 'tous') return c;
	const x = Array.isArray(c) ? { equipes: c, ajoutes: [] as number[], retires: [] as number[] } : c;
	const ajoutes = x.ajoutes.filter((id) => id !== part);
	const retires = x.retires.filter((id) => id !== vient);
	if (!x.ajoutes.includes(part)) retires.push(part);
	if (!x.retires.includes(vient)) ajoutes.push(vient);
	return { equipes: x.equipes, ajoutes, retires };
}

// Les convocations et les réponses suivent : chacun est noté présent à sa nouvelle manœuvre. `si` : l'échange vient d'être conclu.
function ecrituresManoeuvre(base: Base, m: ManoeuvreLue, part: number, vient: number, si: SQL) {
	const convoques = JSON.stringify(echangerPlace(JSON.parse(m.convoques) as Convocation, part, vient));
	return [
		base.update(manoeuvre).set({ convoques }).where(and(eq(manoeuvre.id, m.id), si)),
		...(m.publicationId === null
			? []
			: [
					base.update(publication).set({ convoques }).where(and(eq(publication.id, m.publicationId), si)),
					base.delete(reponseEvenement).where(and(eq(reponseEvenement.publicationId, m.publicationId), inArray(reponseEvenement.personneId, [part, vient]), si)),
					base.insert(reponseEvenement).select(
						base
							.select({ publicationId: sql<number>`${m.publicationId}`.as('publication_id'), personneId: personne.id, reponse: sql<'present'>`'present'`.as('reponse') })
							.from(personne)
							.where(and(eq(personne.id, vient), si))
					)
				])
	] as const;
}

// Un seul batch : conclu seulement si les deux convocations n'ont pas changé depuis leur lecture (un autre échange, le chef).
async function accepterManoeuvre(base: Base, d: LigneDemande, moi: number, ctx: Contexte, maintenant: string): Promise<'conclue'> {
	const manoeuvres = await lireManoeuvres(base, maintenant);
	const { m1, m2 } = exigerEchangeManoeuvre(ctx, manoeuvres, { demandeurId: d.demandeurId, cibleId: moi, manoeuvreId: d.manoeuvreId!, manoeuvreCibleId: d.manoeuvreCibleId! });
	const inchangee = (m: ManoeuvreLue) => sql`exists (select 1 from ${manoeuvre} where ${manoeuvre.id} = ${m.id} and ${manoeuvre.convoques} = ${m.convoques})`;
	const si = sql`exists (select 1 from ${demandeRemplacement} where ${demandeRemplacement.id} = ${d.id} and ${demandeRemplacement.etat} = 'conclue' and ${demandeRemplacement.remplacantId} = ${moi} and ${demandeRemplacement.trancheeLe} = ${maintenant})`;
	const texte = `${nomDe(ctx, moi)} prend « ${m1.theme} », ${nomDe(ctx, d.demandeurId)} prend « ${m2.theme} »`;
	await base.batch([
		base
			.update(demandeRemplacement)
			.set({ etat: 'conclue', remplacantId: moi, accepteeLe: maintenant, trancheePar: `personne:${moi}`, trancheeLe: maintenant })
			.where(and(eq(demandeRemplacement.id, d.id), eq(demandeRemplacement.etat, 'attente'), inchangee(m1), inchangee(m2))),
		...ecrituresManoeuvre(base, m1, d.demandeurId, moi, si),
		...ecrituresManoeuvre(base, m2, moi, d.demandeurId, si),
		journalDemande(base, moi, 'accepter_echange_manoeuvre', d.id, {}, maintenant),
		...avis(base, [d.demandeurId], d.id, 'acceptee', texte, url(d.id), maintenant, si),
		...avis(base, valideurs(ctx.chefs, d.equipeId, d.demandeurId, moi), d.id, 'informe', texte, url(d.id), maintenant, si)
	]);
	const [apres] = await base.select({ etat: demandeRemplacement.etat, remplacantId: demandeRemplacement.remplacantId }).from(demandeRemplacement).where(eq(demandeRemplacement.id, d.id));
	if (apres?.etat !== 'attente' && apres?.remplacantId !== moi) throw dejaTraitee();
	if (apres?.etat !== 'conclue') throw new DonneeInvalide('Échange impossible : une convocation a changé, réessayez');
	return 'conclue';
}

// La demande, lue dans le contexte ; elle doit être en cours.
async function lireDemande(base: Base, id: number, maintenant: string, reglage: Reglage) {
	if (!Number.isInteger(id) || id < 1) throw new DonneeInvalide('Demande introuvable');
	const [[d], destinataires, ctx] = await Promise.all([
		base.select().from(demandeRemplacement).where(eq(demandeRemplacement.id, id)),
		base.select().from(destinataireRemplacement).where(eq(destinataireRemplacement.demandeId, id)),
		lireContexte(base, maintenant, reglage)
	]);
	if (!d) throw new DonneeInvalide('Demande introuvable');
	return { d, destinataires, ctx };
}

const commencee = (d: LigneDemande, maintenant: string) => d.debut <= maintenant.slice(0, 16);
const dejaTraitee = () => new DonneeInvalide('Cette demande a déjà été traitée');
const url = (id: number) => `/remplacements/${id}`;
// La décision écrite est bien celle-ci : l'état et la date du geste.
const decidee = (id: number, etat: EtatDemande, maintenant: string) => sql`exists (select 1 from ${demandeRemplacement} where ${demandeRemplacement.id} = ${id} and ${demandeRemplacement.etat} = ${etat} and ${demandeRemplacement.trancheeLe} = ${maintenant})`;

export const texteDe = (ctx: Contexte, d: LigneDemande) =>
	d.genre === 'echange' ? `${texteDemande(periodesDe(d.periodes))} contre ${texteDemande(periodesDe(d.periodesCible))}` : texteDemande(periodesDe(d.periodes));

// Accepter : le collègue visé, ou un destinataire d'une demande ouverte. Une aptitude contrôlée manque : à valider par le chef.
export async function accepterDemande(base: Base, acteur: Acteur, id: number, maintenant: string, reglage: Reglage): Promise<'conclue' | 'a_valider'> {
	const moi = await exigerDemander(base, acteur, maintenant);
	const { d, destinataires, ctx } = await lireDemande(base, id, maintenant, reglage);
	exigerRemplacants(ctx, moi);
	const recue = destinataires.some((x) => x.personneId === moi && x.refuseLe === null);
	if (!recue || (d.cibleId !== null && d.cibleId !== moi)) throw new RefusDroit('DEMANDER_REMPLACEMENT', { type: 'centre' }, 'Cette demande ne vous est pas adressée');
	if (d.etat !== 'attente') throw new DonneeInvalide(d.remplacantId === null ? 'Cette demande n’est plus ouverte' : 'Déjà prise par un collègue');
	if (commencee(d, maintenant)) throw new DonneeInvalide('Période déjà commencée');
	// Un échange proposé par un agent qui n'est plus opérationnel depuis ne se conclut plus.
	if (d.genre !== 'remplacement') exigerRemplacants(ctx, d.demandeurId);
	if (d.genre === 'manoeuvre') return accepterManoeuvre(base, d, moi, ctx, maintenant);
	const periodes = periodesDe(d.periodes);
	const date = d.debut.slice(0, 10);
	let manquantes: string[];
	if (d.genre === 'echange') {
		const periodesCible = periodesDe(d.periodesCible);
		const siennes = mesTranches(ctx, moi).flatMap((s) => s.tranches);
		const encoreSiennes = periodesCible.every((p) => siennes.some((t) => t.debut === p.debut && t.fin === p.fin && !t.prise));
		if (!encoreSiennes || !disponible(ctx, moi, periodes, id) || !disponible(ctx, d.demandeurId, periodesCible, id)) throw new DonneeInvalide('Échange impossible : l’un de vous n’est plus libre');
		manquantes = [...new Set([...manque(ctx, d.demandeurId, moi, date), ...manque(ctx, moi, d.demandeurId, periodesCible[0]!.debut.slice(0, 10))])];
	} else {
		if (d.genre !== 'remplacement') throw new DonneeInvalide('Demande inconnue');
		if (!disponible(ctx, moi, periodes, id)) throw new DonneeInvalide('Vous n’êtes pas disponible sur ces périodes');
		manquantes = manque(ctx, d.demandeurId, moi, date);
	}
	const etat = manquantes.length > 0 ? 'a_valider' : 'conclue';
	const chefs = valideurs(ctx.chefs, d.equipeId, d.demandeurId, moi);
	// Deux acceptations à la même minute : seul celui qui l'a eue est annoncé.
	const si = sql`${decidee(id, etat, maintenant)} and exists (select 1 from ${demandeRemplacement} where ${demandeRemplacement.id} = ${id} and ${demandeRemplacement.remplacantId} = ${moi})`;
	const texte = `${nomDe(ctx, moi)} · ${texteDe(ctx, d)}`;
	await base.batch([
		base
			.update(demandeRemplacement)
			.set({ etat, remplacantId: moi, manque: manquantes.length > 0 ? JSON.stringify(manquantes) : null, accepteeLe: maintenant, trancheePar: `personne:${moi}`, trancheeLe: maintenant })
			.where(and(eq(demandeRemplacement.id, id), eq(demandeRemplacement.etat, 'attente'))),
		journalDemande(base, moi, 'accepter_remplacement', id, { etat, manque: manquantes }, maintenant),
		...avis(base, [d.demandeurId], id, 'acceptee', etat === 'a_valider' ? `${texte} · à valider par le chef de garde` : texte, url(id), maintenant, si),
		...avis(base, chefs, id, etat === 'a_valider' ? 'a_valider' : 'informe', etat === 'a_valider' ? `${texte} · manque : ${manquantes.join(', ')}` : `${texte} · remplace ${nomDe(ctx, d.demandeurId)}`, url(id), maintenant, si)
	]);
	const [apres] = await base.select({ remplacantId: demandeRemplacement.remplacantId }).from(demandeRemplacement).where(eq(demandeRemplacement.id, id));
	if (apres?.remplacantId !== moi) throw new DonneeInvalide('Déjà prise par un collègue');
	return etat;
}

// Refuser : une demande ciblée passe « refusée » (le demandeur peut l'ouvrir à tous) ; une demande ouverte disparaît pour soi.
export async function refuserDemande(base: Base, acteur: Acteur, id: number, maintenant: string, reglage: Reglage): Promise<void> {
	const moi = moiDe(acteur);
	exigerDateHeure(maintenant, 'Date');
	const { d, destinataires, ctx } = await lireDemande(base, id, maintenant, reglage);
	if (!destinataires.some((x) => x.personneId === moi && x.refuseLe === null)) throw new RefusDroit('DEMANDER_REMPLACEMENT', { type: 'centre' }, 'Cette demande ne vous est pas adressée');
	const ecarter = base
		.update(destinataireRemplacement)
		.set({ refuseLe: maintenant })
		.where(and(eq(destinataireRemplacement.demandeId, id), eq(destinataireRemplacement.personneId, moi)));
	if (d.cibleId !== moi) {
		await base.batch([ecarter]);
		return;
	}
	if (d.etat !== 'attente') throw dejaTraitee();
	await base.batch([
		base
			.update(demandeRemplacement)
			.set({ etat: 'refusee', trancheePar: `personne:${moi}`, trancheeLe: maintenant })
			.where(and(eq(demandeRemplacement.id, id), eq(demandeRemplacement.etat, 'attente'))),
		ecarter,
		journalDemande(base, moi, 'refuser_remplacement', id, {}, maintenant),
		...avis(base, [d.demandeurId], id, 'refusee', `${nomDe(ctx, moi)} · ${texteDe(ctx, d)}`, url(id), maintenant, decidee(id, 'refusee', maintenant))
	]);
}

// Le demandeur ouvre à tous une demande ciblée refusée (ou encore en attente) : les disponibles la reçoivent.
export async function ouvrirATous(base: Base, acteur: Acteur, id: number, maintenant: string, reglage: Reglage): Promise<void> {
	const moi = moiDe(acteur);
	exigerDateHeure(maintenant, 'Date');
	const { d, destinataires, ctx } = await lireDemande(base, id, maintenant, reglage);
	if (d.demandeurId !== moi) throw new RefusDroit('DEMANDER_REMPLACEMENT', { type: 'centre' }, 'Ce n’est pas votre demande');
	if (d.genre !== 'remplacement' || d.cibleId === null || !['attente', 'refusee'].includes(d.etat)) throw dejaTraitee();
	if (commencee(d, maintenant)) throw new DonneeInvalide('Période déjà commencée');
	const deja = new Set(destinataires.map((x) => x.personneId));
	// Rien n'est envoyé si la cible a accepté entre-temps.
	const ouverteATous = sql`exists (select 1 from ${demandeRemplacement} where ${demandeRemplacement.id} = ${id} and ${demandeRemplacement.etat} = 'attente' and ${demandeRemplacement.cibleId} is null)`;
	const nouveaux = disponibles(ctx, moi, periodesDe(d.periodes), id)
		.map((a) => a.id)
		.filter((x) => !deja.has(x));
	await base.batch([
		base
			.update(demandeRemplacement)
			.set({ etat: 'attente', cibleId: null, trancheePar: null, trancheeLe: null })
			.where(and(eq(demandeRemplacement.id, id), inArray(demandeRemplacement.etat, ['attente', 'refusee']))),
		ecrireDestinataires(base, id, nouveaux, ouverteATous),
		journalDemande(base, moi, 'ouvrir_remplacement', id, { destinataires: nouveaux.length }, maintenant),
		...avis(base, nouveaux, id, 'recue', `${nomDe(ctx, moi)} · ${texteDe(ctx, d)}`, URL_POUR_MOI, maintenant, ouverteATous)
	]);
}

// Retour au départ, après un refus du chef ou un désistement : une demande ouverte attend un autre collègue (le remplaçant ne la revoit plus) ;
// une demande ciblée ou un échange passe « refusé ».
// Une demande ouverte est renvoyée à ses destinataires encore disponibles (sauf l'ancien remplaçant).
function rouvrir(base: Base, ctx: Contexte, d: LigneDemande, destinataires: { personneId: number; refuseLe: string | null }[], qui: number, motif: string | null, maintenant: string) {
	const ouverte = d.genre === 'remplacement' && d.cibleId === null;
	const periodes = periodesDe(d.periodes);
	const encore = ouverte ? destinataires.filter((x) => x.refuseLe === null && x.personneId !== d.remplacantId && disponible(ctx, x.personneId, periodes, d.id)).map((x) => x.personneId) : [];
	return [
		base
			.update(demandeRemplacement)
			.set({ etat: ouverte ? 'attente' : 'refusee', remplacantId: null, manque: null, accepteeLe: null, motif, trancheePar: `personne:${qui}`, trancheeLe: maintenant })
			.where(and(eq(demandeRemplacement.id, d.id), inArray(demandeRemplacement.etat, ['a_valider', 'conclue']))),
		base
			.update(destinataireRemplacement)
			.set({ refuseLe: maintenant })
			.where(and(eq(destinataireRemplacement.demandeId, d.id), eq(destinataireRemplacement.personneId, d.remplacantId ?? 0))),
		...avis(base, encore, d.id, 'recue', `${nomDe(ctx, d.demandeurId)} · ${texteDe(ctx, d)} · de nouveau sans remplaçant`, URL_POUR_MOI, maintenant, rouverte(d, maintenant))
	] as const;
}

const rouverte = (d: LigneDemande, maintenant: string) => decidee(d.id, d.genre === 'remplacement' && d.cibleId === null ? 'attente' : 'refusee', maintenant);

// Le remplaçant se désiste avant le début : le titulaire redevient responsable, il est prévenu, et la demande repart.
export async function desister(base: Base, acteur: Acteur, id: number, maintenant: string, reglage: Reglage): Promise<void> {
	const moi = moiDe(acteur);
	exigerDateHeure(maintenant, 'Date');
	const { d, ctx, destinataires } = await lireDemande(base, id, maintenant, reglage);
	if (d.remplacantId !== moi || !['a_valider', 'conclue'].includes(d.etat)) throw new RefusDroit('DEMANDER_REMPLACEMENT', { type: 'centre' }, 'Vous ne remplacez pas sur cette demande');
	if (d.genre === 'manoeuvre') throw new DonneeInvalide('Un échange de manœuvre ne se défait pas');
	if (commencee(d, maintenant)) throw new DonneeInvalide('Période déjà commencée');
	const texte = `${nomDe(ctx, moi)} · ${texteDe(ctx, d)} · vous redevenez responsable`;
	await base.batch([
		...rouvrir(base, ctx, d, destinataires, moi, 'Désistement', maintenant),
		journalDemande(base, moi, 'desister_remplacement', id, {}, maintenant),
		...avis(base, [d.demandeurId], id, 'desistement', texte, url(id), maintenant, rouverte(d, maintenant)),
		...avis(base, valideurs(ctx.chefs, d.equipeId, d.demandeurId, d.remplacantId), id, 'desistement', `${nomDe(ctx, moi)} ne remplace plus ${nomDe(ctx, d.demandeurId)} · ${texteDe(ctx, d)}`, url(id), maintenant, rouverte(d, maintenant))
	]);
}

function exigerValideur(ctx: Contexte, d: LigneDemande, moi: number) {
	if (!valideurs(ctx.chefs, d.equipeId, d.demandeurId, d.remplacantId).includes(moi)) throw new RefusDroit('VALIDER_REMPLACEMENT', d.equipeId === null ? { type: 'centre' } : { type: 'equipe', id: d.equipeId }, 'Réservé au chef de garde');
}

export async function valider(base: Base, acteur: Acteur, id: number, maintenant: string, reglage: Reglage): Promise<void> {
	const moi = moiDe(acteur);
	exigerDateHeure(maintenant, 'Date');
	const { d, ctx } = await lireDemande(base, id, maintenant, reglage);
	exigerValideur(ctx, d, moi);
	if (d.etat !== 'a_valider') throw dejaTraitee();
	if (commencee(d, maintenant)) throw new DonneeInvalide('Période déjà commencée');
	const si = decidee(id, 'conclue', maintenant);
	const texte = `${nomDe(ctx, d.remplacantId)} remplace ${nomDe(ctx, d.demandeurId)} · ${texteDe(ctx, d)}`;
	await base.batch([
		base
			.update(demandeRemplacement)
			.set({ etat: 'conclue', trancheePar: `personne:${moi}`, trancheeLe: maintenant })
			.where(and(eq(demandeRemplacement.id, id), eq(demandeRemplacement.etat, 'a_valider'))),
		journalDemande(base, moi, 'valider_remplacement', id, {}, maintenant),
		...avis(base, [d.demandeurId, d.remplacantId!], id, 'validee', texte, url(id), maintenant, si)
	]);
}

// Le chef refuse : la demande repart comme au départ, le remplaçant et le demandeur sont prévenus.
export async function refuserValidation(base: Base, acteur: Acteur, id: number, motif: string | null, maintenant: string, reglage: Reglage): Promise<void> {
	const moi = moiDe(acteur);
	exigerDateHeure(maintenant, 'Date');
	const { d, ctx, destinataires } = await lireDemande(base, id, maintenant, reglage);
	exigerValideur(ctx, d, moi);
	if (d.etat !== 'a_valider') throw dejaTraitee();
	if (commencee(d, maintenant)) throw new DonneeInvalide('Période déjà commencée');
	const propre = motDe(motif);
	const texte = [`${nomDe(ctx, d.remplacantId)} ne remplacera pas ${nomDe(ctx, d.demandeurId)}`, texteDe(ctx, d), ...(propre ? [propre] : [])].join(', ');
	await base.batch([
		...rouvrir(base, ctx, d, destinataires, moi, propre ?? 'Refusé par le chef de garde', maintenant),
		journalDemande(base, moi, 'refuser_validation', id, {}, maintenant),
		...avis(base, [d.demandeurId], id, 'refus_chef', texte, url(id), maintenant, rouverte(d, maintenant)),
		// Le remplaçant écarté ne voit plus la demande : son avis mène à « Pour moi ».
		...avis(base, [d.remplacantId!], id, 'refus_chef', texte, URL_POUR_MOI, maintenant, rouverte(d, maintenant))
	]);
}

// Annuler : le demandeur tant que personne n'a accepté ; un valideur, à tout moment avant le début.
export async function annulerDemande(base: Base, acteur: Acteur, id: number, maintenant: string, reglage: Reglage): Promise<void> {
	const moi = moiDe(acteur);
	exigerDateHeure(maintenant, 'Date');
	const { d, ctx } = await lireDemande(base, id, maintenant, reglage);
	const parLeDemandeur = d.demandeurId === moi && ['attente', 'refusee'].includes(d.etat);
	if (!parLeDemandeur) {
		if (d.demandeurId === moi && ['a_valider', 'conclue'].includes(d.etat)) throw new DonneeInvalide('Déjà acceptée : demandez au remplaçant de se désister');
		exigerValideur(ctx, d, moi);
	}
	if (!['attente', 'refusee', 'a_valider', 'conclue'].includes(d.etat)) throw dejaTraitee();
	if (d.genre === 'manoeuvre' && d.etat === 'conclue') throw new DonneeInvalide('Un échange de manœuvre conclu ne s’annule pas');
	if (commencee(d, maintenant)) throw new DonneeInvalide('Période déjà commencée');
	const prevenus = [...new Set([...(parLeDemandeur ? [] : [d.demandeurId]), ...(d.remplacantId !== null && ['a_valider', 'conclue'].includes(d.etat) ? [d.remplacantId] : []), ...(d.cibleId !== null && d.etat === 'attente' ? [d.cibleId] : [])])].filter((x) => x !== moi);
	await base.batch([
		base
			.update(demandeRemplacement)
			.set({ etat: 'annulee', trancheePar: `personne:${moi}`, trancheeLe: maintenant })
			.where(and(eq(demandeRemplacement.id, id), eq(demandeRemplacement.etat, d.etat))),
		journalDemande(base, moi, 'annuler_remplacement', id, { parLeDemandeur }, maintenant),
		...avis(base, prevenus, id, 'annulee', `${parLeDemandeur ? nomDe(ctx, moi) : 'Le chef'} a annulé · ${texteDe(ctx, d)}`, url(id), maintenant, decidee(id, 'annulee', maintenant))
	]);
}

