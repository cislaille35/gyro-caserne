import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// La charte (skill du projet) ne doit citer que ce qui existe : sinon elle guide vers du code disparu.
const depot = new URL('../../../', import.meta.url).pathname;
const appli = new URL('.', import.meta.url).pathname;
const charte = join(depot, '.claude/skills/charte-gyro/SKILL.md');
const texte = existsSync(charte) ? readFileSync(charte, 'utf8') : '';
const cites = [...texte.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]!);

describe('charte graphique', () => {
	it('existe et se présente comme un skill', () => {
		expect(texte).toMatch(/^---\nname: charte-gyro\ndescription: /);
	});

	it('chaque fichier cité existe', () => {
		const chemins = cites.filter((c) => /\.(ts|css|svelte|md)$/.test(c) || c.startsWith('lib/') || c.startsWith('routes/') || c.startsWith('apps/'));
		// « centres/<id>/… » désigne le dossier d'un centre : on vérifie celui du centre fictif.
		const absents = chemins.filter((c) => ![join(depot, c), join(appli, c)].some((p) => existsSync(p.replace('<id>', 'exemple'))));
		expect(chemins.length).toBeGreaterThan(5);
		expect(absents).toEqual([]);
	});

	it('chaque composant cité existe', () => {
		const composants = [...new Set(cites.filter((c) => /^[A-Z][A-Za-z]+$/.test(c)))];
		const absents = composants.filter((c) => !['lib/ui', 'lib/planning'].some((d) => existsSync(join(appli, d, `${c}.svelte`))));
		expect(composants.length).toBeGreaterThan(10);
		expect(absents).toEqual([]);
	});

	it('chaque jeton et chaque classe commune cités existent dans app.css', () => {
		const css = readFileSync(join(appli, 'app.css'), 'utf8');
		const jetons = cites.filter((c) => /^--[a-z0-9-]+$/.test(c));
		// `.page` est propre à chaque écran : la charte le dit.
		const classes = cites.filter((c) => /^\.[a-z-]+$/.test(c) && c !== '.page');
		expect(jetons.filter((j) => !css.includes(`${j}:`))).toEqual([]);
		expect(classes.filter((k) => !new RegExp(`\\${k}(?![\\w-])`).test(css))).toEqual([]);
	});

	it('chaque fonction ou option citée existe encore dans le code', () => {
		const tout = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tout(join(d, e.name)) : /\.(ts|svelte)$/.test(e.name) && !e.name.endsWith('.test.ts') ? [readFileSync(join(d, e.name), 'utf8')] : []));
		const code = tout(join(appli, 'lib')).join('\n');
		const noms = [...new Set(cites.filter((c) => /^[a-z][a-zA-Z]+$/.test(c)))];
		const absents = noms.filter((n) => !new RegExp(`export (?:const|function) ${n}\\b|\\b${n}\\??: |\\b${n} = |'${n}'`).test(code));
		expect(noms.length).toBeGreaterThan(10);
		expect(absents).toEqual([]);
	});

	it('CLAUDE.md y renvoie', () => {
		expect(readFileSync(join(depot, 'CLAUDE.md'), 'utf8')).toContain('.claude/skills/charte-gyro/SKILL.md');
	});
});
