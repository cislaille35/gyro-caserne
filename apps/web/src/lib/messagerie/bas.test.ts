import { describe, expect, it, vi } from 'vitest';
import { suivreLeBas } from './bas.ts';

// Une fenêtre qui défile et une page qui grandit (une photo qui se charge), sans navigateur.
function scene() {
	const ecouteurs = new Set<() => void>();
	const fenetre = {
		scrollY: 0,
		addEventListener: (_: 'scroll', f: () => void) => ecouteurs.add(f),
		removeEventListener: (_: 'scroll', f: () => void) => ecouteurs.delete(f)
	};
	let grandit: (() => void) | null = null;
	const deconnecter = vi.fn();
	const descendre = vi.fn();
	const suivi = suivreLeBas(fenetre, (rappel) => ((grandit = rappel), deconnecter), descendre);
	const defiler = (y: number) => {
		fenetre.scrollY = y;
		ecouteurs.forEach((f) => f());
	};
	return { suivi, descendre, deconnecter, ecouteurs, defiler, grandir: () => grandit!() };
}

describe('suivreLeBas', () => {
	it('après « ↓ », la page qui grandit redescend, même pendant la descente', () => {
		const s = scene();
		s.grandir();
		expect(s.descendre).not.toHaveBeenCalled();
		s.suivi.suivre();
		s.defiler(300);
		s.grandir();
		s.defiler(900);
		s.grandir();
		expect(s.descendre).toHaveBeenCalledTimes(2);
	});

	it('la personne remonte elle-même : la page ne la ramène plus en bas, jusqu’au prochain « ↓ »', () => {
		const s = scene();
		s.suivi.suivre();
		s.defiler(900);
		s.defiler(700);
		s.grandir();
		expect(s.descendre).not.toHaveBeenCalled();
		s.suivi.suivre();
		s.grandir();
		expect(s.descendre).toHaveBeenCalledOnce();
	});

	it('arrêté : plus d’écoute ni d’observation', () => {
		const s = scene();
		s.suivi.arreter();
		expect(s.ecouteurs.size).toBe(0);
		expect(s.deconnecter).toHaveBeenCalledOnce();
	});
});
