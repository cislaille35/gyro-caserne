import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import type { Cookies } from '@sveltejs/kit';
import type { Auth } from './auth.ts';

// La session de la requête. Une fois par jour d'usage, Better Auth la prolonge de 90 jours et réécrit son cookie :
// ce cookie est recopié dans la réponse de SvelteKit, sans quoi le navigateur garderait l'ancienne échéance.
export async function lireSession(auth: Auth, requete: Request, cookies: Pick<Cookies, 'set'>) {
	const { headers, response } = await auth.api.getSession({ headers: requete.headers, returnHeaders: true });
	for (const [nom, attributs] of parseSetCookieHeader(headers.get('set-cookie') ?? '')) {
		cookies.set(nom, attributs.value, { ...toCookieOptions(attributs), path: attributs.path ?? '/' });
	}
	return response;
}
