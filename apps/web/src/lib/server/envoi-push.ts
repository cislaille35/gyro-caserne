import { finirEnvois, prendreEnvois, type Base, type Envoi } from '@gyro-caserne/socle';
import { requetePush, type ClesVapid } from './webpush.ts';

// Un lot d'envois au téléphone, pris dans la file. 40 au plus : l'offre gratuite de Cloudflare permet 50 sous-requêtes par appel.
// Les envois sont réservés, puis retirés de la file une fois partis : si Cloudflare coupe la requête entre-temps, un passage
// suivant les reprend (voir prendreEnvois). Un envoi refusé n'est jamais renvoyé ; 404 ou 410 : l'abonnement n'existe plus
// (appli désinstallée, autorisation retirée), il est supprimé. Sans clés VAPID, rien ne peut partir : le lot est seulement
// retiré de la file. Deux requêtes à la base, une seule si la file est vide. Chargé aussi par la tâche planifiée : imports relatifs.
// Un service push qui ne répond pas en 20 s : l'envoi est abandonné (journal), pour que le lot ne reste pas en vol jusqu'à sa reprise.
const DELAI_ENVOI = 20_000;

// Le contenu de la notification, avec le numéro de l'envoi (le téléphone garde la plus récente d'un fil, notification-recue.ts)
// et le chiffre de la cloche de la personne plus ses messages non lus (la pastille sur l'icône). Une ligne de la cloche passe par /notifications/ouvrir,
// qui la marque lue avant d'ouvrir sa page : touchée au téléphone, elle ne reste pas non lue.
export function charge(e: Envoi) {
	const { lue, ...donnees } = e.donnees;
	const url = lue?.id ? `/notifications/ouvrir?${new URLSearchParams({ genre: lue.genre, id: String(lue.id), vers: donnees.url })}` : donnees.url;
	return { ...donnees, url, envoi: e.id, pastille: e.pastille };
}

export async function envoyerLot(base: Base, cles: ClesVapid | null, envoyer: (url: string, init: RequestInit) => Promise<Response> = fetch, max = 40, maintenant = new Date()): Promise<{ envoyes: number; perimes: number }> {
	const { jeton, envois } = await prendreEnvois(base, max, maintenant);
	if (envois.length === 0) return { envoyes: 0, perimes: 0 };
	if (!cles) {
		await finirEnvois(base, jeton, []);
		return { envoyes: 0, perimes: 0 };
	}
	const jetons = new Map<string, string>();
	const perimes: number[] = [];
	await Promise.all(
		envois.map(async (e) => {
			try {
				const { url, init } = await requetePush(e, charge(e), cles, jetons, e.essais === 1);
				const reponse = await envoyer(url, { ...init, signal: AbortSignal.timeout(DELAI_ENVOI) });
				if (reponse.status === 404 || reponse.status === 410) perimes.push(e.abonnementId);
				else if (!reponse.ok) console.warn('Notification refusée par le service push', reponse.status);
			} catch (erreur) {
				console.error('Notification non envoyée', erreur instanceof Error ? erreur.name : typeof erreur);
			}
		})
	);
	await finirEnvois(base, jeton, perimes);
	return { envoyes: envois.length, perimes: perimes.length };
}

// Envoyés dès le geste, après la réponse : 20 au plus, pour que la requête de l'auteur reste légère (environ 0,5 ms de calcul
// par envoi). Le reste part au réveil suivant de la tâche planifiée (toutes les cinq minutes), par lots de 40.
export const LOT_IMMEDIAT = 20;

// Après la réponse : attend ce qui part en arrière-plan (les notifications du geste, y compris celles inscrites entre-temps),
// puis envoie un lot, seulement si une requête a mis des envois en file (`misEnFile`, voir creerBaseD1 ; même si elle n'a
// écrit aucune ligne). Sinon, rien : pas même une lecture de la file.
export async function envoyerApres(base: Base, cles: ClesVapid | null, taches: Promise<unknown>[], misEnFile: () => boolean, envoyer: (url: string, init: RequestInit) => Promise<Response> = fetch) {
	for (let vues = 0; vues < taches.length; ) {
		const n = taches.length;
		await Promise.allSettled(taches.slice(vues));
		vues = n;
	}
	if (!misEnFile()) return null;
	return envoyerLot(base, cles, envoyer, LOT_IMMEDIAT);
}

// Le suivi d'une requête, pour hooks.server.ts : `siEnFile` va à creerBaseD1, `enArrierePlan` aux locals ; `terminer`, appelé
// quand la requête finit (réponse, redirection ou erreur), envoie le lot après la réponse.
export function envoisDuGeste(waitUntil: (tache: Promise<unknown>) => void) {
	let misEnFile = false;
	const taches: Promise<unknown>[] = [];
	return {
		siEnFile: () => {
			misEnFile = true;
		},
		enArrierePlan: (tache: Promise<unknown>) => {
			taches.push(tache);
			waitUntil(tache);
		},
		terminer: (base: Base, cles: ClesVapid | null, envoyer?: (url: string, init: RequestInit) => Promise<Response>) =>
			waitUntil(envoyerApres(base, cles, taches, () => misEnFile, envoyer).catch((e) => console.error('Notifications non envoyées', e instanceof Error ? e.name : typeof e)))
	};
}
