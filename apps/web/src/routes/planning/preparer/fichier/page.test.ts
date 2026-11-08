import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('Fichier du planning', () => {
	it('exporter et importer, avec un champ étiqueté et le retour vers Préparer', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const html = render(Page as any, { props: { data: { annee: 2027 } } }).body;
		expect(html).toContain('Exporter l’année 2027');
		expect(html).toMatch(/<label class="titre[^"]*" for="fichier-planning"/);
		expect(html).toContain('aria-describedby="fichier-planning-aide"');
		expect(html).toContain('href="/planning/preparer?annee=2027"');
	});
});
