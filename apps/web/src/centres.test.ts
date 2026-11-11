import { describe, expect, it } from 'vitest';
import { erreursCentre, type Centre } from '@gyro-caserne/centre';
import { unstable_getMiniflareWorkerOptions, unstable_readConfig } from 'wrangler';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { CRON_NUIT, CRON_REVEIL } from './planifie.ts';

// Tous les centres décrits dans le dépôt, pas seulement celui de la compilation en cours
const fichiers = import.meta.glob<{ default: Centre }>('../../../centres/*/centre.ts');
const appli = fileURLToPath(new URL('..', import.meta.url));

function configCloudflare(cheminCentre: string) {
	const fichier = fileURLToPath(new URL(cheminCentre.replace('centre.ts', 'wrangler.jsonc'), import.meta.url));
	return { fichier, config: unstable_readConfig({ config: fichier }) };
}

describe('centres du dépôt', () => {
	it('en trouve au moins un', () => {
		expect(Object.keys(fichiers).length).toBeGreaterThan(0);
	});

	for (const [chemin, charger] of Object.entries(fichiers)) {
		const dossier = chemin.split('/').at(-2);

		it(`${dossier} est bien décrit`, async () => {
			const { default: centre } = await charger();
			expect(erreursCentre(centre)).toEqual([]);
			expect(centre.id).toBe(dossier);
		});

		it(`${dossier} fait son ménage chaque nuit, à 3 h 30 (UTC), et se réveille toutes les cinq minutes`, () => {
			expect(configCloudflare(chemin).config.triggers.crons).toEqual([CRON_NUIT, CRON_REVEIL]);
			expect(CRON_REVEIL).toBe('*/5 * * * *');
		});

		it(`${dossier} a sa config Cloudflare, qui déploie l'appli sous son propre nom`, () => {
			const { fichier, config } = configCloudflare(chemin);
			expect(config.name).toBe(`gyro-caserne-${dossier}`);
			expect(config.main).toBe(resolve(appli, '.svelte-kit/cloudflare/_worker.js'));
			expect(resolve(dirname(fichier), config.assets?.directory ?? '')).toBe(resolve(appli, '.svelte-kit/cloudflare'));
			// Aucune version d'essai en ligne : les adresses de prévisualisation sont coupées à chaque déploiement (décision 0026, terminée).
			expect(config.preview_urls, 'preview_urls').toBe(false);
		});

		// L'adresse n'est pas un secret : elle est dans la config, pour qu'aucun déploiement ne la perde (décision 0024).
		it(`${dossier} donne l'adresse de l'appli dans sa config (https, sans chemin)`, () => {
			const adresse = configCloudflare(chemin).config.vars.BETTER_AUTH_URL;
			expect(adresse, 'vars.BETTER_AUTH_URL').toBeTypeOf('string');
			const url = new URL(adresse as string);
			expect(url.protocol).toBe('https:');
			expect(url.origin).toBe(adresse);
		});

		// Après une mise à jour du code, un centre doit recopier les réglages techniques de centres/exemple
		it(`${dossier} a les mêmes réglages techniques que centres/exemple`, () => {
			const { config } = configCloudflare(chemin);
			const { config: modele } = configCloudflare('../../../centres/exemple/centre.ts');
			expect(config.compatibility_date, 'compatibility_date').toBe(modele.compatibility_date);
			expect(config.compatibility_flags, 'compatibility_flags').toEqual(modele.compatibility_flags);
			expect(config.triggers, 'triggers').toEqual(modele.triggers);
			const base = config.d1_databases.find((d: { binding: string }) => d.binding === 'BASE');
			const baseModele = modele.d1_databases.find((d: { binding: string }) => d.binding === 'BASE');
			expect(base, 'base D1 « BASE »').toBeDefined();
			expect(base?.migrations_dir, 'migrations_dir').toBe(baseModele?.migrations_dir);
			expect(base?.database_name, 'database_name').toBe(`gyro-caserne-${dossier}`);
		});
	}
});

// En local (développement et tests), .dev.vars l'emporte sur l'adresse de la config : les liens de connexion restent sur localhost.
describe('adresse en local', () => {
	it('vient de .dev.vars, pas de la config du centre', () => {
		const dossier = mkdtempSync(join(tmpdir(), 'gyro-adresse-'));
		try {
			const { config } = configCloudflare('../../../centres/exemple/centre.ts');
			writeFileSync(join(dossier, 'wrangler.jsonc'), JSON.stringify({ name: 'essai', vars: config.vars }));
			writeFileSync(join(dossier, '.dev.vars'), 'BETTER_AUTH_URL=http://localhost:5174\n');
			const { workerOptions } = unstable_getMiniflareWorkerOptions(join(dossier, 'wrangler.jsonc'));
			expect(config.vars.BETTER_AUTH_URL).toMatch(/^https:/);
			expect((workerOptions.bindings as Record<string, unknown> | undefined)?.BETTER_AUTH_URL).toBe('http://localhost:5174');
		} finally {
			rmSync(dossier, { recursive: true, force: true });
		}
	});
});

// La version d'essai de la refonte est retirée (décision 0026, terminée).
it('aucun flux ne déploie de version d’essai', () => {
	expect(existsSync(fileURLToPath(new URL('../../../.github/workflows/deployer-refonte.yml', import.meta.url)))).toBe(false);
});
