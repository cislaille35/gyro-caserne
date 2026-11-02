import { exigerGestionEngins } from '#lib/server/engins.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { aujourdhui } = await exigerGestionEngins(locals);
	return { aujourdhui };
};
