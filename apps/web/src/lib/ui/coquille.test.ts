import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Coquille from './Coquille.svelte';
import { entreesNavigation, rubriqueDe } from './navigation.ts';

const contenu = createRawSnippet(() => ({ render: () => '<p>Bonjour</p>' }));

function html(chemin: string, connecte = true, cloche = 0) {
	return render(Coquille, {
		props: { chemin, connecte, nomCentre: 'CIS Test', cloche, children: contenu }
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

	const courant = (page: string) => {
		expect(page.match(/aria-current="page"/g)).toHaveLength(1);
		return page.match(/<a\b[^>]*aria-current="page"[^>]*>/)![0];
	};

	it("marque seulement l'onglet dont descend la page courante", () => {
		expect(courant(html('/agents/12'))).toContain('href="/caserne"');
		expect(courant(html('/reglages'))).toContain('href="/caserne"');
		expect(courant(html('/'))).toContain('href="/"');
	});

	it('marque « Moi » pour le profil et l’affichage, la cloche pour les notifications', () => {
		expect(courant(html('/profil'))).toContain('href="/moi"');
		expect(courant(html('/affichage'))).toContain('href="/moi"');
		expect(courant(html('/notifications'))).toContain('href="/notifications"');
	});

	it('sans connexion : « Affichage » reste marqué dans la navigation, sans cloche ni « Moi »', () => {
		const page = html('/affichage', false);
		expect(courant(page)).toContain('href="/affichage"');
		expect(page).not.toContain('href="/notifications"');
		expect(page).not.toContain('href="/moi"');
	});

	it('met la cloche « Notifications » et « Moi » en haut, hors de la navigation', () => {
		const page = html('/');
		const entete = page.match(/<header[\s\S]*?<\/header>/)![0];
		expect(entete).toMatch(/<a[^>]*href="\/notifications"[^>]*aria-label="Notifications"/);
		expect(entete).toMatch(/<a[^>]*href="\/moi"[^>]*>[\s\S]*?Moi[\s\S]*?<\/a>/);
	});

	it('la cloche dit le nombre de nouvelles, au singulier comme au pluriel, sans compter sur la couleur', () => {
		const lien = (n: number) => html('/', true, n).match(/<a[^>]*href="\/notifications"[^>]*>[\s\S]*?<\/a>/)![0];
		expect(lien(0)).toMatch(/aria-label="Notifications"/);
		expect(lien(0)).not.toContain('class="nombre"');
		expect(lien(1)).toContain('aria-label="Notifications, 1 nouvelle"');
		expect(lien(3)).toContain('aria-label="Notifications, 3 nouvelles"');
		expect(lien(3)).toMatch(/<span class="nombre[^"]*"[^>]*aria-hidden="true"[^>]*>3<\/span>/);
		expect(lien(99)).toContain('aria-label="Notifications, 99 nouvelles"');
		expect(lien(120)).toContain('aria-label="Notifications, plus de 99 nouvelles"');
		expect(lien(120)).toMatch(/>99\+<\/span>/);
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
	it('connecté : les quatre onglets, dans l’ordre', () => {
		expect(entreesNavigation(true).map((e) => [e.href, e.libelle])).toEqual([
			['/', 'Accueil'],
			['/planning', 'Planning'],
			['/caserne', 'Caserne'],
			['/echanges', 'Échanges']
		]);
	});
	it('sans connexion : Connexion et Affichage', () => {
		expect(entreesNavigation(false).map((e) => e.href)).toEqual(['/connexion', '/affichage']);
	});
});

describe('rubriqueDe', () => {
	it('range chaque page sous son onglet', () => {
		expect(rubriqueDe('/')).toBe('/');
		expect(rubriqueDe('/planning')).toBe('/planning');
		expect(rubriqueDe('/agents')).toBe('/caserne');
		expect(rubriqueDe('/agents/12')).toBe('/caserne');
		expect(rubriqueDe('/nominations')).toBe('/caserne');
		expect(rubriqueDe('/reglages')).toBe('/caserne');
		expect(rubriqueDe('/echanges')).toBe('/echanges');
		expect(rubriqueDe('/profil')).toBe('/moi');
		expect(rubriqueDe('/affichage')).toBe('/moi');
		expect(rubriqueDe('/notifications')).toBe('/notifications');
	});
	it('ne confond pas un chemin qui commence pareil', () => {
		expect(rubriqueDe('/agentsx')).not.toBe('/caserne');
	});
});
