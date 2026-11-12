import centre from '$centre';
import { appliquerPlanning, manoeuvreChangee } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { lireJson, pasDuJson, refus } from '#lib/server/fichier-effectif.ts';
import { anneeValide, estFichierPlanningLu, exigerPlanning, json } from '#lib/server/fichier-planning.ts';
import { annoncerSiJournee } from '#lib/server/planning.ts';
import { enArrierePlan } from '#lib/server/notifier.ts';
import type { RequestHandler } from './$types';

// Corps : { annee, lu }. Tout est appliqué d'un bloc ; les convoqués des manœuvres annoncées qui changent sont prévenus.
export const POST: RequestHandler = async ({ locals, request }) => {
	const acteur = await exigerPlanning(locals);
	const corps = (await lireJson(request)) as { annee?: unknown; lu?: unknown } | undefined;
	if (corps === undefined) return pasDuJson();
	if (!estFichierPlanningLu(corps?.lu)) return json({ message: 'Fichier mal formé' }, { status: 400 });
	try {
		const { changees } = await appliquerPlanning(locals.base, acteur, anneeValide(corps.annee), corps.lu, maintenantParis(), centre.astreinte, centre.manoeuvres);
		for (const id of changees) enArrierePlan(locals, () => manoeuvreChangee(locals.base, id, maintenantParis()));
		annoncerSiJournee(locals);
		return json({ ok: true });
	} catch (erreur) {
		return refus(erreur);
	}
};
