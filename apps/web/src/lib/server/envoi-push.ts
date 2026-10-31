import { oublierAbonnements, prendreEnvois, type Base } from '@gyro-caserne/socle';
import { requetePush, type ClesVapid } from './webpush.ts';

// Un lot d'envois au téléphone, pris dans la file. 40 au plus : l'offre gratuite de Cloudflare permet 50 sous-requêtes par appel.
// Le service push répond 404 ou 410 : l'abonnement n'existe plus (appli désinstallée, autorisation retirée), il est supprimé.
// Sans clés VAPID, rien ne peut partir : le lot est seulement retiré de la file. Chargé aussi par la tâche planifiée : imports relatifs.
export async function envoyerLot(base: Base, cles: ClesVapid | null, envoyer: (url: string, init: RequestInit) => Promise<Response> = fetch, max = 40): Promise<{ envoyes: number; perimes: number }> {
	const envois = await prendreEnvois(base, max);
	if (!cles || envois.length === 0) return { envoyes: 0, perimes: 0 };
	const jetons = new Map<string, string>();
	const perimes: number[] = [];
	await Promise.all(
		envois.map(async (e) => {
			try {
				const { url, init } = await requetePush(e, e.donnees, cles, jetons);
				const reponse = await envoyer(url, init);
				if (reponse.status === 404 || reponse.status === 410) perimes.push(e.abonnementId);
				else if (!reponse.ok) console.warn('Notification refusée par le service push', reponse.status);
			} catch (erreur) {
				console.error('Notification non envoyée', erreur instanceof Error ? erreur.name : typeof erreur);
			}
		})
	);
	await oublierAbonnements(base, perimes);
	return { envoyes: envois.length, perimes: perimes.length };
}
