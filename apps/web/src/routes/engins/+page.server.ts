import centre from '$centre';
import { listerEngins, prisesDeLaReleve } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { accesEngins } from '#lib/server/engins.ts';
import type { PageServerLoad } from './$types';

// Caserne → Engins : les engins du centre, où en est leur prise de garde, et, pour qui les gère, les entrées vers les fiches.
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base, aujourdhui } = await accesEngins(locals);
	const [liste, r] = await Promise.all([listerEngins(base, acteur, aujourdhui), prisesDeLaReleve(base, acteur, maintenantParis(), centre.astreinte)]);
	return { ...liste, releve: r.releve, prises: Object.fromEntries(r.engins.map((x) => [x.engin.id, { prise: x.prise, ouvertes: x.ouvertes }])) };
};
