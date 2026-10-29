import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (form: unknown) => render(Page as any, { props: { form } }).body;

describe('page de connexion', () => {
	it('une phrase, un champ, un bouton', () => {
		const page = html(null);
		expect(page).toContain('recevez un lien de connexion par courriel');
		expect(page).toMatch(/<input[^>]*type="email"/);
		expect(page).toMatch(/<button[^>]*type="submit"[^>]*>[^<]*?(<!---->)?Recevoir un lien de connexion/);
	});

	it('après l’envoi : l’adresse rappelée et « Changer d’adresse »', () => {
		const page = html({ envoye: true, email: 'claire@exemple.fr' });
		expect(page).toMatch(/role="status"[\s\S]*?un lien vient de partir[\s\S]*?claire@exemple\.fr/);
		expect(page).toMatch(/<a[^>]*href="\/connexion"[^>]*>Changer d’adresse<\/a>/);
		expect(page).not.toContain('<form');
	});
});
