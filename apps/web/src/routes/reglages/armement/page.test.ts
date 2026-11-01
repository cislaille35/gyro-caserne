import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const armement = {
	engins: [{ nom: 'FPT', postes: { ca2: 1, ca1: 0, ce: 2, cod1: 1, agent: 2 } }],
	niveaux: { ca2: 1, ca1: 2, ce: 3, cod2: null, cod1: 4 }
};
const aptitudes = [1, 2, 3, 4].map((id) => ({ id, nom: ['CA2', 'CA1', 'CE', 'COD1'][id - 1], controlee: true, ordre: id }));

describe('Armement des engins', () => {
	it('un champ étiqueté par poste et par niveau, groupés par engin', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const html = render(Page as any, { props: { data: { armement, aptitudes }, form: null } }).body;
		expect(html).toMatch(/<legend[^>]*>FPT · calculé pour l’été<\/legend>/);
		expect(html).toMatch(/name="FPT-ce"[^>]*value="2"[^>]*aria-label="FPT : Chef d’équipe \(CE\)"/);
		expect(html).toMatch(/name="niveau-cod2"[^>]*>(?:(?!<\/select>).)*<option value=""[^>]*selected/s);
		expect(html).toMatch(/name="niveau-cod1"[^>]*>(?:(?!<\/select>).)*<option value="4"[^>]*selected/s);
	});
});
