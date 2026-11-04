import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

const etat = vi.hoisted(() => ({ page: { form: null as object | null } }));
vi.mock('$app/state', () => etat);
const { default: EnvoiCoupe } = await import('./EnvoiCoupe.svelte');

describe('message d’un envoi coupé', () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const html = () => render(EnvoiCoupe as any).body;

	it('rien sans coupure, même avec un autre retour de formulaire', () => {
		etat.page = { form: { message: 'Date invalide' } };
		expect(html()).not.toContain('Date invalide');
		expect(html()).not.toContain('Fermer');
	});

	it('le message, dans une zone annoncée, avec Fermer', () => {
		etat.page = { form: { coupure: 'votre envoi n’est peut-être pas passé' } };
		const page = html();
		expect(page).toContain('role="alert"');
		expect(page).toContain('votre envoi n’est peut-être pas passé');
		expect(page).toContain('Fermer');
	});
});
