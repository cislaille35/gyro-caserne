import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (ecusson: number | null, form: unknown = null) => render(Page as any, { props: { data: { ecusson }, form } }).body.replace(/<!--[^>]*-->/g, '');

describe('Écusson du centre', () => {
	it('sans écusson : le champ d’image (JPEG ou WebP, 200 Ko) et « Enregistrer l’écusson », rien à retirer', () => {
		const html = page(null);
		expect(html).toContain('Image de l’écusson');
		expect(html).toContain('JPEG ou WebP, 200 Ko au plus');
		expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Enregistrer l’écusson/);
		expect(html).not.toContain('/ecusson?v=');
		expect(html).not.toContain('Retirer');
	});

	it('avec un écusson : l’aperçu (texte alternatif), « Remplacer l’écusson » ; le retrait rangé sous « Plus », grave et confirmé', () => {
		const html = page(5);
		expect(html).toMatch(/<img[^>]*src="\/ecusson\?v=5"[^>]*alt="Écusson de [^"]+"/);
		expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Remplacer l’écusson/);
		expect(html).toMatch(/<details class="plus"[^>]*>\s*<summary>Plus<\/summary>[\s\S]*name="confirmation" value="oui"[\s\S]*class="grave[^"]*"[^>]*>Retirer l’écusson/);
	});

	it('l’erreur d’image sous le champ ; le retrait refusé rouvre « Plus »', () => {
		expect(page(null, { cible: 'ecusson', erreurs: { image: 'Image JPEG ou WebP seulement.' } })).toMatch(/aria-invalid="true"[\s\S]*Image JPEG ou WebP seulement\./);
		expect(page(5, { cible: 'retirer', message: 'Cochez « Je confirme » pour continuer.' })).toMatch(/<details class="plus" open/);
	});
});
