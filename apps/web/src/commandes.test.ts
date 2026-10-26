import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appli = fileURLToPath(new URL('..', import.meta.url));
const { scripts } = JSON.parse(readFileSync(`${appli}package.json`, 'utf8')) as { scripts: Record<string, string> };

// Tout ce qui touche à la base ou à l'appli en ligne exige de nommer le centre.
describe('CENTRE obligatoire en ligne', () => {
	it.each(['deployer', 'base-en-ligne'])('%s exige CENTRE', (nom) => {
		expect(scripts[nom]).toContain('${CENTRE:?');
		expect(scripts[nom]).not.toContain('${CENTRE:-');
	});

	it('jeu-de-depart --en-ligne refuse sans CENTRE', () => {
		const { CENTRE: _, ...env } = process.env;
		const resultat = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', 'scripts/jeu-de-depart.ts', '--en-ligne'], { cwd: appli, env, encoding: 'utf8' });
		expect(resultat.status).toBe(1);
		expect(resultat.stderr).toContain('CENTRE à préciser');
	}, 30_000);
});
