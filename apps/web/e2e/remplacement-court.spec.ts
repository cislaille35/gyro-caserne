import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { connecter } from './connexion.ts';

async function sansViolation(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

// Alice (équipe 1) demande 2 h de son astreinte du jour ; Chloé (équipe 3) accepte ; le planning montre la seule plage.
// L'équipe 1 n'est d'astreinte qu'une semaine sur quatre : les autres jours, l'écran le dit et le test s'arrête là.
test.describe('remplacement court', () => {
	test('demander 2 h, un collègue accepte, le planning montre la plage', async ({ page, browser }, info) => {
		test.skip(info.project.name !== 'telephone', 'Un seul parcours, au téléphone.');
		test.setTimeout(180_000);
		await connecter(page, 'alice.martin@exemple.fr');
		await page.goto('/remplacements/court');
		await expect(page.getByRole('heading', { level: 1, name: 'Quelques heures' })).toBeVisible();
		test.skip(await page.getByText('Aucune plage de 2 h libre aujourd’hui.').isVisible(), 'Alice n’est pas d’astreinte aujourd’hui.');
		await sansViolation(page);
		await page.getByLabel('2 h').check();
		const phrase = (await page.getByText(/^Remplacement de .* ouvert à tous les disponibles\.$/).textContent()) ?? '';
		const plage = phrase.match(/de (\d+ h(?: \d+)?) à (\d+ h(?: \d+)?)/)!;
		await page.getByRole('button', { name: 'Envoyer la demande' }).click();
		await expect(page.getByText('Demande envoyée.', { exact: false })).toBeVisible();
		await expect(page.getByRole('heading', { level: 1, name: 'Remplacement court' })).toBeVisible();
		await sansViolation(page);

		const autre = await browser.newContext();
		const chloe = await autre.newPage();
		await connecter(chloe, 'chloe.durand@exemple.fr');
		await chloe.goto('/remplacements');
		await chloe.getByRole('article').filter({ hasText: `de ${plage[1]} à ${plage[2]}` }).getByRole('button', { name: /^Accepter/ }).click();
		await expect(chloe.getByRole('status')).toContainText('c’est conclu');
		await chloe.goto('/planning?vue=semaine');
		await expect(chloe.getByText(new RegExp(`je remplace Alice Martin, .*de ${plage[1]} à ${plage[2]}`)).first()).toBeAttached();
		await autre.close();

		await page.reload();
		await expect(page.getByRole('heading', { level: 2, name: 'Remplacé par Chloé Durand' })).toBeVisible();
		await page.getByText('Refuser ce remplaçant').click();
		await expect(page.getByRole('button', { name: 'Je confirme : refuser ce remplaçant' })).toBeVisible();
		await sansViolation(page);
	});
});
