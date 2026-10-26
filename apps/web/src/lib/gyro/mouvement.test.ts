import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { arreterApres } from './mouvement.ts';

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
});
