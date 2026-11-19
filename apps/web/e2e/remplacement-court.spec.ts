import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import exemple from '../../../centres/exemple/centre.ts';
import { connecter } from './connexion.ts';

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

// La semaine en cours et la suivante (leur jour de relève, « AAAA-MM-JJ »), à l'heure de Paris.
// Les deux : quelle que soit l'heure, Alice a une plage de 2 h libre aujourd'hui (le vendredi avant la relève, c'est la suivante).
function semainesEnJeu(): string[] {
	const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
	const paris = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(' ', 'T');
	const jour = Date.parse(`${paris.slice(0, 10)}T00:00:00Z`);
	const rang = (new Date(jour).getUTCDay() + 6) % 7;
	let ecart = (rang - JOURS.indexOf(exemple.astreinte.debut.jour) + 7) % 7;
	if (ecart === 0 && paris.slice(11, 16) < exemple.astreinte.debut.heure) ecart = 7;
	const releve = jour - ecart * 86_400_000;
	return [releve, releve + 7 * 86_400_000].map((t) => new Date(t).toISOString().slice(0, 10));
}

// Alice (équipe 1) demande 2 h de son astreinte du jour ; Chloé (équipe 3) accepte ; le planning montre la seule plage.
// L'équipe 1 est mise d'astreinte cette semaine et la suivante, le temps du test ; tout est remis en place après.
test.describe.serial('remplacement court', () => {
	const semaines = semainesEnJeu();
	test.beforeAll(({}, info) => {
		if (info.project.name !== 'telephone') return;
		executer(`INSERT OR REPLACE INTO semaine_changee (debut, equipe_id) VALUES ${semaines.map((s) => `('${s}', (SELECT id FROM equipe WHERE nom = 'Équipe 1'))`).join(', ')};`);
	});
	// Les autres tests (remplacements, planning) retrouvent le roulement et les demandes du jeu de départ.
	test.afterAll(({}, info) => {
		if (info.project.name !== 'telephone') return;
		executer(`DELETE FROM semaine_changee WHERE debut IN (${semaines.map((s) => `'${s}'`).join(', ')}); DELETE FROM demande_remplacement WHERE court = 1;`);
	});

	test('demander 2 h, un collègue accepte, le planning montre la plage', async ({ page, browser }, info) => {
		test.skip(info.project.name !== 'telephone', 'Un seul parcours, au téléphone.');
		test.setTimeout(180_000);
		await connecter(page, 'alice.martin@exemple.fr');
		await page.goto('/remplacements/court');
		await expect(page.getByRole('heading', { level: 1, name: 'Quelques heures' })).toBeVisible();
		await sansViolation(page);
		await page.getByLabel('2 h').check();
		const phrase = (await page.getByText(/^Remplacement de .* ouvert à tous les disponibles\.$/).textContent()) ?? '';
		const plage = phrase.match(/de (\d+ h(?: \d+)?) à (\d+ h(?: \d+)?|minuit)/)!;
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

		// Alice voit son remplaçant ; elle peut le refuser jusqu'au début.
		await page.reload();
		await expect(page.getByRole('heading', { level: 2, name: 'Remplacé par Chloé Durand' })).toBeVisible();
		await page.getByText('Refuser ce remplaçant').click();
		await expect(page.getByRole('button', { name: 'Je confirme : refuser ce remplaçant' })).toBeVisible();
		await sansViolation(page);
	});
});
