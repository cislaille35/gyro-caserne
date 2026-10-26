import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ADRESSE, ETAT_CONNECTE } from './serveur.ts';

async function sansViolation(page: Page, chemin: string) {
	await page.goto(chemin);
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

for (const theme of ['auto', 'sombre']) {
	test.describe(`thème ${theme}`, () => {
		test.beforeEach(async ({ context }) => {
			await context.addCookies([{ name: 'theme', value: theme, url: ADRESSE }]);
		});

		test.describe('non connecté', () => {
			for (const chemin of ['/connexion', '/affichage']) {
				test(`${chemin} sans violation`, async ({ page }) => {
					await sansViolation(page, chemin);
				});
			}
		});

		test.describe('connecté', () => {
			test.use({ storageState: ETAT_CONNECTE });
			for (const chemin of ['/', '/affichage']) {
				test(`${chemin} sans violation`, async ({ page }) => {
					await sansViolation(page, chemin);
				});
			}
		});
	});
}

test('thème sombre choisi : la page arrive déjà en sombre', async ({ request }) => {
	const reponse = await request.get('/connexion', { headers: { cookie: 'theme=sombre' } });
	expect(await reponse.text()).toMatch(/<html[^>]*data-theme="sombre"/);
});

test.describe('connecté, au clavier', () => {
	test.use({ storageState: ETAT_CONNECTE });

	test('premier Tab : « Aller au contenu », qui mène au contenu', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('Tab');
		await expect(page.locator(':focus')).toHaveText('Aller au contenu');
		await page.keyboard.press('Enter');
		await expect(page.locator('main#contenu')).toBeFocused();
	});

	test('cinq appuis sur Gyro (Entrée) : « pin-pon ! »', async ({ page }) => {
		await page.goto('/');
		const gyro = page.getByRole('button', { name: 'Faire réagir Gyro' });
		// Tant que la page n'est pas prête, les appuis ne comptent pas : on recommence.
		await expect(async () => {
			await gyro.focus();
			for (let i = 0; i < 5; i++) await page.keyboard.press('Enter');
			await expect(page.getByText('pin-pon !')).toBeVisible({ timeout: 1000 });
		}).toPass({ timeout: 20_000 });
	});
});

test.describe('réduire les animations', () => {
	test.use({ storageState: ETAT_CONNECTE, reducedMotion: 'reduce' });

	test('niveau vivant : aucune animation sur l’accueil', async ({ page, context }) => {
		await context.addCookies([{ name: 'niveau', value: 'vivant', url: ADRESSE }]);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Faire réagir Gyro' })).toBeVisible();
		expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
	});
});

test.describe('mouvement limité (RGAA 13.8)', () => {
	test.use({ storageState: ETAT_CONNECTE });

	test('niveau vivant : Gyro bouge à l’arrivée, s’immobilise, un appui relance puis arrête', async ({ page, context }) => {
		await context.addCookies([{ name: 'niveau', value: 'vivant', url: ADRESSE }]);
		await page.clock.install();
		await page.goto('/');
		const gyro = page.getByRole('button', { name: 'Faire réagir Gyro' });
		const animations = () => page.evaluate(() => document.getAnimations().length);
		// Tant que la page n'est pas prête, les appuis ne comptent pas : on attend l'hydratation.
		await expect.poll(animations).toBeGreaterThan(0);

		// Le minuteur n'existe qu'une fois la page hydratée : on avance l'horloge jusqu'à l'arrêt.
		await expect(async () => {
			await page.clock.runFor(10_500);
			expect(await animations()).toBe(0);
		}).toPass({ timeout: 15_000 });

		await expect(async () => {
			await gyro.click();
			expect(await animations()).toBeGreaterThan(0);
		}).toPass({ timeout: 10_000 });

		await gyro.click();
		expect(await animations()).toBe(0);

		await gyro.click();
		expect(await animations()).toBeGreaterThan(0);
		await page.clock.runFor(10_500);
		expect(await animations()).toBe(0);
	});
});
