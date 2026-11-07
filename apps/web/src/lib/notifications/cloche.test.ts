import { afterEach, describe, expect, it, vi } from 'vitest';
import { lireCloche } from './cloche.ts';

afterEach(() => vi.unstubAllGlobals());

describe('lireCloche', () => {
	it('demande le nombre au serveur', async () => {
		const fetch = vi.fn(async () => new Response(JSON.stringify({ cloche: 3 })));
		vi.stubGlobal('fetch', fetch);
		expect(await lireCloche()).toBe(3);
		expect(fetch).toHaveBeenCalledWith('/notifications/cloche');
	});

	it('null hors ligne ou déconnecté : la cloche garde son nombre', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
		expect(await lireCloche()).toBeNull();
		vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('hors ligne'))));
		expect(await lireCloche()).toBeNull();
	});
});
