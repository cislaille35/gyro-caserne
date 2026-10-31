// L'abonnement de cet appareil aux notifications (dans le navigateur).

export type EtatPush = 'indisponible' | 'ios-a-installer' | 'refuse' | 'inactif' | 'actif';

const ADRESSE = '/moi/notifications/abonnement';

function octets(base64url: string): Uint8Array<ArrayBuffer> {
	const brut = atob((base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
	const o = new Uint8Array(new ArrayBuffer(brut.length));
	for (let i = 0; i < brut.length; i++) o[i] = brut.charCodeAt(i);
	return o;
}

const estIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const estInstallee = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// Sur iPhone, les notifications n'existent que pour une appli ajoutée à l'écran d'accueil (exigence d'Apple).
export async function etatPush(): Promise<EtatPush> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return estIOS() && !estInstallee() ? 'ios-a-installer' : 'indisponible';
	if (Notification.permission === 'denied') return 'refuse';
	const inscription = await navigator.serviceWorker.ready;
	return (await inscription.pushManager.getSubscription()) ? 'actif' : 'inactif';
}

export async function activerPush(clePublique: string): Promise<EtatPush> {
	if ((await Notification.requestPermission()) !== 'granted') return 'refuse';
	const inscription = await navigator.serviceWorker.ready;
	const abonnement = (await inscription.pushManager.getSubscription()) ?? (await inscription.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octets(clePublique) }));
	const reponse = await fetch(ADRESSE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...abonnement.toJSON(), appareil: navigator.userAgent.slice(0, 80) }) });
	return reponse.ok ? 'actif' : 'inactif';
}

export async function desactiverPush(): Promise<EtatPush> {
	const inscription = await navigator.serviceWorker.ready;
	const abonnement = await inscription.pushManager.getSubscription();
	if (abonnement) {
		await fetch(ADRESSE, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: abonnement.endpoint }) });
		await abonnement.unsubscribe();
	}
	return 'inactif';
}
