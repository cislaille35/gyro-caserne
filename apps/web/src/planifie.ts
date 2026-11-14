import { creerBaseD1, creerBasePhotos, effacerAgentsPartis, effacerAnciens, effacerSouhaitsPasses, effacerVieillesDemandes, effacerPhotosOrphelines, effacerVieillesNotifications, effacerVieillesPublications, effacerVieillesReservations, fileDEnvoisVide, mettreAJourReleves, planningDuMatin, rappelsEte, remplacementsDuMoment } from '@gyro-caserne/socle';
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

type Env = EnvVapid & { BASE: D1Database; PHOTOS: D1Database; VIGILANCE_CLE?: string; SUPER_ADMINS?: string };

// Les notifications du fil sont gardées 30 jours.
const CONSERVATION_NOTIFICATIONS_JOURS = 30;
const CONSERVATION_HABILLEMENT_MOIS = 24;
// Les données d'un agent parti sont effacées 12 mois après son dernier départ (décision 0029).
const CONSERVATION_PARTIS_MOIS = 12;
// Le ménage, chaque nuit ; le réveil, toutes les dix minutes (chaque réveil démarre à froid : décision 0012). Voir wrangler.jsonc.
export const CRON_NUIT = '30 3 * * *';
export const CRON_REVEIL = '*/10 * * * *';

// Le worker de SvelteKit, plus le gestionnaire planifié.
export function avecPlanifie<K extends { fetch: unknown }>(kit: K, centre: { conservationMessagesMois: number; conservationPublicationsMois: number; position: { latitude: number; longitude: number }; departement?: string; manoeuvres: { petitDejeuner: string[] } }) {
	return {
		fetch: kit.fetch,
		scheduled(controleur: ScheduledController, env: Env, ctx: ExecutionContext) {
			// Une tâche du réveil qui met des envois en file (annonce, relance, vigilance rouge) : le lot part ensuite.
			let misEnFile = false;
			const base = creerBaseD1(env.BASE, () => {
				misEnFile = true;
			});
			if (controleur.cron !== CRON_NUIT) {
				// La file, lue en même temps que les tâches : vide, et rien mis en file par elles, le lot n'est pas pris. Illisible : il l'est.
				const fileVide = fileDEnvoisVide(base).catch(() => false);
				const taches: Promise<unknown>[] = [];
				// L'heure prévue du réveil (même s'il part en retard) : 8 h 00, 8 h 10…
				const maintenant = maintenantParis(new Date(controleur.scheduledTime));
				// Les manœuvres du planning s'annoncent le matin, pas en pleine nuit : à 8 h (Paris), et à 8 h 10 si le passage de 8 h a manqué.
				// Une annonce faite n'est jamais refaite ; deux passages espacés ne se croisent pas.
				if (['08:00', '08:10'].includes(maintenant.slice(11, 16))) {
					taches.push(planningDuMatin(base, maintenant, centre.manoeuvres.petitDejeuner).catch((e) => console.error('Planning du matin', e)));
					// Les rappels des vacances d'été : chacun n'est envoyé qu'une fois.
					taches.push(rappelsEte(base, maintenant).catch((e) => console.error('Rappels de l’été', e)));
				}
				// Les remplacements : expirés au début de leur période, relancés la veille. Toutes les dix minutes, à chaque réveil.
				if (maintenant[15] === '0') taches.push(remplacementsDuMoment(base, maintenant).catch((e) => console.error('Remplacements du moment', e)));
				// La météo et la vigilance : regardées à chaque réveil, la météo redemandée si elle a plus d'une heure, la vigilance à chaque réveil (décision 0012).
				const lieu = { position: centre.position, departement: centre.departement };
				taches.push(mettreAJourReleves(base, lieu, maintenant.slice(0, 16), fetch, env.VIGILANCE_CLE).catch((e) => console.error('Météo', e)));
				// Puis un lot d'envois au téléphone : ce que ce réveil a mis en file, et ce qui reste en file au-delà du lot envoyé dès le geste.
				ctx.waitUntil(Promise.allSettled(taches).then(async () => (!misEnFile && (await fileVide) ? null : envoyerLot(base, clesVapid(env)))));
				return;
			}
			const quand = new Date(controleur.scheduledTime);
			const avant = limiteDeConservation(quand, centre.conservationMessagesMois);
			const notifications = aujourdhuiParis(new Date(quand.getTime() - CONSERVATION_NOTIFICATIONS_JOURS * 86_400_000));
			// Les réservations sont gardées un an après leur fin.
			const reservations = limiteDeConservation(quand, 12);
			// Les publications des murs et leurs photos, sauf épinglées.
			const publications = limiteDeConservation(quand, centre.conservationPublicationsMois);
			// Les demandes d'habillement finies, avec leur fil : 24 mois, comme les publications (décision 0023).
			const habillement = limiteDeConservation(quand, CONSERVATION_HABILLEMENT_MOIS);
			const photos = creerBasePhotos(env.PHOTOS);
			ctx.waitUntil(
				Promise.all([
					effacerAnciens(base, photos, avant),
					effacerVieillesPublications(base, photos, publications),
					effacerVieillesNotifications(base, notifications),
					// Les souhaits d'anniversaire ne passent pas la journée (décision 0033).
					effacerSouhaitsPasses(base, aujourdhuiParis(quand)),
					effacerVieillesReservations(base, reservations),
					effacerVieillesDemandes(base, habillement),
					// Les adresses des super administrateurs (séparées par des virgules) : leur compte n'est jamais touché.
					effacerAgentsPartis(base, limiteDeConservation(quand, CONSERVATION_PARTIS_MOIS), aujourdhuiParis(quand), (env.SUPER_ADMINS ?? '').split(',').map((a) => a.trim()).filter(Boolean)),
					// Les octets de PHOTOS que plus rien ne référence (un effacement raté) : une tranche par nuit.
					effacerPhotosOrphelines(base, photos, maintenantParis(quand))
				])
			);
		}
	};
}
