import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { photoVisee } from './visionneuse.ts';

// La visionneuse lit l'état de la page : une photo ouverte y est notée.
const etat = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('$app/state', () => ({ page: etat }));
vi.mock('$app/navigation', () => ({ pushState: vi.fn() }));
const { default: Visionneuse } = await import('./Visionneuse.svelte');

const html = (state: Record<string, unknown> = {}) => {
	etat.state = state;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return render(Visionneuse as any, { props: {} }).body.replace(/<!--[^>]*-->/g, '');
};
const source = readFileSync(new URL('./Visionneuse.svelte', import.meta.url), 'utf8');
const style = source.slice(source.indexOf('<style'));

// Un lien de photo, comme dans la page : marqué, avec sa photo dedans.
const lien = (alt = 'Photo de l’écart : Radio') => ({ getAttribute: (n: string) => (n === 'href' ? '/engins/photo/5' : null), querySelector: () => ({ alt }) });
const appui = (autres: Record<string, unknown> = {}, cible: unknown = lien()) => ({
	button: 0,
	ctrlKey: false,
	metaKey: false,
	shiftKey: false,
	altKey: false,
	defaultPrevented: false,
	target: { closest: (s: string) => (s === 'a[data-visionneuse]' ? cible : null) },
	...autres
});

describe('Visionneuse', () => {
	it('fermée : une fenêtre native vide, rien ne s’affiche', () => {
		const page = html();
		// Un nom sans « photo » : getByLabel('Photo') (le champ d'un formulaire) ne doit trouver que le champ.
		expect(page).toMatch(/<dialog class="visionneuse[^"]*"[^>]*aria-label="Image en grand"/);
		expect(page.match(/<dialog[^>]*>/)![0]).not.toMatch(/photo/i);
		expect(page).not.toMatch(/<dialog[^>]* open/);
		expect(page).not.toContain('<img');
	});

	it('ouverte : la photo entière avec son texte, et « Fermer » écrit pour les lecteurs d’écran', () => {
		const page = html({ photo: { src: '/engins/photo/5', alt: 'Photo de l’écart : Radio' } });
		expect(page).toMatch(/<img[^>]*src="\/engins\/photo\/5"[^>]*alt="Photo de l’écart : Radio"/);
		expect(page).toMatch(/<button type="button" class="fermer[^"]*"[^>]*>[\s\S]*?<span class="masque[^"]*">Fermer<\/span><\/button>/);
	});

	it('la photo entière sur un fond sombre (jeton), « Fermer » en haut, de 44 px au moins', () => {
		expect(readFileSync(new URL('../../app.css', import.meta.url), 'utf8')).toMatch(/:root \{[^}]*--fond-photo: #[0-9a-f]{6};/);
		expect(style).toMatch(/\.visionneuse \{[^}]*background: var\(--fond-photo\);/);
		expect(style).toMatch(/img \{[^}]*object-fit: contain;/);
		expect(style).toMatch(/\.fermer \{[^}]*top:[^}]*width: var\(--cible\);[^}]*height: var\(--cible\);/);
		// L'apparition est celle des fenêtres (app.css), coupée si le mouvement est réduit : aucune autre ici.
		expect(style).not.toMatch(/transition|animation/);
		// Ni largeur ni hauteur d'écran : la barre de défilement de l'ordinateur rognerait « Fermer ».
		expect(style).not.toMatch(/100vw|100dvh/);
		// Les couleurs en jetons, jamais écrites.
		expect(style).not.toMatch(/#[0-9a-f]{3,8}\b/i);
		expect(style).toMatch(/var\(--encre-photo\)/);
		expect(style).toMatch(/var\(--voile-photo\)/);
	});

	it('posée une fois pour toute l’appli, dans la racine', () => {
		const racine = readFileSync(new URL('../../routes/+layout.svelte', import.meta.url), 'utf8');
		expect(racine.match(/<Visionneuse \/>/g)).toHaveLength(1);
	});

	it('s’ouvre et se ferme par l’historique : retour du téléphone, Échap, appui hors de la photo', () => {
		// L'adresse entière, fragment compris (#publication-…) : fermée, la page revient à la même adresse.
		expect(source).toMatch(/pushState\(location\.href, \{ photo:/);
		expect(source).toMatch(/history\.back\(\)/);
		// Deux fermetures rapprochées (double appui, Échap puis le fond) ne reculent qu'une fois : sinon on quitte la page, et l'appli sur iPhone.
		expect(source).toMatch(/if \(ferme\) return;\s*ferme = true;\s*history\.back\(\)/);
		expect(source).toMatch(/oncancel=/);
		expect(source).toMatch(/showModal\(\)/);
		// Le focus revient au lien d'origine.
		expect(source).toMatch(/origine\?\.focus\(\)/);
	});
});

describe('photoVisee', () => {
	it('un appui simple sur un lien de photo : son adresse et le texte de sa photo', () => {
		expect(photoVisee(appui())).toMatchObject({ src: '/engins/photo/5', alt: 'Photo de l’écart : Radio' });
	});

	it('Ctrl, Cmd, Maj, Alt, un autre bouton ou un appui déjà pris : le navigateur garde la main', () => {
		for (const autres of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
			expect(photoVisee(appui(autres)), JSON.stringify(autres)).toBeNull();
		}
	});

	it('un autre lien ou un appui ailleurs : rien', () => {
		expect(photoVisee(appui({}, null))).toBeNull();
		expect(photoVisee(appui({ target: null }))).toBeNull();
	});
});
