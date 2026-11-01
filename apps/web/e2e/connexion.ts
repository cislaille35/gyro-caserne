import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Sortie du serveur : sans clé Brevo, les liens de connexion y sont écrits.
export const JOURNAL = fileURLToPath(new URL('../test-results/serveur.log', import.meta.url));

function dernierLien(email: string): string | null {
	const texte = readFileSync(JOURNAL, 'utf8');
	const debut = texte.lastIndexOf(`Courriel pour ${email} :`);
	if (debut < 0) return null;
	return texte.slice(debut).match(/https?:\/\/\S+\/api\/auth\/magic-link\/verify\?\S+/)?.[0] ?? null;
}

// Se connecter comme un agent : demander un lien, le lire dans le journal, l'ouvrir.
// Un lien par minute et par adresse : si un test précédent vient d'en demander un pour la même adresse, on redemande une minute plus tard.
export async function connecter(page: Page, email: string): Promise<void> {
	const avant = dernierLien(email);
	let lien: string | null = null;
	for (let essai = 1; !lien; essai++) {
		await page.goto('/connexion');
		await page.getByLabel('Adresse e-mail').fill(email);
		await page.getByRole('button', { name: 'Recevoir un lien de connexion' }).click();
		await expect(page.getByRole('status')).toContainText('un lien vient de partir');
		try {
			await expect(() => {
				const nouveau = dernierLien(email);
				expect(nouveau).not.toBeNull();
				expect(nouveau).not.toBe(avant);
				lien = nouveau;
			}).toPass({ timeout: 15_000 });
		} catch (erreur) {
			if (essai > 1) throw erreur;
			test.info().setTimeout(test.info().timeout + 75_000);
			await page.waitForTimeout(50_000);
		}
	}

	await page.goto(lien!);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Bonjour/);
}
