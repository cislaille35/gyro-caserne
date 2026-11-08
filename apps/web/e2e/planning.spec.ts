import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { connecter } from './connexion.ts';
import { ETAT_SUPER } from './serveur.ts';

async function sansViolation(page: Page) {
	// Une fenêtre qui apparaît fausserait le calcul du contraste : on attend la fin de ce qui n'est pas sans fin.
	await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

// Le jeu de départ publie l'année en cours (planning fictif).
test.describe('chef : préparer l’année', () => {
	test.use({ storageState: ETAT_SUPER });

	test('été : les quatre étapes, proposer, une plage et le recalcul dans un panneau', async ({ page }) => {
		test.setTimeout(90_000);
		const annee = new Date().getFullYear();
		await page.goto(`/planning/preparer?annee=${annee}`);
		await page.getByRole('link', { name: `Été ${annee}` }).click();
		await expect(page.getByRole('heading', { level: 1, name: `Été ${annee}` })).toBeVisible();
		const etapes = page.getByRole('navigation', { name: 'Étapes' });
		await etapes.getByRole('link', { name: 'Période' }).click();
		await expect(page.getByText('Étape 1 sur 4')).toBeVisible();
		// Les deux tailles d'écran jouent ce test : l'une a pu ouvrir l'été avant l'autre.
		const ouvrir = page.getByRole('button', { name: 'Ouvrir la saisie des vacances' });
		// On attend la fin de l'envoi : la page qu'il relit écraserait sinon une navigation partie entre-temps.
		if (await ouvrir.count()) {
			await ouvrir.click();
			await expect(ouvrir).toHaveCount(0);
		}
		await page.getByRole('link', { name: 'Modifier la période' }).click();
		await expect(page.getByRole('dialog', { name: 'Période de l’été' })).toBeVisible();
		await sansViolation(page);
		await page.keyboard.press('Escape');
		await etapes.getByRole('link', { name: 'Vacances' }).click();
		await expect(page.getByRole('heading', { level: 2, name: 'Vacances' })).toBeVisible();
		await expect(page.getByText('Sans réponse', { exact: true })).toBeVisible();
		await sansViolation(page);
		await etapes.getByRole('link', { name: 'Répartition' }).click();
		await expect(page.getByRole('heading', { level: 2, name: 'Répartition' })).toBeVisible();
		const proposer = page.getByRole('button', { name: 'Proposer la répartition' });
		if (await proposer.count()) {
			await proposer.click();
			await expect(page.getByText(/Répartition proposée/)).toBeVisible();
		}
		await expect(page.getByText(/FPT armé \d+\/\d+|à revoir/).first()).toBeVisible();
		// Un seul geste de publication par étape : ici le lien, le bouton à l'étape suivante.
		await expect(page.getByRole('button', { name: `Publier l’été ${annee}` })).toHaveCount(0);
		await sansViolation(page);
		await page.locator('details.semaine summary').first().click();
		await page.locator('.plages a').first().click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByRole('heading', { level: 3, name: 'Ajouter un agent' })).toBeVisible();
		await sansViolation(page);
		await page.keyboard.press('Escape');
		await page.getByText('Plus d’actions').click();
		await page.getByRole('link', { name: 'Recalculer la proposition…' }).click();
		await expect(page.getByRole('dialog', { name: 'Recalculer la proposition ?' })).toBeVisible();
		await page.getByRole('link', { name: 'Annuler' }).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await page.getByRole('navigation', { name: 'Étape précédente ou suivante' }).getByRole('link', { name: /^Publier/ }).click();
		await expect(page.getByRole('button', { name: `Publier l’été ${annee}` })).toBeVisible();
		await sansViolation(page);
	});

	test('partir d’une proposition : le panneau, accepter, le brouillon sans annonce', async ({ page }) => {
		// L'année en cours et la suivante sont publiées par le jeu fictif : celle d'après n'a pas de roulement.
		const annee = new Date().getFullYear() + 2;
		await page.goto(`/planning/preparer?annee=${annee}`);
		// Les deux tailles d'écran jouent ce test : l'une a pu accepter avant l'autre.
		const bouton = page.getByRole('link', { name: 'Partir d’une proposition' });
		if (await bouton.count()) {
			await bouton.click();
			const panneau = page.getByRole('dialog', { name: `Proposition pour ${annee}` });
			await expect(panneau).toBeVisible();
			await expect(panneau.getByRole('heading', { level: 3, name: 'État des équipes' })).toBeVisible();
			await expect(panneau.getByText(/\d+ semaines, Noël : .*, Nouvel An : /)).toBeVisible();
			await sansViolation(page);
			await panneau.getByRole('button', { name: 'Accepter et écrire le brouillon' }).click();
			await expect(page.getByText('Proposition acceptée')).toBeVisible();
			await expect(page.getByRole('dialog')).toHaveCount(0);
		}
		await expect(page.getByRole('link', { name: 'Partir d’une proposition' })).toHaveCount(0);
		await expect(page.getByText('Brouillon', { exact: true })).toBeVisible();
		await page.goto(`/planning/preparer?annee=${annee}&etape=publier`);
		await expect(page.getByRole('button', { name: `Publier l’année ${annee}` })).toBeVisible();
	});

	test('armement : un engin dans un panneau, − et + annoncés', async ({ page }) => {
		await page.goto('/reglages/armement');
		await page.getByRole('link', { name: 'Modifier le FPT' }).click();
		const panneau = page.getByRole('dialog', { name: 'FPT' });
		await expect(panneau).toBeVisible();
		await panneau.getByRole('button', { name: /^Un poste Agent de plus/ }).click();
		await expect(panneau.getByRole('status').filter({ hasText: 'Agent : 3' })).toHaveCount(1);
		await panneau.getByRole('button', { name: /^Un poste Agent de moins/ }).click();
		await sansViolation(page);
		await panneau.getByRole('button', { name: 'Enregistrer' }).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(page.getByText('6 postes : CA tout engins, conducteur, 2 CE, 2 agents')).toBeVisible();
	});

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
		// Toucher une semaine à venir ouvre le choix d'équipe (une semaine commencée ne change plus).
		await page.locator('a.case').last().click();
		await expect(page.getByRole('group', { name: 'Quelle équipe d’astreinte ?' })).toBeVisible();
		await sansViolation(page);
		await page.getByRole('link', { name: 'Fermer' }).click();
		await expect(page.getByRole('group', { name: 'Quelle équipe d’astreinte ?' })).toHaveCount(0);
		await expect(page.locator('a.case').last()).toBeFocused();

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
		// Échap pendant une saisie ne ferme pas : ce qui a été tapé reste.
		await page.getByLabel('Thème').fill('Brouillon');
		await page.keyboard.press('Escape');
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
		// Les flèches ne font pas remonter la page.
		const fleche = page.getByRole('link', { name: 'Semaine suivante' });
		await fleche.scrollIntoViewIfNeeded();
		const avant = await page.evaluate(() => window.scrollY);
		await fleche.click();
		await expect(page).toHaveURL(/semaine=/);
		if (avant > 0) expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

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
		// Toucher l'onglet Planning, déjà ouvert, deux fois : la vue ne change pas.
		await page.getByRole('navigation', { name: 'Vue du planning' }).getByRole('link', { name: 'Année' }).click();
		await expect(page).toHaveURL(/vue=annee/);
		for (let i = 0; i < 2; i++) {
			await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Planning' }).click();
			await expect(page).toHaveURL(/\/planning$/);
			await expect(page.getByRole('navigation', { name: 'Vue du planning' }).getByRole('link', { name: 'Année' })).toHaveAttribute('aria-current', 'page');
		}

		await page.goto('/moi');
		await page.getByRole('link', { name: /Ajouter à mon agenda/ }).click();
		const lien = await page.getByLabel('Votre lien personnel').inputValue();
		expect(lien).toMatch(/\/agenda\/\d+-[A-Za-z0-9_-]{43}\.ics$/);
		const fichier = await page.request.get(lien);
		expect(fichier.status()).toBe(200);
		expect(fichier.headers()['content-type']).toBe('text/calendar; charset=utf-8');
		expect(await fichier.text()).toContain('SUMMARY:Astreinte');
		await sansViolation(page);
		await page.getByRole('button', { name: 'Changer le lien' }).click();
		await expect(page.getByText('Nouveau lien créé')).toBeVisible();
		expect(await page.getByLabel('Votre lien personnel').inputValue()).not.toBe(lien);
		expect((await page.request.get(lien)).status()).toBe(404);
	});
});

test('agent d’équipe, au Planning : réponses sur une ligne à 390 px, le focus reste sur le bouton', async ({ page }, info) => {
	test.skip(info.project.name !== 'telephone', 'mesure à 390 px');
	await connecter(page, 'alice.martin@exemple.fr');
	await page.goto('/planning?vue=annee');
	await page.waitForLoadState('networkidle');
	const groupe = page.getByRole('group', { name: /^Votre réponse/ });
	test.skip((await groupe.count()) === 0, 'aucune manœuvre annoncée à cette date dans le jeu fictif');
	const incertain = groupe.getByRole('button', { name: 'Incertain' });
	await incertain.focus();
	await page.keyboard.press('Enter');
	await expect(incertain).toHaveAttribute('aria-pressed', 'true');
	await expect(incertain).toBeFocused();
	const hauts = await groupe.getByRole('button').evaluateAll((boutons) => boutons.map((b) => b.getBoundingClientRect().top));
	expect(new Set(hauts).size).toBe(1);
});
