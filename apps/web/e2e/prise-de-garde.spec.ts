import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ETAT_CONNECTE, ETAT_SUPER } from './serveur.ts';

async function sansViolation(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

test.describe('prise de garde', () => {
	test.use({ storageState: ETAT_CONNECTE });

	test('lire sans brouillon, puis les zones une à une ; annuler ; la validation sans défiler', async ({ page }) => {
		await page.goto('/engins/2/prise');
		await page.waitForLoadState('networkidle');
		// Un essai précédent a pu laisser un brouillon.
		const abandon = page.getByText('Abandonner la prise…');
		if (await abandon.count()) {
			await abandon.click();
			await page.getByRole('button', { name: 'Oui, abandonner' }).click();
			await expect(abandon).toBeHidden();
		}
		await expect(page.getByText('Commencée par')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Commencer la prise' })).toBeHidden();
		const zones = page.getByRole('navigation', { name: 'Zones de l’engin' }).getByRole('link');
		const nombre = await zones.count();
		expect(nombre).toBeGreaterThan(1);
		await sansViolation(page);

		// Le lien « Écart » : 44 px de cible, nommé d'après son élément.
		const ecart = page.locator('summary').filter({ hasText: /^Écart/ }).first();
		expect((await ecart.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		expect((await ecart.boundingBox())!.width).toBeGreaterThanOrEqual(44);

		// Changer de zone ne demande rien au serveur.
		const requetes: string[] = [];
		page.on('request', (r) => requetes.push(r.url()));
		const premier = await page.locator('#titre-zone').textContent();
		await zones.nth(1).click();
		await expect(zones.nth(1)).toHaveAttribute('aria-current', 'true');
		await expect(page.locator('#titre-zone')).not.toHaveText(premier!);
		expect(requetes).toEqual([]);
		// Le titre de la zone choisie est à l'écran et reçoit le focus.
		await expect(page.locator('#titre-zone')).toBeFocused();
		await expect(page.locator('#titre-zone')).toBeInViewport();
		await zones.nth(0).click();
		await expect(page.locator('#titre-zone')).toHaveText(premier!);

		// Un écart avec photo commence la prise ; le fichier ne repart pas avec l'écart suivant.
		await ecart.click();
		await page.locator('input[name="photo"]').first().setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') });
		await page.getByRole('button', { name: /^Enregistrer l’écart/ }).first().click();
		await expect(page.getByText('Commencée par')).toBeVisible();
		await expect(page.getByRole('link', { name: /Photo de l’écart/ })).toBeVisible();
		expect(await page.locator('input[name="photo"]').first().inputValue()).toBe('');
		await page.getByRole('button', { name: /^Retirer l’écart/ }).click();
		await expect(page.getByRole('link', { name: /Photo de l’écart/ })).toBeHidden();

		const complet = page.getByRole('button', { name: /^Tout est complet/ });
		for (let i = 0; i < nombre; i++) {
			// Le geste vient après la liste.
			const liste = await page.locator('.elements').boundingBox();
			expect((await complet.boundingBox())!.y).toBeGreaterThanOrEqual(liste!.y);
			await complet.click();
			await expect(page.getByText(`${i + 1} ${i ? 'zones vues' : 'zone vue'} sur ${nombre}`)).toBeVisible();
			if (i + 1 < nombre) {
				await expect(zones.nth(i + 1)).toHaveAttribute('aria-current', 'true');
				await expect(page.locator('#titre-zone')).toBeFocused();
				await expect(page.locator('#titre-zone')).toBeInViewport();
				await expect(page.getByRole('button', { name: 'Valider la prise' })).toBeHidden();
			}
			if (i === 0) await sansViolation(page);
		}
		await expect(page.locator('#titre-valider')).toBeFocused();
		await expect(page.getByRole('button', { name: 'Valider la prise' })).toBeInViewport();
		await sansViolation(page);

		// Le dernier geste s'annule d'un toucher.
		await page.getByRole('button', { name: /^Annuler/ }).click();
		await expect(page.getByRole('button', { name: 'Valider la prise' })).toBeHidden();
		await expect(zones.nth(nombre - 1)).toHaveAttribute('aria-current', 'true');

		// Un collègue abandonne ailleurs : le geste suivant est refusé, et la page se remet à jour sans recharger.
		const ailleurs = await page.context().newPage();
		await ailleurs.goto('/engins/2/prise');
		await ailleurs.waitForLoadState('networkidle');
		await ailleurs.getByText('Abandonner la prise…').click();
		await ailleurs.getByRole('button', { name: 'Oui, abandonner' }).click();
		await expect(ailleurs.getByText('Commencée par')).toBeHidden();
		await ailleurs.close();
		await complet.click();
		await expect(page.locator('.echec')).toBeVisible();
		await expect(page.getByText('Commencée par')).toBeHidden();
		await complet.click();
		await expect(page.getByText('Commencée par')).toBeVisible();

		await abandon.click();
		await page.getByRole('button', { name: 'Oui, abandonner' }).click();
		await expect(page.getByText('Commencée par')).toBeHidden();
	});
});

test.describe('agents, côté chef', () => {
	test.use({ storageState: ETAT_SUPER });

	test('toute la ligne ouvre la fiche, 44 px au moins', async ({ page }) => {
		await page.goto('/agents');
		await page.waitForLoadState('networkidle');
		const ligne = page.locator('li.agent').first();
		await expect(ligne).toBeVisible();
		const b = (await ligne.boundingBox())!;
		expect(b.height).toBeGreaterThanOrEqual(44);
		for (const x of [b.x + 4, b.x + b.width - 4]) {
			await page.mouse.click(x, b.y + b.height / 2);
			await expect(page).toHaveURL(/\/agents\/\d+/);
			await page.goto('/agents');
			await page.waitForLoadState('networkidle');
		}
	});
});
