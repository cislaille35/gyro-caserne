import { json } from '@sveltejs/kit';
import { apercuImport, type FichierLu } from '@gyro-caserne/socle';
import { exigerGestion } from '#lib/server/formulaire-agent.ts';
import { lireJson, pasDuJson, refus } from '#lib/server/fichier-effectif.ts';
import type { RequestHandler } from './$types';

const LIGNES_MAX = 2000;
const textes = (v: unknown): v is string[] => Array.isArray(v) && v.every((t) => typeof t === 'string');
const entier = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

// Le fichier lu vient du navigateur : sa forme est vérifiée avant le calcul.
function estFichierLu(v: unknown): v is FichierLu {
	if (typeof v !== 'object' || v === null) return false;
	const { entetes, lignes, repere } = v as Record<string, unknown>;
	const lignesOk = Array.isArray(lignes) && lignes.every((l) => typeof l === 'object' && l !== null && entier(l.numero) && textes(l.cellules));
	const r = repere as Record<string, unknown> | null;
	const repereOk = r === null || (typeof r === 'object' && entier(r.journal) && entier(r.personne) && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
	return textes(entetes) && lignesOk && repereOk;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	const { acteur, aujourdhui } = await exigerGestion(locals);
	const fichier = await lireJson(request);
	if (fichier === undefined) return pasDuJson();
	if (!estFichierLu(fichier)) return json({ message: 'Fichier mal formé' }, { status: 400 });
	if (fichier.lignes.length > LIGNES_MAX) return json({ message: `Fichier trop long : ${LIGNES_MAX} lignes au plus` }, { status: 400 });
	try {
		return json(await apercuImport(locals.base, acteur, fichier, aujourdhui, locals.superAdmins));
	} catch (erreur) {
		return refus(erreur);
	}
};
