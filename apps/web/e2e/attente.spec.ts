import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ETAT_CONNECTE } from './serveur.ts';

// Ce que renvoie vraiment Cloudflare quand le Worker dépasse sa limite de calcul (voir src/lib/attente/attente.ts).
const COUPURE = { status: 503, contentType: 'text/plain; charset=UTF-8', body: 'error code: 1102\n' };

async function sansViolation(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

// Le service worker prend la main sur la page ouverte, sans attendre de rechargement.
const controlee = (page: Page) => page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 15_000 });

// Simule la coupure pour les seules requêtes de cette page (et de ses données).
const couper = (context: BrowserContext, chemin: RegExp, reponse: 'coupure' | 'reseau' = 'coupure') =>
	context.route(chemin, (r) => (reponse === 'reseau' ? r.abort('internetdisconnected') : r.fulfill(COUPURE)));

test('le service worker s’installe dès la page de connexion, et ne met rien en cache', async ({ page }) => {
	await page.goto('/connexion');
	await controlee(page);
	expect(await page.evaluate(() => caches.keys())).toEqual([]);
});

test.describe('connecté', () => {
	test.use({ storageState: ETAT_CONNECTE });

	for (const [nom, reponse] of [['coupure 1102', 'coupure'], ['pas de réseau', 'reseau']] as const) {
		test(`${nom} : page d’attente, nouvel essai seul, la page revient`, async ({ page, context }) => {
			test.setTimeout(60_000);
			await page.goto('/');
			await controlee(page);
			await couper(context, /\/planning$/, reponse);
			await page.goto('/planning');
			await expect(page.getByRole('heading', { name: 'Un instant, ça arrive…' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Réessayer' })).toBeHidden();
			await sansViolation(page);
			await context.unrouteAll();
			await expect(page.getByRole('heading', { level: 1, name: 'Planning' })).toBeVisible({ timeout: 15_000 });
		});
	}

	test('la coupure dure : 5, 10, 20 secondes, puis un bouton Réessayer', async ({ page, context }) => {
		test.setTimeout(90_000);
		await page.goto('/');
		await controlee(page);
		await couper(context, /\/planning$/);
		await page.goto('/planning');
		const etat = page.locator('#etat');
		await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible({ timeout: 45_000 });
		await expect(etat).toContainText('plus de temps que d’habitude');
		await sansViolation(page);
		await context.unrouteAll();
		await page.getByRole('button', { name: 'Réessayer' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Planning' })).toBeVisible();
	});

	test('un 503 qui n’est pas une coupure passe tel quel', async ({ page, context }) => {
		await page.goto('/');
		await controlee(page);
		await context.route(/\/planning$/, (r) => r.fulfill({ status: 503, contentType: 'text/html', body: '<!doctype html><html lang="fr"><title>x</title><h1>Maintenance</h1></html>' }));
		await page.goto('/planning');
		await expect(page.getByRole('heading', { name: 'Maintenance' })).toBeVisible();
		await expect(page.getByText('Un instant, ça arrive…')).toHaveCount(0);
	});

	test('une erreur de l’appli n’est jamais prise pour une coupure', async ({ page }) => {
		await page.goto('/');
		await controlee(page);
		const reponse = await page.goto('/cette-page-n-existe-pas');
		expect(reponse?.status()).toBe(404);
		await expect(page.getByRole('heading', { name: 'Page indisponible' })).toBeVisible();
		await expect(page.getByText('Un instant, ça arrive…')).toHaveCount(0);
	});

	test('navigation dans l’appli coupée : SvelteKit recharge la page, attente, puis la page revient', async ({ page, context }) => {
		test.setTimeout(60_000);
		await page.goto('/');
		await controlee(page);
		await couper(context, /\/planning(\/__data\.json.*)?$/);
		await page.locator('a[href="/planning"]').first().click();
		await expect(page.getByRole('heading', { name: 'Un instant, ça arrive…' })).toBeVisible();
		await context.unrouteAll();
		await expect(page.getByRole('heading', { level: 1, name: 'Planning' })).toBeVisible({ timeout: 15_000 });
	});

	test('un envoi coupé : message clair, une seule requête, la saisie reste', async ({ page, context }) => {
		await page.goto('/echanges/publier?mur=vie');
		await controlee(page);
		let envois = 0;
		await context.route(/\/echanges\/publier/, (r) => {
			if (r.request().method() !== 'POST') return r.continue();
			envois++;
			return r.fulfill(COUPURE);
		});
		const formulaire = page.locator('form[action="?/publier"]');
		await formulaire.getByLabel('Votre message', { exact: true }).fill('Message à ne pas perdre');
		await formulaire.getByRole('button', { name: /^Publier/ }).click();
		await expect(page.getByText('votre envoi n’est peut-être pas passé')).toBeVisible();
		await expect(formulaire.getByLabel('Votre message', { exact: true })).toHaveValue('Message à ne pas perdre');
		expect(envois).toBe(1);
		await page.getByRole('button', { name: 'Fermer' }).click();
		await expect(page.getByText('votre envoi n’est peut-être pas passé')).toHaveCount(0);
	});
});

test('un formulaire classique coupé : aucun renvoi, retour au formulaire', async ({ page, context }) => {
	await page.goto('/connexion');
	await controlee(page);
	let envois = 0;
	await context.route(/\/connexion$/, (r) => {
		if (r.request().method() !== 'POST') return r.continue();
		envois++;
		return r.fulfill(COUPURE);
	});
	await page.getByLabel('Adresse e-mail').fill('agent@exemple.fr');
	await page.getByRole('button', { name: 'Recevoir un lien de connexion' }).click();
	await expect(page.getByRole('button', { name: 'Revenir au formulaire' })).toBeVisible();
	await page.waitForTimeout(6_000);
	expect(envois).toBe(1);
	await sansViolation(page);
	await page.getByRole('button', { name: 'Revenir au formulaire' }).click();
	await expect(page.getByLabel('Adresse e-mail')).toHaveValue('agent@exemple.fr');
});
