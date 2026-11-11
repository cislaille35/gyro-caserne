import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encreSur } from '#lib/couleurs.ts';

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

function variables(bloc: string): Record<string, string> {
	return Object.fromEntries([...bloc.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

function corps(debut: string): string {
	const i = css.indexOf(debut);
	if (i < 0) throw new Error(`bloc absent : ${debut}`);
	const ouvre = css.indexOf('{', i);
	const fin = css.indexOf('}', ouvre);
	return css.slice(ouvre + 1, fin);
}

const themes: Record<string, Record<string, string>> = {
	clair: variables(corps(':root {')),
	sombre: variables(corps(":root[data-theme='sombre']")),
	auto: variables(corps("@media (prefers-color-scheme: dark) {\n\t:root[data-theme='auto']"))
};

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
	const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (haut + 0.05) / (bas + 0.05);
}

describe('jetons', () => {
	it('le thème auto sombre reprend exactement le thème sombre', () => {
		expect(Object.keys(themes.sombre).length).toBeGreaterThan(0);
		expect(themes.auto).toEqual(themes.sombre);
	});

	it.each(['clair', 'sombre'])('%s : texte lisible (≥ 4,5:1)', (nom) => {
		const t = { ...themes.clair, ...themes[nom] };
		for (const [a, b] of [
			['encre', 'fond'],
			['encre', 'surface'],
			['doux', 'fond'],
			['doux', 'surface'],
			['accent', 'surface'],
			['sur-rouge', 'rouge'],
			...['ok', 'info', 'alerte', 'danger', 'neutre'].map((k) => [`statut-${k}-texte`, `statut-${k}-fond`])
		]) {
			expect(t[a], a).toMatch(/^#[0-9a-f]{6}$/);
			expect(t[b], b).toMatch(/^#[0-9a-f]{6}$/);
			expect(contraste(t[a], t[b]), `${a}/${b}`).toBeGreaterThanOrEqual(4.5);
		}
		expect(contraste(t.focus, t.fond), 'focus/fond').toBeGreaterThanOrEqual(3);
	});

	it('le clair est un gris neutre : plus de crème ni de beige', () => {
		expect(themes.clair).toMatchObject({ fond: '#eef0f3', 'trait-doux': '#d9dee3', 'segment-fond': '#e1e5ea', 'menu-actif': '#e1e5ea' });
		expect(themes.clair['ombre-carte']).toBe('0 0 0 transparent');
	});

	it.each(['clair', 'sombre'])('%s : la vue Mois reste lisible, « ma semaine » comprise', (nom) => {
		const t = { ...themes.clair, ...themes[nom] };
		const vue = readFileSync(new URL('./lib/planning/VueMois.svelte', import.meta.url), 'utf8');
		// Les autres semaines : le nom de l'équipe à l'encre sur la carte, à côté d'un carré de couleur décoratif.
		expect(vue).toMatch(/\.equipe \{[^}]*color: var\(--encre\)/);
		expect(vue).toMatch(/<span class="carre" aria-hidden="true"><\/span>\s*<span class="equipe">\{e\.nom\}<\/span>/);
		expect(contraste(t.encre, t.surface)).toBeGreaterThanOrEqual(4.5);
		// « Ma semaine » : l'à-plat de l'équipe, tout en encre choisie pour elle (au moins 4,5:1, voir encreSur).
		expect(vue).toMatch(/style:--sur-equipe=\{mienne \? encreSur\(e\.couleur\) : undefined\}/);
		expect(vue).toMatch(/\.mienne th,\s*\.mienne td \{[^}]*background: var\(--equipe\)/);
		expect(vue).toMatch(/\.mienne \.equipe,\s*\.mienne \.numero,\s*\.mienne \.marque,\s*\.mienne td a,\s*\.mienne \.signes span \{[^}]*color: var\(--sur-equipe\)/);
		expect(vue).toMatch(/\.mienne \{[^}]*--focus: var\(--sur-equipe\)/);
		// Sur « ma semaine », seule la taille distingue alors les jours hors du mois : jamais la couleur seule.
		expect(vue).toMatch(/\.hors \.jour \{[^}]*font-size: var\(--texte-14\)/);
		for (const equipe of ['#f2c200', '#e5699a', '#3d7fd6', '#3fa34d', '#d4a017', '#c2185b', '#1565c0', '#2e7d32', '#8a949e'])
			expect(contraste(encreSur(equipe), equipe), equipe).toBeGreaterThanOrEqual(4.5);
	});

	it.each(['clair', 'sombre'])('%s : les cases à cocher, dessinées, lisibles, grisées à part', (nom) => {
		const t = { ...themes.clair, ...themes[nom] };
		const regle = (suite: string) => corps(`:where(input[type='checkbox']:not([role='switch']))${suite} {`);
		const base = regle('');
		expect(base).toMatch(/appearance: none/);
		expect(base).toMatch(/border: 2px solid var\(--doux\)/);
		expect(base).toMatch(/background: var\(--surface\)/);
		expect(base).toMatch(/--case-plein: var\(--encre\);\s*--case-coche: var\(--surface\)/);
		expect(regle(':checked')).toMatch(/background: var\(--case-plein\)/);
		const grisee = regle(':disabled');
		expect(grisee).toMatch(/--case-plein: var\(--segment-fond\);\s*--case-coche: var\(--doux\)/);
		expect(grisee).toMatch(/border-style: dashed/);
		// Le bord de la case se voit sur la carte et sur le fond (3:1) ; la coche se lit sur la case pleine ; grisée aussi.
		expect(contraste(t.doux, t.surface)).toBeGreaterThanOrEqual(3);
		expect(contraste(t.doux, t.fond)).toBeGreaterThanOrEqual(3);
		expect(contraste(t.encre, t.surface), 'case pleine sur la carte').toBeGreaterThanOrEqual(3);
		expect(contraste(t.surface, t.encre), 'coche').toBeGreaterThanOrEqual(4.5);
		expect(contraste(t.doux, t['segment-fond']), 'coche grisée').toBeGreaterThanOrEqual(3);
		// Grisée, la case ne ressemble ni à une case vide (fond de carte) ni à une case pleine.
		expect(t['segment-fond']).not.toBe(t.surface);
		expect(contraste(t['segment-fond'], t.encre)).toBeGreaterThanOrEqual(3);
	});

	it('aucun écran ne redessine la case à sa façon', () => {
		const racine = new URL('./', import.meta.url);
		const fichiers = (readdirSync(racine, { recursive: true }) as string[]).filter((p) => p.endsWith('.svelte'));
		for (const f of fichiers) {
			const texte = readFileSync(new URL(f, racine), 'utf8');
			const debut = texte.includes('\n<style>') ? texte.lastIndexOf('\n<style>') : texte.length;
			const [code, style] = [texte.slice(0, debut), texte.slice(debut)];
			expect(style, f).not.toMatch(/type=.checkbox./);
			// La couleur native (accent-color) reste aux boutons radio : un écran à cases ne s'en sert pas.
			if (code!.includes('type="checkbox"')) expect(style, f).not.toMatch(/accent-color/);
		}
	});

	it('le socle de Gyro : inchangé en clair, visible sur le fond sombre', () => {
		expect(themes.clair['gyro-socle']).toBe('#1d2733');
		expect(contraste(themes.sombre['gyro-socle'], themes.sombre.fond)).toBeGreaterThanOrEqual(3);
		expect(contraste(themes.sombre['gyro-socle'], themes.sombre.surface)).toBeGreaterThanOrEqual(3);
	});

	it('en sombre, le fond ne change pas', () => {
		expect(themes.sombre.fond).toBe('#11171f');
		expect(themes.sombre['trait-doux']).toBe('#2b3642');
	});

	it('cartes arrondies sans bord ni ombre : une surface sur le fond', () => {
		expect(themes.clair['rayon-grand']).toBe('14px');
		expect(themes.clair['rayon-bouton']).toBe('10px');
		// Une ombre invisible plutôt que « none » : elle se combine avec une autre ombre.
		expect(themes.clair['ombre-carte']).toBe('0 0 0 transparent');
		expect(themes.sombre['ombre-carte']).toBe('0 0 0 transparent');
		expect(luminance(themes.sombre.surface)).toBeGreaterThan(luminance(themes.sombre.fond));
	});

	it.each(['clair', 'sombre'])('%s : l’en-tête anthracite, son menu et les blocs de choix restent lisibles', (nom) => {
		const t = { ...themes.clair, ...themes[nom] };
		for (const [a, b] of [
			['entete-texte', 'entete-fond'],
			['entete-doux', 'entete-fond'],
			['entete-texte', 'entete-bouton'],
			['encre', 'menu-fond'],
			['doux', 'menu-fond'],
			['encre', 'menu-actif'],
			['encre', 'segment-fond'],
			['fond', 'encre']
		]) {
			expect(t[a], a).toMatch(/^#[0-9a-f]{6}$/);
			expect(t[b], b).toMatch(/^#[0-9a-f]{6}$/);
			expect(contraste(t[a], t[b]), `${a}/${b}`).toBeGreaterThanOrEqual(4.5);
		}
		// Le repère du clavier se voit sur l'en-tête comme sur les blocs de choix.
		expect(contraste(t['entete-focus'], t['entete-fond']), 'focus/en-tête').toBeGreaterThanOrEqual(3);
		expect(contraste(t['entete-focus'], t['entete-bouton']), 'focus/bouton de l’en-tête').toBeGreaterThanOrEqual(3);
		expect(contraste(t.focus, t['segment-fond']), 'focus/segments').toBeGreaterThanOrEqual(3);
	});

	it('en sombre, l’en-tête et le menu sont plus foncés que le fond', () => {
		expect(themes.clair['entete-fond']).toBe('#1d2733');
		expect(luminance(themes.sombre['entete-fond'])).toBeLessThan(luminance(themes.sombre.fond));
		expect(luminance(themes.sombre['menu-fond'])).toBeLessThan(luminance(themes.sombre.fond));
	});

	it('la bande de marquage : jaune et rouge, par jetons', () => {
		expect(themes.clair.jaune).toBe('#f2c200');
		expect(css).toMatch(/repeating-linear-gradient\(-45deg, var\(--jaune\) 0 10px, var\(--rouge\) 10px 20px\)/);
	});
});

describe('texte posé sur la couleur d’une équipe (plaque d’astreinte, visage)', () => {
	// Les équipes de Laillé, celles du centre d'exemple, une couleur sombre, et des teintes moyennes, les plus difficiles.
	const couleurs = ['#f2c200', '#e5699a', '#3d7fd6', '#3fa34d', '#d4a017', '#c2185b', '#1565c0', '#2e7d32', '#1d2733', '#8a949e', '#777777', '#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000'];

	it.each(couleurs)('%s : noir ou blanc, au moins 4,5:1 même pour un petit texte', (couleur) => {
		const encre = encreSur(couleur);
		expect(['#1d2733', '#000000', '#ffffff']).toContain(encre);
		expect(contraste(encre, couleur)).toBeGreaterThanOrEqual(4.5);
	});

	it('l’anthracite de l’appli quand il passe, le noir pur sinon (le bleu de Laillé)', () => {
		expect(encreSur('#f2c200')).toBe('#1d2733');
		expect(encreSur('#3d7fd6')).toBe('#000000');
		expect(encreSur('#1565c0')).toBe('#ffffff');
		expect(encreSur('#1d2733')).toBe('#ffffff');
	});

	it('un balayage de toutes les teintes : jamais sous 4,5:1', () => {
		const pas = [...Array(16).keys()].map((i) => (i * 17).toString(16).padStart(2, '0'));
		for (const r of pas)
			for (const g of pas)
				for (const b of pas) {
					const couleur = `#${r}${g}${b}`;
					expect(contraste(encreSur(couleur), couleur), couleur).toBeGreaterThanOrEqual(4.5);
				}
	});
});
