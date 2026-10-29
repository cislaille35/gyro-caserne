import { json } from '@sveltejs/kit';
import { appliquerOperation, type Operation } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerGestion } from '#lib/server/formulaire-agent.ts';
import { lireJson, pasDuJson, refus } from '#lib/server/fichier-effectif.ts';
import type { RequestHandler } from './$types';

// Une opération de l'aperçu ; le socle vérifie sa forme.
export const POST: RequestHandler = async ({ locals, request }) => {
	const { acteur } = await exigerGestion(locals);
	const corps = await lireJson(request);
	if (corps === undefined) return pasDuJson();
	const { operation, nouvelles } = (typeof corps === 'object' && corps !== null ? corps : {}) as { operation?: Operation; nouvelles?: Record<number, number> };
	try {
		return json(await appliquerOperation(locals.base, locals.basePhotos, acteur, operation as Operation, nouvelles as Record<number, number>, maintenantParis(), locals.superAdmins));
	} catch (erreur) {
		return refus(erreur);
	}
};
