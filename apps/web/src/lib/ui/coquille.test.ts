import { readFileSync } from 'node:fs';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Coquille from './Coquille.svelte';
import { dansUneConversation, entreesNavigation, marqueDesLues, rubriqueDe } from './navigation.ts';

const contenu = createRawSnippet(() => ({ render: () => '<p>Bonjour</p>' }));

function html(chemin: string, connecte = true, cloche = 0, nonLus = 0, visage: { prenom: string; nom: string; couleur: string | null } | null = null) {
	return render(Coquille, {
		props: { chemin, connecte, nomCentre: 'CIS Test', cloche, nonLus, visage, children: contenu }
	}).body;
}

describe('Coquille', () => {
	it('dans une conversation seulement, en bon état : les barres se masquent', () => {
		expect(dansUneConversation('/echanges/messages/[id]', null)).toBe(true);
		expect(dansUneConversation('/echanges/messages/a/[personne]', null)).toBe(true);
		for (const route of ['/echanges/messages', '/echanges/messages/nouveau', '/echanges/messages/nouveau/groupe', '/echanges/messages/[id]/infos', '/echanges/[mur]', '/', null]) {
			expect(dansUneConversation(route, null), String(route)).toBe(false);
		}
		// Une page d'erreur garde sa navigation : sans elle, plus de sortie.
		expect(dansUneConversation('/echanges/messages/[id]', { message: 'Introuvable' })).toBe(false);
	});

	it('les pages dont l’ouverture marque des notifications lues : la cloche est relue après elles seulement', () => {
		for (const route of ['/echanges/[mur]', '/echanges/[mur]/[id]', '/remplacements', '/engins/anomalies/[id]']) expect(marqueDesLues(route), route).toBe(true);
		for (const route of ['/', '/planning', '/notifications', '/echanges/messages/[id]', '/engins/[id]', null]) expect(marqueDesLues(route), String(route)).toBe(false);
	});

	it('une conversation : la coquille le sait, et le lien « Aller au contenu » reste', () => {
		const page = render(Coquille, { props: { chemin: '/echanges/messages/7', connecte: true, nomCentre: 'CIS Test', conversation: true, children: contenu } }).body;
		expect(page).toMatch(/class="coquille[^"]*conversation/);
		expect(page).toContain('href="#contenu"');
		expect(html('/echanges/messages')).not.toMatch(/class="coquille[^"]*conversation/);
	});

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
		expect(entete).toMatch(/<a[^>]*href="\/moi"[^>]*>[\s\S]*?<span class="masque">Moi<\/span>/);
	});

	it('« Moi » : le visage seul de la personne (initiales, couleur d’équipe) ; sans fiche, l’icône de profil', () => {
		const moi = (visage: Parameters<typeof html>[4]) => html('/', true, 0, 0, visage).match(/<a[^>]*href="\/moi"[^>]*>[\s\S]*?<\/a>/)![0];
		const avec = moi({ prenom: 'Alice', nom: 'Martin', couleur: '#d4a017' });
		expect(avec).toMatch(/class="visage[^"]*"[^>]*style="background: #d4a017;[^"]*"[^>]*>AM<\/span>/);
		expect(avec).not.toContain('<svg');
		// « Moi » n'est écrit que pour les lecteurs d'écran : le visage suffit à l'œil.
		expect(avec.match(/>([^<]+)</g)!.map((t) => t.slice(1, -1).trim()).filter(Boolean)).toEqual(['AM', 'Moi']);
		expect(moi(null)).toContain('<svg');
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

	const source = readFileSync(new URL('./Coquille.svelte', import.meta.url), 'utf8');
	const regle = (selecteur: string) => source.match(new RegExp(`\\n\\t*${selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';

	it('la bande de marquage sous l’en-tête : décorative, en jetons, masquée avec l’en-tête dans une conversation', () => {
		const page = html('/');
		expect(page).toMatch(/<\/header>\s*<div class="marquage[^"]*" aria-hidden="true"><\/div>/);
		expect(regle('.marquage')).toMatch(/height: 4px/);
		expect(regle('.marquage')).toMatch(/background: var\(--marquage\)/);
		expect(source).toMatch(/\.conversation header,\s*\.conversation \.marquage,\s*\.conversation nav \{\s*display: none;/);
		// Sans connexion aussi : la marque de l'appli.
		expect(html('/connexion', false)).toContain('class="marquage ');
	});

	it('l’en-tête anthracite : « Gyro Caserne » en condensé, cloche et visage en carrés arrondis de 44 px, repère du clavier clair', () => {
		expect(regle('header')).toMatch(/background: var\(--entete-fond\)/);
		expect(regle('header')).toMatch(/color: var\(--entete-texte\)/);
		expect(regle('header')).toMatch(/--focus: var\(--entete-focus\)/);
		expect(regle('.appli')).toMatch(/var\(--police-titre\)/);
		expect(regle('.centre')).toMatch(/color: var\(--entete-doux\)/);
		expect(regle('.rond')).toMatch(/width: var\(--cible\)[\s\S]*border-radius: 12px[\s\S]*background: var\(--entete-bouton\)/);
		expect(source).toMatch(/header :global\(\.visage\) \{[^}]*border-radius: 12px/);
		expect(html('/')).toMatch(/<span class="appli[^"]*">Gyro Caserne<\/span>/);
	});

	it('à l’ordinateur, l’en-tête et sa bande prennent toute la largeur, le menu dessous à gauche', () => {
		expect(source).toMatch(/'entete entete'\s*'marquage marquage'\s*'menu contenu'/);
		expect(source).toMatch(/background: var\(--menu-fond\)/);
		expect(source).toMatch(/nav a\[aria-current='page'\] \{[^}]*background: var\(--menu-actif\)[^}]*font-weight: 700/);
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
		expect(rubriqueDe('/reservations/3/reserver')).toBe('/caserne');
		expect(rubriqueDe('/reglages')).toBe('/caserne');
		expect(rubriqueDe('/echanges')).toBe('/echanges');
		expect(rubriqueDe('/profil')).toBe('/moi');
		expect(rubriqueDe('/affichage')).toBe('/moi');
		expect(rubriqueDe('/notifications')).toBe('/notifications');
		expect(rubriqueDe('/engins')).toBe('/caserne');
		expect(rubriqueDe('/engins/3/prise')).toBe('/caserne');
		expect(rubriqueDe('/engins/prise')).toBe('/caserne');
		expect(rubriqueDe('/remplacements')).toBe('/planning');
		expect(rubriqueDe('/remplacements/7')).toBe('/planning');
		expect(rubriqueDe('/remplacements/demander')).toBe('/planning');
		expect(rubriqueDe('/moi/agenda')).toBe('/moi');
	});
	it('ne confond pas un chemin qui commence pareil', () => {
		expect(rubriqueDe('/agentsx')).not.toBe('/caserne');
		expect(rubriqueDe('/enginsx')).not.toBe('/caserne');
		expect(rubriqueDe('/remplacementsx')).not.toBe('/planning');
	});
});

describe('pastille d’Échanges', () => {
	const onglet = (page: string) => page.match(/<a\b[^>]*href="\/echanges"[^>]*>[\s\S]*?<\/a>/)![0];

	it('montre les messages non lus et les dit en texte', () => {
		const lien = onglet(html('/', true, 0, 3));
		expect(lien).toMatch(/<span class="nombre[^"]*" aria-hidden="true">3<\/span>/);
		expect(lien.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).toContain('Échanges , 3 messages non lus');
		expect(onglet(html('/', true, 0, 1))).toContain('1 message non lu');
		expect(onglet(html('/', true, 0, 120))).toContain('99+');
	});

	it('rien sans non-lus', () => {
		expect(onglet(html('/', true, 0, 0))).not.toContain('nombre');
	});
});
