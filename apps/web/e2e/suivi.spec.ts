import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ETAT_SUPER } from './serveur.ts';

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));

function executer(sql: string) {
	try {
		execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, '--command', sql], { cwd: appli, stdio: 'pipe' });
	} catch (e) {
		const { status, stdout, stderr } = e as { status: number | null; stdout?: Buffer; stderr?: Buffer };
		throw new Error(`Wrangler d1 execute, statut ${status} :\n${String(stdout ?? '')}\n${String(stderr ?? '')}`);
	}
}

async function sansViolation(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

// 30 lignes fictives du sujet « Agents » (le ménage de nuit, une fiche qui n'existe pas), datées d'aujourd'hui : plus d'une page.
const CIBLE = 999_999;
test.describe('suivi du centre', () => {
	test.use({ storageState: ETAT_SUPER });
	test.beforeAll(() => {
		const maintenant = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(' ', 'T');
		executer(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 30) INSERT INTO journal (quand, acteur, action, cible_type, cible_id) SELECT '${maintenant}', 'nuit', 'effacer_agent', 'personne', ${CIBLE} FROM n;`);
	});
	test.afterAll(() => executer(`DELETE FROM journal WHERE cible_id = ${CIBLE} AND acteur = 'nuit';`));

	test('filtré « Agents » sans violation ; « Voir les plus anciennes » ajoute la suite sans recharger, le focus sur la première nouvelle ligne', async ({ page }) => {
		await page.goto('/suivi?sujet=agents');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('navigation', { name: 'Filtrer le suivi' }).getByRole('link', { name: 'Agents' })).toHaveAttribute('aria-current', 'page');
		await sansViolation(page);

		// Une marque posée sur la page : un rechargement l'effacerait.
		await page.evaluate(() => ((window as unknown as { marque: boolean }).marque = true));
		const lignes = page.locator('li[id^="suivi-"]');
		const lien = page.getByRole('link', { name: 'Voir les plus anciennes' });
		await expect(lignes).toHaveCount(25);
		while (await lien.isVisible()) {
			const avant = await lignes.count();
			await lien.click();
			await expect.poll(() => lignes.count()).toBeGreaterThan(avant);
			const attendue = await lignes.nth(avant).getAttribute('id');
			expect(await page.evaluate(() => document.activeElement?.closest('li[id^="suivi-"]')?.id)).toBe(attendue);
			await expect(page.getByRole('status').filter({ hasText: /actions? affichées?/ })).toHaveText(`${await lignes.count()} actions affichées.`);
		}
		expect(await lignes.count()).toBeGreaterThanOrEqual(30);
		await expect(lien).toHaveCount(0);
		expect(await page.evaluate(() => (window as unknown as { marque?: boolean }).marque)).toBe(true);
		await expect(page).toHaveURL(/\/suivi\?sujet=agents$/);
	});
});
