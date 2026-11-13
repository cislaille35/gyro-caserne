import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import { isAuthPath } from 'better-auth/svelte-kit';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
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

// Pour le hook : les adresses de Better Auth (lien de connexion, déconnexion) répondent elles-mêmes et posent leurs cookies,
// que SvelteKit n'ajouterait pas à leur réponse : la session n'y est pas lue.
export function sessionDuHook(auth: Auth, event: Pick<RequestEvent, 'request' | 'url' | 'cookies'>) {
	return isAuthPath(event.url.toString(), auth.options) ? null : lireSession(auth, event.request, event.cookies);
}
