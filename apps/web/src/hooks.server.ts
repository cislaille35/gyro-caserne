import { building } from '$app/env';
import { env } from 'cloudflare:workers';
import { acteurDe, creerBaseD1 } from '@gyro-caserne/socle';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { creerAuth, superAdmins } from '#lib/server/auth.ts';

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);
	const base = creerBaseD1(env.BASE);
	const auth = creerAuth(env, base);
	event.locals.base = base;
	event.locals.auth = auth;

	const connexion = await auth.api.getSession({ headers: event.request.headers });
	event.locals.acteur = connexion ? await acteurDe(base, connexion.user.email, superAdmins(env)) : null;
	return svelteKitHandler({ event, resolve, auth, building });
};
