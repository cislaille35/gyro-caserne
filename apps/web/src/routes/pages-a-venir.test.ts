import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Planning from './planning/+page.svelte';
import { load as chargerPlanning } from './planning/+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: any) => render(composant, { props: { data: {} } }).body;

describe('pages à venir', () => {
	it('disent une phrase vraie, sans fausses données', () => {
		expect(html(Planning)).toContain('Le planning arrive bientôt.');
	});

	it('demandent la connexion', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((chargerPlanning as any)({ locals: { acteur: null } })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});
});
