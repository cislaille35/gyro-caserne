import { defineConfig, devices } from '@playwright/test';
// Pour que context.route voie aussi les requêtes du service worker (e2e/attente.spec.ts).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
import { ADRESSE } from './e2e/serveur.ts';

// Tests d'accessibilité dans Chromium, à la taille d'un téléphone et d'un ordinateur.
// Un seul serveur pour tous les tests, lancé par e2e/serveur.ts (l'appli compilée en CI).
export default defineConfig({
	testDir: 'e2e',
	globalSetup: './e2e/serveur.ts',
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: ADRESSE,
		trace: 'retain-on-failure',
		// En local, Chromium du système si besoin (CHROMIUM=/usr/bin/chromium)
		launchOptions: { executablePath: process.env.CHROMIUM || undefined }
	},
	projects: [
		{ name: 'telephone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
		{ name: 'ordinateur', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }
	]
});
