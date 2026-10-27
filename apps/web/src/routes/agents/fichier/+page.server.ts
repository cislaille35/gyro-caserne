import { exigerGestion } from '#lib/server/formulaire-agent.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { aujourdhui } = await exigerGestion(locals);
	return { aujourdhui };
};
