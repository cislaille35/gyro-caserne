import { building } from '$app/env';
import { env, waitUntil } from 'cloudflare:workers';
import { acteurDe, creerBaseD1, creerBasePhotos, resumeErreur } from '@gyro-caserne/socle';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { appliquerAffichage, lireAffichage } from '#lib/affichage.ts';
import { creerAuth, superAdmins, type Auth } from '#lib/server/auth.ts';
import { envoisDuGeste } from '#lib/server/envoi-push.ts';
import { estAdresseDeBetterAuth, lireSession } from '#lib/server/session.ts';
import { clesVapid } from '#lib/server/webpush.ts';
import { formulaireEgare } from '#lib/server/resoumission.ts';
import { envoiRefuse } from '#lib/server/taille-envoi.ts';
import { lignePage } from '#lib/server/page-au-journal.ts';

export const handle: Handle = async ({ event, resolve }) => {
	// Au début de handle, avant le travail, pour que la ligne reste même si Cloudflare coupe la requête (décision 0037). Une requête interne est déjà comptée.
	// Seulement là où le journal des requêtes est gardé : ailleurs, elle porterait l'adresse de la page sans servir.
	const deBetterAuth = !building && estAdresseDeBetterAuth(event.url, env);
	if (!building && !event.isSubRequest && env.JOURNAL_DES_PAGES === true) console.log(lignePage(event, deBetterAuth));
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
	event.locals.base = base;
	event.locals.basePhotos = creerBasePhotos(env.PHOTOS);
	// Better Auth n'est créé que là où il sert (connexion, déconnexion, ses adresses) : le créer coûte du calcul (décision 0035).
	let auth: Auth | undefined;
	Object.defineProperty(event.locals, 'auth', { get: () => (auth ??= creerAuth(env, base, waitUntil)) });
	event.locals.superAdmins = superAdmins(env);
	event.locals.enArrierePlan = envois.enArrierePlan;
	const cles = clesVapid(env);
	event.locals.clePublique = cles?.publique ?? null;

	try {
		// Ses adresses répondent elles-mêmes et posent leurs cookies : la session n'y est pas lue.
		if (deBetterAuth) {
			event.locals.acteur = null;
			return await event.locals.auth.handler(event.request);
		}
		const connexion = await lireSession(base, env, event.cookies);
		event.locals.acteur = connexion ? await acteurDe(base, connexion.email, event.locals.superAdmins) : null;
		return await resoudre(event);
	} finally {
		envois.terminer(base, cles);
	}
};

// Le journal du Worker est gardé par Cloudflare (décision 0036) : la page en cause (son modèle, sans identifiant) et l'erreur résumée,
// sans les valeurs de la requête. Seulement une erreur imprévue : une page introuvable ou un refus voulu (error(…)) n'en est pas une.
export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind !== 'unknown') return;
	console.error('Erreur imprévue', event.route.id ?? 'page inconnue', resumeErreur(error));
};
