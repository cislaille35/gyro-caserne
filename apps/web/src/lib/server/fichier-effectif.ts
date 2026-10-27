import { json } from '@sveltejs/kit';
import { DonneeInvalide, RefusDroit } from '@gyro-caserne/socle';

// Corps JSON de la requête ; `undefined` s'il n'en est pas un.
export async function lireJson(request: Request): Promise<unknown> {
	if (!request.headers.get('content-type')?.startsWith('application/json')) return undefined;
	try {
		return await request.json();
	} catch {
		return undefined;
	}
}

export const pasDuJson = () => json({ message: 'Corps JSON attendu' }, { status: 415 });

// Traduit un refus du socle en réponse JSON ; toute autre erreur remonte.
export function refus(erreur: unknown) {
	if (erreur instanceof RefusDroit) return json({ message: erreur.message }, { status: 403 });
	if (erreur instanceof DonneeInvalide) return json({ message: erreur.message }, { status: 400 });
	throw erreur;
}
