import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
			...['ok', 'info', 'alerte', 'neutre'].map((k) => [`statut-${k}-texte`, `statut-${k}-fond`])
		]) {
			expect(contraste(t[a], t[b]), `${a}/${b}`).toBeGreaterThanOrEqual(4.5);
		}
		expect(contraste(t.focus, t.fond), 'focus/fond').toBeGreaterThanOrEqual(3);
	});
});
