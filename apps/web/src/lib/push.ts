// L'abonnement de cet appareil aux notifications (dans le navigateur).

import { estInstallee, estIOS } from './installation.ts';

export type EtatPush = 'indisponible' | 'ios-a-installer' | 'refuse' | 'inactif' | 'actif';

const ADRESSE = '/moi/notifications/abonnement';
const ATTENTE_MAX = 4000;

function octets(base64url: string): Uint8Array<ArrayBuffer> {
	const brut = atob((base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
	const o = new Uint8Array(new ArrayBuffer(brut.length));
	for (let i = 0; i < brut.length; i++) o[i] = brut.charCodeAt(i);
	return o;
}
const enBase64url = (tampon: ArrayBuffer | null | undefined) =>
	tampon ? btoa(String.fromCharCode(...new Uint8Array(tampon))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '';


// Le service worker de l'appli ; nul s'il ne répond pas (navigation privée, enregistrement refusé).
async function inscription(): Promise<ServiceWorkerRegistration | null> {
	let minuteur: ReturnType<typeof setTimeout> | undefined;
	const delai = new Promise<null>((r) => (minuteur = setTimeout(() => r(null), ATTENTE_MAX)));
	try {
		return await Promise.race([navigator.serviceWorker.ready, delai]);
	} finally {
		clearTimeout(minuteur);
	}
}

const envoyer = (methode: 'POST' | 'DELETE', corps: object) => fetch(ADRESSE, { method: methode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
const declarer = (abonnement: PushSubscription) => envoyer('POST', { ...abonnement.toJSON(), appareil: navigator.userAgent.slice(0, 80) });

// L'état de cet appareil. Abonné, il est redéclaré au serveur (rattaché à l'agent connecté, recréé s'il avait été retiré),
// et réabonné si la clé du centre a changé.
export async function etatPush(clePublique: string): Promise<EtatPush> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return estIOS(navigator) && !estInstallee(window.matchMedia('(display-mode: standalone)').matches, navigator as { standalone?: boolean }) ? 'ios-a-installer' : 'indisponible';
	if (Notification.permission === 'denied') return 'refuse';
	const sw = await inscription();
	if (!sw) return 'indisponible';
	let abonnement = await sw.pushManager.getSubscription();
	if (!abonnement) return 'inactif';
	if (enBase64url(abonnement.options.applicationServerKey) !== clePublique) {
		await abonnement.unsubscribe();
		abonnement = await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octets(clePublique) });
	}
	return (await declarer(abonnement)).ok ? 'actif' : 'inactif';
}

export async function activerPush(clePublique: string): Promise<EtatPush> {
	if ((await Notification.requestPermission()) !== 'granted') return 'refuse';
	const sw = await inscription();
	if (!sw) return 'indisponible';
	const abonnement = (await sw.pushManager.getSubscription()) ?? (await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octets(clePublique) }));
	return (await declarer(abonnement)).ok ? 'actif' : 'inactif';
}

export async function desactiverPush(): Promise<EtatPush> {
	await oublierCetAppareil();
	return 'inactif';
}

// Désabonne cet appareil, côté serveur et navigateur : à la désactivation, et avant la déconnexion (un appareil partagé
// ne doit plus recevoir les notifications de l'agent parti). Ne bloque jamais plus de quelques secondes.
export async function oublierCetAppareil(): Promise<void> {
	if (!('serviceWorker' in navigator)) return;
	const sw = await inscription();
	const abonnement = await sw?.pushManager.getSubscription();
	if (!abonnement) return;
	await envoyer('DELETE', { endpoint: abonnement.endpoint }).catch(() => {});
	await abonnement.unsubscribe();
}
