import { listerComites, listerProfils, listerResponsabilites } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { accesReglages, comitesChoix } from '#lib/server/formulaire-reglages.ts';
import type { LayoutServerLoad } from './$types';

// La liste des réglages, rangée par thème : sur la page /reglages, et à côté de chaque page sur ordinateur.
export const load: LayoutServerLoad = async ({ locals }) => {
	const aujourdhui = aujourdhuiParis();
	const { acteur, base, comites, listes, pouvoir } = await accesReglages(locals, aujourdhui);
	return {
		peutPouvoir: pouvoir,
		responsabilites: listes ? await listerResponsabilites(base, acteur, aujourdhui) : null,
		comites: comites ? await listerComites(base, acteur, aujourdhui) : null,
		// Les profils et leurs droits sont l'affaire du chef de centre, de l'adjoint et du super administrateur.
		profils: pouvoir ? await listerProfils(base, acteur, aujourdhui) : null,
		comitesChoix: await comitesChoix(base)
	};
};
