import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { connecter } from './connexion.ts';
import { ETAT_CONNECTE, ETAT_SUPER } from './serveur.ts';

test.use({ storageState: ETAT_CONNECTE });

// Le menu des gestes d'un message, au clavier seul : ouvrir, parcourir, fermer, focus rendu ; puis « Répondre ».
test('menu des gestes au clavier', async ({ page }) => {
	const marque = `Essai ${Date.now().toString(36)}`;
	await page.goto('/echanges/messages/nouveau');
	await page.waitForLoadState('networkidle');
	await page.locator('h2:text-is("Tout le centre") ~ ul a').first().click();
	await page.waitForURL(/\/echanges\/messages\/(a\/)?\d+/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('textbox', { name: 'Votre message' }).fill(marque);
	await page.getByRole('button', { name: 'Envoyer' }).click();
	const fil = page.getByRole('log');
	await expect(fil.getByText(marque)).toBeVisible();

	const bouton = page.getByRole('button', { name: /^Gestes sur votre message/ }).last();
	// Le bouton n'apparaît qu'avec JavaScript, une fois la page prête.
	await expect(bouton).not.toHaveAttribute('hidden');
	await bouton.focus();
	await page.keyboard.press('Enter');
	const menu = page.getByRole('menu');
	await expect(menu).toBeVisible();
	await expect(bouton).toHaveAttribute('aria-expanded', 'true');
	const elements = menu.locator('[role^="menuitem"]');
	await expect(elements.first()).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(elements.nth(1)).toBeFocused();
	await page.keyboard.press('End');
	await expect(elements.last()).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(elements.first()).toBeFocused();
	await page.keyboard.press('ArrowUp');
	await expect(elements.last()).toBeFocused();

	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => v.id)).toEqual([]);

	await page.keyboard.press('Escape');
	await expect(menu).toBeHidden();
	await expect(bouton).toBeFocused();
	await expect(bouton).toHaveAttribute('aria-expanded', 'false');

	await page.keyboard.press('Enter');
	await menu.getByRole('menuitem', { name: 'Répondre' }).focus();
	await page.keyboard.press('Enter');
	await expect(menu).toBeHidden();
	await expect(page.getByRole('textbox', { name: 'Votre message' })).toBeFocused();
	await expect(page.getByText(`Réponse à vous`)).toBeVisible();
	await page.getByRole('button', { name: 'Annuler la réponse' }).click();
	await expect(page.getByText(`Réponse à vous`)).toBeHidden();
});

// Une conversation avec la première personne de l'annuaire, et un message envoyé : on est sur /echanges/messages/<id>.
async function ouvrirConversation(page: Page, texte: string) {
	await page.goto('/echanges/messages/nouveau');
	await page.waitForLoadState('networkidle');
	await page.locator('h2:text-is("Tout le centre") ~ ul a').first().click();
	await page.waitForURL(/\/echanges\/messages\/(a\/)?\d+/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('textbox', { name: 'Votre message' }).fill(texte);
	await page.getByRole('button', { name: 'Envoyer' }).click();
	await expect(page.getByRole('log').getByText(texte, { exact: true })).toBeVisible();
	await page.waitForURL(/\/echanges\/messages\/\d+/);
}

test('le brouillon est gardé, à la clé de la personne, puis effacé après l’envoi', async ({ page }) => {
	const marque = `Brouillon ${Date.now().toString(36)}`;
	await ouvrirConversation(page, `Ouverture ${marque}`);
	const champ = page.getByRole('textbox', { name: 'Votre message' });
	await champ.fill(marque);
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(champ).toHaveValue(marque);
	const cles = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('gyro:brouillon:')));
	expect(cles).toHaveLength(1);
	// Préfixée par la personne connectée (jamais 0), puis la conversation.
	expect(cles[0]).toMatch(/^gyro:brouillon:[1-9]\d*:\d+$/);
	await page.getByRole('button', { name: 'Envoyer' }).click();
	await expect(page.getByRole('log').getByText(marque, { exact: true })).toBeVisible();
	await expect(champ).toHaveValue('');
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(champ).toHaveValue('');
});

test('en lisant plus haut, le bouton « ↓ » ramène en bas', async ({ page }) => {
	const long = Array.from({ length: 60 }, (_, i) => `Ligne ${i + 1}`).join('\n');
	await ouvrirConversation(page, `Long ${Date.now().toString(36)}`);
	await page.getByRole('textbox', { name: 'Votre message' }).fill(long);
	await page.getByRole('button', { name: 'Envoyer' }).click();
	await expect(page.getByRole('log').getByText('Ligne 60')).toBeVisible();
	const bas = page.getByRole('button', { name: /Aller aux derniers messages|aller en bas/ });
	await expect(bas).toBeHidden();
	await page.evaluate(() => window.scrollTo(0, 0));
	await expect(bas).toBeVisible();
	await bas.click();
	await expect(bas).toBeHidden();
	expect(await page.evaluate(() => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 96)).toBe(true);
});

// Au doigt (événements simulés) : glisser une bulle vers la droite répond, sauf avec « réduire les animations ».
for (const mouvement of ['no-preference', 'reduce'] as const) {
	test(`glisser pour répondre, animations ${mouvement}`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: mouvement });
		const marque = `Glisser ${Date.now().toString(36)}`;
		await ouvrirConversation(page, marque);
		const rangee = page.locator('.rangee').filter({ hasText: marque });
		const b = (await rangee.boundingBox())!;
		const geste = (type: string, dx: number) => rangee.dispatchEvent(type, { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: b.x + 20 + dx, clientY: b.y + 10, bubbles: true });
		await geste('pointerdown', 0);
		for (let dx = 10; dx <= 90; dx += 10) await geste('pointermove', dx);
		await geste('pointerup', 90);
		if (mouvement === 'reduce') await expect(page.getByText('Réponse à vous')).toBeHidden();
		else await expect(page.getByText('Réponse à vous')).toBeVisible();
	});
}

// Infos d'un groupe qu'on vient de créer (on l'anime) : le menu d'un membre au clavier, la confirmation, puis l'ajout de membres.
test('infos du groupe : menu d’un membre au clavier et confirmation', async ({ page }) => {
	const nom = `Groupe ${Date.now().toString(36)}`;
	await page.goto('/echanges/messages/nouveau/groupe');
	await page.waitForLoadState('networkidle');
	await page.locator('label.ligne').nth(0).click();
	await page.locator('label.ligne').nth(1).click();
	await page.getByRole('button', { name: 'Suivant' }).click();
	await page.getByLabel('Nom du groupe').fill(nom);
	await page.getByRole('button', { name: 'Créer' }).click();
	await page.waitForURL(/\/echanges\/messages\/\d+$/);
	await page.goto(`${new URL(page.url()).pathname}/infos`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(nom);

	const bouton = page.getByRole('button', { name: /^Actions pour / }).first();
	await expect(bouton).not.toHaveAttribute('hidden');
	await bouton.focus();
	await page.keyboard.press('Enter');
	const menu = page.getByRole('menu');
	const elements = menu.getByRole('menuitem');
	await expect(elements).toHaveText([/^Écrire à /, 'Nommer animateur', 'Retirer du groupe']);
	await expect(elements.first()).toBeFocused();
	await page.keyboard.press('End');
	await expect(elements.last()).toBeFocused();
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => v.id)).toEqual([]);

	// Retirer demande une confirmation ; Échap l'annule et rend le focus.
	await page.keyboard.press('Enter');
	const dialogue = page.getByRole('dialog');
	await expect(dialogue).toContainText(/Retirer .+ du groupe \?/);
	await expect(dialogue.getByRole('button', { name: 'Annuler' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(dialogue).toBeHidden();
	await expect(bouton).toBeFocused();

	// Nommer, confirmé : la personne anime aussi le groupe.
	await page.keyboard.press('Enter');
	await menu.getByRole('menuitem', { name: 'Nommer animateur' }).click();
	await dialogue.getByRole('button', { name: 'Nommer' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'anime maintenant le groupe' })).toBeAttached();
	await expect(page.locator('.animateur')).toHaveCount(2);
	await expect(bouton).toBeFocused();

	await page.getByRole('link', { name: 'Ajouter des membres' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajouter des membres');
});

const axe = async (page: Page) => {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
};

// Alice écrit deux messages à l'agent connecté ; il signale les deux. Le super administrateur (il modère) les voit dans
// la cloche, retire le premier, classe le second ; l'agent voit « Message retiré par la modération ».
test('modération : le message signalé arrive dans la cloche, « Retirer le message » puis « Classer »', async ({ browser, page }) => {
	const marque = Date.now().toString(36);
	const alice = await (await browser.newContext()).newPage();
	await connecter(alice, 'alice.martin@exemple.fr');
	await alice.goto('/echanges/messages/nouveau');
	await alice.waitForLoadState('networkidle');
	await alice.getByRole('searchbox', { name: 'Écrire à' }).fill('Fictif');
	await alice.getByRole('link', { name: /Test Fictif/ }).click();
	await alice.waitForURL(/\/echanges\/messages\/(a\/)?\d+/);
	await alice.waitForLoadState('networkidle');
	for (const texte of [`Grave ${marque}`, `Limite ${marque}`]) {
		await alice.getByRole('textbox', { name: 'Votre message' }).fill(texte);
		await alice.getByRole('button', { name: 'Envoyer' }).click();
		await expect(alice.getByRole('log').getByText(texte, { exact: true })).toBeVisible();
	}
	await alice.context().close();

	await page.goto('/echanges/messages');
	await page.getByRole('link', { name: /Alice Martin/ }).first().click();
	await page.waitForURL(/\/echanges\/messages\/\d+$/);
	await page.waitForLoadState('networkidle');
	for (const texte of [`Grave ${marque}`, `Limite ${marque}`]) {
		const rangee = page.locator('.rangee').filter({ hasText: texte });
		const bouton = rangee.getByRole('button', { name: /^Gestes sur le message de Alice/ });
		await expect(bouton).not.toHaveAttribute('hidden');
		await bouton.focus();
		await page.keyboard.press('Enter');
		await page.getByRole('menu').getByRole('menuitem', { name: 'Signaler' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Signaler' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'transmis' })).toBeAttached();
	}

	const chef = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
	await chef.goto('/');
	await expect(chef.getByRole('link', { name: /^Notifications, \d+ nouvelles?$/ })).toBeVisible();
	await chef.goto('/notifications');
	await chef.waitForLoadState('networkidle');
	const section = chef.getByRole('region', { name: 'Messages signalés' });
	const carte = (texte: string) => section.getByRole('listitem').filter({ hasText: texte });
	await expect(carte(`Grave ${marque}`)).toContainText('Alice Martin');
	await expect(carte(`Grave ${marque}`)).toContainText('Signalé par Test Fictif');
	await axe(chef);

	// Retirer : une confirmation (Annuler d'abord), puis le message disparaît de la liste.
	await carte(`Grave ${marque}`).getByRole('link', { name: /^Retirer le message/ }).click();
	const dialogue = chef.getByRole('dialog');
	await expect(dialogue.getByRole('button', { name: 'Annuler' })).toBeFocused();
	await axe(chef);
	await dialogue.getByRole('button', { name: 'Retirer' }).click();
	await expect(chef.getByRole('status').filter({ hasText: 'Message retiré pour tous.' })).toBeAttached();
	await expect(carte(`Grave ${marque}`)).toHaveCount(0);
	await carte(`Limite ${marque}`).getByRole('button', { name: /^Classer/ }).click();
	await expect(chef.getByRole('status').filter({ hasText: 'Signalement classé.' })).toBeAttached();
	await expect(carte(`Limite ${marque}`)).toHaveCount(0);
	await chef.context().close();

	await page.reload();
	// La conversation peut garder ceux d'un passage précédent : le dernier est le nôtre.
	await expect(page.getByRole('log').getByText(`Grave ${marque}`)).toHaveCount(0);
	await expect(page.getByRole('log').getByText('Message retiré par la modération').last()).toBeVisible();
	await expect(page.getByRole('log').getByText(`Limite ${marque}`, { exact: true })).toBeVisible();
});

test('Mon profil : « Montrer quand j’ai lu les messages », décochée puis recochée', async ({ page }) => {
	await page.goto('/profil');
	const caseCoches = page.getByRole('checkbox', { name: 'Montrer quand j’ai lu les messages' });
	await expect(caseCoches).toBeChecked();
	await expect(caseCoches).toHaveAccessibleDescription(/vous ne voyez plus non plus celles des autres/);
	await axe(page);
	for (const coche of [false, true]) {
		await caseCoches.setChecked(coche);
		// Attendre la réponse de cet envoi : le message du précédent peut encore être à l'écran.
		await Promise.all([page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/profil'), page.getByRole('button', { name: 'Enregistrer' }).click()]);
		await expect(page.getByText('Profil enregistré')).toBeVisible();
		// Relire par une nouvelle visite : recharger renverrait le formulaire.
		await page.goto('/profil');
		if (coche) await expect(caseCoches).toBeChecked();
		else await expect(caseCoches).not.toBeChecked();
	}
});

// À l'ordinateur : la liste à gauche à partir de 1024 px, les infos à droite à partir de 1280 px ; au téléphone, la conversation seule.
test('colonnes : liste, conversation et infos à 1280 px ; liste et conversation à 1100 px ; conversation seule au téléphone', async ({ page }) => {
	await ouvrirConversation(page, `Colonnes ${Date.now().toString(36)}`);
	const liste = page.getByRole('navigation', { name: 'Conversations' });
	const fil = page.getByRole('log');
	const infos = page.getByRole('complementary', { name: /^Infos/ });
	if (test.info().project.name === 'telephone') {
		await expect(liste).toBeHidden();
		await expect(infos).toBeHidden();
		return;
	}
	await expect(liste).toBeVisible();
	await expect(infos).toBeVisible();
	const x = async (l: typeof fil) => (await l.boundingBox())!.x;
	expect(await x(liste)).toBeLessThan(await x(fil));
	expect(await x(fil)).toBeLessThan(await x(infos));
	// La conversation ouverte est marquée dans la liste.
	await expect(liste.locator('li a[aria-current="page"]')).toHaveCount(1);
	// Au clavier, la liste vient d'abord, puis la conversation.
	await liste.getByRole('link').last().focus();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Retour aux messages' })).toBeFocused();
	await axe(page);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);

	await page.setViewportSize({ width: 1100, height: 900 });
	await expect(liste).toBeVisible();
	await expect(infos).toBeHidden();
	expect(await x(liste)).toBeLessThan(await x(fil));
	await axe(page);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1100);
});

// À 1280 px, dans un groupe : après la saisie, Tab mène aux infos de droite (« Renommer »), sans rien sauter entre les deux.
test('colonnes, au clavier : du fil aux infos à 1280 px', async ({ page }) => {
	test.skip(test.info().project.name === 'telephone', 'à l’ordinateur seulement');
	await page.goto('/echanges/messages/nouveau/groupe');
	await page.waitForLoadState('networkidle');
	await page.locator('label.ligne').nth(0).click();
	await page.locator('label.ligne').nth(1).click();
	await page.getByRole('button', { name: 'Suivant' }).click();
	await page.getByLabel('Nom du groupe').fill(`Clavier ${Date.now().toString(36)}`);
	await page.getByRole('button', { name: 'Créer' }).click();
	await page.waitForURL(/\/echanges\/messages\/\d+$/);
	await page.waitForLoadState('networkidle');
	await page.getByRole('textbox', { name: 'Votre message' }).focus();
	const dansLesInfos = () => page.evaluate(() => document.activeElement?.closest('aside.infos') !== null);
	const dansLaConversation = () => page.evaluate(() => document.activeElement?.closest('.conversation') !== null);
	for (let i = 0; i < 6 && !(await dansLesInfos()); i++) {
		expect(await dansLaConversation()).toBe(true);
		await page.keyboard.press('Tab');
	}
	await expect(page.getByRole('complementary', { name: 'Infos du groupe' }).getByRole('link', { name: 'Renommer' })).toBeFocused();
});

// Juste à 1024 px : la liste à gauche, la conversation au centre, pas encore les infos ; rien ne déborde.
test('colonnes à 1024 px : liste et conversation, sans les infos', async ({ page }) => {
	test.skip(test.info().project.name === 'telephone', 'à l’ordinateur seulement');
	await page.setViewportSize({ width: 1024, height: 800 });
	await ouvrirConversation(page, `Étroit ${Date.now().toString(36)}`);
	const liste = page.getByRole('navigation', { name: 'Conversations' });
	await expect(liste).toBeVisible();
	await expect(page.getByRole('complementary', { name: /^Infos/ })).toBeHidden();
	expect((await liste.boundingBox())!.x).toBeLessThan((await page.getByRole('log').boundingBox())!.x);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
	await axe(page);
});

// Se déconnecter efface les brouillons de l'appareil (session à part : celle des autres tests reste ouverte).
test.describe('déconnexion', () => {
	test.use({ storageState: { cookies: [], origins: [] } });
	test('les brouillons ne restent pas pour le compte suivant', async ({ page }) => {
		await connecter(page, 'test@exemple.fr');
		await page.evaluate(() => {
			localStorage.setItem('gyro:brouillon:1:2', 'Secret');
			localStorage.setItem('autre', 'garde');
		});
		await page.goto('/moi');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Se déconnecter' }).click();
		await page.waitForURL(/\/connexion/);
		expect(await page.evaluate(() => [localStorage.getItem('gyro:brouillon:1:2'), localStorage.getItem('autre')])).toEqual([null, 'garde']);
	});
});
