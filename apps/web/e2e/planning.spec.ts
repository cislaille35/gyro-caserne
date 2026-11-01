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

	test('les cinq étapes, une semaine ouverte, ajouter une manœuvre dans le panneau', async ({ page }) => {
		test.setTimeout(90_000);
		const annee = new Date().getFullYear();
		const theme = `Secourisme ${Date.now().toString(36)}`;
		await page.goto('/planning');
		await page.getByRole('link', { name: 'Préparer l’année' }).click();
		await expect(page.getByRole('heading', { level: 1, name: `Préparer ${annee}` })).toBeVisible();
		await expect(page.getByText('Publiée', { exact: true })).toBeVisible();
		await expect(page.getByText('Étape 1 sur 5')).toBeVisible();
		await expect(page.getByText('Année publiée : le roulement ne change plus.')).toBeVisible();
		await sansViolation(page);

		for (const etape of ['Fêtes', 'Repères', 'Vérifier et publier']) {
			await page.getByRole('navigation', { name: 'Étapes' }).getByRole('link', { name: etape }).click();
			await expect(page.getByRole('heading', { level: 2, name: etape })).toBeVisible();
			await sansViolation(page);
		}
		// Toucher une semaine ouvre le choix d'équipe.
		await page.locator('a.case').first().click();
		await expect(page.getByRole('group', { name: 'Quelle équipe d’astreinte ?' })).toBeVisible();
		await sansViolation(page);
		await page.getByRole('link', { name: 'Fermer' }).click();
		await expect(page.getByRole('group', { name: 'Quelle équipe d’astreinte ?' })).toHaveCount(0);

		await page.getByRole('navigation', { name: 'Étapes' }).getByRole('link', { name: 'Manœuvres' }).click();
		// Au clavier : le panneau est modal (focus dedans, page inerte), Échap le ferme et rend le focus à son lien.
		const ajouter = page.getByRole('link', { name: 'Ajouter une manœuvre' });
		const panneau = page.getByRole('dialog', { name: 'Nouvelle manœuvre' });
		await ajouter.focus();
		await page.keyboard.press('Enter');
		await expect(panneau).toBeVisible();
		await expect(page.locator('dialog:modal')).toHaveCount(1);
		await expect(panneau.getByRole('heading', { level: 2 })).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(panneau.getByRole('link', { name: 'Fermer' })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(panneau).toHaveCount(0);
		await expect(ajouter).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(panneau).toBeVisible();
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
	test('carte, vues Semaine, Mois, Année, Équipes ; lien d’agenda et « Changer le lien »', async ({ page }, info) => {
		test.setTimeout(90_000);
		// Un lien de connexion par minute et par adresse : un agent par taille d'écran.
		await connecter(page, info.project.name === 'telephone' ? 'alice.martin@exemple.fr' : 'bruno.petit@exemple.fr');
		await page.getByRole('link', { name: 'Planning', exact: true }).first().click();
		await expect(page.getByRole('heading', { level: 2, name: /Ma prochaine astreinte|Mon astreinte en cours/ })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: /^Semaine \d+/ })).toBeVisible();
		await sansViolation(page);
		await page.getByRole('link', { name: 'Semaine suivante' }).click();
		await expect(page).toHaveURL(/semaine=/);

		await page.getByRole('navigation', { name: 'Vue du planning' }).getByRole('link', { name: 'Mois' }).click();
		await expect(page.getByRole('table')).toBeVisible();
		await sansViolation(page);
		// Des cases d'au moins 44 px, au téléphone aussi.
		for (const boite of await page.locator('td a').evaluateAll((liens) => liens.map((l) => l.getBoundingClientRect()))) {
			expect(boite.width).toBeGreaterThanOrEqual(44);
			expect(boite.height).toBeGreaterThanOrEqual(44);
		}
		// Le 25 décembre porte le signe « Fête », même quand la relève tombe à Noël.
		await page.goto(`/planning?annee=${new Date().getFullYear()}&vue=mois&mois=12`);
		await expect(page.getByRole('link', { name: /25 décembre, .*Fête/ })).toBeVisible();

		await page.getByRole('navigation', { name: 'Vue du planning' }).getByRole('link', { name: 'Année' }).click();
		await expect(page.getByRole('heading', { level: 3, name: 'Décembre' })).toBeVisible();
		// Le mois en cours est déplié ; les autres, repliés, cachent leurs semaines.
		await expect(page.locator('details[open]').getByText('Mon astreinte', { exact: true }).first()).toBeVisible();
		await page.getByRole('switch', { name: 'Seulement mes semaines' }).check();
		await sansViolation(page);

		await page.getByRole('navigation', { name: 'Vue du planning' }).getByRole('link', { name: 'Équipes' }).click();
		await expect(page.getByRole('navigation', { name: 'Vue du planning' }).getByRole('link', { name: 'Équipes' })).toHaveAttribute('aria-current', 'page');
		await expect(page.getByText('Mon astreinte', { exact: true })).toHaveCount(0);
		await sansViolation(page);
		// La dernière vue est retenue sur l'appareil.
		await page.goto('/planning');
		await expect(page.getByRole('navigation', { name: 'Vue du planning' }).getByRole('link', { name: 'Équipes' })).toHaveAttribute('aria-current', 'page');

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
