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
		const arreter = suivreNonLus((n) => vus.push(n));
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
		arreter();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('une réponse en erreur ou une panne réseau est ignorée', async () => {
		vi.useFakeTimers();
		const { fetch } = scene();
		const vus: number[] = [];
		suivreNonLus((n) => vus.push(n));
		fetch.mockResolvedValueOnce(new Response('', { status: 401 }));
		await vi.advanceTimersByTimeAsync(30_000);
		fetch.mockRejectedValueOnce(new Error('hors ligne'));
		await vi.advanceTimersByTimeAsync(30_000);
		expect(vus).toEqual([]);
	});
});
