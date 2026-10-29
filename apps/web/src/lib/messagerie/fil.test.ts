import type { VueMessage } from '@gyro-caserne/socle';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());
import { APPUI_LONG, apresArrivee, cleBrouillon, ecartGlisse, entreeEnvoie, glissementCommence, glissementRepond, instant, mouvementAnnuleAppui, oublierBrouillons, purgerBrouillons, SEUIL_REPONSE } from './fil.ts';

const message = (id: number, moi = false) => ({ id, moi }) as VueMessage;

describe('brouillons', () => {
	it('une clé par personne connectée et par conversation', () => {
		expect(cleBrouillon(4, '7')).toBe('gyro:brouillon:4:7');
		expect(cleBrouillon(4, 'a-9')).toBe('gyro:brouillon:4:a-9');
		expect(cleBrouillon(5, '7')).not.toBe(cleBrouillon(4, '7'));
	});

	it('la déconnexion efface tous les brouillons, et rien d’autre', () => {
		const donnees = new Map([
			['gyro:brouillon:4:7', 'a'],
			['gyro:brouillon:5:a-9', 'b'],
			['theme', 'sombre']
		]);
		const stockage = {
			get length() {
				return donnees.size;
			},
			key: (i: number) => [...donnees.keys()][i] ?? null,
			removeItem: (k: string) => void donnees.delete(k)
		};
		purgerBrouillons(stockage);
		expect([...donnees.keys()]).toEqual(['theme']);
	});

	it('à la déconnexion, ceux de l’appareil ; sans stockage, rien ne casse', () => {
		const efface: string[] = [];
		vi.stubGlobal('localStorage', { length: 2, key: (i: number) => ['gyro:brouillon:4:7', 'theme'][i], removeItem: (k: string) => efface.push(k) });
		oublierBrouillons();
		expect(efface).toEqual(['gyro:brouillon:4:7']);
		vi.stubGlobal('localStorage', undefined);
		expect(() => oublierBrouillons()).not.toThrow();
	});

	it('un stockage indisponible ne bloque pas la déconnexion', () => {
		expect(() =>
			purgerBrouillons({
				get length(): number {
					throw new Error('bloqué');
				},
				key: () => null,
				removeItem: () => {}
			})
		).not.toThrow();
	});
});

describe('apresArrivee', () => {
	it('en bas, ou juste après un envoi : on descend, le compteur repart à zéro', () => {
		expect(apresArrivee({ forcerBas: false, etaitEnBas: true, compteur: 2 }, [message(5)])).toEqual({ descendre: true, compteur: 0, forcerBas: false });
		expect(apresArrivee({ forcerBas: true, etaitEnBas: false, compteur: 0 }, [message(5, true)])).toEqual({ descendre: true, compteur: 0, forcerBas: false });
	});

	it('en lisant plus haut : on reste, « ↓ » compte les messages des autres', () => {
		expect(apresArrivee({ forcerBas: false, etaitEnBas: false, compteur: 1 }, [message(5), message(6, true), message(7)])).toEqual({ descendre: false, compteur: 3, forcerBas: false });
	});

	it('rien de neuf : on ne bouge pas, et la demande de descendre tombe quand même', () => {
		expect(apresArrivee({ forcerBas: true, etaitEnBas: false, compteur: 1 }, [])).toEqual({ descendre: false, compteur: 1, forcerBas: false });
	});
});

describe('entreeEnvoie', () => {
	const touche = (key: string, autres: Partial<{ shiftKey: boolean; isComposing: boolean }> = {}) => ({ key, shiftKey: false, isComposing: false, ...autres });
	it('à l’ordinateur, Entrée envoie ; Maj + Entrée, une saisie en cours ou une autre touche, non', () => {
		expect(entreeEnvoie(touche('Enter'), true)).toBe(true);
		expect(entreeEnvoie(touche('Enter', { shiftKey: true }), true)).toBe(false);
		expect(entreeEnvoie(touche('Enter', { isComposing: true }), true)).toBe(false);
		expect(entreeEnvoie(touche('a'), true)).toBe(false);
	});
	it('au téléphone, Entrée va à la ligne', () => {
		expect(entreeEnvoie(touche('Enter'), false)).toBe(false);
	});
});

describe('gestes au doigt', () => {
	it('l’appui long dure 500 ms ; un mouvement de plus de 8 px l’annule', () => {
		expect(APPUI_LONG).toBe(500);
		expect(mouvementAnnuleAppui(8, 8)).toBe(false);
		expect(mouvementAnnuleAppui(9, 0)).toBe(true);
		expect(mouvementAnnuleAppui(0, -9)).toBe(true);
	});

	it('le glissement commence vers la droite, plus horizontal que vertical, conversation active, animations permises', () => {
		const permis = { actif: true, calme: false };
		expect(glissementCommence(13, 2, permis)).toBe(true);
		expect(glissementCommence(12, 0, permis)).toBe(false);
		expect(glissementCommence(-20, 0, permis)).toBe(false);
		expect(glissementCommence(20, 11, permis)).toBe(false);
		expect(glissementCommence(20, 0, { actif: false, calme: false })).toBe(false);
		// « Réduire les animations » coupe le glissement : le menu propose toujours « Répondre ».
		expect(glissementCommence(20, 0, { actif: true, calme: true })).toBe(false);
	});

	it('la bulle suit le doigt jusqu’à 80 px, et répond à partir de 56 px', () => {
		expect([ecartGlisse(-10), ecartGlisse(40), ecartGlisse(200)]).toEqual([0, 40, 80]);
		expect(SEUIL_REPONSE).toBe(56);
		expect(glissementRepond(55)).toBe(false);
		expect(glissementRepond(56)).toBe(true);
	});
});

describe('instant', () => {
	it('lit une date à l’heure de Paris, avec ou sans secondes', () => {
		expect(instant('2026-10-29T10:05:30') - instant('2026-10-29T10:00')).toBe(330_000);
	});
});
