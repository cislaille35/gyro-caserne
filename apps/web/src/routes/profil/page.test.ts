import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Page from './+page.svelte';

const profil = { surnom: null, telephone: null, telephoneVisible: false, contactUrgence: null, naissance: '1990-05-17', anniversaireVisible: true, cochesLecture: true };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: Record<string, unknown>) => render(Page as any, { props: { data: { profil, messagerie: true, ...data }, form: null } }).body.replace(/<!--[\s\S]*?-->/g, '');

describe('page Mon profil', () => {
	it('« Montrer quand j’ai lu les messages » : cochée selon le profil, expliquée, avec son repère', () => {
		const page = html({});
		expect(page).toMatch(/Montrer quand j’ai lu les messages<\/span><span id="([^"]+)-aide"[^>]*>[^<]*vous ne voyez plus non plus celles des autres[\s\S]*?<input type="checkbox" role="switch" name="cochesLecture" value="1"[^>]*aria-describedby="\1-aide"[^>]*checked/);
		expect(page).toContain('<input type="hidden" name="avecCoches" value="1"');
		expect(html({ profil: { ...profil, cochesLecture: false } })).not.toMatch(/name="cochesLecture"[^>]*checked/);
	});

	it('les réglages oui ou non en interrupteurs, enregistrés par « Enregistrer » (sans JavaScript aussi)', () => {
		const page = html({ profil: { ...profil, telephoneVisible: true, anniversaireVisible: false } });
		expect(page).toMatch(/Montrer mon téléphone au centre<\/span><\/span><input type="checkbox" role="switch" name="telephoneVisible" value="1"[^>]*checked/);
		expect(page).toMatch(/Afficher mon anniversaire<\/span><\/span><input type="checkbox" role="switch" name="anniversaireVisible" value="1"(?![^>]*checked)[^>]*>/);
		expect(page).not.toContain('<noscript');
		expect(page).toMatch(/<button[^>]*type="submit"[^>]*>(<!---->)?Enregistrer(<!---->)?<\/button>/);
		const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');
		expect(source.match(/<Interrupteur\s/g)).toHaveLength(3);
		expect(source).not.toContain('type="checkbox"');
	});

	it('date de naissance : champ date, facultatif, qui dit qui la voit', () => {
		const page = html({});
		expect(page).toMatch(/<input[^>]*id="naissance"[^>]*>/);
		expect(page).toMatch(/<input[^>]*type="date"[^>]*name="naissance"|<input[^>]*name="naissance"[^>]*type="date"/);
		expect(page).toContain('value="1990-05-17"');
		expect(page).not.toMatch(/name="naissance"[^>]*required/);
		expect(page).toContain('Vue du chef de centre et de son adjoint seulement. Votre âge n’est jamais montré.');
	});

	it('sans messagerie : ni case ni repère', () => {
		const page = html({ messagerie: false });
		expect(page).not.toContain('cochesLecture');
		expect(page).not.toContain('avecCoches');
	});

	it('en-tête avec retour vers « Moi »', () => {
		expect(html({})).toMatch(/<a[^>]*href="\/moi"[^>]*>[\s\S]*?Moi<\/a>[\s\S]*?<h1[^>]*>Mon profil<\/h1>/);
	});

	it('super administrateur : un vide qui explique, et où aller', () => {
		const page = html({ profil: null });
		expect(page).toContain('Le super administrateur n’a pas de fiche.');
		expect(page).toMatch(/<a[^>]*href="\/affichage"/);
		expect(page).not.toContain('<form');
	});
});
