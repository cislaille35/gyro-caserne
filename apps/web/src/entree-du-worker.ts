import { appendFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Adapter } from '@sveltejs/kit';

// L'adaptateur Cloudflare n'écrit qu'un gestionnaire `fetch`, dans getBuildDirectory('cloudflare')/_worker.js : le test des
// centres garantit que ce chemin est bien le `main` de wrangler.jsonc. Après lui, son worker est renommé _sveltekit.js, et une
// petite entrée prend sa place : elle reprend son `fetch` et ajoute le gestionnaire planifié (planifie.ts). Wrangler assemble
// le tout au déploiement. Voir docs/decisions/0011.
export function avecEntreePlanifiee(adaptateur: Adapter, fichierCentre: string, fichierPlanifie: string): Adapter {
	return {
		...adaptateur,
		async adapt(builder) {
			await adaptateur.adapt(builder);
			const dossier = builder.getBuildDirectory('cloudflare');
			const chemin = (fichier: string) => relative(dossier, fichier).replaceAll('\\', '/');
			renameSync(join(dossier, '_worker.js'), join(dossier, '_sveltekit.js'));
			writeFileSync(
				join(dossier, '_worker.js'),
				[
					`import kit from './_sveltekit.js';`,
					`import centre from '${chemin(fichierCentre)}';`,
					`import { avecPlanifie } from '${chemin(fichierPlanifie)}';`,
					'',
					'export default avecPlanifie(kit, centre);',
					''
				].join('\n')
			);
			// Le dossier est publié tel quel : le code du serveur n'y est jamais servi.
			appendFileSync(join(dossier, '.assetsignore'), '\n_sveltekit.js');
		}
	};
}
