import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('fichier des fiches', () => {
	it('deux étapes : exporter, puis importer un .xlsx ; rien d’écrit avant validation', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const page = render(Page as any, { props: { data: { aujourdhui: '2026-11-02' } } }).body;
		expect(page).toMatch(/1\. Exporter les fiches[\s\S]*Exporter les fiches[\s\S]*2\. Importer le fichier modifié/);
		expect(page).toMatch(/<input[^>]*id="fichier-fiches"[^>]*type="file"[^>]*accept="\.xlsx/);
		expect(page).toContain('Rien n’est écrit avant votre validation.');
	});
});
