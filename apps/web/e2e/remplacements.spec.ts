import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { connecter } from './connexion.ts';
import { ETAT_SUPER } from './serveur.ts';

async function sansViolation(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

// Le jeu de départ : David (équipe 1) cherche un remplaçant pour sa prochaine nuit, ouverte à tous les disponibles.
test.describe('remplacements', () => {
	test('Chloé accepte la demande de David ; David demande une nuit puis l’annule', async ({ page }, info) => {
		test.setTimeout(120_000);
		if (info.project.name === 'telephone') {
			await connecter(page, 'chloe.durand@exemple.fr');
			await expect(page.getByRole('link', { name: /David Leroy cherche un remplaçant/ })).toBeVisible();
			await page.goto('/remplacements');
			await expect(page.getByRole('heading', { level: 2, name: 'David Leroy cherche un remplaçant' })).toBeVisible();
			await sansViolation(page);
			await page.getByRole('button', { name: /^Accepter/ }).click();
			await expect(page.getByRole('status')).toContainText('c’est conclu');
			await page.getByRole('link', { name: 'Mes demandes' }).click();
			await expect(page.getByRole('heading', { level: 2, name: 'Je remplace David Leroy' })).toBeVisible();
			await expect(page.getByText('Conclu', { exact: true })).toBeVisible();
			await page.getByRole('link', { name: /^Détails/ }).click();
			await expect(page.getByText(/mettez à jour votre disponibilité dans l’appli du SDIS/)).toBeVisible();
			await sansViolation(page);
			// Vue Année : le mois du remplacement peut être replié.
			await page.goto('/planning?vue=annee');
			await expect(page.getByText(/je remplace David Leroy/).first()).toBeAttached();
		} else {
			await connecter(page, 'david.leroy@exemple.fr');
			await page.goto('/planning');
			await page.getByRole('link', { name: 'Me faire remplacer' }).first().click();
			await expect(page.getByRole('heading', { level: 1, name: 'Me faire remplacer' })).toBeVisible();
			await sansViolation(page);
			// Étape 1 : la semaine de la carte est ouverte ; toucher un jour libre.
			await expect(page.getByText('Étape 1 sur 3')).toBeVisible();
			await page.locator('input[name="p"]:not([disabled])').first().check();
			await page.getByRole('button', { name: 'Continuer' }).click();
			// Étape 2 : « Tout le monde » est choisi d'office.
			await expect(page.getByText('Étape 2 sur 3')).toBeVisible();
			await expect(page.getByLabel(/Tout le monde/)).toBeChecked();
			await sansViolation(page);
			await page.getByRole('button', { name: 'Continuer' }).click();
			// Étape 3 : la phrase, puis Envoyer.
			await expect(page.getByText('Étape 3 sur 3')).toBeVisible();
			await expect(page.getByText(/^Vous demandez à être remplacé/)).toBeVisible();
			await sansViolation(page);
			await page.getByRole('button', { name: 'Envoyer la demande' }).click();
			await expect(page.getByText('Demande envoyée.', { exact: false })).toBeVisible();
			await expect(page.getByRole('list', { name: 'Où en est la demande' })).toBeVisible();
			await expect(page.getByRole('heading', { level: 2, name: 'Ouverte à tous les disponibles' })).toBeVisible();
			await expect(page.getByRole('heading', { level: 2, name: /Disponibles/ })).toBeVisible();
			await sansViolation(page);
			await page.getByRole('button', { name: /^Annuler la demande/ }).click();
			await expect(page.getByText('Annulée', { exact: true })).toBeVisible();
			await page.goto('/remplacements?onglet=historique');
			await sansViolation(page);
		}
	});
});

test.describe('chef : aptitudes', () => {
	test.use({ storageState: ETAT_SUPER });

	test('réglages : la liste des aptitudes, en ajouter une', async ({ page }) => {
		const nom = `T${Date.now().toString(36).slice(-4)}`;
		await page.goto('/reglages');
		await page.getByRole('link', { name: /Aptitudes/ }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Aptitudes' })).toBeVisible();
		await expect(page.getByLabel('Nom').first()).toHaveValue('CA2');
		await sansViolation(page);
		await page.locator('#nom-nouvelle').fill(nom);
		await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
		await expect(page.getByRole('status').first()).toContainText(`Aptitude ${nom} ajoutée`);
	});
});
