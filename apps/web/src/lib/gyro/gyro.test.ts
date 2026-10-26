import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Gyro from './Gyro.svelte';
import { TENUES, type Tenue } from './tenues.ts';

const html = (props: Record<string, unknown>) => render(Gyro, { props }).body;
const noms = Object.keys(TENUES) as Tenue[];

describe('Gyro', () => {
	it('connaît 42 tenues', () => {
		expect(noms).toHaveLength(42);
	});

	it.each(noms)('dessine la tenue %s avec son libellé', (tenue) => {
		const page = html({ tenue });
		expect(page).toContain('<svg');
		expect(page).toContain(`aria-label="Gyro, ${TENUES[tenue]}"`);
		expect(page).toContain('role="img"');
	});

	it('prend la tenue normale par défaut', () => {
		expect(html({})).toContain('aria-label="Gyro, souriant"');
	});

	it('dessine les accessoires de la tenue et pas ceux des autres', () => {
		expect(html({ tenue: 'galette' })).toContain('#b9772a');
		expect(html({ tenue: 'normal' })).not.toContain('#b9772a');
	});

	it('applique la taille', () => {
		expect(html({ taille: 48 })).toMatch(/<svg[^>]*width="48"[^>]*height="48"/);
	});

	it('anime par défaut', () => {
		expect(html({})).toMatch(/class="a-/);
	});

	it('sans animation, aucune classe a-', () => {
		for (const tenue of noms) expect(html({ tenue, anime: false })).not.toMatch(/class="a-/);
	});

	it('décoratif : caché des lecteurs d’écran', () => {
		const page = html({ decoratif: true });
		expect(page).toContain('aria-hidden="true"');
		expect(page).not.toContain('role="img"');
		expect(page).not.toContain('aria-label');
	});
});
