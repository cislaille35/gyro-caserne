import { and, asc, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours, exigerDateHeure } from '../dates.ts';
import { ligneJournal } from '../journal.ts';
import { notifierConvoques } from '../notifications.ts';
import { anneePlanning, manoeuvre, publication } from '../schema.ts';
import { rangDuJour } from './calendrier.ts';

// Les manœuvres s'annoncent seules sur « Le centre », deux semaines avant, signées « Planning du centre » (auteur `planning`).
// Le petit-déjeuner est un sondage dans la même publication. Le mercredi d'avant, une relance aux convoqués sans réponse.

export const AUTEUR_PLANNING = 'planning';
const JOURS_AVANT = 14;
const QUESTION = 'Petit-déjeuner ?';

// Le mercredi qui précède la manœuvre d'au moins 2 jours.
export function mercrediDeRelance(date: string): string {
	const limite = ajouterJours(date.slice(0, 10), -2);
	return ajouterJours(limite, -((rangDuJour(limite) - 2 + 7) % 7));
}

// Le sondage ferme le vendredi qui précède la manœuvre, à 18 h (le temps de commander) ; si c'est passé, au début de la manœuvre.
export function clotureSondage(debut: string, maintenant: string): string {
	const veille = ajouterJours(debut.slice(0, 10), -1);
	const vendredi = `${ajouterJours(veille, -((rangDuJour(veille) - 4 + 7) % 7))}T18:00`;
	return vendredi > maintenant.slice(0, 16) ? vendredi : debut.slice(0, 16);
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
// « dimanche 29 novembre, 8 h 30 »
function quand(debut: string): string {
	const [h, m] = debut.slice(11, 16).split(':');
	return `${JOURS[rangDuJour(debut)]} ${Number(debut.slice(8, 10))} ${MOIS[Number(debut.slice(5, 7)) - 1]}, ${Number(h)} h${m === '00' ? '' : ` ${m}`}`;
}

type Manoeuvre = typeof manoeuvre.$inferSelect;

// Les colonnes de la publication d'une manœuvre. `ouverture` : celle du sondage déjà publié, gardée lors d'un changement.
// `cloture` : celle du sondage, gardée si la date de la manœuvre ne change pas.
export function colonnesPublication(m: Pick<Manoeuvre, 'debut' | 'theme' | 'lieu' | 'convoques' | 'petitDejeuner'>, maintenant: string, ouverture?: string | null, cloture?: string | null) {
	const sondage = m.petitDejeuner === 1;
	return {
		texte: `Manœuvre : ${m.theme}`,
		debut: m.debut,
		lieu: m.lieu,
		convoques: m.convoques,
		sondageQuestion: sondage ? QUESTION : null,
		sondageReponses: sondage ? JSON.stringify(['Oui', 'Non']) : null,
		sondageOuverture: sondage ? (ouverture ?? maintenant.slice(0, 16)) : null,
		sondageCloture: sondage ? (cloture ?? clotureSondage(m.debut, maintenant)) : null
	};
}

const pdj = (m: Pick<Manoeuvre, 'petitDejeuner'>) => (m.petitDejeuner === 1 ? ' Petit-déjeuner : répondez au sondage avant vendredi 18 h.' : '');

// Chaque matin (voir planifie.ts) : annonce les manœuvres à 14 jours ou moins, relance le mercredi d'avant.
// Seulement les années publiées ; une manœuvre annulée ou commencée n'est plus traitée.
export async function planningDuMatin(base: Base, maintenant: string): Promise<{ publiees: number; relances: number }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const [annees, liste] = await base.batch([
		base.select({ annee: anneePlanning.annee, publieeLe: anneePlanning.publieeLe }).from(anneePlanning),
		base
			.select({
				id: manoeuvre.id,
				debut: manoeuvre.debut,
				theme: manoeuvre.theme,
				lieu: manoeuvre.lieu,
				convoques: manoeuvre.convoques,
				petitDejeuner: manoeuvre.petitDejeuner,
				publicationId: manoeuvre.publicationId,
				relanceLe: manoeuvre.relanceLe,
				annonceeLe: manoeuvre.annonceeLe
			})
			.from(manoeuvre)
			.where(and(isNull(manoeuvre.annuleeLe), gt(manoeuvre.debut, maintenant.slice(0, 16)), lte(manoeuvre.debut, `${ajouterJours(aujourdhui, JOURS_AVANT)}T23:59`)))
			.orderBy(asc(manoeuvre.debut))
	]);
	const publiees = new Set(annees.filter((a) => a.publieeLe !== null).map((a) => a.annee));
	let n = 0;
	let relances = 0;
	for (const m of liste) {
		if (!publiees.has(Number(m.debut.slice(0, 4)))) continue;
		if (m.annonceeLe === null) {
			const [lignes] = await base.batch([
				base
					.insert(publication)
					.values({ mur: 'centre', auteur: AUTEUR_PLANNING, type: 'evenement', creeLe: maintenant, ...colonnesPublication(m, maintenant) })
					.returning({ id: publication.id }),
				base.update(manoeuvre).set({ publicationId: sqlDernierePublication(), annonceeLe: maintenant }).where(eq(manoeuvre.id, m.id)),
				ligneJournal(base, { acteur: AUTEUR_PLANNING, action: 'annoncer_manoeuvre', cibleType: 'manoeuvre', cibleId: m.id }, maintenant)
			]);
			await notifierConvoques(base, lignes[0]!.id, maintenant, { titre: `Manœuvre : ${m.theme}`, texte: `${quand(m.debut)} · ${m.lieu}.${pdj(m)}`, seulementSansReponse: false });
			n++;
		} else if (m.publicationId !== null && m.relanceLe === null && aujourdhui >= mercrediDeRelance(m.debut) && m.annonceeLe.slice(0, 10) < aujourdhui) {
			await base.update(manoeuvre).set({ relanceLe: maintenant }).where(eq(manoeuvre.id, m.id));
			await notifierConvoques(base, m.publicationId, maintenant, { titre: `Rappel : manœuvre ${m.theme}`, texte: `${quand(m.debut)} · ${m.lieu}. Dites si vous serez présent.${pdj(m)}`, seulementSansReponse: true });
			relances++;
		}
	}
	return { publiees: n, relances };
}

// Le batch est une transaction : la publication insérée juste avant a le plus grand identifiant.
const sqlDernierePublication = () => sql<number>`(select max(${publication.id}) from ${publication})`;

// Après un changement ou une annulation par le chef : les convoqués d'une manœuvre déjà annoncée sont prévenus.
export async function manoeuvreChangee(base: Base, id: number, maintenant: string): Promise<void> {
	exigerDateHeure(maintenant, 'Date');
	const [m] = await base.select().from(manoeuvre).where(eq(manoeuvre.id, id));
	if (!m || m.publicationId === null) return;
	const titre = m.annuleeLe !== null ? `Manœuvre annulée : ${m.theme}` : `Manœuvre modifiée : ${m.theme}`;
	await notifierConvoques(base, m.publicationId, maintenant, { titre, texte: `${quand(m.debut)} · ${m.lieu}.`, seulementSansReponse: false });
}
