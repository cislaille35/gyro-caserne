import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDate } from '../dates.ts';
import { accorde, droitsDe, estChefDeCentre, type Acteur, type DroitAccorde, type Perimetre } from '../droits.ts';
import { estGestionnaire } from '../effectif.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { finirOuSupprimer } from '../fin-de-periode.ts';
import { ligneJournal } from '../journal.ts';
import type { TypePerimetre } from '../listes.ts';
import { attribution, comite, equipe, personne, responsabilite } from '../schema.ts';
import { nomActeur } from './personnes.ts';

type Responsabilite = typeof responsabilite.$inferSelect;

// Ce qu'il faut savoir de l'acteur pour appliquer les règles : lu une fois, puis réutilisé pour chaque cas.
type Contexte = { acteur: Acteur; droits: DroitAccorde[]; estChef: boolean };

async function contexteDe(base: Base, acteur: Acteur, aujourdhui: string): Promise<Contexte> {
	const estChef = acteur.type === 'personne' && (await estChefDeCentre(base, acteur.id, aujourdhui));
	return { acteur, droits: await droitsDe(base, acteur, aujourdhui), estChef };
}

// Seule définition de « qui peut attribuer ou retirer telle responsabilité sur tel périmètre ».
function exigerAttribution(contexte: Contexte, laResponsabilite: Responsabilite, perimetre: Perimetre) {
	// Exceptions aux droits : le chef de centre est nommé par un super administrateur, son adjoint par le chef de centre.
	if (laResponsabilite.systeme === 'chef_centre') {
		if (contexte.acteur.type !== 'super') throw new RefusDroit('ATTRIBUER_RESPONSABILITE', { type: 'centre' }, 'Seul un super administrateur nomme ou retire le chef de centre');
		return;
	}
	if (laResponsabilite.systeme === 'chef_centre_adjoint') {
		if (contexte.acteur.type !== 'super' && !contexte.estChef) {
			throw new RefusDroit('ATTRIBUER_RESPONSABILITE', { type: 'centre' }, 'Seul le chef de centre nomme ou retire un adjoint');
		}
		return;
	}
	let vise: Perimetre;
	if (laResponsabilite.comiteAttributeurId !== null) vise = { type: 'comite', id: laResponsabilite.comiteAttributeurId };
	else if (perimetre.type === 'comite') vise = perimetre;
	else vise = { type: 'centre' };
	if (!accorde(contexte.droits, 'ATTRIBUER_RESPONSABILITE', vise)) throw new RefusDroit('ATTRIBUER_RESPONSABILITE', vise);
}

function peutAttribuer(contexte: Contexte, laResponsabilite: Responsabilite, perimetre: Perimetre): boolean {
	try {
		exigerAttribution(contexte, laResponsabilite, perimetre);
		return true;
	} catch (erreur) {
		if (erreur instanceof RefusDroit) return false;
		throw erreur;
	}
}

// La même règle, droits de l'acteur lus une seule fois : pour juger de nombreux cas (aperçu d'un import).
export async function regleDAttribution(base: Base, acteur: Acteur, aujourdhui: string): Promise<(laResponsabilite: Responsabilite, perimetre: Perimetre) => boolean> {
	const contexte = await contexteDe(base, acteur, aujourdhui);
	return (laResponsabilite, perimetre) => peutAttribuer(contexte, laResponsabilite, perimetre);
}

function perimetreDeLigne(type: TypePerimetre, id: number | null): Perimetre {
	return type === 'centre' || id === null ? { type: 'centre' } : { type, id };
}

async function responsabiliteConnue(base: Base, id: number): Promise<Responsabilite> {
	const [ligne] = await base.select().from(responsabilite).where(eq(responsabilite.id, id));
	if (!ligne) throw new DonneeInvalide('Responsabilité inconnue');
	return ligne;
}

export async function attribuer(
	base: Base,
	acteur: Acteur,
	a: { personneId: number; responsabiliteId: number; perimetre: Perimetre; debut: string; fin?: string; compteRendu?: string },
	aujourdhui: string
): Promise<number> {
	exigerDate(aujourdhui);
	exigerDate(a.debut);
	if (a.fin !== undefined) exigerDate(a.fin);
	const laResponsabilite = await responsabiliteConnue(base, a.responsabiliteId);
	if (laResponsabilite.archiveeLe !== null) throw new DonneeInvalide('Responsabilité archivée');
	if (a.perimetre.type !== laResponsabilite.typePerimetre) throw new DonneeInvalide('Périmètre différent de celui de la responsabilité');
	if (a.fin !== undefined && a.fin < a.debut) throw new DonneeInvalide('Fin avant le début');
	const [fiche] = await base.select({ id: personne.id, statut: personne.statut }).from(personne).where(eq(personne.id, a.personneId));
	if (!fiche) throw new DonneeInvalide('Personne inconnue');
	if (fiche.statut === 'parti') throw new DonneeInvalide('Cette personne est partie');
	if (a.perimetre.type === 'equipe') {
		const [uneEquipe] = await base.select({ id: equipe.id }).from(equipe).where(eq(equipe.id, a.perimetre.id));
		if (!uneEquipe) throw new DonneeInvalide('Équipe inconnue');
	}
	if (a.perimetre.type === 'comite') {
		const [unComite] = await base.select({ id: comite.id, dissousLe: comite.dissousLe }).from(comite).where(eq(comite.id, a.perimetre.id));
		if (!unComite) throw new DonneeInvalide('Comité inconnu');
		if (unComite.dissousLe !== null) throw new DonneeInvalide('Comité dissous');
	}

	exigerAttribution(await contexteDe(base, acteur, aujourdhui), laResponsabilite, a.perimetre);

	// Même personne, même rôle, même périmètre, périodes qui se chevauchent : refusé.
	const memePerimetre = a.perimetre.type === 'centre' ? isNull(attribution.perimetreId) : eq(attribution.perimetreId, a.perimetre.id);
	const [doublon] = await base
		.select({ id: attribution.id })
		.from(attribution)
		.where(
			and(
				eq(attribution.personneId, a.personneId),
				eq(attribution.responsabiliteId, a.responsabiliteId),
				eq(attribution.perimetreType, a.perimetre.type),
				memePerimetre,
				or(isNull(attribution.fin), gte(attribution.fin, a.debut)),
				a.fin === undefined ? undefined : lte(attribution.debut, a.fin)
			)
		)
		.limit(1);
	if (doublon) throw new DonneeInvalide('Cette personne tient déjà ce rôle sur cette période');

	const qui = nomActeur(acteur);
	const [lignes] = await base.batch([
		base
			.insert(attribution)
			.values({
				personneId: a.personneId,
				responsabiliteId: a.responsabiliteId,
				perimetreType: a.perimetre.type,
				perimetreId: a.perimetre.type === 'centre' ? null : a.perimetre.id,
				debut: a.debut,
				fin: a.fin ?? null,
				saisiePar: qui,
				saisieLe: aujourdhui,
				compteRendu: a.compteRendu ?? null
			})
			.returning({ id: attribution.id }),
		// L'ordre compte : le journal suit l'insertion, last_insert_rowid() est l'id de l'attribution.
		ligneJournal(base, { acteur: qui, action: 'attribuer', cibleType: 'attribution', cibleId: sql`last_insert_rowid()`, details: { personneId: a.personneId, responsabiliteId: a.responsabiliteId, perimetre: a.perimetre, debut: a.debut, fin: a.fin ?? null } }, aujourdhui)
	]);
	return lignes[0]!.id;
}

export async function finirAttribution(base: Base, acteur: Acteur, attributionId: number, fin: string, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	exigerDate(fin);
	const [ligne] = await base.select().from(attribution).where(eq(attribution.id, attributionId));
	if (!ligne) throw new DonneeInvalide('Attribution inconnue');
	if (fin < ligne.debut) throw new DonneeInvalide('Fin avant le début');
	if (ligne.fin !== null && fin > ligne.fin) throw new DonneeInvalide('Une attribution ne peut qu’être raccourcie');
	const laResponsabilite = await responsabiliteConnue(base, ligne.responsabiliteId);
	exigerAttribution(await contexteDe(base, acteur, aujourdhui), laResponsabilite, perimetreDeLigne(ligne.perimetreType, ligne.perimetreId));

	await base.batch([
		base.update(attribution).set({ fin }).where(eq(attribution.id, attributionId)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'finir_attribution', cibleType: 'attribution', cibleId: attributionId, details: { fin } }, aujourdhui)
	]);
}

// « Terminer » : la personne perd le rôle aujourd'hui (fin la veille, ou annulation s'il commençait aujourd'hui ou plus tard).
export async function terminerAttribution(base: Base, acteur: Acteur, attributionId: number, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	const [ligne] = await base.select().from(attribution).where(eq(attribution.id, attributionId));
	if (!ligne) throw new DonneeInvalide('Attribution inconnue');
	const laResponsabilite = await responsabiliteConnue(base, ligne.responsabiliteId);
	exigerAttribution(await contexteDe(base, acteur, aujourdhui), laResponsabilite, perimetreDeLigne(ligne.perimetreType, ligne.perimetreId));
	if (ligne.fin !== null && ligne.fin < aujourdhui) throw new DonneeInvalide('Attribution déjà terminée');

	const [supprimer, terminer] = finirOuSupprimer(base, attribution, eq(attribution.id, attributionId), aujourdhui);
	await base.batch([
		supprimer,
		terminer,
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'terminer_attribution', cibleType: 'attribution', cibleId: attributionId, details: { annulee: ligne.debut >= aujourdhui } }, aujourdhui)
	]);
}

// Lectures

export type PerimetreNomme = { type: TypePerimetre; id: number | null; nom: string | null };

export type LigneAttribution = {
	id: number;
	responsabilite: { id: number; nom: string };
	perimetre: PerimetreNomme;
	debut: string;
	fin: string | null;
	saisiePar: string;
	peutTerminer: boolean;
};

export type Titulaire = {
	id: number;
	personne: { id: number; prenom: string; nom: string };
	perimetre: PerimetreNomme;
	debut: string;
	fin: string | null;
};

export type CeQueJePeuxAttribuer = {
	responsabiliteId: number;
	nom: string;
	portee: TypePerimetre;
	perimetres: { type: TypePerimetre; id: number | null; nom: string }[];
}[];

// Nom d'un périmètre : celui de l'équipe ou du comité, rien pour le centre.
async function nommeurDePerimetres(base: Base) {
	const equipes = new Map((await base.select({ id: equipe.id, nom: equipe.nom }).from(equipe)).map((e) => [e.id, e.nom]));
	const comites = new Map((await base.select({ id: comite.id, nom: comite.nom }).from(comite)).map((c) => [c.id, c.nom]));
	return (type: TypePerimetre, id: number | null): PerimetreNomme => {
		const nom = id === null ? null : type === 'equipe' ? equipes.get(id) : type === 'comite' ? comites.get(id) : null;
		return { type, id, nom: nom ?? null };
	};
}

// Les rôles d'une personne, pour sa fiche (gestionnaires seulement).
export async function attributionsDe(
	base: Base,
	acteur: Acteur,
	personneId: number,
	aujourdhui: string
): Promise<{ enCours: LigneAttribution[]; aVenir: LigneAttribution[]; passees: LigneAttribution[] }> {
	exigerDate(aujourdhui);
	if (!(await estGestionnaire(base, acteur, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' });
	const contexte = await contexteDe(base, acteur, aujourdhui);
	const nommer = await nommeurDePerimetres(base);
	const lignes = await base
		.select({ a: attribution, r: responsabilite })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.where(eq(attribution.personneId, personneId))
		.orderBy(attribution.debut, attribution.id);

	// Auteur : « Prénom Nom », ou « Super administrateur ».
	const idsAuteurs = lignes.flatMap(({ a }) => (a.saisiePar.startsWith('personne:') ? [Number(a.saisiePar.slice('personne:'.length))] : []));
	const auteurs = new Map(
		idsAuteurs.length === 0 ? [] : (await base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne).where(inArray(personne.id, idsAuteurs))).map((p) => [`personne:${p.id}`, `${p.prenom} ${p.nom}`])
	);
	const auteur = (saisiePar: string) => (saisiePar.startsWith('super:') ? 'Super administrateur' : (auteurs.get(saisiePar) ?? saisiePar));

	const resultat = { enCours: [] as LigneAttribution[], aVenir: [] as LigneAttribution[], passees: [] as LigneAttribution[] };
	for (const { a, r } of lignes) {
		const passee = a.fin !== null && a.fin < aujourdhui;
		const ligne: LigneAttribution = {
			id: a.id,
			responsabilite: { id: r.id, nom: r.nom },
			perimetre: nommer(a.perimetreType, a.perimetreId),
			debut: a.debut,
			fin: a.fin,
			saisiePar: auteur(a.saisiePar),
			peutTerminer: !passee && peutAttribuer(contexte, r, perimetreDeLigne(a.perimetreType, a.perimetreId))
		};
		if (passee) resultat.passees.unshift(ligne);
		else if (a.debut > aujourdhui) resultat.aVenir.push(ligne);
		else resultat.enCours.push(ligne);
	}
	return resultat;
}

type Candidat = CeQueJePeuxAttribuer[number]['perimetres'][number];

// Responsabilités non archivées, et périmètres où les attribuer (équipes actives, comités non dissous).
async function candidats(base: Base): Promise<{ responsabilites: Responsabilite[]; perimetres: Record<TypePerimetre, Candidat[]> }> {
	const responsabilites = (await base.select().from(responsabilite).where(isNull(responsabilite.archiveeLe))).sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
	const equipes = await base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(equipe.ordreRotation);
	const comites = (await base.select({ id: comite.id, nom: comite.nom }).from(comite).where(isNull(comite.dissousLe))).sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
	// Les salons et ressources n'existent pas encore : rien à proposer.
	return {
		responsabilites,
		perimetres: {
			centre: [{ type: 'centre', id: null, nom: 'Centre' }],
			equipe: equipes.map((e) => ({ type: 'equipe', id: e.id, nom: e.nom })),
			comite: comites.map((c) => ({ type: 'comite', id: c.id, nom: c.nom })),
			salon: [],
			ressource: []
		}
	};
}

// Les responsabilités que l'acteur peut attribuer, et sur quels périmètres.
export async function ceQueJePeuxAttribuer(base: Base, acteur: Acteur, aujourdhui: string): Promise<CeQueJePeuxAttribuer> {
	exigerDate(aujourdhui);
	const contexte = await contexteDe(base, acteur, aujourdhui);
	const { responsabilites, perimetres } = await candidats(base);
	return responsabilites
		.map((r) => ({
			responsabiliteId: r.id,
			nom: r.nom,
			portee: r.typePerimetre,
			perimetres: perimetres[r.typePerimetre].filter((p) => peutAttribuer(contexte, r, perimetreDeLigne(p.type, p.id)))
		}))
		.filter((r) => r.perimetres.length > 0);
}

// Même règle que ceQueJePeuxAttribuer, mais s'arrête au premier rôle attribuable (pour le menu).
export async function peutAttribuerQuelqueChose(base: Base, acteur: Acteur, aujourdhui: string): Promise<boolean> {
	exigerDate(aujourdhui);
	if (acteur.type === 'super') return true;
	const contexte = await contexteDe(base, acteur, aujourdhui);
	const { responsabilites, perimetres } = await candidats(base);
	return responsabilites.some((r) => perimetres[r.typePerimetre].some((p) => peutAttribuer(contexte, r, perimetreDeLigne(p.type, p.id))));
}

// Titulaires en cours et à venir des responsabilités données, sur les périmètres que l'acteur peut attribuer.
async function titulaires(base: Base, contexte: Contexte, responsabilites: Responsabilite[], aujourdhui: string): Promise<Map<number, Titulaire[]>> {
	const parRole = new Map(responsabilites.map((r) => [r.id, [] as Titulaire[]]));
	if (responsabilites.length === 0) return parRole;
	const parId = new Map(responsabilites.map((r) => [r.id, r]));
	const nommer = await nommeurDePerimetres(base);
	const lignes = await base
		.select({ a: attribution, p: { id: personne.id, prenom: personne.prenom, nom: personne.nom } })
		.from(attribution)
		.innerJoin(personne, eq(personne.id, attribution.personneId))
		.where(and(inArray(attribution.responsabiliteId, [...parId.keys()]), or(isNull(attribution.fin), gte(attribution.fin, aujourdhui))))
		.orderBy(attribution.debut, personne.nom, personne.prenom, attribution.id);
	for (const { a, p } of lignes) {
		if (!peutAttribuer(contexte, parId.get(a.responsabiliteId)!, perimetreDeLigne(a.perimetreType, a.perimetreId))) continue;
		parRole.get(a.responsabiliteId)!.push({ id: a.id, personne: p, perimetre: nommer(a.perimetreType, a.perimetreId), debut: a.debut, fin: a.fin });
	}
	return parRole;
}

export async function titulairesDe(base: Base, acteur: Acteur, responsabiliteId: number, aujourdhui: string): Promise<Titulaire[]> {
	exigerDate(aujourdhui);
	const laResponsabilite = await responsabiliteConnue(base, responsabiliteId);
	const contexte = await contexteDe(base, acteur, aujourdhui);
	return (await titulaires(base, contexte, [laResponsabilite], aujourdhui)).get(responsabiliteId)!;
}

// Les titulaires de chaque responsabilité que l'acteur peut attribuer, ses droits lus une seule fois.
export async function titulairesDesMiens(base: Base, acteur: Acteur, aujourdhui: string): Promise<Map<number, Titulaire[]>> {
	exigerDate(aujourdhui);
	const contexte = await contexteDe(base, acteur, aujourdhui);
	const { responsabilites, perimetres } = await candidats(base);
	const miennes = responsabilites.filter((r) => perimetres[r.typePerimetre].some((p) => peutAttribuer(contexte, r, perimetreDeLigne(p.type, p.id))));
	return titulaires(base, contexte, miennes, aujourdhui);
}
