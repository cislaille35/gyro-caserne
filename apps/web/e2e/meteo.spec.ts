import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import exemple from '../../../centres/exemple/centre.ts';
import { soleilCouche } from '../src/lib/gyro/soleil.ts';
import { ADRESSE, ETAT_CONNECTE } from './serveur.ts';

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));

// Des relevés fictifs, écrits dans la base locale comme le ferait la tâche planifiée : averses, vigilance orange aujourd'hui, rouge demain.
function releves() {
	const paris = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(' ', 'T');
	const jour = paris.slice(0, 10);
	const demain = new Date(Date.parse(`${jour}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
	const meteo = JSON.stringify({ temperature: 11.6, code: 80, rafales: 45 });
	const vigilance = JSON.stringify({ jours: [{ date: jour, niveau: 3, phenomenes: ['orages'] }, { date: demain, niveau: 4, phenomenes: ['vent violent'] }], rouge: true });
	executer(`INSERT OR REPLACE INTO releve (cle, donnees, maj_le) VALUES ('meteo', '${meteo}', '${paris}'), ('vigilance', '${vigilance}', '${paris}');`);
}

// En cas d'échec, l'erreur porte les deux sorties de Wrangler (un échec à la CI, novembre 2026, sans qu'on puisse en lire la cause).
function executer(sql: string) {
	try {
		execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, '--command', sql], { cwd: appli, stdio: 'pipe' });
	} catch (e) {
		const { status, stdout, stderr } = e as { status: number | null; stdout?: Buffer; stderr?: Buffer };
		throw new Error(`Wrangler d1 execute, statut ${status} :\n${String(stdout ?? '')}\n${String(stderr ?? '')}`);
	}
}

test.describe('météo et vigilance', () => {
	test.use({ storageState: ETAT_CONNECTE });
	test.beforeEach(releves);
	// Les autres tests de l'Accueil retrouvent un Accueil sans météo.
	test.afterAll(() => executer('DELETE FROM releve;'));

	for (const theme of ['auto', 'sombre']) {
		test(`accueil, thème ${theme} : ligne météo, mention Open-Meteo, bandeau de vigilance, sans violation`, async ({ context, page }) => {
			await context.addCookies([{ name: 'theme', value: theme, url: ADRESSE }]);
			await page.goto('/');
			const bandeau = page.getByRole('region', { name: 'Vigilance météo' });
			await expect(bandeau).toContainText('Vigilance orange orages, aujourd’hui');
			await expect(bandeau).toContainText('Vigilance rouge vent violent, demain');
			await expect(bandeau.getByRole('link', { name: /vigilance\.meteofrance\.fr/ })).toBeVisible();
			await expect(page.getByText('12 °C, averses, rafales 45 km/h')).toBeVisible();
			await expect(page.getByRole('link', { name: 'Météo : Open-Meteo' })).toBeVisible();
			const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
			expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
		});
	}

	// La vigilance discrète (verte, jaune) et « indisponible » : sans violation dans les deux thèmes.
	const jourParis = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date());
	const ancien = '2020-01-01T00:00';
	for (const [nom, niveau, texte, majLe] of [
		['verte', 1, 'Vigilance verte · Ille-et-Vilaine', null],
		['jaune', 2, 'Vigilance jaune orages, aujourd’hui · Ille-et-Vilaine', null],
		['indisponible', 1, 'Vigilance indisponible, voir Météo-France', ancien]
	] as const) {
		for (const theme of ['auto', 'sombre']) {
			test(`vigilance ${nom}, thème ${theme} : une ligne discrète avec le lien, sans violation`, async ({ context, page }) => {
				const paris = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(' ', 'T');
				const donnees = JSON.stringify({ jours: [{ date: jourParis(), niveau, phenomenes: niveau === 2 ? ['orages'] : [] }], rouge: false });
				executer(`UPDATE releve SET donnees = '${donnees}', maj_le = '${majLe ?? paris}' WHERE cle = 'vigilance';`);
				await context.addCookies([{ name: 'theme', value: theme, url: ADRESSE }]);
				await page.goto('/');
				await expect(page.getByRole('region', { name: 'Vigilance météo' })).toHaveCount(0);
				await expect(page.getByRole('link', { name: texte })).toHaveAttribute('href', 'https://vigilance.meteofrance.fr/');
				// Parité : la ligne se voit autant au téléphone qu'à l'ordinateur.
				await expect(page.getByRole('link', { name: texte })).toBeVisible();
				expect(parseFloat(await page.getByRole('link', { name: texte }).evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(15);
				const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
				expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
			});
		}
	}

	// Les ambiances claires (brouillard, gel) passent derrière le texte : contraste vérifié en thème sombre.
	for (const [ambiance, temps] of [['brouillard', { temperature: 6, code: 45, rafales: 10 }], ['gel', { temperature: -3, code: 0, rafales: 10 }]] as const) {
		test(`ambiance ${ambiance}, thème sombre : sans violation`, async ({ context, page }) => {
			executer(`UPDATE releve SET donnees = '${JSON.stringify(temps)}' WHERE cle = 'meteo';`);
			await context.addCookies([{ name: 'theme', value: 'sombre', url: ADRESSE }]);
			await page.goto('/');
			await expect(page.locator(`.meteo.m-${ambiance}`)).toHaveCount(1);
			const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
			expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
		});
	}

	test('ciel dégagé : le soleil seulement s’il est levé au centre, quoi que dise le relevé', async ({ page }) => {
		// Le soleil se calcule à l'heure de la page (le relevé, relu toutes les heures, peut retarder). Les heures fixées sont dans page.test.ts.
		const leve = (decalage: number) => !soleilCouche(new Date(Date.now() + decalage), exemple.position);
		test.skip(leve(-5 * 60_000) !== leve(5 * 60_000), 'à cinq minutes du lever ou du coucher');
		const clair = (nuit: boolean) => executer(`UPDATE releve SET donnees = '${JSON.stringify({ temperature: 12, code: 0, rafales: 10, nuit })}' WHERE cle = 'meteo';`);
		for (const nuit of [false, true]) {
			clair(nuit);
			await page.goto('/');
			await expect(page.locator('.meteo.m-clair')).toHaveCount(1);
			await expect(page.locator('.meteo.m-clair .soleil')).toHaveCount(leve(0) ? 1 : 0);
		}
	});

	test('affichage Sobre : pas d’ambiance animée, la météo reste écrite', async ({ context, page }) => {
		await context.addCookies([{ name: 'niveau', value: 'sobre', url: ADRESSE }]);
		await page.goto('/');
		await expect(page.getByText('12 °C, averses, rafales 45 km/h')).toBeVisible();
		await expect(page.locator('.meteo.m-pluie')).toHaveCount(0);
	});

	test('« réduire les animations » : l’ambiance reste immobile', async ({ browser }) => {
		const context = await browser.newContext({ storageState: ETAT_CONNECTE, reducedMotion: 'reduce' });
		const page = await context.newPage();
		await page.goto('/');
		await expect(page.locator('.m-pluie .goutte').first()).toBeHidden();
		await context.close();
	});
});
