import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Planning from './planning/+page.svelte';
import Echanges from './echanges/+page.svelte';
import Notifications from './notifications/+page.svelte';
import { load as chargerPlanning } from './planning/+page.server';
import { load as chargerEchanges } from './echanges/+page.server';
import { load as chargerNotifications } from './notifications/+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: any) => render(composant, { props: { data: {} } }).body;

describe('pages à venir', () => {
	it('disent une phrase vraie, sans fausses données', () => {
		expect(html(Planning)).toContain('Le planning arrive bientôt.');
		expect(html(Echanges)).toContain('Les murs et la messagerie arrivent bientôt.');
		expect(html(Notifications)).toContain('Les notifications arrivent bientôt.');
	});

	it('demandent la connexion', async () => {
		for (const charger of [chargerPlanning, chargerEchanges, chargerNotifications]) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await expect((charger as any)({ locals: { acteur: null } })).rejects.toMatchObject({ status: 303, location: '/connexion' });
		}
	});
});
