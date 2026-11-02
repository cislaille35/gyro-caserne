import { listerEngins } from '@gyro-caserne/socle';
import { accesEngins } from '#lib/server/engins.ts';
import type { PageServerLoad } from './$types';

// Caserne → Engins : les engins du centre et, pour qui les gère, les entrées vers les fiches.
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base, aujourdhui } = await accesEngins(locals);
	return listerEngins(base, acteur, aujourdhui);
};
