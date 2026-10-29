import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ETAT_CONNECTE } from './serveur.ts';

test.use({ storageState: ETAT_CONNECTE });

// Le menu des gestes d'un message, au clavier seul : ouvrir, parcourir, fermer, focus rendu ; puis « Répondre ».
test('menu des gestes au clavier', async ({ page }) => {
	const marque = `Essai ${Date.now().toString(36)}`;
	await page.goto('/echanges/messages/nouveau');
	await page.waitForLoadState('networkidle');
	await page.locator('h2:text-is("Tout le centre") ~ ul a').first().click();
	await page.waitForURL(/\/echanges\/messages\/(a\/)?\d+/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('textbox', { name: 'Votre message' }).fill(marque);
	await page.getByRole('button', { name: 'Envoyer' }).click();
	const fil = page.getByRole('log');
	await expect(fil.getByText(marque)).toBeVisible();

	const bouton = page.getByRole('button', { name: /^Gestes sur votre message/ }).last();
	// Le bouton n'apparaît qu'avec JavaScript, une fois la page prête.
	await expect(bouton).not.toHaveAttribute('hidden');
	await bouton.focus();
	await page.keyboard.press('Enter');
	const menu = page.getByRole('menu');
	await expect(menu).toBeVisible();
	await expect(bouton).toHaveAttribute('aria-expanded', 'true');
	const elements = menu.locator('[role^="menuitem"]');
	await expect(elements.first()).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(elements.nth(1)).toBeFocused();
	await page.keyboard.press('End');
	await expect(elements.last()).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(elements.first()).toBeFocused();
	await page.keyboard.press('ArrowUp');
	await expect(elements.last()).toBeFocused();

	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => v.id)).toEqual([]);

	await page.keyboard.press('Escape');
	await expect(menu).toBeHidden();
	await expect(bouton).toBeFocused();
	await expect(bouton).toHaveAttribute('aria-expanded', 'false');

	await page.keyboard.press('Enter');
	await menu.getByRole('menuitem', { name: 'Répondre' }).focus();
	await page.keyboard.press('Enter');
	await expect(menu).toBeHidden();
	await expect(page.getByRole('textbox', { name: 'Votre message' })).toBeFocused();
	await expect(page.getByText(`Réponse à vous`)).toBeVisible();
	await page.getByRole('button', { name: 'Annuler la réponse' }).click();
	await expect(page.getByText(`Réponse à vous`)).toBeHidden();
});
