import centre from '$centre';
import { donneesFichierPlanning } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { anneeValide, exigerPlanning, json } from '#lib/server/fichier-planning.ts';
import type { RequestHandler } from './$types';

// Ce qu'il faut au navigateur pour écrire le classeur de l'année (?annee=).
export const GET: RequestHandler = async ({ locals, url }) => {
	const acteur = await exigerPlanning(locals);
	return json(await donneesFichierPlanning(locals.base, acteur, anneeValide(url.searchParams.get('annee')), maintenantParis(), centre.astreinte));
};
