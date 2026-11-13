import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Sortie du serveur : sans clé Brevo, les liens de connexion y sont écrits.
export const JOURNAL = fileURLToPath(new URL('../test-results/serveur.log', import.meta.url));

// Le dernier courriel de connexion écrit pour cette adresse : son lien et son code.
function dernierCourriel(email: string): { lien: string; code: string } | null {
	const texte = readFileSync(JOURNAL, 'utf8');
	const debut = texte.lastIndexOf(`Courriel pour ${email} :`);
	if (debut < 0) return null;
	const courriel = texte.slice(debut);
	const lien = courriel.match(/https?:\/\/\S+\/api\/auth\/magic-link\/verify\?\S+/)?.[0];
	const code = courriel.match(/\b\d{6}\b/)?.[0];
	return lien && code ? { lien, code } : null;
}
const dernierLien = (email: string) => dernierCourriel(email)?.lien ?? null;

// Se connecter comme un agent : demander un lien, le lire dans le journal, l'ouvrir.
// Avec parCode, taper plutôt le code du même courriel, comme dans l'appli installée sur iPhone ; avantCode regarde l'écran du code.
// Un lien par minute et par adresse : si un test précédent vient d'en demander un pour la même adresse, on redemande une minute plus tard.
export async function connecter(page: Page, email: string, { parCode = false, avantCode }: { parCode?: boolean; avantCode?: (page: Page) => Promise<void> } = {}): Promise<void> {
	const avant = dernierLien(email);
	let lien: string | null = null;
	for (let essai = 1; !lien; essai++) {
		await page.goto('/connexion');
		await page.getByLabel('Adresse e-mail').fill(email);
		await page.getByRole('button', { name: 'Recevoir un lien de connexion' }).click();
		await expect(page.getByRole('status')).toContainText('un courriel vient de partir');
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

	if (parCode) {
		await avantCode?.(page);
		await page.getByLabel('Code reçu par courriel').fill(dernierCourriel(email)!.code);
		await page.getByRole('button', { name: 'Me connecter' }).click();
	} else {
		await page.goto(lien!);
	}
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Bonjour/);
}
