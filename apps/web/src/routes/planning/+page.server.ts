import centre from '$centre';
import { DonneeInvalide, planningDe, RefusDroit, remplacementsDe } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { gestes } from '#lib/server/gestes-mur.ts';
import { anneeDe, connecte, ouRefus } from '#lib/server/planning.ts';
import type { Actions, PageServerLoad } from './$types';

const VUES = ['semaine', 'mois', 'annee', 'equipes'] as const;
type Vue = (typeof VUES)[number];

// La vue est dans l'adresse (?vue=, ?semaine=, ?mois=) : flèches et puces marchent sans JavaScript.
// Par défaut, la Semaine ; « Équipes » pour qui n'a pas d'équipe.
export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = connecte(locals);
	const maintenant = maintenantParis().slice(0, 16);
	const annee = anneeDe(url);
	const [planning, listes] = await Promise.all([
		ouRefus(planningDe(base, acteur, annee, maintenant, centre.astreinte), 'Le planning est réservé aux agents du centre.'),
		acteur.type === 'personne'
			? remplacementsDe(base, acteur, maintenant, centre.astreinte).catch((e) => {
					if (e instanceof RefusDroit || e instanceof DonneeInvalide) return null;
					throw e;
				})
			: null
	]);
	const sansEquipe = planning.publiee && planning.monEquipe === null && !planning.semaines.some((s) => s.mienne);
	const demandee = url.searchParams.get('vue') === 'moi' ? 'annee' : VUES.find((v) => v === url.searchParams.get('vue'));
	const vue: Vue = demandee ?? (sansEquipe ? 'equipes' : 'semaine');

	const semaines = planning.publiee ? planning.semaines : [];
	const enCours = semaines.find((s) => s.periodes[0]!.debut.slice(0, 10) <= maintenant.slice(0, 10) && maintenant < s.periodes.at(-1)!.fin);
	const brute = url.searchParams.get('semaine');
	const semaine = (brute === 'derniere' ? semaines.at(-1) : semaines.find((s) => s.debut === brute)) ?? enCours ?? semaines[0];
	const moisBrut = Number(url.searchParams.get('mois'));
	const moisCourant = annee === Number(maintenant.slice(0, 4)) ? Number(maintenant.slice(5, 7)) : 1;
	const mois = Number.isInteger(moisBrut) && moisBrut >= 1 && moisBrut <= 12 ? moisBrut : moisCourant;

	const remplacements = { miennes: listes?.miennes ?? [], pourMoi: listes?.pourMoi ?? [], aValider: listes?.aValider ?? [] };
	return { planning, vue, vueDemandee: demandee !== undefined, semaine: semaine?.debut ?? null, mois, moisCourant, remplacements, maintenant };
};

// Répondre à la manœuvre annoncée, sans quitter le planning.
export const actions: Actions = { repondre: ({ locals, request }) => gestes.repondre({ locals, params: {}, request }) };
