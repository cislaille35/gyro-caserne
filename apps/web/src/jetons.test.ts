import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICONES_ROLES } from '#lib/ui/icones-roles.ts';

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
	const [r, g, b] = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
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
			...['ok', 'info', 'alerte', 'danger', 'neutre'].map((k) => [`statut-${k}-texte`, `statut-${k}-fond`]),
			...Object.keys(ICONES_ROLES).map((k) => [`icone-${k}-texte`, `icone-${k}-fond`])
		]) {
			expect(t[a], a).toMatch(/^#[0-9a-f]{6}$/);
			expect(t[b], b).toMatch(/^#[0-9a-f]{6}$/);
			expect(contraste(t[a], t[b]), `${a}/${b}`).toBeGreaterThanOrEqual(4.5);
		}
		expect(contraste(t.focus, t.fond), 'focus/fond').toBeGreaterThanOrEqual(3);
	});

	// Couleurs d'équipe : celles du centre d'exemple, et les extrêmes qu'un autre centre pourrait choisir.
	const canal = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
	const melange = (couleur: string, part: number, fond: string) =>
		`#${[0, 1, 2].map((i) => Math.round(canal(couleur, i) * part + canal(fond, i) * (1 - part)).toString(16).padStart(2, '0')).join('')}`;

	it.each(['clair', 'sombre'])('%s : la vue Mois reste lisible sur toutes les bandes, « ma semaine » comprise', (nom) => {
		const t = { ...themes.clair, ...themes[nom] };
		const vue = readFileSync(new URL('./lib/planning/VueMois.svelte', import.meta.url), 'utf8');
		// Le numéro de semaine et les jours hors du mois sur « ma semaine » : à l'encre, seule couleur sûre sur toute bande.
		expect(vue).toMatch(/\.numero \{[^}]*color: var\(--encre\)/);
		expect(vue).toMatch(/\.mienne \.hors a \{[^}]*color: var\(--encre\)/);
		// Sur « ma semaine », seule la taille distingue alors les jours hors du mois : jamais la couleur seule.
		expect(vue).toMatch(/\.hors \.jour \{[^}]*font-size: 0\.8125rem/);
		for (const equipe of ['#d4a017', '#c2185b', '#1565c0', '#2e7d32', '#8a949e', '#ffffff', '#000000'])
			for (const part of [0.1, 0.22, 0.3]) expect(contraste(t.encre, melange(equipe, part, t.surface)), `${equipe} à ${part}`).toBeGreaterThanOrEqual(4.5);
	});

	it('le socle de Gyro : inchangé en clair, visible sur le fond sombre', () => {
		expect(themes.clair['gyro-socle']).toBe('#1d2733');
		expect(contraste(themes.sombre['gyro-socle'], themes.sombre.fond)).toBeGreaterThanOrEqual(3);
		expect(contraste(themes.sombre['gyro-socle'], themes.sombre.surface)).toBeGreaterThanOrEqual(3);
	});

	it('fond crème et bord doux en clair, fond inchangé en sombre', () => {
		expect(themes.clair.fond).toBe('#f6f3ef');
		expect(themes.clair['trait-doux']).toBe('#e3ddd5');
		expect(themes.clair['rayon-grand']).toBe('16px');
		expect(themes.sombre.fond).toBe('#11171f');
		expect(themes.sombre['trait-doux']).toBe('#2b3642');
	});
});
