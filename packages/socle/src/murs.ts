import { and, asc, eq, gte, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import type { Base } from './base.ts';
import { requeteTenues, tenuesValides } from './casquettes.ts';
import { enCours } from './dates.ts';
import type { Acteur, Perimetre } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { affectationEquipe, comite, equipe, personne, profil } from './schema.ts';

export type CleMur = 'centre' | 'vie' | `equipe:${number}` | `comite:${number}`;
export type Mur = { cle: CleMur; nom: string; type: 'centre' | 'vie' | 'equipe' | 'comite'; peutPublier: boolean; peutModerer: boolean; lectureSeule: boolean };

// Un modérateur peut aussi publier ; un mur en lecture seule (équipe inactive, comité dissous) ne reçoit plus rien.
function mur(cle: CleMur, nom: string, type: Mur['type'], publie: boolean, modere: boolean, lectureSeule = false): Mur {
	return { cle, nom, type, peutPublier: !lectureSeule && (publie || modere), peutModerer: modere, lectureSeule };
}

// Ce qui relie une personne aux murs ce jour-là. `fiche` : faux pour le super administrateur.
export type Appartenances = { fiche: boolean; tous: boolean; membreEquipe: Set<number>; chefEquipe: Set<number>; membreComite: Set<number>; rapporteur: Set<number> };

// Règle unique, partagée par mursDe et le suivi des publications : à partir des affectations et des rôles tenus (lignes de requeteTenues).
export function appartenances(affectations: { equipeId: number; debut: string; fin: string | null }[], tenues: { type: string; portee: string; perimetreId: number | null; systeme: string | null; nomme: string | null }[], aujourdhui: string): Appartenances {
	const valides = tenuesValides(tenues);
	const a: Appartenances = {
		fiche: true,
		tous: valides.some((l) => l.systeme === 'chef_centre' || l.systeme === 'chef_centre_adjoint'),
		membreEquipe: new Set(),
		chefEquipe: new Set(),
		membreComite: new Set(),
		rapporteur: new Set()
	};
	for (const x of affectations) if (enCours(x.debut, x.fin, aujourdhui)) a.membreEquipe.add(x.equipeId);
	for (const l of valides) {
		if (l.perimetreId === null) continue;
		if (l.type === 'equipe' && l.systeme === 'chef_equipe') a.chefEquipe.add(l.perimetreId);
		if (l.type === 'comite') a.membreComite.add(l.perimetreId);
		if (l.type === 'comite' && l.nomme !== null) a.rapporteur.add(l.perimetreId);
	}
	return a;
}

const SANS_FICHE: Appartenances = { fiche: false, tous: true, membreEquipe: new Set(), chefEquipe: new Set(), membreComite: new Set(), rapporteur: new Set() };

// Membre naturel d'un mur (attendu dans les suivis) : tout agent pour Le centre et Vie du centre ; membres en cours et chef d'équipe
// pour une équipe ; membres en cours (rapporteur compris) pour un comité. Le chef de centre, l'adjoint et le super administrateur qui
// supervisent une équipe ou un comité n'en sont pas membres.
export function estMembre(a: Appartenances, cle: string): boolean {
	if (!a.fiche) return false;
	if (cle === 'centre' || cle === 'vie') return true;
	const [type, numero] = cle.split(':');
	const id = Number(numero);
	if (type === 'equipe') return a.membreEquipe.has(id) || a.chefEquipe.has(id);
	return type === 'comite' && a.membreComite.has(id);
}

// Lectures à placer dans un batch : les agents qui ont accès (ni partis, ni suspendus, ni extérieurs, comme mursDe),
// toutes les affectations en cours et tous les rôles tenus ce jour-là.
export function lecturesAgents(base: Base, aujourdhui: string) {
	return [
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom })
			.from(personne)
			.leftJoin(profil, eq(profil.id, personne.profilId))
			.where(and(inArray(personne.statut, STATUTS_AVEC_ACCES), or(isNull(profil.typePersonne), ne(profil.typePersonne, 'exterieur')))),
		base
			.select({ personneId: affectationEquipe.personneId, equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin })
			.from(affectationEquipe)
			.where(and(lte(affectationEquipe.debut, aujourdhui), or(isNull(affectationEquipe.fin), gte(affectationEquipe.fin, aujourdhui)))),
		requeteTenues(base, null, aujourdhui)
	] as const;
}

type Lu<T> = T extends PromiseLike<infer R> ? R : never;
export type AgentsLus = [Lu<ReturnType<typeof lecturesAgents>[0]>, Lu<ReturnType<typeof lecturesAgents>[1]>, Lu<ReturnType<typeof lecturesAgents>[2]>];
export type AgentDuJour = AgentsLus[0][number] & { a: Appartenances };

// Chaque agent avec ses appartenances du jour, à partir des résultats de lecturesAgents.
export function agentsDuJour([agents, affectations, tenues]: AgentsLus, aujourdhui: string): AgentDuJour[] {
	return agents.map((ag) => ({
		...ag,
		a: appartenances(
			affectations.filter((x) => x.personneId === ag.id),
			tenues.filter((t) => t.personneId === ag.id),
			aujourdhui
		)
	}));
}

export const membresDe = (agents: AgentDuJour[], cle: string) => agents.filter((x) => estMembre(x.a, cle));

// Nombre de membres naturels de chaque mur demandé. Une seule requête (un batch).
export async function audiences(base: Base, cles: CleMur[], aujourdhui: string): Promise<Map<CleMur, number>> {
	const agents = agentsDuJour(await base.batch(lecturesAgents(base, aujourdhui)), aujourdhui);
	return new Map(cles.map((cle) => [cle, membresDe(agents, cle).length]));
}

// Convoqué : membre du mur et, si des équipes sont convoquées, membre en cours ou chef de l'une d'elles.
export function estConvoque(a: Appartenances, cle: string, convoques: 'tous' | number[]): boolean {
	return estMembre(a, cle) && (convoques === 'tous' || convoques.some((id) => a.membreEquipe.has(id) || a.chefEquipe.has(id)));
}

// Droits déduits de l'appartenance du jour : rien n'est enregistré par mur. Une seule requête (un batch).
// Ordre : Le centre, Vie du centre, équipes (actives puis inactives), comités (en cours puis dissous).
export async function mursDe(base: Base, acteur: Acteur, aujourdhui: string): Promise<Mur[]> {
	return (await mursEtAppartenances(base, acteur, aujourdhui)).murs;
}

export async function mursEtAppartenances(base: Base, acteur: Acteur, aujourdhui: string): Promise<{ murs: Mur[]; appartenances: Appartenances }> {
	const lesEquipes = base.select({ id: equipe.id, nom: equipe.nom, active: equipe.active }).from(equipe).orderBy(asc(equipe.ordreRotation));
	const lesComites = base.select({ id: comite.id, nom: comite.nom, dissousLe: comite.dissousLe }).from(comite).orderBy(asc(comite.nom));

	// Chef de centre, adjoint et super administrateur : tous les murs.
	let a = SANS_FICHE;
	let equipes: { id: number; nom: string; active: number }[];
	let comites: { id: number; nom: string; dissousLe: string | null }[];

	if (acteur.type === 'super') {
		[equipes, comites] = await base.batch([lesEquipes, lesComites]);
	} else {
		// Pas de colonnes de même nom issues de tables jointes : dans un batch, D1 n'en garde qu'une.
		const [fiches, tenues, affectations, e, c] = await base.batch([
			base.select({ statut: personne.statut, typePersonne: profil.typePersonne }).from(personne).leftJoin(profil, eq(profil.id, personne.profilId)).where(eq(personne.id, acteur.id)),
			requeteTenues(base, acteur.id, aujourdhui),
			base.select({ equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe).where(eq(affectationEquipe.personneId, acteur.id)),
			lesEquipes,
			lesComites
		]);
		// Agent : ni parti ni suspendu, et pas extérieur ; les autres n'ont aucun mur.
		const fiche = fiches[0];
		if (!fiche || !(STATUTS_AVEC_ACCES as readonly string[]).includes(fiche.statut) || fiche.typePersonne === 'exterieur') return { murs: [], appartenances: { ...SANS_FICHE, tous: false } };
		[equipes, comites] = [e, c];
		a = appartenances(affectations, tenues, aujourdhui);
	}
	const { tous, membreEquipe, chefEquipe, membreComite, rapporteur } = a;

	const murEquipe = equipes
		.filter((e) => tous || membreEquipe.has(e.id) || chefEquipe.has(e.id))
		.map((e) => mur(`equipe:${e.id}`, e.nom, 'equipe', membreEquipe.has(e.id) || chefEquipe.has(e.id), tous || chefEquipe.has(e.id), e.active !== 1));
	// Un comité dissous reste une archive pour le chef, l'adjoint et le super seulement.
	const murComite = comites
		.filter((c) => tous || (membreComite.has(c.id) && c.dissousLe === null))
		.map((c) => mur(`comite:${c.id}`, c.nom, 'comite', membreComite.has(c.id), tous || rapporteur.has(c.id), c.dissousLe !== null));
	return { murs: [mur('centre', 'Le centre', 'centre', tous, tous), mur('vie', 'Vie du centre', 'vie', true, tous), ...ouvertsPuisFermes(murEquipe), ...ouvertsPuisFermes(murComite)], appartenances: a };
}

const ouvertsPuisFermes = (murs: Mur[]) => [...murs.filter((m) => !m.lectureSeule), ...murs.filter((m) => m.lectureSeule)];

const BESOINS = { lire: 'LIRE_SALON', publier: 'PUBLIER_SALON', moderer: 'MODERER_SALON' } as const;

// Le mur, si l'acteur peut le lire, y publier ou le modérer ; RefusDroit sinon.
export async function exigerMur(base: Base, acteur: Acteur, cle: string, aujourdhui: string, besoin: 'lire' | 'publier' | 'moderer'): Promise<Mur> {
	return (await accesMur(base, acteur, cle, aujourdhui, besoin)).mur;
}

// Comme exigerMur, avec les appartenances de l'acteur (pour savoir s'il est convoqué), sans requête de plus.
export async function accesMur(base: Base, acteur: Acteur, cle: string, aujourdhui: string, besoin: 'lire' | 'publier' | 'moderer'): Promise<{ mur: Mur; appartenances: Appartenances }> {
	const forme = /^(?:centre|vie|(equipe|comite):([1-9]\d*))$/.exec(cle);
	if (!forme) throw new DonneeInvalide('Mur inconnu');
	const { murs, appartenances } = await mursEtAppartenances(base, acteur, aujourdhui);
	const trouve = murs.find((m) => m.cle === cle);
	const permis = trouve && (besoin === 'lire' || (besoin === 'publier' ? trouve.peutPublier : trouve.peutModerer));
	if (!permis) throw refusMur(cle, besoin);
	return { mur: trouve, appartenances };
}

export function refusMur(cle: string, besoin: 'lire' | 'publier' | 'moderer', raison = 'Mur non accessible'): RefusDroit {
	const forme = /^(equipe|comite):(\d+)$/.exec(cle);
	const perimetre: Perimetre = forme ? { type: forme[1] as 'equipe' | 'comite', id: Number(forme[2]) } : { type: 'centre' };
	return new RefusDroit(BESOINS[besoin], perimetre, raison);
}
