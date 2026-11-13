import { eq } from 'drizzle-orm';
import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import { isAuthPath } from 'better-auth/svelte-kit';
import type { Cookies } from '@sveltejs/kit';
import { session, user, type Base } from '@gyro-caserne/socle';
import { DUREE_SESSION, PROLONGEE_APRES, type EnvAuth } from './auth.ts';

// Lecture de la session à chaque requête, sans créer Better Auth (trop coûteux pour le budget de calcul, décision 0035).
// Elle refait exactement ce que fait auth.api.getSession de Better Auth 1.7.12 : cookie signé, session en base,
// prolongation une fois par jour. session.test.ts compare les deux : à revérifier à chaque mise à jour de Better Auth.

export type EnvSession = Pick<EnvAuth, 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL'>;
type CookiesDeLaRequete = Pick<Cookies, 'get' | 'set' | 'delete'>;

// Recopie dans la réponse de SvelteKit les cookies posés par Better Auth lors d'un appel de son API.
export function recopierCookies(entetes: Headers, cookies: Pick<Cookies, 'set'>) {
	for (const [nom, attributs] of parseSetCookieHeader(entetes.get('set-cookie') ?? '')) {
		cookies.set(nom, attributs.value, { ...toCookieOptions(attributs), path: attributs.path ?? '/' });
	}
}

// Les adresses de Better Auth (lien de connexion, déconnexion…) : elles seules ont besoin de lui.
export function estAdresseDeBetterAuth(url: URL, env: EnvSession) {
	return isAuthPath(url.toString(), { baseURL: env.BETTER_AUTH_URL });
}

// Noms et attributs des cookies de Better Auth : préfixe __Secure- et attribut Secure en https.
function cookiesDeBetterAuth(env: EnvSession) {
	const secure = env.BETTER_AUTH_URL.startsWith('https://');
	const nom = (n: string) => `${secure ? '__Secure-' : ''}better-auth.${n}`;
	return { session: nom('session_token'), donnees: nom('session_data'), sansSouvenir: nom('dont_remember'), attributs: { httpOnly: true, secure, sameSite: 'lax', path: '/' } as const };
}

const cles = new Map<string, Promise<CryptoKey>>();
function cleDe(secret: string) {
	let cle = cles.get(secret);
	if (!cle) {
		cle = crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
		cles.set(secret, cle);
	}
	return cle;
}

// Valeur d'un cookie signé « valeur.signature » (HMAC-SHA256 en base64), ou null. crypto.subtle.verify compare à temps constant.
async function valeurSignee(cookie: string | undefined, secret: string): Promise<string | null> {
	if (!cookie) return null;
	const point = cookie.lastIndexOf('.');
	if (point < 1) return null;
	const [valeur, signature] = [cookie.slice(0, point), cookie.slice(point + 1)];
	if (signature.length !== 44 || !signature.endsWith('=')) return null;
	try {
		const octets = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
		return (await crypto.subtle.verify('HMAC', await cleDe(secret), octets, new TextEncoder().encode(valeur))) ? valeur : null;
	} catch {
		return null;
	}
}

// L'adresse de l'agent connecté, ou null. Une seule lecture de la base, et une écriture une fois par jour d'usage.
export async function lireSession(base: Base, env: EnvSession, cookies: CookiesDeLaRequete): Promise<{ email: string } | null> {
	const noms = cookiesDeBetterAuth(env);
	const cookie = cookies.get(noms.session);
	const jeton = await valeurSignee(cookie, env.BETTER_AUTH_SECRET);
	if (!jeton) return null;
	const effacerCookies = () => {
		for (const nom of [noms.session, noms.donnees, noms.sansSouvenir]) cookies.delete(nom, noms.attributs);
	};

	const [trouvee] = await base.select({ email: user.email, echeance: session.expiresAt }).from(session).innerJoin(user, eq(user.id, session.userId)).where(eq(session.token, jeton));
	const maintenant = Date.now();
	if (!trouvee || trouvee.echeance.getTime() < maintenant) {
		effacerCookies();
		if (trouvee) await base.delete(session).where(eq(session.token, jeton));
		return null;
	}

	// Prolongée au plus une fois par jour : quand il reste moins de 89 jours. Pas si l'agent a demandé à ne pas rester connecté.
	const aProlonger = trouvee.echeance.getTime() - DUREE_SESSION * 1000 + PROLONGEE_APRES * 1000 <= maintenant;
	if (aProlonger && !(await valeurSignee(cookies.get(noms.sansSouvenir), env.BETTER_AUTH_SECRET))) {
		const prolongee = await base
			.update(session)
			.set({ expiresAt: new Date(maintenant + DUREE_SESSION * 1000), updatedAt: new Date(maintenant) })
			.where(eq(session.token, jeton))
			.returning({ token: session.token });
		// Effacée entre-temps (déconnexion sur un autre appareil) : plus de session.
		if (prolongee.length === 0) {
			effacerCookies();
			return null;
		}
		// Même jeton, même signature : le cookie renvoyé est identique, seule son échéance change.
		cookies.set(noms.session, cookie!, { ...noms.attributs, maxAge: DUREE_SESSION });
	}
	return { email: trouvee.email };
}
