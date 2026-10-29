import { creerBaseD1, creerBasePhotos, effacerAnciens } from '@gyro-caserne/socle';
import { aujourdhuiParis } from './lib/aujourdhui.ts';

// Le gestionnaire planifié du worker (voir entree-du-worker.ts). Chargé par Wrangler hors de SvelteKit : imports relatifs, sans les alias de SvelteKit.

// La date, à Paris, `mois` mois avant `quand` (même jour, ou dernier jour du mois s'il n'existe pas).
export function limiteDeConservation(quand: Date, mois: number): string {
	const [annee, m, jour] = aujourdhuiParis(quand).split('-').map(Number) as [number, number, number];
	const vise = new Date(Date.UTC(annee, m - 1 - mois, 1));
	const dernierJour = new Date(Date.UTC(vise.getUTCFullYear(), vise.getUTCMonth() + 1, 0)).getUTCDate();
	vise.setUTCDate(Math.min(jour, dernierJour));
	return vise.toISOString().slice(0, 10);
}

type Env = { BASE: D1Database; PHOTOS: D1Database };

// Le worker de SvelteKit, plus l'effacement quotidien des messages plus vieux que la durée de conservation du centre.
export function avecPlanifie<K extends { fetch: unknown }>(kit: K, centre: { conservationMessagesMois: number }) {
	return {
		fetch: kit.fetch,
		scheduled(controleur: ScheduledController, env: Env, ctx: ExecutionContext) {
			const avant = limiteDeConservation(new Date(controleur.scheduledTime), centre.conservationMessagesMois);
			ctx.waitUntil(effacerAnciens(creerBaseD1(env.BASE), creerBasePhotos(env.PHOTOS), avant));
		}
	};
}
