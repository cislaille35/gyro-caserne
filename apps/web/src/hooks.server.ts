import { building } from '$app/env';
import { env, waitUntil } from 'cloudflare:workers';
import { acteurDe, creerBaseD1, creerBasePhotos } from '@gyro-caserne/socle';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { appliquerAffichage, lireAffichage } from '#lib/affichage.ts';
import { creerAuth, superAdmins } from '#lib/server/auth.ts';
import { clesVapid } from '#lib/server/webpush.ts';
import { envoiRefuse } from '#lib/server/taille-envoi.ts';

export const handle: Handle = async ({ event, resolve }) => {
	const refus = envoiRefuse(event.request, event.url.pathname);
	if (refus) return refus;
	event.locals.affichage = lireAffichage(event.cookies);
	const resoudre: typeof resolve = (evenement, options) =>
		resolve(evenement, { ...options, transformPageChunk: ({ html }) => appliquerAffichage(html, event.locals.affichage) });

	if (building) return resoudre(event);
	const base = creerBaseD1(env.BASE);
	const auth = creerAuth(env, base, waitUntil);
	event.locals.base = base;
	event.locals.basePhotos = creerBasePhotos(env.PHOTOS);
	event.locals.auth = auth;
	event.locals.superAdmins = superAdmins(env);
	event.locals.enArrierePlan = waitUntil;
	event.locals.clePublique = clesVapid(env)?.publique ?? null;

	const connexion = await auth.api.getSession({ headers: event.request.headers });
	event.locals.acteur = connexion ? await acteurDe(base, connexion.user.email, event.locals.superAdmins) : null;
	return svelteKitHandler({ event, resolve: resoudre, auth, building });
};
