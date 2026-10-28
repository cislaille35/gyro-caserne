import { asc, eq } from 'drizzle-orm';
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

// Droits déduits de l'appartenance du jour : rien n'est enregistré par mur. Une seule requête (un batch).
// Ordre : Le centre, Vie du centre, équipes (actives puis inactives), comités (en cours puis dissous).
export async function mursDe(base: Base, acteur: Acteur, aujourdhui: string): Promise<Mur[]> {
	const lesEquipes = base.select({ id: equipe.id, nom: equipe.nom, active: equipe.active }).from(equipe).orderBy(asc(equipe.ordreRotation));
	const lesComites = base.select({ id: comite.id, nom: comite.nom, dissousLe: comite.dissousLe }).from(comite).orderBy(asc(comite.nom));

	// Chef de centre, adjoint et super administrateur : tous les murs.
	let tous = true;
	const membreEquipe = new Set<number>();
	const chefEquipe = new Set<number>();
	const membreComite = new Set<number>();
	const rapporteur = new Set<number>();
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
		if (!fiche || !(STATUTS_AVEC_ACCES as readonly string[]).includes(fiche.statut) || fiche.typePersonne === 'exterieur') return [];
		[equipes, comites] = [e, c];
		const valides = tenuesValides(tenues);
		tous = valides.some((l) => l.systeme === 'chef_centre' || l.systeme === 'chef_centre_adjoint');
		for (const a of affectations) if (enCours(a.debut, a.fin, aujourdhui)) membreEquipe.add(a.equipeId);
		for (const l of valides) {
			if (l.perimetreId === null) continue;
			if (l.type === 'equipe' && l.systeme === 'chef_equipe') chefEquipe.add(l.perimetreId);
			if (l.type === 'comite') membreComite.add(l.perimetreId);
			if (l.type === 'comite' && l.nomme !== null) rapporteur.add(l.perimetreId);
		}
	}

	const murEquipe = equipes
		.filter((e) => tous || membreEquipe.has(e.id) || chefEquipe.has(e.id))
		.map((e) => mur(`equipe:${e.id}`, e.nom, 'equipe', membreEquipe.has(e.id) || chefEquipe.has(e.id), tous || chefEquipe.has(e.id), e.active !== 1));
	// Un comité dissous reste une archive pour le chef, l'adjoint et le super seulement.
	const murComite = comites
		.filter((c) => tous || (membreComite.has(c.id) && c.dissousLe === null))
		.map((c) => mur(`comite:${c.id}`, c.nom, 'comite', membreComite.has(c.id), tous || rapporteur.has(c.id), c.dissousLe !== null));
	return [mur('centre', 'Le centre', 'centre', tous, tous), mur('vie', 'Vie du centre', 'vie', true, tous), ...ouvertsPuisFermes(murEquipe), ...ouvertsPuisFermes(murComite)];
}

const ouvertsPuisFermes = (murs: Mur[]) => [...murs.filter((m) => !m.lectureSeule), ...murs.filter((m) => m.lectureSeule)];

const BESOINS = { lire: 'LIRE_SALON', publier: 'PUBLIER_SALON', moderer: 'MODERER_SALON' } as const;

// Le mur, si l'acteur peut le lire, y publier ou le modérer ; RefusDroit sinon.
export async function exigerMur(base: Base, acteur: Acteur, cle: string, aujourdhui: string, besoin: 'lire' | 'publier' | 'moderer'): Promise<Mur> {
	const forme = /^(?:centre|vie|(equipe|comite):([1-9]\d*))$/.exec(cle);
	if (!forme) throw new DonneeInvalide('Mur inconnu');
	const trouve = (await mursDe(base, acteur, aujourdhui)).find((m) => m.cle === cle);
	const permis = trouve && (besoin === 'lire' || (besoin === 'publier' ? trouve.peutPublier : trouve.peutModerer));
	if (!permis) {
		const perimetre: Perimetre = forme[1] ? { type: forme[1] as 'equipe' | 'comite', id: Number(forme[2]) } : { type: 'centre' };
		throw new RefusDroit(BESOINS[besoin], perimetre, 'Mur non accessible');
	}
	return trouve;
}
