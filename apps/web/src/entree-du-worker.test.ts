import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Adapter, Builder } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { avecEntreePlanifiee } from './entree-du-worker.ts';

describe('avecEntreePlanifiee', () => {
	it('après l’adaptateur, le worker de SvelteKit est enveloppé par une entrée qui ajoute le gestionnaire planifié', async () => {
		const racine = mkdtempSync(join(tmpdir(), 'entree-'));
		const dossier = join(racine, 'apps/web/.svelte-kit/cloudflare');
		const adaptateur: Adapter = {
			name: 'faux',
			adapt: () => {
				mkdirSync(dossier, { recursive: true });
				writeFileSync(join(dossier, '_worker.js'), 'export default { fetch() {} };');
				writeFileSync(join(dossier, '.assetsignore'), '_worker.js\n_headers');
			}
		};
		const builder = { getBuildDirectory: (nom: string) => join(racine, 'apps/web/.svelte-kit', nom) } as unknown as Builder;
		const enveloppe = avecEntreePlanifiee(adaptateur, join(racine, 'centres/exemple/centre.ts'), join(racine, 'apps/web/src/planifie.ts'));
		expect(enveloppe.name).toBe('faux');
		await enveloppe.adapt(builder);

		expect(readFileSync(join(dossier, '_sveltekit.js'), 'utf8')).toBe('export default { fetch() {} };');
		const entree = readFileSync(join(dossier, '_worker.js'), 'utf8');
		expect(entree).toContain("import kit from './_sveltekit.js';");
		expect(entree).toContain("import centre from '../../../../centres/exemple/centre.ts';");
		expect(entree).toContain("import { avecPlanifie } from '../../src/planifie.ts';");
		expect(entree).toContain('export default avecPlanifie(kit, centre);');
		// Le code du serveur n'est jamais servi comme un fichier public.
		expect(readFileSync(join(dossier, '.assetsignore'), 'utf8').split('\n')).toContain('_sveltekit.js');
		expect(existsSync(join(dossier, '_worker.js'))).toBe(true);
	});
});
