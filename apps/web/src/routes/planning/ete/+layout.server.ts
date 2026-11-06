import centre from '$centre';
import { eteAPreparer } from '@gyro-caserne/socle';
import { etapeEteDe } from '#lib/planning/ete.ts';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { anneeDe, connecte, ouRefus } from '#lib/server/planning.ts';
import type { LayoutServerLoad } from './$types';

// L'été de l'année (?annee=), à l'étape ?etape=. Il ne lit que ces deux paramètres : ouvrir une plage ou un panneau
// (+page.server.ts) ne le fait pas recalculer.
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { acteur, base } = connecte(locals);
	const ete = await ouRefus(eteAPreparer(base, acteur, anneeDe(url), maintenantParis(), centre.astreinte), 'L’été est réservé à qui gère le planning du centre.');
	return { ete, etape: etapeEteDe(url, ete) };
};
