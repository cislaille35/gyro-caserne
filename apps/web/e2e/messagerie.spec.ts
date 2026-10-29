import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { connecter } from './connexion.ts';
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

// Une conversation avec la première personne de l'annuaire, et un message envoyé : on est sur /echanges/messages/<id>.
async function ouvrirConversation(page: Page, texte: string) {
	await page.goto('/echanges/messages/nouveau');
	await page.waitForLoadState('networkidle');
	await page.locator('h2:text-is("Tout le centre") ~ ul a').first().click();
	await page.waitForURL(/\/echanges\/messages\/(a\/)?\d+/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('textbox', { name: 'Votre message' }).fill(texte);
	await page.getByRole('button', { name: 'Envoyer' }).click();
	await expect(page.getByRole('log').getByText(texte, { exact: true })).toBeVisible();
	await page.waitForURL(/\/echanges\/messages\/\d+/);
}

test('le brouillon est gardé, à la clé de la personne, puis effacé après l’envoi', async ({ page }) => {
	const marque = `Brouillon ${Date.now().toString(36)}`;
	await ouvrirConversation(page, `Ouverture ${marque}`);
	const champ = page.getByRole('textbox', { name: 'Votre message' });
	await champ.fill(marque);
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(champ).toHaveValue(marque);
	const cles = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('gyro:brouillon:')));
	expect(cles).toHaveLength(1);
	// Préfixée par la personne connectée (jamais 0), puis la conversation.
	expect(cles[0]).toMatch(/^gyro:brouillon:[1-9]\d*:\d+$/);
	await page.getByRole('button', { name: 'Envoyer' }).click();
	await expect(page.getByRole('log').getByText(marque, { exact: true })).toBeVisible();
	await expect(champ).toHaveValue('');
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(champ).toHaveValue('');
});

test('en lisant plus haut, le bouton « ↓ » ramène en bas', async ({ page }) => {
	const long = Array.from({ length: 60 }, (_, i) => `Ligne ${i + 1}`).join('\n');
	await ouvrirConversation(page, `Long ${Date.now().toString(36)}`);
	await page.getByRole('textbox', { name: 'Votre message' }).fill(long);
	await page.getByRole('button', { name: 'Envoyer' }).click();
	await expect(page.getByRole('log').getByText('Ligne 60')).toBeVisible();
	const bas = page.getByRole('button', { name: /Aller aux derniers messages|aller en bas/ });
	await expect(bas).toBeHidden();
	await page.evaluate(() => window.scrollTo(0, 0));
	await expect(bas).toBeVisible();
	await bas.click();
	await expect(bas).toBeHidden();
	expect(await page.evaluate(() => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 96)).toBe(true);
});

// Au doigt (événements simulés) : glisser une bulle vers la droite répond, sauf avec « réduire les animations ».
for (const mouvement of ['no-preference', 'reduce'] as const) {
	test(`glisser pour répondre, animations ${mouvement}`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: mouvement });
		const marque = `Glisser ${Date.now().toString(36)}`;
		await ouvrirConversation(page, marque);
		const rangee = page.locator('.rangee').filter({ hasText: marque });
		const b = (await rangee.boundingBox())!;
		const geste = (type: string, dx: number) => rangee.dispatchEvent(type, { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: b.x + 20 + dx, clientY: b.y + 10, bubbles: true });
		await geste('pointerdown', 0);
		for (let dx = 10; dx <= 90; dx += 10) await geste('pointermove', dx);
		await geste('pointerup', 90);
		if (mouvement === 'reduce') await expect(page.getByText('Réponse à vous')).toBeHidden();
		else await expect(page.getByText('Réponse à vous')).toBeVisible();
	});
}

// Infos d'un groupe qu'on vient de créer (on l'anime) : le menu d'un membre au clavier, la confirmation, puis l'ajout de membres.
test('infos du groupe : menu d’un membre au clavier et confirmation', async ({ page }) => {
	const nom = `Groupe ${Date.now().toString(36)}`;
	await page.goto('/echanges/messages/nouveau/groupe');
	await page.waitForLoadState('networkidle');
	await page.locator('label.ligne').nth(0).click();
	await page.locator('label.ligne').nth(1).click();
	await page.getByRole('button', { name: 'Suivant' }).click();
	await page.getByLabel('Nom du groupe').fill(nom);
	await page.getByRole('button', { name: 'Créer' }).click();
	await page.waitForURL(/\/echanges\/messages\/\d+$/);
	await page.goto(`${new URL(page.url()).pathname}/infos`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(nom);

	const bouton = page.getByRole('button', { name: /^Actions pour / }).first();
	await expect(bouton).not.toHaveAttribute('hidden');
	await bouton.focus();
	await page.keyboard.press('Enter');
	const menu = page.getByRole('menu');
	const elements = menu.getByRole('menuitem');
	await expect(elements).toHaveText([/^Écrire à /, 'Nommer animateur', 'Retirer du groupe']);
	await expect(elements.first()).toBeFocused();
	await page.keyboard.press('End');
	await expect(elements.last()).toBeFocused();
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => v.id)).toEqual([]);

	// Retirer demande une confirmation ; Échap l'annule et rend le focus.
	await page.keyboard.press('Enter');
	const dialogue = page.getByRole('dialog');
	await expect(dialogue).toContainText(/Retirer .+ du groupe \?/);
	await expect(dialogue.getByRole('button', { name: 'Annuler' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(dialogue).toBeHidden();
	await expect(bouton).toBeFocused();

	// Nommer, confirmé : la personne anime aussi le groupe.
	await page.keyboard.press('Enter');
	await menu.getByRole('menuitem', { name: 'Nommer animateur' }).click();
	await dialogue.getByRole('button', { name: 'Nommer' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'anime maintenant le groupe' })).toBeAttached();
	await expect(page.locator('.animateur')).toHaveCount(2);
	await expect(bouton).toBeFocused();

	await page.getByRole('link', { name: 'Ajouter des membres' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajouter des membres');
});

// Se déconnecter efface les brouillons de l'appareil (session à part : celle des autres tests reste ouverte).
test.describe('déconnexion', () => {
	test.use({ storageState: { cookies: [], origins: [] } });
	test('les brouillons ne restent pas pour le compte suivant', async ({ page }) => {
		await connecter(page, 'test@exemple.fr');
		await page.evaluate(() => {
			localStorage.setItem('gyro:brouillon:1:2', 'Secret');
			localStorage.setItem('autre', 'garde');
		});
		await page.goto('/moi');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Se déconnecter' }).click();
		await page.waitForURL(/\/connexion/);
		expect(await page.evaluate(() => [localStorage.getItem('gyro:brouillon:1:2'), localStorage.getItem('autre')])).toEqual([null, 'garde']);
	});
});
