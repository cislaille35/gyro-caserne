import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const armement = {
	engins: [{ nom: 'FPT', postes: { ca2: 1, ca1: 0, ce: 2, cod1: 1, agent: 2 } }],
	niveaux: { ca2: 1, ca1: 2, ce: 3, cod2: null, cod1: 4 }
};
const aptitudes = [1, 2, 3, 4].map((id) => ({ id, nom: ['CA2', 'CA1', 'CE', 'COD1'][id - 1], controlee: true, ordre: id }));

const vsav = { nom: 'VSAV', postes: { ca2: 0, ca1: 1, ce: 1, cod1: 0, agent: 1 } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (engin: string | null = null) => render(Page as any, { props: { data: { armement: { ...armement, engins: [vsav, ...armement.engins] }, aptitudes, engin }, form: null } }).body.replace(/<!--[^>]*-->/g, '');

describe('Armement des engins', () => {
	it('une rangée par engin : ses postes en une ligne, les postes à zéro masqués ; « Modifier » ouvre son panneau', () => {
		const html = page();
		expect(html).toContain('3 postes : CA 1 agrès, CE, agent');
		expect(html).toContain('6 postes : CA tout engins, conducteur, 2 CE, 2 agents');
		expect(html).toMatch(/href="\?engin=FPT"[^>]*>Modifier<span class="masque[^"]*"> le FPT<\/span>/);
		expect(html).not.toContain('type="number"');
		expect(html).not.toContain('<dialog');
	});

	it('la correspondance des aptitudes, repliée', () => {
		const html = page();
		expect(html).toMatch(/<details[^>]*>\s*<summary[^>]*>Correspondance des aptitudes<\/summary>/);
		expect(html).toMatch(/name="niveau-cod2"[^>]*>(?:(?!<\/select>).)*<option value=""[^>]*selected/s);
		expect(html).toMatch(/name="niveau-cod1"[^>]*>(?:(?!<\/select>).)*<option value="4"[^>]*selected/s);
	});

	it('le panneau d’un engin : − et + nommés par poste, valeur annoncée ; chaque poste envoyé', () => {
		const html = page('VSAV');
		expect(html).toMatch(/<dialog[^>]*>/);
		expect(html).toMatch(/aria-label="Un poste CE de moins \(1 actuellement\)"/);
		expect(html).toMatch(/aria-label="Un poste CE de plus \(1 actuellement\)"/);
		expect(html).toMatch(/aria-label="Un poste CA tout engins de moins \(0 actuellement\)"[^>]*aria-disabled="true"/);
		expect(html).toMatch(/aria-label="Un poste CE de moins \(1 actuellement\)"[^>]*aria-disabled="false"/);
		expect(html).toMatch(/<input type="hidden" name="VSAV-ce" value="1"/);
		expect(html).toMatch(/role="status"/);
	});
});
