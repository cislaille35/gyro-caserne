import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ADRESSE, ETAT_CONNECTE, ETAT_SUPER } from './serveur.ts';

async function sansViolation(page: Page, chemin?: string) {
	if (chemin) await page.goto(chemin);
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
			for (const chemin of ['/', '/affichage', '/agents', '/profil']) {
				test(`${chemin} sans violation`, async ({ page }) => {
					await sansViolation(page, chemin);
				});
			}
		});

		test.describe('super administrateur', () => {
			test.use({ storageState: ETAT_SUPER });
			for (const chemin of ['/agents', '/agents/nouveau', '/profil']) {
				test(`${chemin} sans violation`, async ({ page }) => {
					await sansViolation(page, chemin);
				});
			}

			test('fiche d’un agent sans violation, avertissement de départ compris', async ({ page }) => {
				await page.goto(await ficheDe(page, 'Alice Martin'));
				await sansViolation(page);
				await choisirParti(page);
				await sansViolation(page);
			});
		});
	});
}

// Adresse de la fiche, lue dans la liste de gestion.
async function ficheDe(page: Page, nom: string): Promise<string> {
	await page.goto(`/agents?texte=${encodeURIComponent(nom.split(' ')[1]!)}`);
	return (await page.getByRole('link', { name: `Voir la fiche de ${nom}` }).getAttribute('href'))!;
}

// L'avertissement n'apparaît qu'une fois la page prête : on recommence le choix jusque-là.
async function choisirParti(page: Page) {
	const statut = page.locator('form[action="?/statut"]');
	await expect(async () => {
		await statut.getByLabel('Statut').selectOption('operationnel');
		await statut.getByLabel('Statut').selectOption('parti');
		await expect(statut.getByLabel('Je confirme')).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 20_000 });
}

test.describe('agents', () => {
	test('un agent ordinaire n’ouvre pas une fiche : 403', async ({ browser }) => {
		const contexte = await browser.newContext({ storageState: ETAT_CONNECTE });
		const reponse = await (await contexte.newPage()).goto('/agents/1');
		expect(reponse!.status()).toBe(403);
		await contexte.close();
	});

	test('le super administrateur ajoute un agent, puis le déclare parti : il quitte la vue des agents', async ({ browser }) => {
		const gestion = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		const agent = await (await browser.newContext({ storageState: ETAT_CONNECTE })).newPage();
		const marque = Date.now().toString(36);
		const nom = `Essai${marque}`;

		await gestion.goto('/agents/nouveau');
		await gestion.getByLabel('Prénom').fill('Zoé');
		await gestion.getByLabel('Nom', { exact: true }).fill(nom);
		await gestion.getByLabel('E-mail').fill(`zoe.${marque}@exemple.fr`);
		// Les filtres de la liste sont aussi dans la page : chaque libellé doit viser le champ de l'ajout.
		await gestion.locator('form[method="POST"]').getByLabel('Équipe').selectOption({ label: 'Équipe 1' });
		await gestion.getByRole('button', { name: "Ajouter l'agent" }).click();
		await expect(gestion).toHaveURL(/\/agents\/\d+$/);
		await expect(gestion.getByRole('heading', { level: 1, name: `Zoé ${nom}` })).toBeVisible();

		await gestion.goto(await ficheDe(gestion, `Zoé ${nom}`));
		await agent.goto('/agents');
		await expect(agent.getByText(`Zoé ${nom}`)).toBeVisible();

		await choisirParti(gestion);
		const statut = gestion.locator('form[action="?/statut"]');
		await statut.getByLabel('Je confirme').check();
		await statut.getByRole('button', { name: 'Enregistrer' }).click();
		await expect(gestion.getByText('Statut enregistré')).toBeVisible();
		await expect(gestion.locator('.titre')).toContainText('Parti');

		await agent.reload();
		await expect(agent.getByRole('heading', { level: 1, name: 'Agents' })).toBeVisible();
		await expect(agent.getByText(`Zoé ${nom}`)).toHaveCount(0);
	});
});

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
	const animations = (page: Page) => page.evaluate(() => document.getAnimations().length);

	test('connexion, niveau vivant : Gyro bouge 5 s puis s’immobilise', async ({ page, context }) => {
		await context.addCookies([{ name: 'niveau', value: 'vivant', url: ADRESSE }]);
		await page.clock.install();
		await page.goto('/connexion');
		await expect.poll(() => animations(page)).toBeGreaterThan(0);
		// Le minuteur n'existe qu'une fois la page hydratée : on avance l'horloge jusqu'à l'arrêt.
		await expect(async () => {
			await page.clock.runFor(5_500);
			expect(await animations(page)).toBe(0);
		}).toPass({ timeout: 15_000 });
	});

	test.describe('accueil', () => {
		test.use({ storageState: ETAT_CONNECTE });

		test.beforeEach(async ({ page, context }) => {
			await context.addCookies([{ name: 'niveau', value: 'vivant', url: ADRESSE }]);
			await page.clock.install();
			await page.goto('/');
			await expect(page.locator('.accueil[data-pret]')).toBeAttached();
		});

		test('10 s de mouvement, un appui relance, un appui arrête', async ({ page }) => {
			const gyro = page.getByRole('button', { name: 'Faire réagir Gyro' });
			expect(await animations(page)).toBeGreaterThan(0);
			await page.clock.runFor(10_500);
			expect(await animations(page)).toBe(0);

			await gyro.click();
			expect(await animations(page)).toBeGreaterThan(0);
			await gyro.click();
			expect(await animations(page)).toBe(0);

			await gyro.click();
			expect(await animations(page)).toBeGreaterThan(0);
			await page.clock.runFor(10_500);
			expect(await animations(page)).toBe(0);
		});

		test('cinq appuis en 2 s : « pin-pon ! », animé', async ({ page }) => {
			await page.getByRole('button', { name: 'Faire réagir Gyro' }).focus();
			for (let i = 0; i < 5; i++) await page.keyboard.press('Enter');
			await expect(page.getByText('pin-pon !')).toBeVisible();
			expect(await animations(page)).toBeGreaterThan(0);
		});
	});
});
