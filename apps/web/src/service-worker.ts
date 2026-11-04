/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { ENTETES_ATTENTE, estCoupure, genreDeRequete, pageAttente, reponseAction, reponseDonnees, type Genre } from './lib/attente/attente.ts';

// Le service worker ne met rien en cache : il reçoit les notifications, les ouvre, et remplace l'erreur de coupure par une attente.
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', () => void sw.skipWaiting());
sw.addEventListener('activate', (event) => event.waitUntil(sw.clients.claim()));

const JSON_SANS_CACHE = { 'content-type': 'application/json', 'cache-control': 'no-store' };

function repli(genre: Genre): Response {
	if (genre === 'action') return new Response(reponseAction(), { status: 200, headers: JSON_SANS_CACHE });
	if (genre === 'donnees') return new Response(reponseDonnees(), { status: 503, headers: JSON_SANS_CACHE });
	return new Response(pageAttente(genre), { status: 503, headers: ENTETES_ATTENTE });
}

// La requête part une seule fois (jamais de renvoi d'un formulaire). Seul un 503 est lu : les autres réponses passent telles quelles.
async function aTravers(requete: Request, genre: Genre): Promise<Response> {
	let reponse: Response;
	try {
		reponse = await fetch(requete);
	} catch {
		return repli(genre);
	}
	return reponse.status === 503 && estCoupure(503, await reponse.clone().text()) ? repli(genre) : reponse;
}

sw.addEventListener('fetch', (event) => {
	const genre = genreDeRequete(event.request, sw.location.origin);
	if (genre) event.respondWith(aTravers(event.request, genre));
});

sw.addEventListener('push', (event) => {
	let d: { titre?: string; texte?: string; url?: string; tag?: string } = {};
	try {
		d = event.data?.json() ?? {};
	} catch {
		d = { titre: event.data?.text() };
	}
	event.waitUntil(
		sw.registration.showNotification(d.titre || 'Gyro Caserne', {
			body: d.texte ?? '',
			icon: '/icones/icone-192.png',
			badge: '/icones/icone-192.png',
			// Une seule notification à l'écran par conversation ou publication : la nouvelle remplace l'ancienne.
			tag: d.tag,
			data: { url: d.url ?? '/' }
		})
	);
});

// Toucher la notification ouvre l'appli sur la publication ou la conversation (ce qui la marque lue).
sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = new URL((event.notification.data as { url?: string } | null)?.url ?? '/', sw.location.origin).href;
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
			const ouverte = fenetres.find((f) => f.url.startsWith(sw.location.origin)) as WindowClient | undefined;
			// Une fenêtre que le service worker ne contrôle pas refuse `navigate` : on en ouvre une autre.
			const nouvelle = () => sw.clients.openWindow(url);
			return ouverte ? ouverte.navigate(url).then((f) => (f ? f.focus() : nouvelle())).catch(nouvelle) : nouvelle();
		})
	);
});
