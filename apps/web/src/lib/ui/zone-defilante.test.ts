import { describe, expect, it } from 'vitest';
import { decalagePourVoir } from './zone-defilante.ts';

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
