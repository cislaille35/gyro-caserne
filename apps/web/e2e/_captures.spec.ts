import { expect, test, type Page } from '@playwright/test';
import { connecter } from './connexion.ts';
const DOSSIER = process.env.CAPTURES!;

async function photo(page: Page, nom: string) {
	await page.waitForLoadState('networkidle');
	await page.screenshot({ path: `${DOSSIER}/${nom}.png`, fullPage: true });
}

async function continuer(page: Page) {
	const avant = await page.locator('.progression .ou').innerText();
	await page.getByRole('button', { name: 'Continuer' }).click();
	await expect(page.locator('.progression .ou')).not.toHaveText(avant, { timeout: 60_000 });
	await page.waitForLoadState('networkidle');
}

async function semaineEtJour(page: Page) {
	const carte = page.locator('a.semaine').first();
	if ((await carte.count()) && (await carte.getAttribute('aria-current')) !== 'true') {
		await carte.click();
		await expect(page.locator('a.semaine').first()).toHaveAttribute('aria-current', 'true', { timeout: 60_000 });
	}
	await page.waitForLoadState('networkidle');
	await page.locator('input[type="checkbox"]:not([disabled])').first().check();
}

async function tout(page: Page, t: string, guide: boolean) {
	if (!guide) {
		await page.goto('/');
		await photo(page, `${t}-accueil`);
		await page.goto('/planning?vue=semaine');
		await photo(page, `${t}-planning`);
		await page.goto('/remplacements?onglet=miennes');
		await photo(page, `${t}-remplacements`);
		await page.getByRole('link', { name: /^Détails/ }).first().click();
		await photo(page, `${t}-demande`);
		await page.goto('/remplacements/manoeuvre');
		await photo(page, `${t}-manoeuvre`);
		await page.goto('/moi/agenda');
		await photo(page, `${t}-agenda`);
	}
	await page.goto('/remplacements/demander');
	await photo(page, `${t}-demander-1-semaines`);
	await semaineEtJour(page);
	await photo(page, `${t}-demander-1-jours`);
	await continuer(page);
	await photo(page, `${t}-demander-2-qui`);
	const collegue = page.locator('input[name="pour"]:not([value="tous"])').first();
	if (await collegue.count()) await collegue.check();
	await continuer(page);
	await photo(page, `${t}-demander-3-verifier`);
	await page.goto('/remplacements/demander?mode=echange');
	await semaineEtJour(page);
	await continuer(page);
	await photo(page, `${t}-echange-2-collegue`);
	await page.locator('input[name="avec"]').first().check();
	await continuer(page);
	await semaineEtJour(page);
	await photo(page, `${t}-echange-3-sienne`);
	await continuer(page);
	await photo(page, `${t}-echange-4-verifier`);
	expect(true).toBe(true);
}

test('captures', async ({ page }, info) => {
	test.setTimeout(600_000);
	await connecter(page, 'david.leroy@exemple.fr');
	if (info.project.name === 'telephone') {
		await page.emulateMedia({ colorScheme: 'light' });
		await tout(page, '390-clair', false);
	} else {
		await page.emulateMedia({ colorScheme: 'dark' });
		await tout(page, '1280-sombre', false);
		await page.emulateMedia({ colorScheme: 'light' });
		await tout(page, '1280-clair', true);
	}
});
