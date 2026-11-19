import { expect, test, type Page } from '@playwright/test';
import { ETAT_CONNECTE } from './serveur.ts';

// La visionneuse : une photo s'ouvre en grand sans quitter la page, et toute fermeture y laisse
// (l'appli installée sur iPhone n'a pas de retour : reculer d'une page de trop en ferait sortir).
test.use({ storageState: ETAT_CONNECTE });

// Une photo fictive, dessinée dans la page (comme accessibilite.spec.ts).
async function photoFictive(page: Page): Promise<Buffer> {
	const adresse = await page.evaluate(() => {
		const toile = document.createElement('canvas');
		toile.width = 160;
		toile.height = 120;
		const dessin = toile.getContext('2d')!;
		dessin.fillStyle = '#b22222';
		dessin.fillRect(0, 0, 160, 120);
		dessin.fillStyle = '#ffffff';
		dessin.fillRect(40, 30, 80, 60);
		return toile.toDataURL('image/jpeg', 0.8);
	});
	return Buffer.from(adresse.split(',')[1]!, 'base64');
}

// Publie une photo sur Vie du centre ; de retour sur le mur, la page est prête (arrivée sans rechargement).
async function publierPhoto(page: Page, texte: string) {
	await page.goto('/echanges/vie');
	await page.getByRole('link', { name: /^Publier dans / }).click();
	const formulaire = page.locator('form[action="?/publier"]');
	// Avec JavaScript, les champs d'événement se cachent : la page est prête.
	await expect(formulaire.getByRole('group', { name: 'Pour un événement' })).toBeHidden();
	await formulaire.getByLabel('Votre message', { exact: true }).fill(texte);
	await formulaire.getByLabel('Photos').setInputFiles({ name: 'essai.jpg', mimeType: 'image/jpeg', buffer: await photoFictive(page) });
	await formulaire.getByRole('button', { name: /^Publier/ }).click();
	await page.waitForURL(/\/echanges\/[^/]+#publication-\d+$/);
}

test('une photo s’ouvre en grand sans quitter la page ; retour, Fermer, Échap, le fond, un double appui la ferment et laissent sur la page', async ({ page }) => {
	const texte = `Photo de la visionneuse ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
	await publierPhoto(page, texte);
	const publication = page.locator('article').filter({ hasText: texte });
	await expect(publication).toBeVisible();
	const lien = publication.locator('a[data-visionneuse]');
	const alt = (await lien.locator('img').getAttribute('alt'))!;
	expect(alt).toMatch(/^Photo 1 sur 1, publiée par /);
	const adresse = page.url();
	const ouverte = page.locator('dialog.visionneuse[open]');
	const fermer = ouverte.getByRole('button', { name: 'Fermer' });

	const ouvrir = async () => {
		await lien.click();
		await expect(ouverte).toBeVisible();
		expect(page.url()).toBe(adresse);
		await expect(ouverte.locator('img')).toHaveAttribute('alt', alt);
		await expect(fermer).toBeFocused();
	};
	// Fermée, et toujours sur la page : la même adresse, fragment compris ; un recul de trop s'y verrait (laissé le temps d'arriver).
	const fermeeSurLaPage = async () => {
		await expect(ouverte).toHaveCount(0);
		await page.waitForTimeout(500);
		expect(page.url()).toBe(adresse);
		await expect(publication).toBeVisible();
	};

	// Le retour du navigateur (le geste ou le bouton du téléphone).
	await ouvrir();
	await page.goBack();
	await fermeeSurLaPage();

	// Fermer, Échap, un appui hors de la photo : le focus revient au lien.
	for (const geste of [() => fermer.click(), () => page.keyboard.press('Escape'), () => ouverte.click({ position: { x: 20, y: 200 } })]) {
		await ouvrir();
		await geste();
		await fermeeSurLaPage();
		await expect(lien).toBeFocused();
	}

	// Un double appui sur Fermer ne recule qu'une fois. Les deux appuis partent d'un coup, la fenêtre encore ouverte :
	// un second clic à l'écran tomberait sinon sur la page, une fois la fenêtre fermée.
	await ouvrir();
	await fermer.evaluate((bouton) => {
		(bouton as HTMLButtonElement).click();
		(bouton as HTMLButtonElement).click();
	});
	await fermeeSurLaPage();

	// Rechargée photo ouverte, la page revient sans la visionneuse.
	await ouvrir();
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(publication).toBeVisible();
	await expect(ouverte).toHaveCount(0);
});
