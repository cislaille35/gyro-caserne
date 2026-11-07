import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ETAT_CONNECTE, ETAT_SUPER } from './serveur.ts';

test.use({ storageState: ETAT_CONNECTE });

async function sansViolation(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

// Le super administrateur publie sur « Vie du centre » : la cloche de l'agent le compte, le fil le montre, « Tout marquer comme lu » le remet à zéro.
test('une publication arrive dans la cloche ; « Tout marquer comme lu »', async ({ browser, page }) => {
	const marque = `Gâteau ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	test.setTimeout(60_000);
	const auteur = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
	await auteur.goto('/echanges/publier?mur=vie');
	const formulaire = auteur.locator('form[action="?/publier"]');
	await expect(formulaire.getByRole('group', { name: 'Pour un événement' })).toBeHidden();
	await formulaire.getByLabel('Votre message', { exact: true }).fill(marque);
	await formulaire.getByRole('button', { name: /^Publier/ }).click();
	await auteur.waitForURL(/\/echanges\/vie#publication-\d+$/);
	await auteur.context().close();

	// La notification est écrite juste après la réponse faite à l'auteur.
	await expect(async () => {
		await page.goto('/');
		await expect(page.getByRole('link', { name: /^Notifications, (plus de )?\d+ nouvelles?$/ })).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 15_000 });
	await page.getByRole('link', { name: /^Notifications/ }).click();
	const ligne = page.getByRole('link', { name: new RegExp(`Super administrateur a publié dans Vie du centre ${marque}`) });
	await expect(ligne).toBeVisible();
	await expect(ligne).toContainText('Non lu');
	await expect(page.getByRole('heading', { level: 2, name: 'Aujourd’hui' })).toBeVisible();
	await sansViolation(page);

	await page.getByRole('button', { name: 'Tout marquer comme lu' }).click();
	await expect(page.getByText('Tout est lu.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();
	await expect(ligne).not.toContainText('Non lu');
});

// Ouvrir la publication depuis la cloche (le lien passe par /notifications/ouvrir) : la ligne est lue, le nombre baisse aussitôt.
test('la cloche baisse quand on ouvre la publication depuis la cloche', async ({ browser, page }) => {
	const marque = `Galette ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	test.setTimeout(60_000);
	const auteur = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
	await auteur.goto('/echanges/publier?mur=vie');
	const formulaire = auteur.locator('form[action="?/publier"]');
	await formulaire.getByLabel('Votre message', { exact: true }).fill(marque);
	await formulaire.getByRole('button', { name: /^Publier/ }).click();
	await auteur.waitForURL(/\/echanges\/vie#publication-\d+$/);
	await auteur.context().close();

	const cloche = page.getByRole('link', { name: /^Notifications/ });
	await expect(async () => {
		await page.goto('/notifications');
		await expect(page.getByRole('link', { name: new RegExp(`a publié dans Vie du centre ${marque}`) })).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 15_000 });
	const nombre = async () => Number((await cloche.getAttribute('aria-label'))?.match(/\d+/)?.[0] ?? 0);
	const avant = await nombre();
	expect(avant).toBeGreaterThan(0);
	await page.getByRole('link', { name: new RegExp(`a publié dans Vie du centre ${marque}`) }).click();
	await page.waitForURL(/\/echanges\/vie\/\d+/);
	await expect.poll(nombre).toBe(avant - 1);
});

// Couper un mur (le haut-parleur de son en-tête), puis « Réactiver » dans Moi → Notifications.
test('couper un mur, le retrouver dans Moi → Notifications, le réactiver', async ({ page }) => {
	await page.goto('/echanges/vie');
	await page.waitForLoadState('networkidle');
	const cloche = page.getByRole('button', { name: 'Couper les notifications de Vie du centre' });
	// Un essai précédent (autre taille d'écran) a pu la laisser coupée.
	if ((await cloche.getAttribute('aria-pressed')) === 'true') {
		await cloche.click();
		await expect(cloche).toHaveAttribute('aria-pressed', 'false');
	}
	await cloche.click();
	await expect(cloche).toHaveAttribute('aria-pressed', 'true');
	await expect(cloche).toContainText('Coupées');
	await sansViolation(page);

	await page.getByRole('link', { name: 'Moi', exact: true }).click();
	await page.getByRole('link', { name: /^Notifications Ce téléphone/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
	await expect(page.getByRole('switch', { name: 'Tout couper au téléphone' })).toHaveAttribute('aria-checked', 'false');
	await sansViolation(page);
	await page.getByRole('button', { name: 'Réactiver Vie du centre' }).click();
	await expect(page.getByText('Rien n’est coupé.')).toBeVisible();
	await page.goto('/echanges/vie');
	await expect(page.getByRole('button', { name: 'Couper les notifications de Vie du centre' })).toHaveAttribute('aria-pressed', 'false');
});
