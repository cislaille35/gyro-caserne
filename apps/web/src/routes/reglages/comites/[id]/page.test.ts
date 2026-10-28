import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const comite = { id: 2, nom: 'Amicale', theme: 'amicale', dissousLe: null, estCentre: false, membresEnCours: 3, rapporteurs: ['Alice Martin'] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (c: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data: { comite: { ...comite, ...c } }, form } }).body;

describe('page d’un comité', () => {
	it('en-tête avec membres et rapporteur ; renommer, et dissoudre avec avertissement et « Je confirme »', () => {
		const page = html({});
		expect(page).toContain('3 membres · rapporteur : Alice Martin');
		expect(page).toMatch(/action="\?\/modifier"[\s\S]*id="comite-nom"/);
		expect(page).toContain('Les 3 personnes qui tiennent un rôle dans ce comité le perdent aujourd’hui, avec ses droits ; les nominations à venir sont annulées.');
		expect(page).toMatch(/action="\?\/dissoudre"[\s\S]*name="confirmation" value="oui"/);
	});

	it('le comité du centre ne se renomme ni ne se dissout', () => {
		const page = html({ estCentre: true, nom: 'Comité du centre' });
		expect(page).toContain('<input type="hidden" name="nom" value="Comité du centre"');
		expect(page).toContain('ne se dissout pas');
		expect(page).not.toContain('?/dissoudre');
	});

	it('dissous : plus de formulaire', () => {
		const page = html({ dissousLe: '2026-05-01' }, { cible: 'dissoudre', succes: 'Le comité est dissous.' });
		expect(page).not.toMatch(/<form/);
		expect(page).toContain('Le comité est dissous.');
	});
});
