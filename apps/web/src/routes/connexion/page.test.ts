import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (form: unknown, ecusson: number | null = null) => render(Page as any, { props: { form, data: { ecusson } } }).body;
const envoye = (plus: object = {}) => ({ envoye: true, email: 'claire@exemple.fr', envoyeLe: 1_700_000_000_000, renvoiDans: 60, ...plus });

describe('page de connexion', () => {
	it('une phrase, un champ, un bouton', () => {
		const page = html(null);
		expect(page).toContain('recevez un lien de connexion par courriel');
		expect(page).toMatch(/<form[^>]*action="\?\/envoyer"/);
		expect(page).toMatch(/<input[^>]*type="email"/);
		expect(page).toMatch(/<button[^>]*type="submit"[^>]*>[^<]*?(<!---->)?Recevoir un lien de connexion/);
	});

	it('après l’envoi : « Lien envoyé », l’adresse rappelée, « Changer d’adresse »', () => {
		const page = html(envoye());
		expect(page).toMatch(/role="status"[\s\S]*?Lien envoyé[\s\S]*?claire@exemple\.fr/);
		expect(page).toMatch(/<a[^>]*href="\/connexion"[^>]*>Changer d’adresse<\/a>/);
		expect(page).not.toMatch(/type="email"/);
	});

	it('après l’envoi : le champ du code, clavier numérique et code reçu proposé par le téléphone, puis « Me connecter »', () => {
		const page = html(envoye());
		const formulaire = page.match(/<form[^>]*action="\?\/code"[\s\S]*?<\/form>/)![0];
		expect(formulaire).toMatch(/<input[^>]*name="email"[^>]*value="claire@exemple\.fr"/);
		expect(formulaire).toMatch(/<input[^>]*name="envoyeLe"[^>]*value="1700000000000"/);
		const champ = formulaire.match(/<input[^>]*name="code"[^>]*>/)![0];
		expect(champ).toContain('inputmode="numeric"');
		expect(champ).toContain('autocomplete="one-time-code"');
		expect(champ).toContain('required');
		expect(formulaire).toMatch(/<label[^>]*for="code"[^>]*>Code reçu par courriel<\/label>/);
		expect(formulaire).toMatch(/<button[^>]*type="submit"[^>]*>(<!---->)?Me connecter/);
		expect(page).toMatch(/tapez ici son code à 6 chiffres/);
	});

	it('une erreur sur le code : dite sous le champ, sans humour', () => {
		const page = html(envoye({ erreur: 'Code incorrect. Vérifiez les 6 chiffres.' }));
		expect(page).toMatch(/<input[^>]*name="code"[^>]*aria-invalid="true"/);
		expect(page).toMatch(/class="erreur[^"]*"[^>]*>Code incorrect\. Vérifiez les 6 chiffres\./);
	});

	it('« Renvoyer l’e-mail » : un formulaire vers l’envoi, en attente tant que la minute n’est pas passée', () => {
		const attente = html(envoye()).match(/<form[^>]*action="\?\/envoyer"[\s\S]*?<\/form>/)![0];
		expect(attente).toMatch(/<input[^>]*name="email"[^>]*value="claire@exemple\.fr"/);
		expect(attente).toMatch(/<button[^>]*disabled[^>]*>(<!---->)?Renvoyer l’e-mail/);
		expect(attente).toContain('Possible dans 60 s');
		const libre = html(envoye({ renvoiDans: 0 })).match(/<form[^>]*action="\?\/envoyer"[\s\S]*?<\/form>/)![0];
		expect(libre).not.toMatch(/<button[^>]*disabled/);
		expect(libre).not.toContain('Possible dans');
	});

	it('l’écusson du centre s’il y en a un, avec son texte alternatif ; sinon, la page d’aujourd’hui', () => {
		expect(html(null, 7)).toMatch(/<img[^>]*src="\/ecusson\?v=7"/);
		expect(html(null, 7)).toMatch(/alt="Écusson de [^"]+"/);
		expect(html(null)).not.toContain('/ecusson');
	});
});
