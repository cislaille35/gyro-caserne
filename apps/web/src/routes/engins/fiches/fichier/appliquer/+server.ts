import { json } from '@sveltejs/kit';
import { appliquerFiches } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { estFichierFichesLu, exigerGestionEngins } from '#lib/server/engins.ts';
import { lireJson, pasDuJson, refus } from '#lib/server/fichier-effectif.ts';
import type { RequestHandler } from './$types';

// Corps : le fichier lu. Tout d'un bloc, ou rien s'il reste une erreur.
export const POST: RequestHandler = async ({ locals, request }) => {
	const { acteur, base } = await exigerGestionEngins(locals);
	const lu = await lireJson(request);
	if (lu === undefined) return pasDuJson();
	if (!estFichierFichesLu(lu)) return json({ message: 'Fichier mal formé' }, { status: 400 });
	try {
		await appliquerFiches(base, acteur, lu, maintenantParis());
		return json({ ok: true });
	} catch (erreur) {
		return refus(erreur);
	}
};
