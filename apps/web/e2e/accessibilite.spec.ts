import AxeBuilder from '@axe-core/playwright';
import type { DonneesFichier, FichierLu } from '@gyro-caserne/socle';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ecrireClasseur, lireClasseur } from '../src/lib/fichier-effectif/classeur.ts';
import { connecter } from './connexion.ts';
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
			for (const chemin of ['/', '/planning', '/caserne', '/echanges', '/notifications', '/moi', '/affichage', '/agents', '/profil']) {
				test(`${chemin} sans violation`, async ({ page }) => {
					await sansViolation(page, chemin);
				});
			}
		});

		test.describe('super administrateur', () => {
			test.use({ storageState: ETAT_SUPER });
			for (const chemin of ['/caserne', '/moi', '/agents', '/agents/nouveau', '/nominations', '/profil', '/reglages']) {
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

			test('responsabilités en cours, à venir et passées : /nominations et la fiche sans violation', async ({ page }) => {
				const agent = await nouvelAgent(page);
				await page.goto('/nominations');
				await nommer(page, 'Référent pharmacie', agent.nom);
				await nommer(page, 'Référent engins', agent.nom, { debut: '2099-01-01' });
				await nommer(page, 'Chef d’équipe', agent.nom, { debut: '2020-01-01', fin: '2020-12-31' });
				await sansViolation(page);

				await page.goto(agent.fiche);
				const cartes = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Responsabilités' }) });
				await cartes.locator('summary', { hasText: 'Passées (1)' }).click();
				await expect(cartes.getByText('Chef d’équipe — Équipe 1', { exact: true })).toBeVisible();
				// Terminer sans « Je confirme » : l'erreur reliée à sa case.
				await cartes.locator('li', { hasText: 'Référent pharmacie' }).getByRole('button', { name: 'Terminer' }).click();
				await expect(cartes.locator('li', { hasText: 'Référent pharmacie' }).getByRole('alert')).toHaveText('Cochez « Je confirme » pour terminer ce rôle.');
				await sansViolation(page);
			});

			test('/agents/fichier sans violation, avant et après le dépôt d’un fichier', async ({ page }) => {
				await ouvrirFichier(page);
				await sansViolation(page);
				const modele = (await (await page.request.get('/agents/fichier/donnees?modele=1')).json()) as DonneesFichier;
				const marque = Date.now().toString(36);
				await deposer(page, await classeur(modele.entetes, [arrivee(modele.entetes, marque, 'Yanis')], null));
				await expect(page.getByRole('heading', { level: 3, name: '1 arrivée' })).toBeVisible();
				await sansViolation(page);
			});

			test('/reglages, tous les formulaires ouverts : sans violation, sans débord', async ({ page }) => {
				await page.goto('/reglages');
				await page.waitForLoadState('networkidle');
				await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
				await sansViolation(page);
				expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
			});
		});
	});
}

// Le bloc repliable dont le titre est donné, ouvert. L'hydratation ne referme pas un bloc ouvert.
async function ouvrir(page: Page, titre: string) {
	const bloc = page.locator('details').filter({ has: page.locator('summary', { hasText: titre }) });
	await bloc.locator('summary').click();
	await expect(bloc.locator('form').first()).toBeVisible();
	return bloc;
}

// Adresse de la fiche, lue dans la liste de gestion.
async function ficheDe(page: Page, nom: string): Promise<string> {
	await page.goto(`/agents?texte=${encodeURIComponent(nom.split(' ')[1]!)}`);
	return (await page.getByRole('link', { name: `Voir la fiche de ${nom}` }).getAttribute('href'))!;
}

// Un agent neuf de l'équipe 1, pour des tests qui ne dépendent pas les uns des autres. On finit sur sa fiche.
async function nouvelAgent(page: Page): Promise<{ nom: string; fiche: string; email: string }> {
	const marque = Date.now().toString(36);
	const nom = `Essai${marque}`;
	await page.goto('/agents/nouveau');
	await page.getByLabel('Prénom').fill('Zoé');
	await page.getByLabel('Nom', { exact: true }).fill(nom);
	const email = `zoe.${marque}@exemple.fr`;
	await page.getByLabel('E-mail').fill(email);
	// Les filtres de la liste sont aussi dans la page : chaque libellé doit viser le champ de l'ajout.
	await page.locator('form[method="POST"]').getByRole('combobox', { name: 'Équipe' }).selectOption({ label: 'Équipe 1' });
	await page.getByRole('button', { name: "Ajouter l'agent" }).click();
	await expect(page).toHaveURL(/\/agents\/\d+$/);
	await expect(page.getByRole('heading', { level: 1, name: `Zoé ${nom}` })).toBeVisible();
	await expect(page.locator('form[action="?/equipe"]').getByLabel('Équipe').locator('option:checked')).toHaveText('Équipe 1');
	return { nom: `Zoé ${nom}`, fiche: new URL(page.url()).pathname, email };
}

// Sur /nominations, nommer l'agent au rôle dont la carte porte le nom (équipe 1 si le rôle vise une équipe).
async function nommer(page: Page, role: string, agent: string, dates: { debut?: string; fin?: string } = {}) {
	const carte = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: role, exact: true }) });
	const formulaire = carte.locator('form[action="?/attribuer"]');
	await formulaire.getByLabel('Agent', { exact: true }).selectOption({ label: `${agent} (Équipe 1)` });
	const equipe = formulaire.getByRole('combobox', { name: 'Équipe' });
	if ((await equipe.count()) > 0) await equipe.selectOption({ label: 'Équipe 1' });
	if (dates.debut) await formulaire.getByLabel('Début', { exact: true }).fill(dates.debut);
	if (dates.fin) await formulaire.getByLabel('Fin', { exact: true }).fill(dates.fin);
	await formulaire.getByRole('button', { name: 'Nommer' }).click();
	await expect(formulaire.getByRole('status')).toHaveText('Rôle attribué');
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// La page du fichier, prête : avant l'hydratation, boutons et champ fichier ne font rien.
async function ouvrirFichier(page: Page) {
	await page.goto('/agents/fichier');
	await page.waitForLoadState('networkidle');
}

// Cliquer sur le bouton, attendre le vrai téléchargement et relire le classeur reçu.
async function telecharger(page: Page, bouton: string): Promise<{ nom: string; lu: FichierLu }> {
	const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: bouton }).click()]);
	const lu = await lireClasseur(new Blob([readFileSync((await telechargement.path())!)]));
	return { nom: telechargement.suggestedFilename(), lu };
}

// Classeur fictif écrit comme l'appli l'écrit (listes déroulantes inutiles ici).
async function classeur(entetes: string[], lignes: string[][], repere: FichierLu['repere']): Promise<Buffer> {
	const listes = { grades: [], equipes: [], statuts: [], profils: [], rolesComite: [] };
	return Buffer.from(await (await ecrireClasseur({ entetes, listes, colonnesListe: {}, lignes, repere })).arrayBuffer());
}

// Ligne d'arrivée (sans n°) d'un agent fictif de l'équipe 1, dans l'ordre des en-têtes.
function arrivee(entetes: string[], marque: string, prenom: string): string[] {
	const valeurs: Record<string, string> = { 'E-mail': `${prenom.toLowerCase()}.${marque}@exemple.fr`, Prénom: prenom, Nom: `Import${marque}`, Équipe: 'Équipe 1', Profil: 'Agent' };
	return entetes.map((e) => valeurs[e] ?? '');
}

async function deposer(page: Page, contenu: Buffer) {
	await page.getByLabel('Importer un fichier').setInputFiles({ name: 'effectif.xlsx', mimeType: XLSX, buffer: contenu });
	await expect(page.getByRole('heading', { level: 2, name: "Aperçu de l'import" })).toBeVisible();
}

// Choisi même avant que la page soit prête, « Parti » affiche l'avertissement une fois la page prête.
async function choisirParti(page: Page) {
	const statut = page.locator('form[action="?/statut"]');
	await statut.getByLabel('Statut').selectOption('parti');
	await expect(statut.getByLabel('Je confirme')).toBeVisible();
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
		const { nom } = await nouvelAgent(gestion);

		await gestion.goto(await ficheDe(gestion, nom));
		await agent.goto('/agents');
		await expect(agent.getByText(nom)).toBeVisible();

		await choisirParti(gestion);
		const statut = gestion.locator('form[action="?/statut"]');
		await statut.getByLabel('Je confirme').check();
		await statut.getByRole('button', { name: 'Enregistrer' }).click();
		await expect(gestion.getByText('Statut enregistré')).toBeVisible();
		// Le statut s'affiche à côté du nom de l'agent (sur ordinateur, la liste a aussi son titre).
		await expect(gestion.getByRole('heading', { level: 1, name: nom }).locator('xpath=..')).toContainText('Parti');

		await agent.reload();
		await expect(agent.getByRole('heading', { level: 1, name: 'Agents' })).toBeVisible();
		await expect(agent.getByText(nom)).toHaveCount(0);
	});
});

test.describe('nominations', () => {
	test('un agent ordinaire n’ouvre pas les nominations : 403', async ({ browser }) => {
		const contexte = await browser.newContext({ storageState: ETAT_CONNECTE });
		const reponse = await (await contexte.newPage()).goto('/nominations');
		expect(reponse!.status()).toBe(403);
		await contexte.close();
	});

	test('le super administrateur nomme un agent chef de son équipe : tous le voient, puis il termine le rôle', async ({ browser }) => {
		const gestion = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		const agent = await (await browser.newContext({ storageState: ETAT_CONNECTE })).newPage();
		const { nom } = await nouvelAgent(gestion);
		const carte = gestion.locator('section').filter({ has: gestion.getByRole('heading', { level: 2, name: 'Responsabilités' }) });
		const formulaire = carte.locator('form[action="?/attribuer"]');

		// Choisi même avant que la page soit prête, le rôle d'équipe fait apparaître le choix de l'équipe.
		await formulaire.getByLabel('Responsabilité').selectOption({ label: 'Chef d’équipe' });
		await expect(formulaire.getByRole('combobox', { name: 'Équipe' })).toBeVisible();
		await expect(formulaire.getByLabel('Responsabilité').locator('option:checked')).toHaveText('Chef d’équipe');
		await formulaire.getByRole('combobox', { name: 'Équipe' }).selectOption({ label: 'Équipe 1' });
		await formulaire.getByRole('button', { name: 'Attribuer' }).click();
		await expect(formulaire.getByRole('status')).toHaveText('Rôle attribué');
		await expect(carte.getByText('Chef d’équipe — Équipe 1', { exact: true })).toBeVisible();

		await agent.goto('/agents');
		await expect(agent.getByRole('listitem').filter({ hasText: nom })).toContainText('Rôles : Chef d’équipe (Équipe 1)');

		// Changer la date de fin : le rôle reste, avec sa nouvelle fin.
		await carte.getByLabel('Nouvelle date de fin : Chef d’équipe — Équipe 1').fill('2099-12-31');
		await carte.getByRole('button', { name: 'Changer la date de fin' }).click();
		await expect(carte.getByRole('status').first()).toHaveText('Date de fin enregistrée');
		await expect(carte.getByText('au 31/12/2099')).toBeVisible();

		await carte.getByRole('checkbox', { name: 'Je confirme : terminer Chef d’équipe — Équipe 1' }).check();
		await carte.getByRole('button', { name: 'Terminer' }).click();
		await expect(carte.getByRole('status').first()).toHaveText('Rôle terminé');
		await expect(carte.getByText('Aucune responsabilité en cours.')).toBeVisible();

		await agent.reload();
		await expect(agent.getByRole('listitem').filter({ hasText: nom })).not.toContainText('Rôles');
		await gestion.context().close();
		await agent.context().close();
	});
});

test.describe('réglages', () => {
	test('un agent ordinaire n’ouvre pas les réglages : 403', async ({ browser }) => {
		const contexte = await browser.newContext({ storageState: ETAT_CONNECTE });
		const reponse = await (await contexte.newPage()).goto('/reglages');
		expect(reponse!.status()).toBe(403);
		await contexte.close();
	});

	test('le super administrateur crée un comité et une responsabilité qu’il attribue, puis le dissout : le chef de centre attribue', async ({ browser }) => {
		const page = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		const marque = Date.now().toString(36);
		const comite = `Comité sport ${marque}`;
		const responsabilite = `Référent sport ${marque}`;
		await page.goto('/reglages');

		const creation = await ouvrir(page, 'Créer un comité');
		await creation.getByLabel('Nom', { exact: true }).fill(comite);
		await creation.getByLabel('Thème').fill('sport');
		await creation.getByRole('button', { name: 'Créer le comité' }).click();
		await expect(page.getByText(`Le comité « ${comite} » est créé.`)).toBeVisible();

		const nouvelle = await ouvrir(page, 'Créer une responsabilité');
		await nouvelle.getByLabel('Nom', { exact: true }).fill(responsabilite);
		await nouvelle.getByLabel('Portée').selectOption({ label: 'Centre' });
		await nouvelle.getByLabel('Qui attribue').selectOption({ label: `Le comité « ${comite} »` });
		await nouvelle.getByLabel('Gérer le stock', { exact: true }).check();
		await nouvelle.getByRole('button', { name: 'Créer la responsabilité' }).click();
		await expect(page.getByText(`La responsabilité « ${responsabilite} » est créée.`)).toBeVisible();
		// Colonnes : portée, qui attribue, droits, titulaires.
		const ligne = page.getByRole('row', { name: new RegExp(responsabilite) });
		await expect(ligne.getByRole('cell').nth(1)).toHaveText(comite);
		await expect(ligne.getByRole('cell').nth(2)).toHaveText('Gérer le stock');

		const reglage = await ouvrir(page, `Modifier ou dissoudre « ${comite} »`);
		await reglage.getByLabel('Je confirme').check();
		await reglage.getByRole('button', { name: 'Dissoudre le comité' }).click();
		await expect(page.getByText('Le comité est dissous.')).toBeVisible();
		await expect(ligne.getByRole('cell').nth(1)).toHaveText('Le chef de centre');
		await page.context().close();
	});
});

test.describe('fichier de l’effectif', () => {
	test('un agent ordinaire n’ouvre pas le fichier de l’effectif : 403', async ({ browser }) => {
		const contexte = await browser.newContext({ storageState: ETAT_CONNECTE });
		const reponse = await (await contexte.newPage()).goto('/agents/fichier');
		expect(reponse!.status()).toBe(403);
		await contexte.close();
	});

	test('le super administrateur importe 2 arrivées depuis le modèle, puis un export amputé d’une ligne : « 1 départ » en tête', async ({ browser }) => {
		const page = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		await ouvrirFichier(page);
		const modele = await telecharger(page, 'Télécharger le modèle vierge');
		expect(modele.nom).toBe('modele-effectif.xlsx');
		expect(modele.lu.lignes).toEqual([]);
		expect(modele.lu.repere).toBeNull();

		const marque = Date.now().toString(36);
		const entetes = modele.lu.entetes;
		await deposer(page, await classeur(entetes, [arrivee(entetes, marque, 'Yanis'), arrivee(entetes, marque, 'Zoe')], null));
		await expect(page.getByRole('heading', { level: 3, name: 'Aucun départ' })).toBeVisible();
		await expect(page.getByRole('heading', { level: 3, name: '2 arrivées' })).toBeVisible();

		// Les opérations attendent : on voit l'application en cours et on tente de quitter.
		let ouvrir!: () => void;
		const barriere = new Promise<void>((r) => (ouvrir = r));
		await page.route('**/agents/fichier/operation', async (route) => {
			await barriere;
			await route.continue();
		});
		await page.getByRole('button', { name: "Valider l'import" }).click();
		await expect(page.getByRole('heading', { level: 2, name: 'Application en cours' })).toBeFocused();

		let question = '';
		page.once('dialog', async (dialogue) => {
			question = dialogue.message();
			await dialogue.dismiss();
		});
		await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Caserne' }).click();
		await expect.poll(() => question).toBe("L'import est en cours : quitter l'arrêtera. Quitter quand même ?");
		await expect(page).toHaveURL(/\/agents\/fichier$/);
		await expect(page.getByRole('heading', { level: 2, name: 'Application en cours' })).toBeVisible();

		ouvrir();
		await expect(page.getByRole('heading', { level: 2, name: 'Compte rendu' })).toBeFocused();
		const compteRendu = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Compte rendu' }) });
		await expect(compteRendu.getByRole('heading', { level: 3 })).toHaveCount(0);
		await expect(compteRendu).toContainText('Réexportez avant le prochain import.');
		await sansViolation(page);

		await page.goto(`/agents?texte=Import${marque}`);
		await expect(page.getByRole('link', { name: `Voir la fiche de Yanis Import${marque}` })).toBeVisible();
		await expect(page.getByRole('link', { name: `Voir la fiche de Zoe Import${marque}` })).toBeVisible();

		// Exporter, retirer Yanis, réimporter : son départ vient en tête de l'aperçu.
		await ouvrirFichier(page);
		const exporte = await telecharger(page, "Exporter l'effectif");
		expect(exporte.nom).toMatch(/^effectif-\d{4}-\d{2}-\d{2}\.xlsx$/);
		expect(exporte.lu.repere).not.toBeNull();
		const email = exporte.lu.entetes.indexOf('E-mail');
		const lignes = exporte.lu.lignes.map((l) => l.cellules);
		expect(lignes.filter((l) => l[email]!.endsWith(`.${marque}@exemple.fr`))).toHaveLength(2);
		// Chaque colonne à sa place, sur le vrai moteur D1 (deux colonnes « nom » s'y écrasaient).
		const zoe = lignes.find((l) => l[email] === `zoe.${marque}@exemple.fr`)!;
		expect(zoe[exporte.lu.entetes.indexOf('Nom')]).toBe(`Import${marque}`);
		expect(zoe[exporte.lu.entetes.indexOf('Profil')]).toBe('Agent');
		const ampute = lignes.filter((l) => l[email] !== `yanis.${marque}@exemple.fr`);
		await deposer(page, await classeur(exporte.lu.entetes, ampute, exporte.lu.repere));

		const apercu = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: "Aperçu de l'import" }) });
		await expect(apercu.getByRole('heading', { level: 3 }).first()).toHaveText('1 départ');
		await expect(apercu.getByRole('listitem').first()).toHaveText(`Yanis Import${marque}`);
		// Relu sans changement, le reste de l'export ne modifie personne.
		await expect(apercu.getByRole('heading', { level: 3, name: /modification/ })).toHaveCount(0);
		await page.getByRole('button', { name: "Abandonner l'import" }).click();
		await expect(apercu).toHaveCount(0);
		await page.context().close();
	});
});

test.describe('casquettes', () => {
	test('plusieurs rôles : on change de casquette au clavier, la choisie est marquée', async ({ browser, page }) => {
		const gestion = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		const agent = await nouvelAgent(gestion);
		await gestion.goto('/nominations');
		await nommer(gestion, 'Référent pharmacie', agent.nom);
		await gestion.context().close();

		await connecter(page, agent.email);
		const casquettes = page.getByRole('navigation', { name: 'Casquettes' });
		const astreinte = casquettes.getByRole('link', { name: 'Mon astreinte' });
		const pharmacie = casquettes.getByRole('link', { name: 'Référent pharmacie' });
		await expect(astreinte).toHaveAttribute('aria-current', 'page');
		await expect(pharmacie).not.toHaveAttribute('aria-current');
		await sansViolation(page);

		await pharmacie.focus();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/[?&]casquette=role/);
		await expect(pharmacie).toHaveAttribute('aria-current', 'page');
		await expect(astreinte).not.toHaveAttribute('aria-current');
		await expect(page.getByRole('heading', { level: 2, name: 'Ce que ce rôle permet' })).toBeVisible();
	});

	test('un seul rôle : pas de rangée de casquettes', async ({ browser, page }) => {
		const gestion = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		const agent = await nouvelAgent(gestion);
		await gestion.context().close();

		await connecter(page, agent.email);
		await expect(page.getByRole('navigation', { name: 'Casquettes' })).toHaveCount(0);
	});
});

test('thème sombre choisi : la page arrive déjà en sombre', async ({ request }) => {
	const reponse = await request.get('/connexion', { headers: { cookie: 'theme=sombre' } });
	expect(await reponse.text()).toMatch(/<html[^>]*data-theme="sombre"/);
});

test('« Se déconnecter » depuis « Moi » ferme la session', async ({ page }) => {
	// Personne fictive à part : les sessions gardées pour les autres tests restent ouvertes.
	await connecter(page, 'david.leroy@exemple.fr');
	await page.getByRole('link', { name: 'Moi', exact: true }).click();
	await page.getByRole('button', { name: 'Se déconnecter' }).click();
	await expect(page).toHaveURL(/\/connexion$/);
	await page.goto('/');
	await expect(page).toHaveURL(/\/connexion$/);
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
