import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ETAT_CONNECTE, ETAT_SUPER } from './serveur.ts';

test.use({ storageState: ETAT_CONNECTE });

async function sansViolation(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

// Un jour à venir propre à chaque essai (téléphone, ordinateur, relances) : les créneaux ne se gênent pas.
function jourAVenir(info: { project: { name: string }; retry: number }): string {
	const decalage = 20 + (info.project.name === 'telephone' ? 0 : 40) + info.retry * 3 + Math.floor(Math.random() * 30);
	return new Date(Date.now() + decalage * 864e5).toISOString().slice(0, 10);
}

test('réserver la VL, la retrouver dans « Mes réservations », l’annuler', async ({ page }, info) => {
	const jour = jourAVenir(info);
	const mot = `Formation ${Date.now().toString(36)}`;
	await page.goto('/caserne');
	await page.getByRole('link', { name: /^Réservations/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Réservations' })).toBeVisible();
	await page.getByRole('link', { name: /^VL/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'VL' })).toBeVisible();
	await sansViolation(page);
	await page.goto(`/reservations/1/reserver?jour=${jour}`);
	await page.getByLabel('Début').fill(`${jour}T07:00`);
	await page.getByLabel('Fin').fill(`${jour}T08:00`);
	await expect(page.getByRole('status')).toContainText('Libre');
	await page.getByLabel('Un mot (facultatif)').fill(mot);
	await sansViolation(page);
	await page.getByRole('button', { name: 'Réserver' }).click();
	await expect(page).toHaveURL(/\/reservations\/miennes\?reservee=acceptee$/);
	await expect(page.getByRole('status')).toContainText('Réservation acceptée');
	const carte = page.locator('article', { hasText: mot });
	await expect(carte).toContainText('Acceptée');
	await sansViolation(page);
	await carte.getByRole('link', { name: /^Annuler/ }).click();
	await page.getByRole('button', { name: 'Annuler la réservation' }).click();
	await expect(page.getByRole('status')).toContainText('Réservation annulée.');
	await expect(page.locator('article', { hasText: mot }).first()).toContainText('Annulée');
});

test('demander des bancs ; le super administrateur l’accepte depuis « À valider »', async ({ browser, page }, info) => {
	const jour = jourAVenir(info);
	const mot = `Fête ${Date.now().toString(36)}`;
	await page.goto(`/reservations/2/reserver?jour=${jour}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Réserver · Bancs' })).toBeVisible();
	await page.getByLabel('Quantité').fill('99');
	await expect(page.getByRole('status')).toContainText('Pas assez');
	await page.getByLabel('Quantité').fill('2');
	await expect(page.getByRole('status')).toContainText('Disponible');
	await page.getByLabel('Un mot (facultatif)').fill(mot);
	await page.getByRole('button', { name: 'Demander' }).click();
	await expect(page.getByRole('status')).toContainText('Demande envoyée');
	await expect(page.locator('article', { hasText: mot })).toContainText('En attente');

	const gestion = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
	await gestion.goto('/');
	await expect(gestion.getByRole('link', { name: /^Notifications, (plus de )?\d+ nouvelles?$/ })).toBeVisible();
	await gestion.goto('/reservations/a-valider');
	const demande = gestion.locator('article', { hasText: mot });
	await expect(demande).toContainText('Demandé par Test Fictif');
	await sansViolation(gestion);
	await demande.getByRole('button', { name: /^Accepter/ }).click();
	await expect(gestion.getByRole('status')).toContainText('Demande acceptée');
	await gestion.context().close();

	await page.goto('/notifications');
	await expect(page.getByRole('link', { name: /Bancs : demande acceptée/ }).first()).toBeVisible();
	await page.goto('/reservations/miennes');
	await expect(page.locator('article', { hasText: mot })).toContainText('Acceptée');
});

test('le super administrateur ajoute du matériel, puis le retire', async ({ browser }) => {
	const page = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
	const nom = `Tente ${Date.now().toString(36)}`;
	await page.goto('/reservations/materiel');
	await page.getByLabel('Nom', { exact: true }).last().fill(nom);
	await page.getByLabel('Stock', { exact: true }).last().fill('2');
	await page.getByRole('button', { name: 'Ajouter' }).click();
	await expect(page.getByRole('status')).toContainText(`${nom} ajouté.`);
	await sansViolation(page);
	await page.getByRole('link', { name: `Retirer ${nom}` }).click();
	await page.getByRole('button', { name: 'Retirer', exact: true }).click();
	await expect(page.getByRole('status')).toContainText(`${nom} retiré`);
	await page.context().close();
});
