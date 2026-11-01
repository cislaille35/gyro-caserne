import { defineConfig, devices } from '@playwright/test';
import { ADRESSE } from './e2e/serveur.ts';

// Tests d'accessibilité dans Chromium, à la taille d'un téléphone et d'un ordinateur.
// Un seul serveur de développement pour tous les tests, lancé par e2e/serveur.ts.
export default defineConfig({
	testDir: 'e2e',
	globalSetup: './e2e/serveur.ts',
	// En CI, deux navigateurs en parallèle (la machine a 4 cœurs), pour aller plus vite et économiser les minutes.
	workers: process.env.CI ? 2 : 1,
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
