import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const appli = fileURLToPath(new URL('..', import.meta.url));
const { scripts } = JSON.parse(readFileSync(`${appli}package.json`, 'utf8')) as { scripts: Record<string, string> };

// Tout ce qui touche à la base ou à l'appli en ligne exige de nommer le centre.
describe('CENTRE obligatoire en ligne', () => {
	it.each(['deployer', 'base-en-ligne'])('%s exige CENTRE', (nom) => {
		expect(scripts[nom]).toContain('${CENTRE:?');
		expect(scripts[nom]).not.toContain('${CENTRE:-');
	});

	// Environnement minimal : ni jeton Cloudflare ni connexion Wrangler, même si la vérification régressait.
	it.each([{}, { CENTRE: '' }])('jeu-de-depart --en-ligne refuse sans CENTRE (%o)', (centre) => {
		const env = { PATH: process.env.PATH, HOME: tmpdir(), ...centre };
		const resultat = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', 'scripts/jeu-de-depart.ts', '--en-ligne'], { cwd: appli, env, encoding: 'utf8', timeout: 20_000 });
		expect(resultat.status).toBe(1);
		expect(resultat.stderr).toContain('CENTRE à préciser');
	}, 30_000);

	it('jeu-de-depart --en-ligne --avec-fictifs refuse un autre centre qu’exemple', () => {
		const env = { PATH: process.env.PATH, HOME: tmpdir(), CENTRE: 'laille' };
		const resultat = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', 'scripts/jeu-de-depart.ts', '--en-ligne', '--avec-fictifs'], { cwd: appli, env, encoding: 'utf8', timeout: 20_000 });
		expect(resultat.status).toBe(1);
		expect(resultat.stderr).toContain('fictifs réservés au centre exemple');
		expect(existsSync(`${appli}../../centres/laille/wrangler.en-ligne.jsonc`)).toBe(false);
	}, 30_000);
});
