import { creerBaseD1, creerBasePhotos, effacerAnciens, effacerVieillesNotifications, effacerVieillesReservations, mettreAJourReleves, planningDuMatin, rappelsEte, remplacementsDuMoment } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from './lib/aujourdhui.ts';
import { envoyerLot } from './lib/server/envoi-push.ts';
import { clesVapid, type EnvVapid } from './lib/server/webpush.ts';

// Le gestionnaire planifié du worker (voir entree-du-worker.ts). Chargé par Wrangler hors de SvelteKit : imports relatifs, sans les alias de SvelteKit.

// La date, à Paris, `mois` mois avant `quand` (même jour, ou dernier jour du mois s'il n'existe pas).
export function limiteDeConservation(quand: Date, mois: number): string {
	const [annee, m, jour] = aujourdhuiParis(quand).split('-').map(Number) as [number, number, number];
	const vise = new Date(Date.UTC(annee, m - 1 - mois, 1));
	const dernierJour = new Date(Date.UTC(vise.getUTCFullYear(), vise.getUTCMonth() + 1, 0)).getUTCDate();
	vise.setUTCDate(Math.min(jour, dernierJour));
	return vise.toISOString().slice(0, 10);
}

type Env = EnvVapid & { BASE: D1Database; PHOTOS: D1Database; VIGILANCE_CLE?: string };

// Les notifications du fil sont gardées 30 jours.
const CONSERVATION_NOTIFICATIONS_JOURS = 30;
// Le ménage, chaque nuit ; le réveil, toutes les cinq minutes. Voir wrangler.jsonc.
export const CRON_NUIT = '30 3 * * *';
export const CRON_REVEIL = '*/5 * * * *';

// Le worker de SvelteKit, plus le gestionnaire planifié.
export function avecPlanifie<K extends { fetch: unknown }>(kit: K, centre: { conservationMessagesMois: number; position: { latitude: number; longitude: number }; departement?: string }) {
	return {
		fetch: kit.fetch,
		scheduled(controleur: ScheduledController, env: Env, ctx: ExecutionContext) {
			const base = creerBaseD1(env.BASE);
			if (controleur.cron !== CRON_NUIT) {
				// Les notifications partent dès le geste qui les crée (envoi-push.ts) ; ce lot rattrape celles qui n'ont pas pu partir.
				ctx.waitUntil(envoyerLot(base, clesVapid(env)));
				// L'heure prévue du réveil (même s'il part en retard) : 8 h 00, 8 h 05…
				// Les manœuvres du planning s'annoncent le matin, pas en pleine nuit : à 8 h (Paris), et à 8 h 10 si le passage de 8 h a manqué.
				// Une annonce faite n'est jamais refaite ; deux passages espacés ne se croisent pas.
				const maintenant = maintenantParis(new Date(controleur.scheduledTime));
				if (['08:00', '08:10'].includes(maintenant.slice(11, 16))) {
					ctx.waitUntil(planningDuMatin(base, maintenant).catch((e) => console.error('Planning du matin', e)));
					// Les rappels des vacances d'été : chacun n'est envoyé qu'une fois.
					ctx.waitUntil(rappelsEte(base, maintenant).catch((e) => console.error('Rappels de l’été', e)));
				}
				// Les remplacements : expirés au début de leur période, relancés la veille. Toutes les dix minutes.
				if (maintenant[15] === '0') ctx.waitUntil(remplacementsDuMoment(base, maintenant).catch((e) => console.error('Remplacements du moment', e)));
				// La météo et la vigilance : regardées à chaque réveil, redemandées si elles ont plus d'une heure (météo) ou de 15 minutes (vigilance).
				const lieu = { position: centre.position, departement: centre.departement };
				ctx.waitUntil(mettreAJourReleves(base, lieu, maintenant.slice(0, 16), fetch, env.VIGILANCE_CLE).catch((e) => console.error('Météo', e)));
				return;
			}
			const quand = new Date(controleur.scheduledTime);
			const avant = limiteDeConservation(quand, centre.conservationMessagesMois);
			const notifications = aujourdhuiParis(new Date(quand.getTime() - CONSERVATION_NOTIFICATIONS_JOURS * 86_400_000));
			// Les réservations sont gardées un an après leur fin.
			const reservations = limiteDeConservation(quand, 12);
			ctx.waitUntil(Promise.all([effacerAnciens(base, creerBasePhotos(env.PHOTOS), avant), effacerVieillesNotifications(base, notifications), effacerVieillesReservations(base, reservations)]));
		}
	};
}
