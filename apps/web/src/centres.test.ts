import { describe, expect, it } from 'vitest';
import { erreursCentre, type Centre } from '@gyro-caserne/centre';
import { unstable_readConfig } from 'wrangler';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Tous les centres décrits dans le dépôt, pas seulement celui de la compilation en cours
const fichiers = import.meta.glob<{ default: Centre }>('../../../centres/*/centre.ts');
const appli = fileURLToPath(new URL('..', import.meta.url));

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

		it(`${dossier} a sa config Cloudflare, qui déploie l'appli sous son propre nom`, () => {
			const fichierConfig = fileURLToPath(new URL(chemin.replace('centre.ts', 'wrangler.jsonc'), import.meta.url));
			const config = unstable_readConfig({ config: fichierConfig });
			expect(config.name).toBe(`gyro-caserne-${dossier}`);
			expect(config.main).toBe(resolve(appli, '.svelte-kit/cloudflare/_worker.js'));
			expect(resolve(dirname(fichierConfig), config.assets?.directory ?? '')).toBe(resolve(appli, '.svelte-kit/cloudflare'));
		});
	}
});
