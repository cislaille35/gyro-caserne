import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

const etat = vi.hoisted(() => ({ page: { url: new URL('http://x/remplacements/1'), status: 200, error: null as { message: string } | null } }));
vi.mock('$app/state', () => etat);
const { MESSAGE_COUPURE } = await import('#lib/attente/attente.ts');
const { default: Erreur } = await import('./+error.svelte');

// SvelteKit peut laisser le statut à 200 quand le rechargement qui suit un geste échoue : il n'est jamais montré.
describe('page d’erreur', () => {
	const html = (message: string, status = 200) => {
		etat.page = { ...etat.page, status, error: { message } };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return render(Erreur as any).body;
	};

	it('dit notre message, sans code, et offre une sortie', () => {
		const page = html('Cette demande ne vous concerne pas.');
		expect(page).toContain('Cette demande ne vous concerne pas.');
		expect(page).not.toMatch(/>\s*200\s*</);
		expect(page).toMatch(/<h1[^>]*>/);
		expect(page).toContain('href="/"');
	});

	it('une coupure (dite par le service worker) : l’attente, sans alerte, et Réessayer', () => {
		const page = html(MESSAGE_COUPURE, 503);
		expect(page).toContain('Un instant, ça arrive…');
		expect(page).toContain('role="status"');
		expect(page).not.toContain('role="alert"');
		expect(page).toContain('Réessayer');
	});

	it('un message technique en anglais (panne, limite du serveur) devient une phrase simple', () => {
		const page = html('Internal Error', 503);
		expect(page).not.toContain('Internal Error');
		expect(page).toContain('Réessayez');
	});
});
