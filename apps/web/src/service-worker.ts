/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Le service worker ne met rien en cache : il reçoit les notifications et les ouvre.
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', () => void sw.skipWaiting());
sw.addEventListener('activate', (event) => event.waitUntil(sw.clients.claim()));

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
			return ouverte ? ouverte.navigate(url).then((f) => f?.focus()) : sw.clients.openWindow(url);
		})
	);
});
