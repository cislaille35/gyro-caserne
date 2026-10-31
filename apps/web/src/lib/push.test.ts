import { afterEach, describe, expect, it, vi } from 'vitest';
import { etatPush, oublierCetAppareil } from './push.ts';

// Un navigateur abonné (ou non), avec la clé du serveur `cle` : de quoi suivre ce que l'appli lui demande.
function navigateur(abonne: boolean, cle = 'AQID') {
	const abonnement = abonne
		? { endpoint: 'https://fcm.googleapis.com/fcm/send/x', options: { applicationServerKey: new Uint8Array(atob(cle).split('').map((c) => c.charCodeAt(0))).buffer }, toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'B', auth: 'a' } }), unsubscribe: vi.fn(async () => true) }
		: null;
	const nouveau = { endpoint: 'https://fcm.googleapis.com/fcm/send/neuf', options: {}, toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/neuf', keys: { p256dh: 'B', auth: 'a' } }), unsubscribe: vi.fn() };
	const pushManager = { getSubscription: vi.fn(async () => abonnement), subscribe: vi.fn(async () => nouveau) };
	vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager }) }, userAgent: 'Test', maxTouchPoints: 0 });
	vi.stubGlobal('window', { PushManager: class {}, Notification: class {}, matchMedia: () => ({ matches: false }) });
	vi.stubGlobal('Notification', { permission: 'granted' });
	const envois: { methode: string; corps: unknown }[] = [];
	vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => (envois.push({ methode: init.method!, corps: JSON.parse(init.body as string) }), new Response('{}'))));
	return { abonnement, pushManager, envois };
}

afterEach(() => vi.unstubAllGlobals());

describe('push (navigateur)', () => {
	it('abonné : l’abonnement est renvoyé au serveur, qui le rattache à l’agent connecté', async () => {
		const { envois } = navigateur(true);
		expect(await etatPush('AQID')).toBe('actif');
		expect(envois).toMatchObject([{ methode: 'POST', corps: { endpoint: 'https://fcm.googleapis.com/fcm/send/x' } }]);
	});

	it('abonné avec une autre clé que celle du centre : réabonné avec la bonne', async () => {
		const { abonnement, pushManager, envois } = navigateur(true, 'AQID');
		expect(await etatPush('BAUG')).toBe('actif');
		expect(abonnement!.unsubscribe).toHaveBeenCalled();
		expect(pushManager.subscribe).toHaveBeenCalled();
		expect(envois).toMatchObject([{ methode: 'POST', corps: { endpoint: 'https://fcm.googleapis.com/fcm/send/neuf' } }]);
	});

	it('pas abonné : inactif, rien n’est envoyé', async () => {
		const { envois } = navigateur(false);
		expect(await etatPush('AQID')).toBe('inactif');
		expect(envois).toEqual([]);
	});

	it('à la déconnexion, l’appareil est oublié : le serveur le retire, le navigateur se désabonne', async () => {
		const { abonnement, envois } = navigateur(true);
		await oublierCetAppareil();
		expect(envois).toMatchObject([{ methode: 'DELETE', corps: { endpoint: 'https://fcm.googleapis.com/fcm/send/x' } }]);
		expect(abonnement!.unsubscribe).toHaveBeenCalled();
	});

	it('un service worker qui ne répond pas : indisponible, sans attendre indéfiniment', async () => {
		navigateur(false);
		vi.stubGlobal('navigator', { serviceWorker: { ready: new Promise(() => {}) }, userAgent: 'Test', maxTouchPoints: 0 });
		vi.useFakeTimers();
		const etat = etatPush('AQID');
		await vi.advanceTimersByTimeAsync(5000);
		expect(await etat).toBe('indisponible');
		const oubli = oublierCetAppareil();
		await vi.advanceTimersByTimeAsync(5000);
		await expect(oubli).resolves.toBeUndefined();
		vi.useRealTimers();
	});
});
