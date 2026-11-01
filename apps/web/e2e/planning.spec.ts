import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { connecter } from './connexion.ts';
import { ETAT_SUPER } from './serveur.ts';

async function sansViolation(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

// Le jeu de départ publie l'année en cours (planning fictif).
test.describe('chef : préparer l’année', () => {
	test.use({ storageState: ETAT_SUPER });

	test('voir l’année publiée, ajouter une manœuvre', async ({ page }) => {
		const annee = new Date().getFullYear();
		const theme = `Secourisme ${Date.now().toString(36)}`;
		await page.goto('/planning');
		await page.getByRole('link', { name: 'Préparer l’année' }).click();
		await expect(page.getByRole('heading', { level: 1, name: `Préparer ${annee}` })).toBeVisible();
		await expect(page.getByText('Publiée', { exact: true })).toBeVisible();
		await sansViolation(page);

		await page.getByRole('link', { name: 'Ajouter une manœuvre' }).click();
		await page.getByLabel('Date').fill(`${annee + 1}-03-07`);
		await page.getByLabel('Heure de début').fill('08:30');
		await page.getByLabel('Thème').fill(theme);
		await page.getByLabel('Certaines équipes').check();
		await page.getByLabel('Équipe 1').check();
		await sansViolation(page);
		await page.getByRole('button', { name: 'Ajouter la manœuvre' }).click();
		await expect(page.getByRole('heading', { level: 1, name: `Préparer ${annee + 1}` })).toBeVisible();
		await expect(page.getByRole('link', { name: new RegExp(theme) })).toBeVisible();
	});
});

test.describe('agent : mon année et mon agenda', () => {
	test('prochaine astreinte, mon année, toutes les équipes ; lien d’agenda et « Changer le lien »', async ({ page }, info) => {
		test.setTimeout(90_000);
		// Un lien de connexion par minute et par adresse : un agent par taille d'écran.
		await connecter(page, info.project.name === 'telephone' ? 'alice.martin@exemple.fr' : 'bruno.petit@exemple.fr');
		await page.getByRole('link', { name: 'Planning', exact: true }).first().click();
		await expect(page.getByRole('heading', { level: 2, name: 'Ma prochaine astreinte' })).toBeVisible();
		await expect(page.getByText('Mon astreinte').first()).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: 'Décembre' })).toBeVisible();
		await sansViolation(page);
		await page.getByRole('link', { name: 'Toutes les équipes' }).click();
		await expect(page.getByRole('link', { name: 'Toutes les équipes' })).toHaveAttribute('aria-current', 'page');
		await expect(page.getByText('Mon astreinte')).toHaveCount(0);
		await sansViolation(page);

		await page.goto('/moi');
		await page.getByRole('link', { name: /Ajouter à mon agenda/ }).click();
		const lien = await page.getByLabel('Lien d’abonnement').inputValue();
		expect(lien).toMatch(/\/agenda\/\d+-[A-Za-z0-9_-]{43}\.ics$/);
		const fichier = await page.request.get(lien);
		expect(fichier.status()).toBe(200);
		expect(fichier.headers()['content-type']).toBe('text/calendar; charset=utf-8');
		expect(await fichier.text()).toContain('SUMMARY:Astreinte');
		await sansViolation(page);
		await page.getByRole('button', { name: 'Changer le lien' }).click();
		await expect(page.getByText('Nouveau lien créé')).toBeVisible();
		expect(await page.getByLabel('Lien d’abonnement').inputValue()).not.toBe(lien);
		expect((await page.request.get(lien)).status()).toBe(404);
	});
});
