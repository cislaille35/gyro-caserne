import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({ afterNavigate: () => {} }));
const { default: EnvoiCoupe } = await import('./EnvoiCoupe.svelte');

// Le message lui-même arrive du service worker : e2e/attente.spec.ts.
describe('message d’un envoi coupé', () => {
	it('une zone annoncée, vide tant que rien n’est coupé', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const page = render(EnvoiCoupe as any).body;
		expect(page).toContain('role="alert"');
		expect(page).not.toContain('Fermer');
	});
});
