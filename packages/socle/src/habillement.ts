import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { instruction, type Base } from './base.ts';
import type { ADecider } from './casquettes.ts';
import { enCours, exigerDate, exigerDateHeure } from './dates.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { STATUTS_AVEC_ACCES, type EtapeHabillement, type FilHabillement, type IssueHabillement } from './listes.ts';
import { mettreEnFile } from './notifications.ts';
import { attribution, avisHabillement, demandeHabillement, filHabillement, personne, profil, profilDroit, responsabilite, responsabiliteDroit } from './schema.ts';

// L'habillement : un agent demande une pièce de tenue en texte libre ; un référent habillement (GERER_HABILLEMENT sur le centre)
// la prend en compte, pose des questions, la traite (en stock, commandée au SDIS, refusée) puis la livre. Pas d'inventaire.
// Le chef de centre et l'adjoint tiennent le droit (verrouillé) : ils agissent aussi, et reçoivent les demandes quand aucun référent n'est nommé.

export const LIMITE_HABILLEMENT = 500;
export const FINIES: EtapeHabillement[] = ['livree', 'refusee', 'annulee'];
const TERMINEES_MAX = 50;

const propre = (texte: unknown) => (typeof texte === 'string' ? texte.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : '');
const nomDe = (p: { prenom: string; nom: string } | undefined | null) => (p ? `${p.prenom} ${p.nom}` : 'Un ancien agent');
// Le début de la demande, sur une ligne.
export function extraitDemande(texte: string, max = 80): string {
	const ligne = texte.replace(/\s+/g, ' ').trim();
	return ligne.length > max ? `${ligne.slice(0, max - 1).trimEnd()}…` : ligne;
}
const parmi = (ids: number[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;
const lien = (id: number) => `/habillement/${id}`;

// Ceux qui gèrent l'habillement aujourd'hui : par leur profil, ou par un rôle en cours sur le centre. À placer dans un batch.
export function lecturesGestionnaires(base: Base) {
	const avecAcces = inArray(personne.statut, [...STATUTS_AVEC_ACCES]);
	return [
		base
			.select({ id: personne.id })
			.from(personne)
			.innerJoin(profilDroit, eq(profilDroit.profilId, personne.profilId))
			.where(and(avecAcces, eq(profilDroit.droit, 'GERER_HABILLEMENT'), eq(profilDroit.perimetreType, 'centre'))),
		base
			.select({ id: attribution.personneId, roleId: attribution.responsabiliteId, type: attribution.perimetreType, portee: responsabilite.typePerimetre, systeme: responsabilite.systeme, debut: attribution.debut, fin: attribution.fin })
			.from(attribution)
			.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
			.innerJoin(responsabiliteDroit, and(eq(responsabiliteDroit.responsabiliteId, responsabilite.id), eq(responsabiliteDroit.droit, 'GERER_HABILLEMENT')))
			.innerJoin(personne, eq(personne.id, attribution.personneId))
			.where(and(avecAcces, isNull(responsabilite.archiveeLe)))
	] as const;
}
type LignesGestionnaires = [{ id: number }[], { id: number; roleId: number; type: string; portee: string; systeme: string | null; debut: string; fin: string | null }[]];

// Les référents (par un rôle hors système, ou leur profil) et les chefs (chef de centre, adjoint) ; `roles` : chaque rôle tenu qui porte le droit.
export function gestionnaires([duProfil, tenues]: LignesGestionnaires, aujourdhui: string) {
	const valides = tenues.filter((t) => t.type === 'centre' && t.portee === 'centre' && enCours(t.debut, t.fin, aujourdhui));
	const chefs = valides.filter((t) => t.systeme === 'chef_centre' || t.systeme === 'chef_centre_adjoint').map((t) => t.id);
	const referents = [...duProfil.map((p) => p.id), ...valides.filter((t) => t.systeme === null).map((t) => t.id)];
	return { referents: [...new Set(referents)], chefs: [...new Set(chefs)], roles: valides.filter((t) => t.systeme === null).map((t) => ({ personneId: t.id, roleId: t.roleId })) };
}

// Qui reçoit une nouvelle demande (ou une réponse que personne n'a encore prise) : les référents, sinon le chef et l'adjoint.
const destinataires = (g: { referents: number[]; chefs: number[] }) => (g.referents.length ? g.referents : g.chefs);

// Un agent du centre : une personne qui a accès, pas le compte partagé d'un extérieur. Le super administrateur ne demande pas.
async function peutDemander(base: Base, acteur: Acteur): Promise<boolean> {
	if (acteur.type !== 'personne') return false;
	const [fiche] = await base.select({ statut: personne.statut, type: profil.typePersonne }).from(personne).leftJoin(profil, eq(profil.id, personne.profilId)).where(eq(personne.id, acteur.id));
	return !!fiche && (STATUTS_AVEC_ACCES as readonly string[]).includes(fiche.statut) && fiche.type !== 'exterieur';
}

export async function gereHabillement(base: Base, acteur: Acteur, aujourdhui: string): Promise<boolean> {
	return aLeDroit(base, acteur, 'GERER_HABILLEMENT', { type: 'centre' }, aujourdhui);
}

// Écritures à placer dans un batch : la ligne de la cloche et l'envoi au téléphone (lieu « habillement » : seul « tout » le coupe).
function avis(base: Base, ids: number[], a: { titre: string; texte: string; url: string }, maintenant: string, si?: SQL) {
	if (ids.length === 0) return [];
	return [
		base.insert(avisHabillement).select(
			base
				.select({
					id: sql<number | null>`null`.as('id'),
					personneId: personne.id,
					titre: sql<string>`${a.titre}`.as('titre'),
					texte: sql<string>`${a.texte}`.as('texte'),
					url: sql<string>`${a.url}`.as('url'),
					creeLe: sql<string>`${maintenant}`.as('cree_le'),
					lueLe: sql<string | null>`null`.as('lue_le')
				})
				.from(personne)
				.where(and(inArray(personne.id, parmi(ids)), si))
		),
		mettreEnFile(base, ids, 'habillement', { ...a, tag: `habillement:${a.url}` }, maintenant, si, 'habillement')
	] as const;
}

// Une demande : un seul texte libre. Les référents sont prévenus (sinon le chef et l'adjoint). Deux requêtes, plus les droits.
export async function demanderTenue(base: Base, acteur: Acteur, texte: string, maintenant: string): Promise<number> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await peutDemander(base, acteur)) || acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux agents du centre');
	const t = propre(texte);
	if (!t) throw new DonneeInvalide('Demande vide');
	if (t.length > LIMITE_HABILLEMENT) throw new DonneeInvalide('Demande trop longue');
	const [[cree], [auteur], ...lignes] = await base.batch([
		base.insert(demandeHabillement).values({ demandeurId: acteur.id, texte: t, creeLe: maintenant, majLe: maintenant }).returning({ id: demandeHabillement.id }),
		base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.id, acteur.id)),
		...lecturesGestionnaires(base)
	]);
	const ids = destinataires(gestionnaires(lignes as LignesGestionnaires, aujourdhui)).filter((id) => id !== acteur.id);
	const ecritures = avis(base, ids, { titre: 'Nouvelle demande d’habillement', texte: `${nomDe(auteur)} : ${extraitDemande(t)}`, url: lien(cree!.id) }, maintenant);
	// La cloche après coup : un échec n'annule pas la demande.
	if (ecritures.length) await base.batch([ecritures[0]!, ecritures[1]!]).catch(() => {});
	return cree!.id;
}

export type GesteHabillement =
	| { quoi: 'prendre' }
	| { quoi: 'reprendre' }
	| { quoi: 'question'; texte: string }
	| { quoi: 'repondre'; texte: string }
	| { quoi: 'traiter'; issue: IssueHabillement | 'refus'; texte: string }
	| { quoi: 'livrer'; texte: string }
	| { quoi: 'annuler' };
export type QuoiGesteHabillement = GesteHabillement['quoi'];
export type EtatDemande = { etape: EtapeHabillement; demandeur: number; prisePar: number | null };

// Les gestes permis. L'agent : répondre ou préciser tant que la demande n'est pas finie, l'annuler tant qu'elle n'est ni commandée
// ni sortie du stock. Qui gère : la prendre en compte (ou, d'emblée, poser une question ou la traiter), la reprendre à un collègue ;
// celui qui l'a prise : poser une question, la traiter, puis la livrer.
export function gestesHabillement(d: EtatDemande, qui: { moi: number | null; gere: boolean }): QuoiGesteHabillement[] {
	if (qui.moi === null || FINIES.includes(d.etape)) return [];
	const gestes: QuoiGesteHabillement[] = [];
	if (qui.gere) {
		const sienne = d.prisePar === qui.moi;
		if (d.etape === 'demandee') gestes.push('prendre', 'question', 'traiter');
		else if (!sienne) gestes.push('reprendre');
		else if (d.etape === 'prise') gestes.push('question', 'traiter');
		else if (d.etape === 'question') gestes.push('traiter');
		else if (d.etape === 'traitee') gestes.push('livrer');
	}
	if (d.demandeur === qui.moi) {
		gestes.push('repondre');
		if (d.etape !== 'traitee') gestes.push('annuler');
	}
	return gestes;
}

// Un geste, d'un bloc : la ligne du fil, la demande et la cloche (jamais l'auteur du geste). Gardé par l'état relu : si un collègue
// a agi entre-temps, rien n'est écrit et le geste est refusé.
export async function gesteHabillement(base: Base, acteur: Acteur, id: number, geste: GesteHabillement, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux agents');
	const moi = acteur.id;
	const gere = await gereHabillement(base, acteur, aujourdhui);
	const [[d], [compte], [moiMeme], ...lignes] = await base.batch([
		base.select({ demande: demandeHabillement, prenom: personne.prenom, nom: personne.nom }).from(demandeHabillement).innerJoin(personne, eq(personne.id, demandeHabillement.demandeurId)).where(eq(demandeHabillement.id, id)),
		base.select({ n: sql<number>`count(*)` }).from(filHabillement).where(eq(filHabillement.demandeId, id)),
		base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.id, moi)),
		...lecturesGestionnaires(base)
	]);
	if (!d || (d.demande.demandeurId !== moi && !gere)) throw new DonneeInvalide('Demande inconnue');
	const a = d.demande;
	if (!gestesHabillement({ etape: a.etape, demandeur: a.demandeurId, prisePar: a.prisePar }, { moi, gere }).includes(geste.quoi)) {
		if (a.demandeurId !== moi && !gere) throw new RefusDroit('GERER_HABILLEMENT', { type: 'centre' });
		throw new DonneeInvalide('Geste impossible');
	}
	const texte = 'texte' in geste ? propre(geste.texte) : '';
	if (texte.length > LIMITE_HABILLEMENT) throw new DonneeInvalide('Texte trop long');
	if (geste.quoi === 'traiter' && !['stock', 'commande', 'refus'].includes(geste.issue)) throw new DonneeInvalide('Issue inconnue');
	const exigeTexte = geste.quoi === 'question' || geste.quoi === 'repondre' || geste.quoi === 'livrer' || (geste.quoi === 'traiter' && geste.issue === 'refus');
	if (exigeTexte && !texte) throw new DonneeInvalide(geste.quoi === 'traiter' ? 'Refus sans explication' : geste.quoi === 'livrer' ? 'Récupération à préciser' : 'Message vide');

	const preneur = a.prisePar ?? moi;
	const fin = { finLe: maintenant };
	const [quoi, changement]: [FilHabillement, Partial<typeof demandeHabillement.$inferInsert>] =
		geste.quoi === 'prendre' ? ['prise', { etape: 'prise', prisePar: moi }]
		: geste.quoi === 'reprendre' ? ['reprise', { prisePar: moi }]
		: geste.quoi === 'question' ? ['question', { etape: 'question', prisePar: preneur }]
		: geste.quoi === 'repondre' ? (a.etape === 'question' ? ['reponse', { etape: 'prise' }] : ['precision', {}])
		: geste.quoi === 'traiter' ? (geste.issue === 'refus' ? ['refus', { etape: 'refusee', prisePar: preneur, ...fin }] : [geste.issue, { etape: 'traitee', issue: geste.issue, prisePar: preneur }])
		: geste.quoi === 'livrer' ? ['livraison', { etape: 'livree', livraison: texte, ...fin }]
		: ['annulation', { etape: 'annulee', ...fin }];

	// Avant : l'état relu, inchangé ; après : la dernière ligne du fil porte notre jeton, propre à cet envoi.
	const jeton = crypto.randomUUID();
	const avant = sql`${demandeHabillement.id} = ${id} AND ${demandeHabillement.etape} = ${a.etape} AND coalesce(${demandeHabillement.prisePar}, 0) = ${a.prisePar ?? 0}
		AND (SELECT count(*) FROM ${filHabillement} WHERE ${filHabillement.demandeId} = ${id}) = ${compte?.n ?? 0}`;
	const fait = sql`(SELECT ${filHabillement.jeton} FROM ${filHabillement} WHERE ${filHabillement.demandeId} = ${id} ORDER BY ${filHabillement.id} DESC LIMIT 1) = ${jeton}`;

	const ex = extraitDemande(a.texte);
	const nom = nomDe(moiMeme);
	const AVIS: Record<FilHabillement, { titre: string; texte: string } | null> = {
		prise: { titre: 'Demande prise en compte', texte: `${nom} s’en occupe : ${ex}` },
		reprise: null,
		question: { titre: 'Question sur votre demande', texte: `${nom} : ${texte}` },
		reponse: { titre: 'Réponse à votre question', texte: `${nom} : ${texte}` },
		precision: { titre: 'Précision sur une demande', texte: `${nom} : ${texte}` },
		stock: { titre: 'Demande traitée', texte: `Sortie du stock du centre : ${ex}` },
		commande: { titre: 'Demande traitée', texte: `Commandée au SDIS : ${ex}` },
		refus: { titre: 'Demande refusée', texte: `${nom} : ${texte}` },
		livraison: { titre: 'Tenue livrée', texte: `${texte} : ${ex}` },
		annulation: { titre: 'Demande annulée', texte: `${nom} : ${ex}` }
	};
	// L'agent apprend chaque étape et chaque question ; ses réponses, précisions et annulations vont à qui s'en occupe,
	// sinon à ceux qui reçoivent les nouvelles demandes.
	const deLAgent = quoi === 'reponse' || quoi === 'precision' || quoi === 'annulation';
	const pourQui = !AVIS[quoi] ? [] : !deLAgent ? [a.demandeurId] : a.prisePar !== null ? [a.prisePar] : quoi === 'annulation' ? [] : destinataires(gestionnaires(lignes as LignesGestionnaires, aujourdhui));
	const prevenus = [...new Set(pourQui)].filter((x) => x !== moi);

	const resultats = await base.batch([
		instruction(base, sql`INSERT INTO ${filHabillement} (demande_id, quoi, texte, par, le, jeton) SELECT ${id}, ${quoi}, ${texte || null}, ${moi}, ${maintenant}, ${jeton} FROM ${demandeHabillement} WHERE ${avant}`),
		base
			.update(demandeHabillement)
			.set({ ...changement, majLe: maintenant })
			.where(and(eq(demandeHabillement.id, id), fait)),
		...(AVIS[quoi] ? avis(base, prevenus, { ...AVIS[quoi]!, url: lien(id) }, maintenant, fait) : []),
		base.select({ ok: sql<number>`${fait}` }).from(demandeHabillement).where(eq(demandeHabillement.id, id))
	]);
	const [verif] = resultats.at(-1) as { ok: number }[];
	if (!verif?.ok) throw new DonneeInvalide('Demande changée entre-temps');
}

export type DemandeListee = { id: number; texte: string; etape: EtapeHabillement; issue: IssueHabillement | null; demandeur: string; prisePar: string | null; creeLe: string; majLe: string; finLe: string | null };
export type LigneFilDemande = { quoi: FilHabillement; texte: string | null; par: string; le: string; deLAgent: boolean };
export type VueDemande = DemandeListee & { livraison: string | null; sienne: boolean; fil: LigneFilDemande[]; gestes: QuoiGesteHabillement[] };

const colonnes = {
	id: demandeHabillement.id,
	texte: demandeHabillement.texte,
	etape: demandeHabillement.etape,
	issue: demandeHabillement.issue,
	creeLe: demandeHabillement.creeLe,
	majLe: demandeHabillement.majLe,
	finLe: demandeHabillement.finLe,
	demandeurPrenom: personne.prenom,
	demandeurNom: personne.nom,
	prisePar: sql<string | null>`(SELECT p.prenom || ' ' || p.nom FROM ${personne} p WHERE p.id = ${demandeHabillement.prisePar})`.as('prise_par_nom')
};
type LigneListe = { id: number; texte: string; etape: EtapeHabillement; issue: IssueHabillement | null; creeLe: string; majLe: string; finLe: string | null; demandeurPrenom: string; demandeurNom: string; prisePar: string | null };
const vue = ({ demandeurPrenom, demandeurNom, ...l }: LigneListe): DemandeListee => ({ ...l, demandeur: `${demandeurPrenom} ${demandeurNom}` });
const lecture = (base: Base) => base.select(colonnes).from(demandeHabillement).innerJoin(personne, eq(personne.id, demandeHabillement.demandeurId));
const enCoursSql = isNull(demandeHabillement.finLe);
// En cours : les nouvelles d'abord, puis les plus récemment changées.
const parUrgence = (a: DemandeListee, b: DemandeListee) => Number(b.etape === 'demandee') - Number(a.etape === 'demandee') || b.majLe.localeCompare(a.majLe) || b.id - a.id;

// Mes demandes : en cours, puis les dernières terminées. Une requête. Ouvrir la page ne marque rien lu : chaque demande le fait.
export async function mesDemandes(base: Base, acteur: Acteur): Promise<{ enCours: DemandeListee[]; terminees: DemandeListee[] }> {
	if (acteur.type !== 'personne') return { enCours: [], terminees: [] };
	const [enCours, terminees] = await base.batch([
		lecture(base).where(and(eq(demandeHabillement.demandeurId, acteur.id), enCoursSql)).orderBy(desc(demandeHabillement.majLe), desc(demandeHabillement.id)),
		lecture(base).where(and(eq(demandeHabillement.demandeurId, acteur.id), isNotNull(demandeHabillement.finLe))).orderBy(desc(demandeHabillement.finLe), desc(demandeHabillement.id)).limit(TERMINEES_MAX)
	]);
	return { enCours: enCours.map(vue), terminees: terminees.map(vue) };
}

// Toutes les demandes, pour qui gère l'habillement : en cours (les nouvelles d'abord), puis les dernières terminées. Une requête, plus les droits.
export async function toutesLesDemandes(base: Base, acteur: Acteur, aujourdhui: string): Promise<{ enCours: DemandeListee[]; terminees: DemandeListee[] }> {
	exigerDate(aujourdhui);
	if (!(await gereHabillement(base, acteur, aujourdhui))) throw new RefusDroit('GERER_HABILLEMENT', { type: 'centre' });
	const [enCours, terminees] = await base.batch([
		lecture(base).where(enCoursSql),
		lecture(base).where(isNotNull(demandeHabillement.finLe)).orderBy(desc(demandeHabillement.finLe), desc(demandeHabillement.id)).limit(TERMINEES_MAX)
	]);
	return { enCours: enCours.map(vue).sort(parUrgence), terminees: terminees.map(vue) };
}

// Une demande, son fil et les gestes permis : pour l'agent qui l'a faite et qui gère l'habillement ; inconnue pour les autres.
// L'ouvrir marque lus ses avis. Une requête, plus les droits.
export async function lireDemande(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<VueDemande> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = acteur.type === 'personne' ? acteur.id : null;
	const gere = await gereHabillement(base, acteur, aujourdhui);
	const [[l], fil] = await base.batch([
		base
			.select({ ...colonnes, demandeurId: demandeHabillement.demandeurId, priseParId: demandeHabillement.prisePar, livraison: demandeHabillement.livraison })
			.from(demandeHabillement)
			.innerJoin(personne, eq(personne.id, demandeHabillement.demandeurId))
			.where(eq(demandeHabillement.id, id)),
		base
			.select({ quoi: filHabillement.quoi, texte: filHabillement.texte, le: filHabillement.le, par: filHabillement.par, prenom: personne.prenom, nom: personne.nom })
			.from(filHabillement)
			.innerJoin(personne, eq(personne.id, filHabillement.par))
			.where(eq(filHabillement.demandeId, id))
			.orderBy(asc(filHabillement.id)),
		// Seulement les siens, et seulement s'il voit la demande : rien n'est écrit pour un curieux.
		base
			.update(avisHabillement)
			.set({ lueLe: maintenant })
			.where(and(eq(avisHabillement.personneId, moi ?? 0), eq(avisHabillement.url, lien(id)), isNull(avisHabillement.lueLe), gere ? undefined : sql`EXISTS (SELECT 1 FROM ${demandeHabillement} WHERE ${demandeHabillement.id} = ${id} AND ${demandeHabillement.demandeurId} = ${moi ?? 0})`))
	]);
	if (!l || (l.demandeurId !== moi && !gere)) throw new DonneeInvalide('Demande inconnue');
	const { demandeurId, priseParId, livraison, ...liste } = l;
	return {
		...vue(liste),
		livraison,
		sienne: demandeurId === moi,
		fil: fil.map((f) => ({ quoi: f.quoi, texte: f.texte, le: f.le, par: nomDe(f), deLAgent: f.par === demandeurId })),
		gestes: gestesHabillement({ etape: l.etape, demandeur: demandeurId, prisePar: priseParId }, { moi, gere })
	};
}

// La lecture des demandes à traiter, pour « À décider » : les nouvelles, et celles prises en compte qui attendent leur référent.
export function lectureATraiter(base: Base) {
	return base
		.select({ id: demandeHabillement.id, texte: demandeHabillement.texte, etape: demandeHabillement.etape, prisePar: demandeHabillement.prisePar, prenom: personne.prenom, nom: personne.nom })
		.from(demandeHabillement)
		.innerJoin(personne, eq(personne.id, demandeHabillement.demandeurId))
		.where(or(eq(demandeHabillement.etape, 'demandee'), eq(demandeHabillement.etape, 'prise')))
		.orderBy(asc(demandeHabillement.id));
}
type ATraiter = { id: number; texte: string; etape: EtapeHabillement; prisePar: number | null; prenom: string; nom: string };

// Ce que `moi` a à traiter : les nouvelles (si `nouvelles`), et celles qu'il a prises en compte (réponse reçue, à traiter).
export function habillementADecider(lignes: ATraiter[], moi: number, nouvelles: boolean): ADecider[] {
	const items: ADecider[] = [];
	const n = nouvelles ? lignes.filter((l) => l.etape === 'demandee') : [];
	if (n.length === 1) items.push({ texte: `Demande d’habillement de ${nomDe(n[0])} à prendre en compte`, lien: lien(n[0]!.id) });
	else if (n.length > 1) items.push({ texte: `${n.length} demandes d’habillement à prendre en compte`, lien: '/habillement/toutes' });
	for (const l of lignes.filter((x) => x.etape === 'prise' && x.prisePar === moi)) items.push({ texte: `Habillement, à traiter : ${extraitDemande(l.texte, 60)} (${nomDe(l)})`, lien: lien(l.id) });
	return items;
}

// Conservation (tâche de nuit) : les demandes finies avant `avant` (AAAA-MM-JJ), avec leur fil. Une requête.
export async function effacerVieillesDemandes(base: Base, avant: string): Promise<void> {
	exigerDate(avant);
	const vieilles = base.select({ id: demandeHabillement.id }).from(demandeHabillement).where(lt(demandeHabillement.finLe, avant));
	await base.batch([base.delete(filHabillement).where(inArray(filHabillement.demandeId, vieilles)), base.delete(demandeHabillement).where(lt(demandeHabillement.finLe, avant))]);
}

// Données fictives (préprod, développement local) : quelques demandes à différentes étapes, suivies par `referent`. Relançable, sans doublon.
export async function chargerHabillementFictif(base: Base, maintenant: string, referent: number, demandeurs: number[]): Promise<void> {
	exigerDateHeure(maintenant, 'Date');
	const [a, b = a, c = a] = demandeurs;
	if (a === undefined) return;
	const prevues: { demandeur: number; texte: string; etape: EtapeHabillement; issue?: IssueHabillement; livraison?: string; fil: { quoi: FilHabillement; texte?: string; par: number }[] }[] = [
		{ demandeur: a, texte: 'Veste textile en L, la mienne est déchirée à la manche.', etape: 'demandee', fil: [] },
		{ demandeur: b!, texte: 'Rangers, taille 43.', etape: 'question', fil: [{ quoi: 'prise', par: referent }, { quoi: 'question', texte: 'Montantes ou basses ?', par: referent }] },
		{ demandeur: c!, texte: 'Pantalon F1 en 42, le mien est trop usé aux genoux.', etape: 'traitee', issue: 'commande', fil: [{ quoi: 'prise', par: referent }, { quoi: 'commande', par: referent }] },
		{ demandeur: a, texte: 'Gants d’intervention, taille 9.', etape: 'livree', issue: 'stock', livraison: 'Dans votre casier', fil: [{ quoi: 'prise', par: referent }, { quoi: 'stock', par: referent }, { quoi: 'livraison', texte: 'Dans votre casier', par: referent }] }
	];
	const deja = await base.select({ texte: demandeHabillement.texte, demandeur: demandeHabillement.demandeurId }).from(demandeHabillement);
	for (const p of prevues) {
		if (deja.some((d) => d.texte === p.texte && d.demandeur === p.demandeur)) continue;
		const [d] = await base
			.insert(demandeHabillement)
			.values({ demandeurId: p.demandeur, texte: p.texte, etape: p.etape, issue: p.issue ?? null, prisePar: p.fil.length ? referent : null, livraison: p.livraison ?? null, creeLe: maintenant, majLe: maintenant, finLe: FINIES.includes(p.etape) ? maintenant : null })
			.returning({ id: demandeHabillement.id });
		if (p.fil.length) await base.insert(filHabillement).values(p.fil.map((f) => ({ demandeId: d!.id, quoi: f.quoi, texte: f.texte ?? null, par: f.par, le: maintenant })));
	}
}
