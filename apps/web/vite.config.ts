import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Centre pour lequel l'appli est construite : CENTRE=<id> lit centres/<id>/centre.ts (centre fictif par défaut)
const centre = process.env.CENTRE || 'exemple';
const fichierCentre = fileURLToPath(new URL(`../../centres/${centre}/centre.ts`, import.meta.url));
if (!existsSync(fichierCentre)) {
	throw new Error(`Centre « ${centre} » introuvable : créez centres/${centre}/centre.ts`);
}
// Lire le centre ici arrête la compilation s'il est mal décrit, au lieu de planter l'appli chez l'agent
await import(fichierCentre);

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			// La config Cloudflare (nom de l'appli, base, stockage) est celle du centre
			// La base locale de développement est rangée avec le centre, comme pour `pnpm base-locale`
			adapter: adapter({
				config: fileURLToPath(new URL(`../../centres/${centre}/wrangler.jsonc`, import.meta.url)),
				platformProxy: { persist: { path: fileURLToPath(new URL(`../../centres/${centre}/.wrangler/state/v3`, import.meta.url)) } }
			}),
			// En-tête Content-Security-Policy : seuls les scripts de l'appli peuvent s'exécuter
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:'],
					'connect-src': ['self'],
					'frame-ancestors': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'object-src': ['none']
				}
			}
		})
	],
	resolve: { alias: { $centre: fichierCentre } },
	test: { include: ['src/**/*.test.ts'] }
});
