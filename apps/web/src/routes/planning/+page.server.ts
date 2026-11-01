import centre from '$centre';
import { planningDe } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { anneeDe, connecte, ouRefus } from '#lib/server/planning.ts';
import type { PageServerLoad } from './$types';

// « Mon année » par défaut ; « Toutes les équipes » pour qui n'a pas d'équipe, ou à la demande (?vue=equipes).
export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = connecte(locals);
	const maintenant = maintenantParis();
	const planning = await ouRefus(planningDe(base, acteur, anneeDe(url), maintenant, centre.astreinte), 'Le planning est réservé aux agents du centre.');
	const sansEquipe = planning.publiee && planning.monEquipe === null && !planning.semaines.some((s) => s.mienne);
	const vue = url.searchParams.get('vue') === 'equipes' || sansEquipe ? 'equipes' : 'moi';
	return { planning, vue, maintenant: maintenant.slice(0, 16) };
};
