import { inArray, sql } from 'drizzle-orm';
import { auteurVu } from './actions/publications.ts';
import type { Base } from './base.ts';
import type { Acteur } from './droits.ts';
import { iconeDuComite, type NomIcone } from './icones.ts';
import { estMembre, mursEtAppartenances, type CleMur } from './murs.ts';
import { comite, equipe, personne, publication } from './schema.ts';

export type Apercu = {
	cle: CleMur;
	// Membre naturel (estMembre) ; faux pour un mur seulement supervisé.
	membre: boolean;
	icone: NomIcone | 'maison' | null; // null pour une équipe (on affiche son numéro)
	couleur: string | null; // couleur de l'équipe, sinon null
	numero: number | null; // ordreRotation de l'équipe
	derniere: { auteur: string; texte: string; creeLe: string } | null;
};

const LONGUEUR_MAX = 80;

function surUneLigne(texte: string): string {
	const ligne = texte.replace(/\s+/g, ' ').trim();
	return ligne.length > LONGUEUR_MAX ? `${ligne.slice(0, LONGUEUR_MAX - 1)}…` : ligne;
}

// Pour la liste des murs : identité de chaque mur et dernière publication. Deux requêtes au plus.
export async function apercusDesMurs(base: Base, acteur: Acteur, aujourdhui: string): Promise<Apercu[]> {
	const { murs, appartenances } = await mursEtAppartenances(base, acteur, aujourdhui);
	if (murs.length === 0) return [];

	const idsDernieres = sql`select max(${publication.id}) from ${publication} where ${inArray(publication.mur, murs.map((m) => m.cle))} group by ${publication.mur}`;
	const dernieres = base.select().from(publication).where(sql`${publication.id} in (${idsDernieres})`);
	// Les auteurs des dernières publications, sans connaître leurs identifiants à l'avance.
	const auteurs = base
		.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom })
		.from(personne)
		.where(
			sql`${personne.id} in (select cast(substr(${publication.auteur}, 10) as integer) from ${publication} where ${publication.auteur} like 'personne:%' and ${publication.id} in (${idsDernieres}))`
		);
	const [lesDernieres, lesAuteurs, lesEquipes, lesComites] = await base.batch([
		dernieres,
		auteurs,
		base.select({ id: equipe.id, couleur: equipe.couleur, ordreRotation: equipe.ordreRotation }).from(equipe),
		base.select({ id: comite.id, icone: comite.icone, theme: comite.theme }).from(comite)
	]);

	return murs.map((m) => {
		const r: Apercu = { cle: m.cle, membre: estMembre(appartenances, m.cle), icone: null, couleur: null, numero: null, derniere: null };
		const id = m.cle.includes(':') ? Number(m.cle.split(':')[1]) : 0;
		if (m.type === 'centre') r.icone = 'maison';
		else if (m.type === 'vie') r.icone = 'ballon';
		else if (m.type === 'equipe') {
			const e = lesEquipes.find((x) => x.id === id);
			r.couleur = e?.couleur ?? null;
			r.numero = e?.ordreRotation ?? null;
		} else {
			const c = lesComites.find((x) => x.id === id);
			r.icone = c ? iconeDuComite(c) : null;
		}
		const p = lesDernieres.find((x) => x.mur === m.cle);
		if (p) {
			const a = auteurVu(p.auteur, lesAuteurs.find((x) => `personne:${x.id}` === p.auteur));
			r.derniere = { auteur: p.auteur.startsWith('super:') ? 'Super administrateur' : a.prenom || a.nom, texte: surUneLigne(p.texte), creeLe: p.creeLe };
		}
		return r;
	});
}
