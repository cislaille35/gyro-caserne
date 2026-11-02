import centre from '$centre';
import { prisesDeLaReleve } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { accesEngins } from '#lib/server/engins.ts';
import type { PageServerLoad } from './$types';

// La prise de garde de la relève en cours : chaque engin, où en est sa prise, ses écarts ouverts.
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base } = await accesEngins(locals);
	return prisesDeLaReleve(base, acteur, maintenantParis(), centre.astreinte);
};
