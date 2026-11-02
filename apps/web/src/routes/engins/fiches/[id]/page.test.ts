import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data, form } }).body.replace(/<!--[\s\S]*?-->/g, '');
const fiche = (utilisee = false) => ({
	typeId: 3,
	type: 'VTU',
	version: { id: 1, numero: 2, auteur: 'Rémi Test', creeLe: '2026-11-02T10:00', utilisee },
	zones: [
		{ ref: 1, nom: 'Cabine', elements: [{ ref: 10, libelle: 'Radio', quantite: null }, { ref: 11, libelle: 'Gilets', quantite: 3 }] },
		{ ref: 2, nom: 'Coffres', elements: [] }
	]
});

describe('éditeur de fiche', () => {
	it('version, auteur, zones repliées ; chaque élément a ses gestes nommés', () => {
		const page = html({ fiche: fiche(), retirerZone: null, nouveau: false });
		expect(page).toContain('Version 2');
		expect(page).toContain('Rémi Test');
		expect(page).toMatch(/aria-expanded="false"[\s\S]*?Cabine/);
		expect(page).toMatch(/Monter Radio[\s\S]*?Descendre Radio[\s\S]*?Retirer[\s\S]*? Radio/);
		expect(page).toMatch(/Gilets[\s\S]*?3[\s\S]*?attendus/);
		expect(page).toContain('Ajouter un élément à « Coffres »');
		expect(page).toContain('href="?retirer-zone=2"');
		expect(page).not.toContain('Elle a déjà servi');
	});

	it('une version déjà utilisée annonce la suivante', () => {
		expect(html({ fiche: fiche(true), retirerZone: null, nouveau: false })).toContain('la modifier crée la version 3');
	});

	it('après un geste, la zone touchée est ouverte et le succès dit ; retirer une zone demande confirmation', () => {
		const page = html({ fiche: fiche(), retirerZone: 1, nouveau: false }, { cible: 'element:10', zone: 1, succes: 'Élément déplacé.' });
		expect(page).toMatch(/aria-expanded="true"[\s\S]*?Cabine/);
		expect(page).toContain('Élément déplacé.');
		expect(page).toContain('Retirer « Cabine » et ses 2 éléments ?');
	});
});
