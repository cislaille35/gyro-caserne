import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Coquille from './Coquille.svelte';
import { entreesNavigation } from './navigation.ts';

const contenu = createRawSnippet(() => ({ render: () => '<p>Bonjour</p>' }));

function html(chemin: string, connecte = true) {
	return render(Coquille, {
		props: { chemin, connecte, nomCentre: 'CIS Test', children: contenu }
	}).body;
}

describe('Coquille', () => {
	it('commence par le lien « Aller au contenu » et porte le contenu principal', () => {
		const page = html('/');
		const premierLien = page.match(/<a\b[^>]*>[\s\S]*?<\/a>/)![0];
		expect(premierLien).toContain('href="#contenu"');
		expect(premierLien).toContain('Aller au contenu');
		expect(page).toMatch(/<main[^>]*id="contenu"[^>]*tabindex="-1"/);
		expect(page).toContain('Bonjour');
	});

	it("marque seulement l'entrée de la page courante", () => {
		const page = html('/affichage');
		expect(page.match(/aria-current="page"/g)).toHaveLength(1);
		const lien = page.match(/<a\b[^>]*aria-current="page"[^>]*>/)![0];
		expect(lien).toContain('href="/affichage"');
	});

	it('a une navigation nommée avec un texte visible par entrée', () => {
		const page = html('/');
		expect(page).toContain('aria-label="Navigation principale"');
		for (const entree of entreesNavigation(true)) {
			expect(page).toMatch(new RegExp(`<a[^>]*href="${entree.href}"[^>]*>[\\s\\S]*?${entree.libelle}[\\s\\S]*?</a>`));
		}
	});

	it('affiche le nom du centre', () => {
		expect(html('/')).toContain('CIS Test');
	});
});

describe('entreesNavigation', () => {
	it("sans connexion : pas d'accueil", () => {
		const hrefs = entreesNavigation(false).map((e) => e.href);
		expect(hrefs).toEqual(['/connexion', '/affichage']);
	});
	it('connecté : pas de connexion', () => {
		const hrefs = entreesNavigation(true).map((e) => e.href);
		expect(hrefs).toEqual(['/', '/agents', '/affichage']);
	});
	it('une personne connectée a « Mon profil »', () => {
		const hrefs = entreesNavigation(true, true).map((e) => e.href);
		expect(hrefs).toEqual(['/', '/agents', '/profil', '/affichage']);
	});
	it('« Réglages » apparaît seulement pour qui peut régler le centre', () => {
		expect(entreesNavigation(true, true, true).map((e) => e.href)).toEqual(['/', '/agents', '/profil', '/reglages', '/affichage']);
		expect(entreesNavigation(true, true).map((e) => e.href)).not.toContain('/reglages');
		expect(entreesNavigation(false, false, true).map((e) => e.href)).not.toContain('/reglages');
	});
	it('« Nominations » apparaît pour qui peut attribuer, avant « Réglages », jamais sans connexion', () => {
		expect(entreesNavigation(true, true, true, true).map((e) => e.href)).toEqual(['/', '/agents', '/profil', '/nominations', '/reglages', '/affichage']);
		expect(entreesNavigation(true, true).map((e) => e.href)).not.toContain('/nominations');
		expect(entreesNavigation(false, false, false, true).map((e) => e.href)).not.toContain('/nominations');
	});
	it('« Mon profil » n\'apparaît pas sans connexion', () => {
		expect(entreesNavigation(false, true).map((e) => e.href)).not.toContain('/profil');
	});
});
