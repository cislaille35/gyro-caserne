import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (data: unknown, form: unknown = null) => render(Page as any, { props: { data, form } }).body;
const lien = 'https://caserne.exemple.fr/agenda/3-abc.ics';

describe('Ajouter à mon agenda', () => {
	it('le lien, un mode d’emploi par agenda, « Changer le lien »', () => {
		const html = page({ lien, webcal: lien.replace('https://', 'webcal://') });
		expect(html).toContain(lien);
		expect(html).toContain('href="webcal://caserne.exemple.fr/agenda/3-abc.ics"');
		for (const t of ['Google Agenda', 'iPhone', 'Outlook', 'Changer le lien']) expect(html).toContain(t);
	});

	it('après « Changer le lien », le dit', () => {
		expect(page({ lien, webcal: lien }, { change: true })).toContain('Nouveau lien créé');
	});

	it('sans planning : le dit', () => {
		expect(page({ lien: null, sansPlanning: true })).toContain('Le planning est réservé aux agents du centre.');
	});

	it('le super administrateur n’a pas d’agenda', () => {
		expect(page({ lien: null })).toContain('Le super administrateur n’a pas de planning');
	});
});
