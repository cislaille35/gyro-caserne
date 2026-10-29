import { afterEach, describe, expect, it, vi } from 'vitest';
import { suivreNonLus } from './pastille.ts';

// Un document dont on règle la visibilité, et un serveur qui répond { nonLus }.
function scene(nonLus = 4) {
	const ecouteurs: (() => void)[] = [];
	const doc = {
		visibilityState: 'visible',
		addEventListener: (_: string, f: () => void) => ecouteurs.push(f),
		removeEventListener: vi.fn()
	};
	vi.stubGlobal('document', doc);
	const fetch = vi.fn(async () => new Response(JSON.stringify({ nonLus })));
	vi.stubGlobal('fetch', fetch);
	const montrer = (visible: boolean) => {
		doc.visibilityState = visible ? 'visible' : 'hidden';
		ecouteurs.forEach((f) => f());
	};
	return { fetch, montrer, doc };
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('suivreNonLus', () => {
	it('interroge la pastille toutes les 30 s, page visible seulement, et rend le nombre', async () => {
		vi.useFakeTimers();
		const { fetch, montrer } = scene(4);
		const vus: number[] = [];
		const suivi = suivreNonLus(0, (n) => vus.push(n), () => {});
		expect(fetch).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(30_000);
		expect(fetch).toHaveBeenCalledWith('/echanges/messages/pastille');
		expect(vus).toEqual([4]);
		montrer(false);
		await vi.advanceTimersByTimeAsync(90_000);
		expect(fetch).toHaveBeenCalledTimes(1);
		// De retour sur la page : tout de suite, sans attendre le prochain tour.
		montrer(true);
		await vi.advanceTimersByTimeAsync(0);
		expect(fetch).toHaveBeenCalledTimes(2);
		suivi.arreter();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('de retour sur l’onglet moins de 10 s après la dernière lecture : pas de nouvelle lecture', async () => {
		vi.useFakeTimers();
		const { fetch, montrer } = scene(4);
		suivreNonLus(4, () => {}, () => {});
		await vi.advanceTimersByTimeAsync(5_000);
		montrer(false);
		montrer(true);
		await vi.advanceTimersByTimeAsync(0);
		expect(fetch).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(6_000);
		montrer(false);
		montrer(true);
		await vi.advanceTimersByTimeAsync(0);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('la liste est relue si le nombre change, pas s’il est identique', async () => {
		vi.useFakeTimers();
		const { fetch } = scene(2);
		const vus: number[] = [];
		const relire = vi.fn();
		suivreNonLus(2, (n) => vus.push(n), relire);
		await vi.advanceTimersByTimeAsync(30_000);
		expect(vus).toEqual([]);
		expect(relire).not.toHaveBeenCalled();
		fetch.mockResolvedValueOnce(new Response(JSON.stringify({ nonLus: 5 })));
		await vi.advanceTimersByTimeAsync(30_000);
		expect(vus).toEqual([5]);
		expect(relire).toHaveBeenCalledTimes(1);
	});

	it('en sortant d’une conversation : la pastille est relue ; vers la liste, sans relancer sa lecture (elle vient d’être chargée)', async () => {
		vi.useFakeTimers();
		const { fetch } = scene(1);
		const vus: number[] = [];
		const relire = vi.fn();
		const suivi = suivreNonLus(3, (n) => vus.push(n), relire);
		suivi.apresNavigation('/echanges/centre', '/echanges/messages');
		await vi.advanceTimersByTimeAsync(0);
		expect(fetch).not.toHaveBeenCalled();
		suivi.apresNavigation('/echanges/messages/7', '/echanges/messages');
		await vi.advanceTimersByTimeAsync(0);
		expect(vus).toEqual([1]);
		expect(relire).not.toHaveBeenCalled();
		fetch.mockResolvedValueOnce(new Response(JSON.stringify({ nonLus: 0 })));
		suivi.apresNavigation('/echanges/messages/8', '/');
		await vi.advanceTimersByTimeAsync(0);
		expect(vus).toEqual([1, 0]);
		expect(relire).toHaveBeenCalledTimes(1);
	});

	it('le nombre reçu pendant la lecture d’une conversation suit tout de suite, sans relire la liste ni le serveur', async () => {
		vi.useFakeTimers();
		const { fetch } = scene(3);
		const vus: number[] = [];
		let relues = 0;
		const suivi = suivreNonLus(5, (n) => vus.push(n), () => relues++);
		suivi.recu(3);
		suivi.recu(3);
		expect(vus).toEqual([3]);
		expect(fetch).not.toHaveBeenCalled();
		// Le tour suivant trouve le même nombre : rien ne bouge.
		await vi.advanceTimersByTimeAsync(30_000);
		expect(vus).toEqual([3]);
		expect(relues).toBe(0);
		suivi.arreter();
	});

	it('une réponse en erreur ou une panne réseau est ignorée', async () => {
		vi.useFakeTimers();
		const { fetch } = scene();
		const vus: number[] = [];
		suivreNonLus(0, (n) => vus.push(n), () => {});
		fetch.mockResolvedValueOnce(new Response('', { status: 401 }));
		await vi.advanceTimersByTimeAsync(30_000);
		fetch.mockRejectedValueOnce(new Error('hors ligne'));
		await vi.advanceTimersByTimeAsync(30_000);
		expect(vus).toEqual([]);
	});
});
