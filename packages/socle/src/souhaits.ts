import { and, eq, lt, sql } from 'drizzle-orm';
import { fetesDuJour } from './a-ne-pas-manquer.ts';
import type { Base } from './base.ts';
import { exigerDate, exigerDateHeure } from './dates.ts';
import type { Acteur } from './droits.ts';
import { DonneeInvalide } from './erreurs.ts';
import { mettreEnFile } from './notifications.ts';
import { personne, profil, souhaitAnniversaire } from './schema.ts';

// « Souhaiter » sous un anniversaire du jour : l'agent fêté est prévenu (cloche et téléphone), une fois par collègue (décision 0033).
// Une lecture, puis un batch.
export async function souhaiter(base: Base, acteur: Acteur, personneId: number, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux personnes ayant une fiche');
	if (acteur.id === personneId) throw new DonneeInvalide('On ne se souhaite pas son propre anniversaire');
	const [[fete], [auteur], [deja]] = await base.batch([
		base
			.select({ id: personne.id })
			.from(personne)
			.leftJoin(profil, eq(profil.id, personne.profilId))
			.where(and(eq(personne.id, personneId), fetesDuJour(aujourdhui))),
		base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.id, acteur.id)),
		base
			.select({ id: souhaitAnniversaire.id })
			.from(souhaitAnniversaire)
			.where(and(eq(souhaitAnniversaire.personneId, personneId), eq(souhaitAnniversaire.jour, aujourdhui), eq(souhaitAnniversaire.auteurId, acteur.id)))
	]);
	if (!fete || !auteur) throw new DonneeInvalide('Pas d’anniversaire à souhaiter aujourd’hui');
	if (deja) return;
	const texte = `${`${auteur.prenom} ${auteur.nom}`.trim()} vous souhaite un joyeux anniversaire 🎂`;
	await base.batch([
		// Revérifié à l'écriture : l'agent a pu masquer son anniversaire entre-temps ; deux appuis simultanés n'écrivent qu'une ligne.
		base
			.insert(souhaitAnniversaire)
			.select(
				base
					.select({ id: sql<number | null>`null`.as('id'), personneId: personne.id, auteurId: sql<number>`${acteur.id}`.as('auteur_id'), jour: sql<string>`${aujourdhui}`.as('jour'), creeLe: sql<string>`${maintenant}`.as('cree_le'), lueLe: sql<string | null>`null`.as('lue_le') })
					.from(personne)
					.leftJoin(profil, eq(profil.id, personne.profilId))
					.where(and(eq(personne.id, personneId), fetesDuJour(aujourdhui)))
			)
			.onConflictDoNothing(),
		// Seulement si la ligne vient d'être écrite (changes() : l'instruction précédente du batch). Lieu « anniversaire » : seul « tout » le coupe.
		mettreEnFile(base, [personneId], 'anniversaire', { titre: 'Joyeux anniversaire', texte, url: '/', tag: `anniversaire:${acteur.id}` }, maintenant, sql`changes() = 1`, 'anniversaire')
	]);
}

// Ménage de nuit : les souhaits des jours passés.
export async function effacerSouhaitsPasses(base: Base, aujourdhui: string): Promise<void> {
	exigerDate(aujourdhui);
	await base.delete(souhaitAnniversaire).where(lt(souhaitAnniversaire.jour, aujourdhui));
}
