import { describe, expect, it } from 'vitest';
import { decalagePourVoir, montrerCouranteDeCote } from './zone-defilante.ts';

describe('decalagePourVoir', () => {
	const zone = { haut: 100, bas: 500 };

	it('ne bouge pas si la ligne est déjà visible', () => {
		expect(decalagePourVoir(zone, { haut: 200, bas: 260 })).toBe(0);
	});

	it('descend juste assez quand la ligne est plus bas', () => {
		expect(decalagePourVoir(zone, { haut: 700, bas: 760 })).toBe(260);
	});

	it('remonte juste assez quand la ligne est plus haut', () => {
		expect(decalagePourVoir(zone, { haut: 40, bas: 100 })).toBe(-60);
	});
});

describe('montrerCouranteDeCote', () => {
	// Une rangée de 390 px qui défile ; l'option choisie, à 500 px du bord, est hors de l'écran.
	const rangee = (gauche: number, droite: number, largeurTotale = 700) => {
		const option = { getBoundingClientRect: () => ({ left: gauche, right: droite }) };
		return { scrollLeft: 0, scrollWidth: largeurTotale, clientWidth: 390, querySelector: () => option, getBoundingClientRect: () => ({ left: 0, right: 390 }) };
	};

	it('fait défiler juste assez pour montrer l’option choisie', () => {
		const zone = rangee(500, 600);
		montrerCouranteDeCote(zone as unknown as HTMLElement);
		expect(zone.scrollLeft).toBe(210);
	});

	it('ne bouge pas si elle se voit déjà, ou si la rangée ne défile pas', () => {
		const visible = rangee(100, 200);
		montrerCouranteDeCote(visible as unknown as HTMLElement);
		expect(visible.scrollLeft).toBe(0);
		const courte = rangee(500, 600, 390);
		montrerCouranteDeCote(courte as unknown as HTMLElement);
		expect(courte.scrollLeft).toBe(0);
		expect(() => montrerCouranteDeCote(undefined)).not.toThrow();
	});
});
