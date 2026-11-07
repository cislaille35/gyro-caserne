import { describe, expect, it, vi } from 'vitest';
import { chiffreIcone, poserPastille } from './pastille.ts';

const navigateur = () => ({ setAppBadge: vi.fn(async () => {}), clearAppBadge: vi.fn(async () => {}) });

describe('poserPastille (le chiffre sur l’icône de l’appli)', () => {
	it('un nombre : posé ; zéro : retiré', async () => {
		const n = navigateur();
		await poserPastille(n, 3);
		expect(n.setAppBadge).toHaveBeenCalledWith(3);
		await poserPastille(n, 0);
		expect(n.clearAppBadge).toHaveBeenCalled();
	});

	it('navigateur sans pastille (Firefox, Safari hors écran d’accueil) : rien, sans erreur', async () => {
		await expect(poserPastille({}, 3)).resolves.toBeUndefined();
	});

	it('pas de nombre (notification d’avant la pastille) : rien n’est touché', async () => {
		const n = navigateur();
		for (const v of [undefined, null, '3', -1, 1.5]) await poserPastille(n, v);
		expect(n.setAppBadge).not.toHaveBeenCalled();
		expect(n.clearAppBadge).not.toHaveBeenCalled();
	});

	it('refusée par le navigateur (autorisation retirée) : l’erreur est avalée', async () => {
		await expect(poserPastille({ setAppBadge: async () => Promise.reject(new DOMException('refus', 'NotAllowedError')), clearAppBadge: async () => {} }, 2)).resolves.toBeUndefined();
	});
});

describe('chiffreIcone (appli ouverte)', () => {
	it('la cloche plus les messages non lus (pastille d’Échanges) ; déconnecté, rien', () => {
		expect(chiffreIcone(true, 2, 3)).toBe(5);
		expect(chiffreIcone(true, 0, 1)).toBe(1);
		expect(chiffreIcone(true, 0, 0)).toBe(0);
		expect(chiffreIcone(false, 2, 3)).toBe(0);
	});
});
