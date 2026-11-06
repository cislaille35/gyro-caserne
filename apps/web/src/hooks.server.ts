import { building } from '$app/env';
import { env, waitUntil } from 'cloudflare:workers';
import { acteurDe, creerBaseD1, creerBasePhotos } from '@gyro-caserne/socle';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { appliquerAffichage, lireAffichage } from '#lib/affichage.ts';
import { creerAuth, superAdmins } from '#lib/server/auth.ts';
import { envoisDuGeste } from '#lib/server/envoi-push.ts';
import { clesVapid } from '#lib/server/webpush.ts';
import { formulaireEgare } from '#lib/server/resoumission.ts';
import { envoiRefuse } from '#lib/server/taille-envoi.ts';

export const handle: Handle = async ({ event, resolve }) => {
	const refus = envoiRefuse(event.request, event.url.pathname);
	if (refus) return refus;
	event.locals.affichage = lireAffichage(event.cookies);
	const resoudre: typeof resolve = async (evenement, options) => {
		const reponse = await resolve(evenement, { ...options, transformPageChunk: ({ html }) => appliquerAffichage(html, event.locals.affichage) });
		return formulaireEgare(event.request, event.url, reponse) ?? reponse;
	};

	if (building) return resoudre(event);
	// Les notifications au téléphone partent dès le geste qui les met en file, après la réponse (voir envoyerApres).
	const envois = envoisDuGeste(waitUntil);
	const base = creerBaseD1(env.BASE, envois.siEnFile);
	const auth = creerAuth(env, base, waitUntil);
	event.locals.base = base;
	event.locals.basePhotos = creerBasePhotos(env.PHOTOS);
	event.locals.auth = auth;
	event.locals.superAdmins = superAdmins(env);
	event.locals.enArrierePlan = envois.enArrierePlan;
	const cles = clesVapid(env);
	event.locals.clePublique = cles?.publique ?? null;

	try {
		const connexion = await auth.api.getSession({ headers: event.request.headers });
		event.locals.acteur = connexion ? await acteurDe(base, connexion.user.email, event.locals.superAdmins) : null;
		return await svelteKitHandler({ event, resolve: resoudre, auth, building });
	} finally {
		envois.terminer(base, cles);
	}
};
