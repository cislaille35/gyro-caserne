import AxeBuilder from '@axe-core/playwright';
import type { DonneesFichier, FichierLu } from '@gyro-caserne/socle';
import { expect, test, type Browser, type Locator, type Page, type Request } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ecrireClasseur, lireClasseur } from '../src/lib/fichier-effectif/classeur.ts';
import { connecter } from './connexion.ts';
import { ADRESSE, ETAT_CONNECTE, ETAT_SUPER } from './serveur.ts';

async function sansViolation(page: Page, chemin?: string) {
	if (chemin) await page.goto(chemin);
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

// Marque unique d'un essai : les projets téléphone et ordinateur peuvent tomber sur la même milliseconde.
function nouvelleMarque(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
			for (const chemin of ['/', '/planning', '/planning?vue=mois', '/planning?vue=annee', '/planning?vue=equipes', '/caserne', '/echanges', '/echanges/vie', '/echanges/publier?mur=vie', '/echanges/messages/nouveau', '/echanges/messages/nouveau/groupe', '/notifications', '/moi', '/moi/notifications', '/moi/agenda', '/affichage', '/agents', '/profil', '/reservations', '/reservations/1', '/reservations/2', '/reservations/1/reserver', '/reservations/2/reserver', '/reservations/miennes', '/remplacements', '/remplacements/demander', '/remplacements/demander?mode=echange', '/remplacements/manoeuvre', '/moi/vacances', '/engins', '/engins/1', '/engins/prise', '/engins/1/prise']) {
				test(`${chemin} sans violation`, async ({ page }) => {
					await sansViolation(page, chemin);
				});
			}

			test('publier, sondage ouvert, sans violation', async ({ page }) => {
				await page.goto('/echanges/publier?mur=vie');
				await formulairePret(page);
				await page.locator('summary', { hasText: 'Sondage' }).click();
				await expect(page.getByLabel('Ferme le')).toBeVisible();
				await sansViolation(page);
			});

			test('échanges remplis : accueil, notifications, mur et publication sans violation', async ({ browser, page }) => {
				const gestion = await pageSuper(browser, theme);
				const marque = nouvelleMarque();
				await gestion.goto('/echanges/centre');
				const annonce = await publier(gestion, { type: 'Annonce', texte: `Consigne ${marque}`, prise: true });
				// Événement lointain avec sondage : la clôture préremplie s'arrête un an après l'ouverture.
				await publier(gestion, { type: 'Événement', texte: `Manœuvre ${marque}`, debut: '2099-06-01T18:30', lieu: 'Caserne', question: 'Petit déjeuner ?', reponses: ['Oui', 'Non'] });
				// L'auteur voit le suivi de son annonce.
				await gestion.goto(`/echanges/centre/${annonce}`);
				await expect(gestion.getByRole('heading', { level: 2, name: 'Suivi' })).toBeVisible();
				await toutOuvrir(gestion);
				await sansViolation(gestion);
				await gestion.context().close();

				await page.goto('/');
				await expect(page.getByRole('heading', { name: 'À ne pas manquer' })).toBeVisible();
				await expect(page.getByRole('button', { name: `Pris connaissance : Consigne ${marque}` })).toBeVisible();
				await expect(page.getByRole('group', { name: `Votre réponse : Manœuvre ${marque}` })).toBeVisible();
				await sansViolation(page);
				await page.goto('/notifications');
				await expect(page.getByRole('link', { name: new RegExp(`Consigne ${marque}`) })).toBeVisible();
				await sansViolation(page);
				for (const chemin of ['/echanges/centre', `/echanges/centre/${annonce}`]) {
					await page.goto(chemin);
					await toutOuvrir(page);
					await sansViolation(page);
				}
			});
		});

		// Le super administrateur voit tous les murs : un de chaque sorte, remplis, au niveau Vivant.
		for (const mouvement of ['no-preference', 'reduce'] as const) {
			test.describe(`échanges, niveau vivant, mouvement ${mouvement}`, () => {
				test.use({ storageState: ETAT_SUPER, reducedMotion: mouvement });

				test('la liste, un mur de chaque sorte et Publier sans violation', async ({ page, context }) => {
					await context.addCookies([{ name: 'niveau', value: 'vivant', url: ADRESSE }]);
					const marque = nouvelleMarque();
					await page.goto('/echanges');
					const lien = async (debut: string) => (await page.locator(`a[href^="/echanges/${debut}"]`).first().getAttribute('href'))!;
					const murs = ['/echanges/centre', '/echanges/vie', await lien('equipe:'), await lien('comite:')];
					await page.goto('/echanges/vie');
					await publier(page, { texte: `Sortie ${marque}`, question: 'Quel jour ?', reponses: ['Samedi', 'Dimanche'] });
					for (const mur of murs.slice(2)) {
						await page.goto(mur);
						await publier(page, { texte: `Nouvelle ${marque}` });
					}
					for (const chemin of ['/echanges', ...murs, '/echanges/publier']) {
						await page.goto(chemin);
						await toutOuvrir(page);
						await sansViolation(page);
						if (mouvement === 'reduce') expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
					}
				});
			});
		}

		// La messagerie, remplie : la liste, nouveau message, un groupe et ses infos, une conversation à deux, au niveau Vivant.
		for (const mouvement of ['no-preference', 'reduce'] as const) {
			test.describe(`messagerie, niveau vivant, mouvement ${mouvement}`, () => {
				test.use({ storageState: ETAT_CONNECTE, reducedMotion: mouvement });

				test('la liste, nouveau message, une conversation et ses infos sans violation, sans débord', async ({ page, context }) => {
					await context.addCookies([{ name: 'niveau', value: 'vivant', url: ADRESSE }]);
					const groupe = await groupeAvecMessages(page, `Groupe ${nouvelleMarque()}`);
					await page.goto('/echanges/messages/nouveau');
					await page.locator('h2:text-is("Tout le centre") ~ ul a').first().click();
					await page.waitForURL(/\/echanges\/messages\/(a\/)?\d+/);
					const aDeux = new URL(page.url()).pathname;
					for (const chemin of ['/echanges/messages', '/echanges/messages/nouveau', '/echanges/messages/nouveau/groupe', groupe, `${groupe}/infos`, aDeux]) {
						await page.goto(chemin);
						await page.waitForLoadState('networkidle');
						await sansViolation(page);
						expect(await page.evaluate(() => document.documentElement.scrollWidth), chemin).toBeLessThanOrEqual(page.viewportSize()!.width);
						if (mouvement === 'reduce') expect(await page.evaluate(() => document.getAnimations().length), chemin).toBe(0);
					}
				});
			});
		}

		test.describe('super administrateur', () => {
			test.use({ storageState: ETAT_SUPER });
			for (const chemin of ['/caserne', '/moi', '/agents', '/agents/nouveau', '/nominations', '/profil', '/reglages', '/echanges/centre', '/echanges/publier', '/reservations', '/reservations/a-valider', '/reservations/materiel', '/planning', '/planning/preparer', '/planning/preparer?etape=fetes', '/planning/preparer?etape=manoeuvres&manoeuvre=nouvelle', '/planning/preparer?etape=reperes', '/planning/preparer?etape=publier', '/planning/preparer/manoeuvre', '/reglages/aptitudes', '/remplacements', '/planning/preparer/fichier', '/planning/ete', '/reglages/armement', '/engins', '/engins/nouveau', '/engins/1/modifier', '/engins/fiches', '/engins/fiches/1', '/engins/fiches/fichier']) {
				test(`${chemin} sans violation`, async ({ page }) => {
					await sansViolation(page, chemin);
				});
			}

			test('engin et éditeur de fiche, zones et formulaires ouverts, sans violation', async ({ page }) => {
				// Le bouton d'une zone ne répond qu'une fois la page prête : on réessaie.
				const ouvrirCabine = async () => {
					const bouton = page.getByRole('button', { name: /^Cabine/ });
					await expect(async () => {
						if ((await bouton.getAttribute('aria-expanded')) === 'false') await bouton.click();
						await expect(bouton).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
					}).toPass();
				};
				await page.goto('/engins/1');
				await ouvrirCabine();
				await sansViolation(page);
				await page.goto('/engins/fiches/1?retirer-zone=1');
				await ouvrirCabine();
				await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
				await sansViolation(page);
			});

			test('fiche d’un agent, blocs ouverts, sans violation, erreur de départ comprise', async ({ page }) => {
				test.setTimeout(60_000);
				await page.goto(await ficheDe(page, 'Alice Martin'));
				await page.waitForLoadState('networkidle');
				await toutOuvrir(page);
				await sansViolation(page);
				expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
				// Sans « Je confirme », rien n'est effacé : le bloc se rouvre seul avec l'erreur.
				await page.getByRole('button', { name: 'Déclarer le départ' }).click();
				await expect(page.getByText('Cochez « Je confirme » pour déclarer le départ.')).toBeVisible();
				await sansViolation(page);
			});

			test('responsabilités en cours, à venir et passées : /nominations et la fiche sans violation', async ({ page }) => {
				const agent = await nouvelAgent(page);
				await page.goto('/nominations');
				await nommer(page, 'Référent pharmacie', agent.nom);
				await nommer(page, 'Référent engins', agent.nom, { debut: '2099-01-01' });
				await nommer(page, 'Chef de garde', agent.nom, { debut: '2020-01-01', fin: '2020-12-31' });
				await sansViolation(page);

				await page.goto(agent.fiche);
				const cartes = await blocDeFiche(page, 'Rôles', (b) => b.locator('summary', { hasText: 'Passées (1)' }));
				await cartes.locator('summary', { hasText: 'Passées (1)' }).click();
				await expect(cartes.getByText('Chef de garde — Équipe 1', { exact: true })).toBeVisible();
				// Terminer sans « Je confirme » : l'erreur reliée à sa case.
				await cartes.locator('li', { hasText: 'Référent pharmacie' }).getByRole('button', { name: 'Terminer' }).click();
				await expect(cartes.locator('li', { hasText: 'Référent pharmacie' }).getByRole('alert')).toHaveText('Cochez « Je confirme » pour terminer ce rôle.');
				await sansViolation(page);
			});

			test('/agents/fichier sans violation, avant et après le dépôt d’un fichier', async ({ page }) => {
				await ouvrirFichier(page);
				await sansViolation(page);
				const modele = (await (await page.request.get('/agents/fichier/donnees?modele=1')).json()) as DonneesFichier;
				const marque = nouvelleMarque();
				await deposer(page, await classeur(modele.entetes, [arrivee(modele.entetes, marque, 'Yanis')], null));
				await expect(page.getByRole('heading', { level: 3, name: '1 arrivée' })).toBeVisible();
				await sansViolation(page);
			});

			test('/agents filtrée et cherchée, sans violation', async ({ page }) => {
				for (const chemin of ['/agents?filtre=a-completer', '/agents?filtre=indisponibles', '/agents?filtre=partis', '/agents?texte=Martin&filtre=partis']) await sansViolation(page, chemin);
			});

			test('/nominations : volet « Nommer » ouvert, puis étape de retrait, sans violation', async ({ page }) => {
				const { nom } = await nouvelAgent(page);
				await page.goto('/nominations');
				await page.waitForLoadState('networkidle');
				await nommer(page, 'Référent technique', nom);
				await carteRole(page, 'Référent pharmacie').getByRole('button', { name: 'Nommer', exact: true }).click();
				await expect(page.getByRole('dialog', { name: 'Nommer : Référent pharmacie' })).toBeVisible();
				await sansViolation(page);
				await page.keyboard.press('Escape');
				await expect(page.getByRole('dialog')).toHaveCount(0);
				await carteRole(page, 'Référent technique')
					.getByRole('button', { name: `Retirer ${nom}` })
					.click();
				await expect(page.locator(':focus')).toContainText(`Retirer ${nom} ?`);
				await sansViolation(page);
			});

			test('réglages, groupes et blocs ouverts : sans violation, sans débord', async ({ page }) => {
				for (const chemin of ['/reglages', `/reglages/roles/${await idRole(page, 'Référent engins')}`, '/reglages/roles/nouveau?modele=vierge', '/reglages/comites/nouveau']) {
					await page.goto(chemin);
					await page.waitForLoadState('networkidle');
					await toutOuvrir(page);
					await sansViolation(page);
					expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
				}
			});

			test('réglages : choix du modèle, rôle système en lecture seule, profil : sans violation, sans débord', async ({ page }) => {
				const systeme = await idReglage(page, 'roles', 'Chef de centre');
				const profil = await idReglage(page, 'profils', 'Agent');
				for (const chemin of ['/reglages/roles/nouveau', `/reglages/roles/${systeme}`, `/reglages/profils/${profil}`]) {
					await page.goto(chemin);
					await page.waitForLoadState('networkidle');
					await toutOuvrir(page);
					await sansViolation(page);
					expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
				}
			});
		});
	});
}

// Un groupe avec les deux premières personnes de l'annuaire, et deux messages (dont une réponse) : son adresse.
async function groupeAvecMessages(page: Page, nom: string): Promise<string> {
	await page.goto('/echanges/messages/nouveau/groupe');
	await page.waitForLoadState('networkidle');
	await page.locator('label.ligne').nth(0).click();
	await page.locator('label.ligne').nth(1).click();
	await page.getByRole('button', { name: 'Suivant' }).click();
	await page.getByLabel('Nom du groupe').fill(nom);
	await page.getByRole('button', { name: 'Créer' }).click();
	await page.waitForURL(/\/echanges\/messages\/\d+$/);
	await page.waitForLoadState('networkidle');
	for (const texte of ['Qui vient samedi ?', 'Moi, avec le gâteau.']) {
		await page.getByRole('textbox', { name: 'Votre message' }).fill(texte);
		await page.getByRole('button', { name: 'Envoyer' }).click();
		await expect(page.getByRole('log').getByText(texte, { exact: true })).toBeVisible();
	}
	return new URL(page.url()).pathname;
}

// Ouvre les groupes repliés et les blocs <details> de la page.
async function toutOuvrir(page: Page) {
	// Des poignées fixes : `all()` renverrait des « n-ième bouton fermé », qui glissent à chaque ouverture.
	for (const bouton of await page.locator('button[aria-expanded="false"]').elementHandles()) if (await bouton.isVisible()) await bouton.click();
	await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
}

// L'identifiant d'un rôle, lu dans le lien de la liste des réglages.
async function idRole(page: Page, nom: string): Promise<string> {
	await page.goto('/reglages');
	const href = await page.locator('main a', { hasText: nom }).first().getAttribute('href');
	return href!.split('/').pop()!;
}

// La zone lue de la barre du bas (les autres zones « status » de la page sont des div).
const barreDe = (page: Page) => page.locator('p[role="status"]');

// Même chose au nom exact, pour un rôle (`roles`) ou un profil (`profils`).
async function idReglage(page: Page, type: 'roles' | 'profils', nom: string): Promise<string> {
	await page.goto('/reglages');
	const lien = page.locator(`main a[href^="/reglages/${type}/"]`).filter({ has: page.getByText(nom, { exact: true }) });
	return (await lien.getAttribute('href'))!.split('/').pop()!;
}

// Le groupe d'un domaine, ouvert. Sur ordinateur, les domaines s'ouvrent seuls une fois la page prête :
// on n'ouvre que si besoin, et on réessaie tant que la page n'est pas prête. Au retour, la page est prête.
async function domaineOuvert(page: Page, nom: string) {
	const bouton = page.getByRole('button', { name: new RegExp(`^${nom}`) });
	const groupe = page.locator('main section').filter({ has: bouton });
	const premier = groupe.getByRole('radio').first();
	await expect(async () => {
		if (!(await premier.isVisible())) await bouton.click();
		await expect(premier).toBeVisible({ timeout: 1000 });
	}).toPass();
	return { bouton, groupe };
}

// Adresse de la fiche, lue dans la liste de gestion.
async function ficheDe(page: Page, nom: string): Promise<string> {
	await page.goto(`/agents?texte=${encodeURIComponent(nom.split(' ')[1]!)}`);
	return (await page.getByRole('link', { name: nom, exact: true }).getAttribute('href'))!;
}

// Un agent neuf (de l'équipe 1 par défaut), pour des tests qui ne dépendent pas les uns des autres. On finit sur sa fiche.
async function nouvelAgent(page: Page, equipe = 'Équipe 1'): Promise<{ nom: string; fiche: string; email: string }> {
	const marque = nouvelleMarque();
	const nom = `Essai${marque}`;
	await page.goto('/agents/nouveau');
	await page.getByLabel('Prénom').fill('Zoé');
	await page.getByLabel('Nom', { exact: true }).fill(nom);
	const email = `zoe.${marque}@exemple.fr`;
	await page.getByLabel('E-mail').fill(email);
	// Les filtres de la liste sont aussi dans la page : chaque libellé doit viser le champ de l'ajout.
	await page.locator('form[method="POST"]').getByRole('combobox', { name: 'Équipe' }).selectOption({ label: equipe });
	await page.getByRole('button', { name: "Ajouter l'agent" }).click();
	await expect(page).toHaveURL(/\/agents\/\d+$/);
	await expect(page.getByRole('heading', { level: 1, name: `Zoé ${nom}` })).toBeVisible();
	await expect(page.locator('form[action^="?/equipe"]').getByLabel('Équipe').locator('option:checked')).toHaveText(equipe);
	return { nom: `Zoé ${nom}`, fiche: new URL(page.url()).pathname, email };
}

// La carte d'un rôle sur /nominations.
const carteRole = (page: Page, role: string) => page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: role, exact: true }) });

// Sur /nominations, nommer l'agent au rôle dont la carte porte le nom (équipe 1 ou comité « Amicale » si le rôle en vise un).
async function nommer(page: Page, role: string, agent: string, dates: { debut?: string; fin?: string } = {}) {
	const carte = carteRole(page, role);
	await carte.getByRole('button', { name: 'Nommer', exact: true }).click();
	const formulaire = carte.locator('dialog form[action="?/attribuer"]');
	await expect(formulaire).toBeVisible();
	await formulaire.getByLabel('Agent', { exact: true }).selectOption({ label: `${agent} (Équipe 1)` });
	const equipe = formulaire.getByRole('combobox', { name: 'Équipe' });
	if ((await equipe.count()) > 0) await equipe.selectOption({ label: 'Équipe 1' });
	const comite = formulaire.getByRole('combobox', { name: 'Comité' });
	if ((await comite.count()) > 0) await comite.selectOption({ label: 'Amicale' });
	if (dates.debut || dates.fin) await formulaire.getByText('Changer les dates', { exact: true }).click();
	if (dates.debut) await formulaire.getByLabel('Début', { exact: true }).fill(dates.debut);
	if (dates.fin) await formulaire.getByLabel('Fin', { exact: true }).fill(dates.fin);
	await formulaire.getByRole('button', { name: 'Nommer' }).click();
	// Le volet se ferme, la réussite s'annonce dans la carte.
	await expect(carte.getByRole('status')).toHaveText('Rôle attribué');
	await expect(carte.locator('dialog')).toHaveCount(0);
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

// Ouvre un bloc de la fiche et renvoie sa section. Le bouton ne répond qu'une fois la page prête : on réessaie.
async function blocDeFiche(page: Page, titre: string, attendu: (bloc: Locator) => Locator): Promise<Locator> {
	const bouton = page.getByRole('button', { name: new RegExp(`^${titre}`) });
	const bloc = page.locator('section').filter({ has: bouton });
	await expect(async () => {
		if ((await bouton.getAttribute('aria-expanded')) === 'false') await bouton.click();
		await expect(attendu(bloc)).toBeVisible({ timeout: 1000 });
	}).toPass();
	return bloc;
}

// Une page du super administrateur, dans le thème voulu.
async function pageSuper(browser: Browser, theme?: string): Promise<Page> {
	const contexte = await browser.newContext({ storageState: ETAT_SUPER });
	if (theme) await contexte.addCookies([{ name: 'theme', value: theme, url: ADRESSE }]);
	return contexte.newPage();
}

// Une page où l'agent vient de se connecter.
async function pageAgent(browser: Browser, email: string): Promise<Page> {
	const page = await (await browser.newContext()).newPage();
	await connecter(page, email);
	return page;
}

// La page Publier, une fois prête : avec JavaScript, les champs d'événement se cachent.
async function formulairePret(page: Page): Promise<Locator> {
	const formulaire = page.locator('form[action="?/publier"]');
	await expect(formulaire.getByRole('group', { name: 'Pour un événement' })).toBeHidden();
	return formulaire;
}

type Saisie = { type?: string; texte: string; prise?: boolean; debut?: string; lieu?: string; equipes?: string[]; question?: string; reponses?: string[]; photo?: Buffer };

// Publie depuis le mur ouvert (lien « Publier dans … ») ; de retour sur le mur, renvoie l'identifiant de la publication, lu dans l'adresse.
async function publier(page: Page, s: Saisie): Promise<number> {
	await page.getByRole('link', { name: /^Publier dans / }).click();
	const formulaire = await formulairePret(page);
	if (s.type) await formulaire.getByRole('radio', { name: new RegExp(`^${s.type}`) }).check();
	await formulaire.getByLabel('Votre message', { exact: true }).fill(s.texte);
	if (s.prise) await formulaire.getByLabel('Demander une prise de connaissance (annonce)').check();
	if (s.debut) await formulaire.getByLabel('Date et heure').fill(s.debut);
	if (s.lieu) await formulaire.getByLabel('Lieu', { exact: true }).fill(s.lieu);
	for (const equipe of s.equipes ?? []) await formulaire.getByRole('checkbox', { name: equipe, exact: true }).check();
	if (s.question) {
		await formulaire.locator('summary', { hasText: 'Sondage' }).click();
		await formulaire.getByLabel('Question', { exact: true }).fill(s.question);
		for (const [i, r] of (s.reponses ?? []).entries()) {
			const champ = formulaire.getByLabel(`Réponse ${i + 1}`, { exact: true });
			if (!(await champ.isVisible())) await formulaire.getByRole('button', { name: '+ Ajouter une réponse' }).click();
			await champ.fill(r);
		}
	}
	if (s.photo) await formulaire.getByLabel('Photos').setInputFiles({ name: 'essai.jpg', mimeType: 'image/jpeg', buffer: s.photo });
	await formulaire.getByRole('button', { name: /^Publier/ }).click();
	await page.waitForURL(/\/echanges\/[^/]+#publication-\d+$/);
	await expect(publicationDe(page, s.texte)).toBeVisible();
	return Number(new URL(page.url()).hash.split('-').pop());
}

const publicationDe = (page: Page, texte: string) => page.locator('article').filter({ hasText: texte });

// Une petite photo fictive en JPEG, dessinée par le navigateur.
async function photoFictive(page: Page): Promise<Buffer> {
	const adresse = await page.evaluate(() => {
		const toile = document.createElement('canvas');
		toile.width = 160;
		toile.height = 120;
		const dessin = toile.getContext('2d')!;
		dessin.fillStyle = '#b22222';
		dessin.fillRect(0, 0, 160, 120);
		dessin.fillStyle = '#ffffff';
		dessin.fillRect(40, 30, 80, 60);
		return toile.toDataURL('image/jpeg', 0.8);
	});
	return Buffer.from(adresse.split(',')[1]!, 'base64');
}

test.describe('échanges', () => {
	test('annonce à prendre en compte : l’agent la voit sur son accueil, « Pris connaissance » la retire, l’auteur voit qui l’a fait', async ({ browser }) => {
		const gestion = await pageSuper(browser);
		const titre = `Consigne ${nouvelleMarque()}`;
		await gestion.goto('/echanges/centre');
		const id = await publier(gestion, { type: 'Annonce', texte: titre, prise: true });

		const agent = await (await browser.newContext({ storageState: ETAT_CONNECTE })).newPage();
		await agent.goto('/');
		// Page prête : le geste passe par JavaScript, qui garde le focus dans la section.
		await expect(agent.locator('.accueil[data-pret]')).toBeAttached();
		const bouton = agent.getByRole('button', { name: `Pris connaissance : ${titre}` });
		await bouton.click();
		await expect(bouton).toHaveCount(0);
		await expect(agent.locator(':focus')).toHaveAttribute('id', /^(a-ne-pas-manquer|contenu)$/);
		await expect(agent.getByRole('link', { name: titre, exact: true })).toHaveCount(0);
		await agent.context().close();

		await gestion.goto(`/echanges/centre/${id}`);
		const suivi = gestion.locator('#suivi');
		await expect(suivi).toContainText('1 a pris connaissance');
		await expect(suivi).toContainText(/pas encore : .*Alice Martin/);
		await suivi.locator('summary', { hasText: 'Qui a pris connaissance' }).click();
		await expect(suivi.getByText('Test Fictif', { exact: true })).toBeVisible();
		await gestion.context().close();
	});

	test('événement convoquant l’équipe 1 : un agent de l’équipe 1 répond depuis l’accueil, un agent de l’équipe 2 ne le voit pas', async ({ browser }) => {
		const gestion = await pageSuper(browser);
		const un = await nouvelAgent(gestion);
		const deux = await nouvelAgent(gestion, 'Équipe 2');
		const titre = `Manœuvre ${nouvelleMarque()}`;
		await gestion.goto('/echanges/centre');
		await publier(gestion, { type: 'Événement', texte: titre, debut: '2099-06-01T18:30', lieu: 'Caserne', equipes: ['Équipe 1'] });
		await gestion.context().close();

		const agentUn = await pageAgent(browser, un.email);
		const reponse = agentUn.getByRole('group', { name: `Votre réponse : ${titre}` });
		await expect(agentUn.locator('.accueil[data-pret]')).toBeAttached();
		await reponse.getByRole('button', { name: 'Présent' }).click();
		await expect(reponse.getByRole('button', { name: 'Présent' })).toHaveAttribute('aria-pressed', 'true');
		await expect(reponse.getByRole('button', { name: 'Présent' })).toBeFocused();
		await agentUn.reload();
		await expect(reponse.getByRole('button', { name: 'Présent' })).toHaveAttribute('aria-pressed', 'true');
		await expect(reponse.getByRole('button', { name: 'Absent' })).toHaveAttribute('aria-pressed', 'false');
		await agentUn.context().close();

		const agentDeux = await pageAgent(browser, deux.email);
		// Accueil prêt avant de constater l'absence.
		await expect(agentDeux.locator('.accueil[data-pret]')).toBeAttached();
		await expect(agentDeux.getByText(titre)).toHaveCount(0);
		// Sur le mur, il lit l'événement sans être convoqué : pas de réponse à donner.
		await agentDeux.goto('/echanges/centre');
		await expect(publicationDe(agentDeux, titre)).toContainText('Équipe 1');
		await expect(publicationDe(agentDeux, titre).getByRole('group', { name: 'Votre réponse' })).toHaveCount(0);
		await agentDeux.context().close();
	});

	test('une photo publiée sur le mur de l’équipe 1 s’affiche ; un agent de l’équipe 2 ne peut pas l’ouvrir : 403', async ({ browser }) => {
		const gestion = await pageSuper(browser);
		const un = await nouvelAgent(gestion);
		const deux = await nouvelAgent(gestion, 'Équipe 2');
		await gestion.context().close();

		const page = await pageAgent(browser, un.email);
		await page.goto('/echanges');
		await page
			.getByRole('navigation', { name: 'Murs' })
			.getByRole('link', { name: /^Équipe 1/ })
			.click();
		await expect(page.getByRole('heading', { level: 1, name: 'Équipe 1' })).toBeVisible();
		const texte = `Photo de la manœuvre ${nouvelleMarque()}`;
		await publier(page, { texte, photo: await photoFictive(page) });
		const image = publicationDe(page, texte).getByRole('img', { name: `Photo 1 sur 1, publiée par ${un.nom}` });
		await image.scrollIntoViewIfNeeded();
		await expect.poll(() => image.evaluate((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
		const adresse = (await image.getAttribute('src'))!;
		expect(adresse).toMatch(/^\/echanges\/photo\/\d+$/);
		const lue = await page.request.get(adresse);
		expect(lue.status()).toBe(200);
		expect(lue.headers()['content-type']).toBe('image/jpeg');
		await page.context().close();

		const autre = await pageAgent(browser, deux.email);
		expect((await autre.request.get(adresse)).status()).toBe(403);
		await autre.context().close();
	});

	test('prise de connaissance cochée puis changement de mur : la case masquée ne part pas, l’annonce est publiée', async ({ browser, page }) => {
		const gestion = await pageSuper(browser);
		const { email } = await nouvelAgent(gestion);
		// Chef de l'équipe 1 : il modère son mur d'équipe, pas Vie du centre.
		const carte = await blocDeFiche(gestion, 'Rôles', (b) => b.locator('form[action^="?/attribuer"]'));
		const attribuer = carte.locator('form[action^="?/attribuer"]');
		await attribuer.getByLabel('Responsabilité').selectOption({ label: 'Chef de garde' });
		await attribuer.getByRole('combobox', { name: 'Équipe' }).selectOption({ label: 'Équipe 1' });
		await attribuer.getByRole('button', { name: 'Attribuer' }).click();
		await expect(attribuer.getByRole('status')).toHaveText('Rôle attribué');

		await connecter(page, email);
		await page.goto('/echanges/publier?mur=equipe:1');
		const formulaire = await formulairePret(page);
		await formulaire.getByRole('radio', { name: /^Annonce/ }).check();
		const casePrise = formulaire.getByLabel('Demander une prise de connaissance (annonce)');
		await casePrise.check();
		await formulaire.getByRole('radio', { name: /^Vie du centre/ }).check();
		await expect(casePrise).toBeHidden();
		await expect(casePrise).toBeDisabled();
		const texte = `Annonce ${nouvelleMarque()}`;
		await formulaire.getByLabel('Votre message', { exact: true }).fill(texte);
		await formulaire.getByRole('button', { name: 'Publier dans Vie du centre' }).click();
		await page.waitForURL(/\/echanges\/vie#publication-\d+$/);
		await expect(publicationDe(page, texte)).toBeVisible();

		await carte.getByRole('checkbox', { name: 'Je confirme : terminer Chef de garde — Équipe 1' }).check();
		await carte.getByRole('button', { name: 'Terminer' }).click();
		await expect(carte.getByRole('status').first()).toHaveText('Rôle terminé');
		await gestion.context().close();
	});

	test('les envois du navigateur annoncent leur longueur : la garde de taille les laisse passer', async ({ browser, page }) => {
		const gestion = await pageSuper(browser);
		const { email } = await nouvelAgent(gestion);
		await gestion.context().close();
		const envois: Request[] = [];
		page.on('request', (r) => {
			if (r.method() === 'POST') envois.push(r);
		});
		await connecter(page, email);
		await page.goto('/echanges/vie');
		await publier(page, { texte: `Essai d’envoi ${nouvelleMarque()}`, photo: await photoFictive(page) });
		expect(envois.map((r) => new URL(r.url()).pathname + new URL(r.url()).search)).toEqual(expect.arrayContaining(['/connexion', '/echanges/publier?/publier']));
		for (const r of envois) expect((await r.allHeaders())['content-length'], r.url()).toMatch(/^[1-9]\d*$/);
	});
});

test.describe('échanges à l’ordinateur', () => {
	test.use({ storageState: ETAT_CONNECTE });

	test('sur un mur, « À venir » : à droite à 1280 px, sous le mur à 1100 px (ordre du clavier), absent au téléphone', async ({ browser, page }) => {
		const aVenir = page.getByRole('heading', { level: 2, name: 'À venir' });
		const titre = page.getByRole('heading', { level: 1, name: 'Vie du centre' });
		if (test.info().project.name === 'telephone') {
			await page.goto('/echanges/vie');
			await expect(titre).toBeVisible();
			await expect(aVenir).toBeHidden();
			return;
		}
		// Plus tôt que les événements des autres tests (2099) : il fait partie des 3 prochains.
		const gestion = await pageSuper(browser);
		const marque = nouvelleMarque();
		await gestion.goto('/echanges/centre');
		await publier(gestion, { type: 'Événement', texte: `Manœuvre ${marque}`, debut: '2098-06-01T18:30', lieu: 'Caserne' });
		await gestion.context().close();

		await page.goto('/echanges/vie');
		await expect(page.getByRole('complementary', { name: 'Aujourd’hui' }).getByRole('link', { name: new RegExp(`Manœuvre ${marque}`) })).toBeVisible();
		expect((await aVenir.boundingBox())!.x).toBeGreaterThan((await titre.boundingBox())!.x + 200);
		await page.setViewportSize({ width: 1100, height: 900 });
		const bas = await page.locator('.mur').boundingBox();
		expect((await aVenir.boundingBox())!.y).toBeGreaterThan(bas!.y + bas!.height);
		await sansViolation(page);
	});
});

test.describe('échanges au clavier', () => {
	test.use({ storageState: ETAT_CONNECTE });

	test('publier : un refus met le focus sur le champ fautif, puis « J’aime » se bascule au clavier', async ({ page }) => {
		const texte = `Sortie vélo ${nouvelleMarque()}`;
		await page.goto('/echanges/publier?mur=vie');
		const formulaire = await formulairePret(page);
		const genre = formulaire.getByRole('radio', { name: /^Message/ });
		await genre.focus();
		// Les flèches passent d'un genre à l'autre.
		await page.keyboard.press('ArrowRight');
		await expect(formulaire.getByRole('radio', { name: /^Événement/ })).toBeChecked();
		await expect(formulaire.getByRole('button', { name: 'Publier dans Vie du centre' })).toBeVisible();
		await formulaire.getByLabel('Votre message', { exact: true }).focus();
		await page.keyboard.type(texte);
		const envoyer = formulaire.getByRole('button', { name: 'Publier dans Vie du centre' });
		await envoyer.focus();
		await page.keyboard.press('Enter');
		await expect(formulaire.getByText('Indiquez la date et l’heure.')).toBeVisible();
		await expect(formulaire.getByLabel('Date et heure')).toBeFocused();
		await expect(page.locator('div[role="alert"]')).toHaveText('La publication contient des erreurs.');

		await formulaire.getByLabel('Date et heure').fill('2099-07-14T09:00');
		await formulaire.getByLabel('Lieu', { exact: true }).focus();
		await page.keyboard.type('Parc des sports');
		await envoyer.focus();
		await page.keyboard.press('Enter');
		// Publiée : retour sur le mur, le focus sur la nouvelle publication.
		await page.waitForURL(/\/echanges\/vie#publication-\d+$/);
		await expect(publicationDe(page, texte)).toBeFocused();

		const jaime = publicationDe(page, texte).getByRole('button', { name: /^J’aime/ });
		await expect(jaime).toHaveAttribute('aria-pressed', 'false');
		await jaime.focus();
		await page.keyboard.press('Enter');
		await expect(jaime).toHaveAttribute('aria-pressed', 'true');
		await expect(jaime).toBeFocused();
		await page.keyboard.press('Space');
		await expect(jaime).toHaveAttribute('aria-pressed', 'false');

		// Commenter au clavier : le focus va sur le nouveau commentaire.
		await publicationDe(page, texte).getByRole('link', { name: 'Commenter' }).click();
		const champ = page.getByLabel('Votre commentaire');
		await expect(page.locator('#commenter')).toBeVisible();
		await champ.focus();
		const commentaire = `Je viens ${nouvelleMarque()}`;
		await page.keyboard.type(commentaire);
		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: 'Commenter' })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('div[role="status"]')).toHaveText('Commentaire publié.');
		await expect(page.locator('li', { hasText: commentaire })).toBeFocused();
	});
});

test.describe('agents', () => {
	test('un agent ordinaire n’ouvre pas une fiche : 403', async ({ browser }) => {
		const contexte = await browser.newContext({ storageState: ETAT_CONNECTE });
		const reponse = await (await contexte.newPage()).goto('/agents/1');
		expect(reponse!.status()).toBe(403);
		await contexte.close();
	});

	test('filtrer « À compléter » puis ouvrir une fiche : le filtre reste', async ({ browser }) => {
		const page = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		// Sans grade ni date d'entrée, l'agent neuf est à compléter.
		const { nom } = await nouvelAgent(page);
		await page.goto('/agents');
		const filtre = page.getByRole('button', { name: /^À compléter/ });
		await filtre.click();
		await expect(page).toHaveURL(/[?&]filtre=a-completer/);
		await expect(filtre).toHaveAttribute('aria-pressed', 'true');
		await page.getByRole('link', { name: nom, exact: true }).click();
		await expect(page).toHaveURL(/\/agents\/\d+\?.*filtre=a-completer/);
		await expect(page.getByRole('heading', { level: 1, name: nom })).toBeVisible();
		// Sur téléphone, la liste est cachée derrière la fiche : le filtre y reste choisi.
		await expect(page.getByRole('button', { name: /^À compléter/, includeHidden: true })).toHaveAttribute('aria-pressed', 'true');
		await page.context().close();
	});

	test('filtrer « À compléter », enregistrer une fiche : le filtre reste, l’agent suivant s’ouvre', async ({ browser }, testInfo) => {
		const page = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		const premier = await nouvelAgent(page);
		const second = await nouvelAgent(page);
		await page.goto('/agents?filtre=a-completer');
		await page.getByRole('link', { name: premier.nom, exact: true }).click();
		await expect(page.getByRole('heading', { level: 1, name: premier.nom })).toBeVisible();
		const bloc = await blocDeFiche(page, 'Identité et contact', (b) => b.getByLabel('Téléphone', { exact: true }));
		await bloc.getByLabel('Téléphone', { exact: true }).fill('06 00 00 00 01');
		await bloc.getByRole('button', { name: 'Enregistrer' }).click();
		await expect(page.getByText('Fiche enregistrée')).toBeVisible();
		await expect(page).toHaveURL(/filtre=a-completer/);
		await expect(page.getByRole('button', { name: /^À compléter/, includeHidden: true })).toHaveAttribute('aria-pressed', 'true');
		// Sur téléphone, la liste est derrière la fiche : « ‹ Agents » la rend, filtrée.
		if (testInfo.project.name === 'telephone') {
			await page.getByRole('link', { name: 'Retour : Agents' }).click();
			await expect(page).toHaveURL(/\/agents\?filtre=a-completer$/);
		} else {
			await expect(page.getByRole('link', { name: 'Retour : Agents' })).toBeHidden();
		}
		await expect(page.getByRole('button', { name: /^À compléter/ })).toHaveAttribute('aria-pressed', 'true');
		await page.getByRole('link', { name: second.nom, exact: true }).click();
		await expect(page.getByRole('heading', { level: 1, name: second.nom })).toBeVisible();
		await expect(page).toHaveURL(/\/agents\/\d+\?filtre=a-completer$/);
		await page.context().close();
	});

	test('la fiche au clavier : un bloc s’ouvre (Entrée) et se ferme (Espace)', async ({ browser }) => {
		const page = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		await page.goto(await ficheDe(page, 'Alice Martin'));
		const bouton = page.getByRole('button', { name: /^Identité et contact/ });
		const champ = page.locator('section').filter({ has: bouton }).getByRole('textbox').first();
		await expect(champ).toBeHidden();
		// Tant que la page n'est pas prête, Entrée ne fait rien : on recommence.
		await expect(async () => {
			await bouton.focus();
			if ((await bouton.getAttribute('aria-expanded')) === 'false') await page.keyboard.press('Enter');
			await expect(bouton).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
		}).toPass();
		await expect(champ).toBeVisible();
		await page.keyboard.press('Space');
		await expect(bouton).toHaveAttribute('aria-expanded', 'false');
		await expect(champ).toBeHidden();
		await page.context().close();
	});

	test('le super administrateur ajoute un agent, puis le déclare parti : il quitte la vue des agents', async ({ browser }) => {
		const gestion = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		const agent = await (await browser.newContext({ storageState: ETAT_CONNECTE })).newPage();
		const { nom } = await nouvelAgent(gestion);

		await gestion.goto(await ficheDe(gestion, nom));
		await agent.goto('/agents');
		await expect(agent.getByText(nom)).toBeVisible();

		const depart = await blocDeFiche(gestion, 'Départ du centre', (b) => b.getByLabel('Je confirme'));
		await depart.getByLabel('Je confirme').check();
		await depart.getByRole('button', { name: 'Déclarer le départ' }).click();
		await expect(gestion.getByText('Statut enregistré')).toBeVisible();
		// Le statut s'affiche dans l'en-tête de la fiche (sur ordinateur, la liste a aussi son titre).
		await expect(gestion.locator('header', { has: gestion.getByRole('heading', { level: 1, name: nom }) })).toContainText('Parti');

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
		const carte = await blocDeFiche(gestion, 'Rôles', (b) => b.locator('form[action^="?/attribuer"]'));
		const formulaire = carte.locator('form[action^="?/attribuer"]');

		// Le rôle d'équipe fait apparaître le choix de l'équipe.
		await formulaire.getByLabel('Responsabilité').selectOption({ label: 'Chef de garde' });
		await expect(formulaire.getByRole('combobox', { name: 'Équipe' })).toBeVisible();
		await expect(formulaire.getByLabel('Responsabilité').locator('option:checked')).toHaveText('Chef de garde');
		await formulaire.getByRole('combobox', { name: 'Équipe' }).selectOption({ label: 'Équipe 1' });
		await formulaire.getByRole('button', { name: 'Attribuer' }).click();
		await expect(formulaire.getByRole('status')).toHaveText('Rôle attribué');
		// Dans la liste du bloc (le résumé du bloc porte le même nom).
		await expect(carte.getByRole('list').getByText('Chef de garde — Équipe 1', { exact: true })).toBeVisible();

		await agent.goto('/agents');
		await expect(agent.getByRole('listitem').filter({ hasText: nom })).toContainText('Rôles : Chef de garde (Équipe 1)');

		// Changer la date de fin : le rôle reste, avec sa nouvelle fin.
		await carte.getByLabel('Nouvelle date de fin : Chef de garde — Équipe 1').fill('2099-12-31');
		await carte.getByRole('button', { name: 'Changer la date de fin' }).click();
		await expect(carte.getByRole('status').first()).toHaveText('Date de fin enregistrée');
		await expect(carte.getByText('au 31/12/2099')).toBeVisible();

		await carte.getByRole('checkbox', { name: 'Je confirme : terminer Chef de garde — Équipe 1' }).check();
		await carte.getByRole('button', { name: 'Terminer' }).click();
		await expect(carte.getByRole('status').first()).toHaveText('Rôle terminé');
		await expect(carte.getByText('Aucune responsabilité en cours.')).toBeVisible();

		await agent.reload();
		await expect(agent.getByRole('listitem').filter({ hasText: nom })).not.toContainText('Rôles');
		await gestion.context().close();
		await agent.context().close();
	});

	test('/nominations au clavier : volet « Nommer » (ordre de Tab, Échap, refus), nommer puis retirer', async ({ browser }) => {
		const page = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		const { nom } = await nouvelAgent(page);
		await page.goto('/nominations');
		await page.waitForLoadState('networkidle');
		const carte = carteRole(page, 'Référent technique');
		const ouvrir = carte.getByRole('button', { name: 'Nommer', exact: true });
		const volet = page.getByRole('dialog', { name: 'Nommer : Référent technique' });
		const agent = volet.getByLabel('Agent', { exact: true });
		const valider = volet.getByRole('button', { name: 'Nommer' });

		// Le volet prend le focus ; Tab passe par l'agent, les dates, « Nommer », « Annuler » ; Échap ferme et rend le focus.
		await ouvrir.focus();
		await page.keyboard.press('Enter');
		await expect(agent).toBeFocused();
		await expect(volet.getByLabel('Début', { exact: true })).toBeHidden();
		await page.keyboard.press('Tab');
		await expect(volet.getByText('Changer les dates', { exact: true })).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(valider).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(volet.getByRole('button', { name: 'Annuler' })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(volet).toHaveCount(0);
		await expect(ouvrir).toBeFocused();

		// Refus du serveur : l'erreur dans le volet, le focus sur le champ fautif.
		await page.keyboard.press('Enter');
		await expect(agent).toBeFocused();
		await volet.getByText('Changer les dates', { exact: true }).press('Enter');
		await volet.getByLabel('Fin', { exact: true }).fill('2099-12-31');
		await valider.press('Enter');
		await expect(volet.getByText('Choisissez un agent.')).toBeVisible();
		await expect(agent).toBeFocused();
		// Refermé puis rouvert, le volet repart à neuf.
		await page.keyboard.press('Escape');
		await expect(ouvrir).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(agent).toBeFocused();
		await expect(volet.getByText('Choisissez un agent.')).toHaveCount(0);
		await expect(volet.getByRole('alert')).toHaveText('');
		await expect(volet.getByLabel('Fin', { exact: true })).toHaveValue('');

		// Nommer : le volet se ferme, le focus revient sur « Nommer ».
		await agent.selectOption({ label: `${nom} (Équipe 1)` });
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');
		await expect(valider).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(carte.getByRole('status')).toHaveText('Rôle attribué');
		await expect(volet).toHaveCount(0);
		await expect(ouvrir).toBeFocused();

		// Retirer : la question prend le focus, « Annuler » le rend à la pastille, puis on confirme.
		const pastille = carte.getByRole('button', { name: `Retirer ${nom}` });
		await pastille.focus();
		await page.keyboard.press('Enter');
		await expect(page.locator(':focus')).toContainText(`Retirer ${nom} ?`);
		await carte.getByRole('button', { name: 'Annuler' }).press('Enter');
		await expect(pastille).toBeFocused();
		await page.keyboard.press('Enter');
		await page.keyboard.press('Tab');
		await expect(carte.getByRole('button', { name: 'Confirmer le retrait' })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(carte.getByRole('status')).toHaveText('Rôle terminé');
		await expect(pastille).toHaveCount(0);

		// La recherche d'un agent ne garde que ses rôles.
		await nommer(page, 'Référent pharmacie', nom);
		await page.getByLabel('Rechercher un rôle ou un agent').fill(nom);
		await expect(page.locator('section.role h2')).toHaveText(['Référent pharmacie']);
		await page.context().close();
	});
});

test.describe('réglages', () => {
	test('un agent ordinaire n’ouvre pas les réglages : 403', async ({ browser }) => {
		const contexte = await browser.newContext({ storageState: ETAT_CONNECTE });
		const reponse = await (await contexte.newPage()).goto('/reglages');
		expect(reponse!.status()).toBe(403);
		await contexte.close();
	});

	test('le super administrateur crée un comité, puis un rôle qu’il attribue, règle un domaine, puis dissout le comité : le chef de centre attribue', async ({ browser }) => {
		const page = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		const marque = nouvelleMarque();
		const comite = `Comité sport ${marque}`;
		const role = `Référent sport ${marque}`;

		await page.goto('/reglages');
		await page.getByRole('link', { name: 'Nouveau comité' }).click();
		await page.getByLabel('Nom', { exact: true }).fill(comite);
		await page.getByLabel('Thème').fill('sport');
		await page.getByRole('button', { name: 'Créer le comité' }).click();
		await expect(page).toHaveURL(/\/reglages\/comites\/\d+$/);
		await expect(page.getByRole('heading', { level: 1, name: comite })).toBeVisible();
		const pageComite = page.url();

		await page.goto('/reglages/roles/nouveau');
		await page.getByRole('link', { name: /Vierge/ }).click();
		await page.getByLabel('Nom', { exact: true }).fill(role);
		await page.getByLabel('Portée').selectOption({ label: 'Tout le centre' });
		await page.getByLabel('Qui attribue').selectOption({ label: `Le comité « ${comite} »` });
		await page.getByRole('radio', { name: 'Ballon' }).check();
		await page.getByRole('button', { name: 'Créer le rôle' }).click();
		await expect(page).toHaveURL(/\/reglages\/roles\/\d+$/);
		await expect(page.getByRole('heading', { level: 1, name: role })).toBeVisible();
		await expect(page.getByText(`nommé par le comité « ${comite} »`)).toBeVisible();

		// Un domaine changé : la barre le dit avant l'enregistrement.
		const { groupe: stock } = await domaineOuvert(page, 'Stock et pharmacie');
		await stock.getByRole('radio', { name: 'Gérer' }).check();
		await expect(page.getByText('1 domaine modifié, pas encore enregistré')).toBeVisible();
		await expect(page.locator('main .en-tete-role').getByText('Personnalisé', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
		await expect(page.getByText(`Le rôle « ${role} » est enregistré.`)).toBeVisible();
		const pageRole = page.url();

		await page.goto(pageComite);
		await page.locator('summary', { hasText: 'Dissoudre le comité' }).click();
		await page.getByLabel('Je confirme').check();
		await page.getByRole('button', { name: 'Dissoudre le comité' }).click();
		await expect(page.getByText('Le comité est dissous.')).toBeVisible();
		await page.goto(pageRole);
		await expect(page.getByText('nommé par le chef de centre')).toBeVisible();
		await page.context().close();
	});

	test('le super administrateur crée « Référent pharmacie » depuis son modèle, s’en écarte, revient au modèle et enregistre', async ({ browser }) => {
		const page = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		// Le jeu de départ a déjà un « Référent pharmacie » : les noms sont uniques.
		const role = `Référent pharmacie ${nouvelleMarque()}`;
		const entete = page.locator('main .en-tete-role');
		const barre = barreDe(page);

		await page.goto('/reglages');
		await page.getByRole('link', { name: 'Nouveau rôle' }).click();
		await page.getByRole('link', { name: /^Référent pharmacie.*Stock et pharmacie/ }).click();
		await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Référent pharmacie');
		await page.getByLabel('Nom', { exact: true }).fill(role);
		await page.getByRole('button', { name: 'Créer le rôle' }).click();
		await expect(page).toHaveURL(/\/reglages\/roles\/\d+$/);
		await expect(page.getByRole('heading', { level: 1, name: role })).toBeVisible();
		await expect(entete.getByText('Modèle : Référent pharmacie')).toBeVisible();
		await expect(entete.getByText('Personnalisé', { exact: true })).toHaveCount(0);

		const { groupe: stock } = await domaineOuvert(page, 'Stock et pharmacie');
		await expect(stock.getByRole('radio', { name: 'Gérer' })).toBeChecked();
		await stock.getByRole('radio', { name: 'Rien de plus' }).check();
		await expect(barre).toHaveText('1 domaine modifié, pas encore enregistré');
		await expect(entete.getByText('Personnalisé', { exact: true })).toBeVisible();

		await stock.getByRole('button', { name: /Revenir au modèle \(Gérer\)/ }).click();
		await expect(stock.getByRole('radio', { name: 'Gérer' })).toBeChecked();
		await expect(barre).toHaveText('');
		await expect(entete.getByText('Personnalisé', { exact: true })).toHaveCount(0);
		await expect(stock.getByRole('button', { name: /Revenir au modèle/ })).toHaveCount(0);

		await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
		await expect(page.getByText(`Le rôle « ${role} » est enregistré.`)).toBeVisible();
		await page.reload();
		await expect(entete.getByText('Modèle : Référent pharmacie')).toBeVisible();
		await expect(entete.getByText('Personnalisé', { exact: true })).toHaveCount(0);
		await page.context().close();
	});

	test('au clavier : un groupe s’ouvre et se ferme (Entrée, Espace), les flèches changent de niveau et la barre le dit', async ({ browser }) => {
		const page = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		// Rien n'est enregistré : le rôle du jeu de départ reste tel quel.
		await page.goto(`/reglages/roles/${await idReglage(page, 'roles', 'Référent engins')}`);
		const { bouton: boutonStock, groupe: stock } = await domaineOuvert(page, 'Stock et pharmacie');
		const barre = barreDe(page);

		// Groupe : du domaine Messagerie, Tab mène au bouton « Administration de l'appli » (après les niveaux si le domaine est ouvert).
		const messagerie = page.getByRole('button', { name: /^Messagerie/ });
		const admin = page.getByRole('button', { name: /^Administration de l’appli/ });
		const caseAcces = page.getByRole('checkbox', { name: 'Gérer les accès' });
		await messagerie.focus();
		if ((await messagerie.getAttribute('aria-expanded')) === 'true') await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');
		await expect(admin).toBeFocused();
		await expect(admin).toHaveAttribute('aria-expanded', 'false');
		await expect(caseAcces).toBeHidden();
		await page.keyboard.press('Enter');
		await expect(admin).toHaveAttribute('aria-expanded', 'true');
		await expect(caseAcces).toBeVisible();
		await page.keyboard.press('Space');
		await expect(admin).toHaveAttribute('aria-expanded', 'false');
		await expect(caseAcces).toBeHidden();
		await page.keyboard.press('Space');
		await expect(admin).toHaveAttribute('aria-expanded', 'true');

		// Niveaux : Tab entre dans le groupe sur le niveau choisi, les flèches changent le choix.
		await boutonStock.focus();
		await page.keyboard.press('Tab');
		await expect(stock.getByRole('radio', { name: 'Rien de plus' })).toBeFocused();
		await page.keyboard.press('ArrowRight');
		await expect(stock.getByRole('radio', { name: 'Gérer' })).toBeFocused();
		await expect(stock.getByRole('radio', { name: 'Gérer' })).toBeChecked();
		await expect(barre).toHaveText('1 domaine modifié, pas encore enregistré');
		await expect(boutonStock).toHaveAccessibleName(/Gérer · modifié/);

		const boutonEngins = page.getByRole('button', { name: /^Engins et anomalies/ });
		const engins = page.locator('main section').filter({ has: boutonEngins });
		await boutonEngins.focus();
		if ((await boutonEngins.getAttribute('aria-expanded')) === 'false') await page.keyboard.press('Enter');
		await page.keyboard.press('Tab');
		await expect(engins.getByRole('radio', { name: 'Gérer' })).toBeFocused();
		await page.keyboard.press('ArrowLeft');
		await expect(engins.getByRole('radio', { name: 'Rien de plus' })).toBeChecked();
		await expect(barre).toHaveText('2 domaines modifiés, pas encore enregistrés');

		// Revenir au niveau de départ efface le message.
		await page.keyboard.press('ArrowRight');
		await boutonStock.focus();
		await page.keyboard.press('Tab');
		await page.keyboard.press('ArrowLeft');
		await expect(stock.getByRole('radio', { name: 'Rien de plus' })).toBeChecked();
		await expect(barre).toHaveText('');
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

		const marque = nouvelleMarque();
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
		await expect(page.getByRole('link', { name: `Yanis Import${marque}`, exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: `Zoe Import${marque}`, exact: true })).toBeVisible();

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
		await expect(astreinte).toHaveAttribute('aria-current', 'true');
		await expect(pharmacie).not.toHaveAttribute('aria-current');
		await sansViolation(page);

		await astreinte.focus();
		await page.keyboard.press('Tab');
		await expect(pharmacie).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/[?&]casquette=role/);
		await expect(pharmacie).toHaveAttribute('aria-current', 'true');
		await expect(astreinte).not.toHaveAttribute('aria-current');
		await expect(page.getByRole('heading', { level: 2, name: 'Ce que ce rôle permet' })).toBeVisible();
	});

	test('cinq casquettes : la rangée défile seule, la page ne déborde pas, chacune s’atteint au clavier', async ({ browser, page }) => {
		const gestion = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		const agent = await nouvelAgent(gestion);
		await gestion.goto('/nominations');
		for (const role of ['Chef de garde', 'Référent engins', 'Référent pharmacie', 'Membre de comité']) await nommer(gestion, role, agent.nom);
		await gestion.context().close();

		await connecter(page, agent.email);
		const liens = page.getByRole('navigation', { name: 'Casquettes' }).getByRole('link');
		await expect(liens).toHaveText([/Chef de garde · Équipe 1/, /Mon astreinte/, /Référent engins/, /Référent pharmacie/, /Amicale/]);
		expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

		await liens.first().focus();
		for (let i = 0; i < 5; i++) {
			if (i > 0) await page.keyboard.press('Tab');
			await expect(liens.nth(i)).toBeFocused();
			await expect(liens.nth(i)).toBeInViewport();
		}
		await page.keyboard.press('Enter');
		await expect(liens.nth(4)).toHaveAttribute('aria-current', 'true');
		await expect(page.getByRole('heading', { level: 2, name: 'Membres' })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
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
