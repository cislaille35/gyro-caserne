import centre from '$centre';
import { apercuPlanning } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { lireJson, pasDuJson, refus } from '#lib/server/fichier-effectif.ts';
import { anneeValide, estFichierPlanningLu, exigerPlanning, json } from '#lib/server/fichier-planning.ts';
import type { RequestHandler } from './$types';

// Corps : { annee, lu }. Rien n'est écrit.
export const POST: RequestHandler = async ({ locals, request }) => {
	const acteur = await exigerPlanning(locals);
	const corps = (await lireJson(request)) as { annee?: unknown; lu?: unknown } | undefined;
	if (corps === undefined) return pasDuJson();
	if (!estFichierPlanningLu(corps?.lu)) return json({ message: 'Fichier mal formé' }, { status: 400 });
	try {
		return json(await apercuPlanning(locals.base, acteur, anneeValide(corps.annee), corps.lu, maintenantParis(), centre.astreinte));
	} catch (erreur) {
		return refus(erreur);
	}
};
