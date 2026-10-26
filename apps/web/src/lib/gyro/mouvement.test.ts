import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DUREE_ACCUEIL, DUREE_DECOR, arreterApres } from './mouvement.ts';

describe('arreterApres', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('appelle l’arrêt une fois la durée écoulée', () => {
		const arret = vi.fn();
		arreterApres(5000, arret);
		vi.advanceTimersByTime(4999);
		expect(arret).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(arret).toHaveBeenCalledOnce();
	});

	it('l’annulation empêche l’arrêt', () => {
		const arret = vi.fn();
		arreterApres(5000, arret)();
		vi.advanceTimersByTime(20_000);
		expect(arret).not.toHaveBeenCalled();
	});

	it('durées : 5 s sans commande, 10 s avec', () => {
		expect(DUREE_DECOR).toBe(5000);
		expect(DUREE_ACCUEIL).toBe(10_000);
	});
});
