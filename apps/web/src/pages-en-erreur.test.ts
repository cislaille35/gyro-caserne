import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nomDePage, releverPages, type Demander } from '../scripts/pages-en-erreur.ts';

// Le résumé du relevé est public : des noms génériques de pages et des nombres, jamais un identifiant, un jeton ou un paramètre.
describe('nomDePage', () => {
	it('lit la ligne écrite par l’appli', () => {
		expect(nomDePage('Page GET /agents/[id]')).toBe('GET /agents/[id]');
		expect(nomDePage('Page POST /echanges?/souhaiter')).toBe('POST /echanges?/souhaiter');
		expect(nomDePage('Page POST /echanges/[mur]?/(inconnue)')).toBe('POST /echanges/[mur]?/(inconnue)');
		expect(nomDePage('Page GET /api/auth')).toBe('GET /api/auth');
		expect(nomDePage('Page GET (aucune)')).toBe('GET (aucune)');
		expect(nomDePage('Page réveil')).toBe('réveil');
		expect(nomDePage('Page ménage de la nuit')).toBe('ménage de la nuit');
	});

	it('lit toutes les pages de l’appli', () => {
		const routes = fileURLToPath(new URL('routes', import.meta.url));
		const modeles = readdirSync(routes, { recursive: true, withFileTypes: true })
			.filter((f) => /^\+(page|server)\.(ts|svelte)$/.test(f.name))
			.map((f) => f.parentPath.slice(routes.length) || '/');
		expect(modeles.length).toBeGreaterThan(50);
		for (const modele of modeles) expect(nomDePage(`Page POST ${modele}?/envoyer`)).toBe(`POST ${modele}?/envoyer`);
	});

	it('ne laisse passer rien d’autre', () => {
		for (const message of ['Page GET /agents/42?courriel=alice@exemple.fr', 'Page GET /x y', 'Page JETON /', 'Page GET /a?/b c', 'Erreur imprévue /x', 42, undefined])
			expect(nomDePage(message)).toBe('(illisible)');
	});
});

type Corps = Parameters<Demander>[0];
const cle = (corps: Corps) => corps.parameters.filters[1]!.key;
// Une réponse de l'API : des groupes (clé → valeur) et leur nombre.
const reponse = (groupes: Record<string, string>[]) => ({
	statut: 200,
	corps: { success: true, result: { calculations: [{ aggregates: groupes.map((g) => ({ count: 1, groups: Object.entries(g).map(([key, value]) => ({ key, value })) })) }] } }
});
const id = (requestId: string) => ({ '$metadata.requestId': requestId });
const page = (requestId: string, message: string) => ({ '$metadata.requestId': requestId, '$metadata.message': message });

describe('releverPages', () => {
	const jour = '2026-11-14';
	// r1 coupée sur /agents/[id], r2 en erreur 500 sur /agents/[id], r3 erreur imprévue sur /planning, r4 coupée sans ligne, r5 coupée au réveil.
	const journal = (corps: Corps) => {
		switch (cle(corps)) {
			case '$workers.outcome':
				return reponse([id('r1'), id('r4'), id('r5')]);
			case '$workers.event.response.status':
				return reponse([id('r2'), id('r3')]);
			case '$metadata.message':
				if ((corps.parameters.filters[1]!.value as string).startsWith('Erreur')) return reponse([id('r3')]);
				return reponse([page('r1', 'Page GET /agents/[id]'), page('r2', 'Page POST /agents/[id]?/aptitude'), page('r3', 'Page GET /planning'), page('r5', 'Page réveil'), page('r9', 'Page GET /moi')]);
		}
		throw new Error('requête inattendue');
	};

	it('rattache coupures et erreurs à la page de leur requête', async () => {
		const demander = vi.fn(async (corps: Corps) => journal(corps));
		const texte = (await releverPages(['gyro-caserne-laille'], jour, demander)).join('\n');
		expect(texte).toContain('| GET /agents/[id] | 1 | 0 |');
		expect(texte).toContain('| POST /agents/[id]?/aptitude | 0 | 1 |');
		expect(texte).toContain('| GET /planning | 0 | 1 |');
		expect(texte).toContain('| réveil | 1 | 0 |');
		expect(texte).toContain('| (sans nom de page) | 1 | 0 |');
		// Une page sans coupure ni erreur n'est pas citée ; aucun identifiant de requête dans le résumé.
		expect(texte).not.toMatch(/\/moi|r\d/);
		// La veille, de minuit à minuit (UTC), pour ce Worker.
		const corps = demander.mock.calls[0]![0];
		expect(corps.timeframe).toEqual({ from: Date.parse('2026-11-14T00:00:00Z'), to: Date.parse('2026-11-15T00:00:00Z') });
		expect(corps.parameters.filters[0]).toEqual({ key: '$metadata.service', operation: 'eq', type: 'string', value: 'gyro-caserne-laille' });
	});

	it('ne demande pas les pages quand rien n’est en cause, et le dit', async () => {
		const demander = vi.fn(async () => reponse([]));
		const lignes = await releverPages(['gyro-caserne-exemple'], jour, demander);
		expect(lignes.join('\n')).toContain('aucune coupure ni erreur au journal');
		expect(demander).toHaveBeenCalledTimes(3);
	});

	it('prévient quand la liste des pages est tronquée', async () => {
		const demander = async (corps: Corps) => (corps.parameters.groupBys.length === 2 ? reponse(Array.from({ length: 2000 }, (_, i) => page(`p${i}`, 'Page GET /'))) : reponse([id('r1')]));
		expect((await releverPages(['gyro-caserne-exemple'], jour, demander)).join('\n')).toContain('Plus de 2000 requêtes');
	});

	it('ne fait pas échouer le relevé sans le droit de lire le journal : il le dit', async () => {
		const lignes = await releverPages(['gyro-caserne-exemple'], jour, async () => ({ statut: 403, corps: { success: false, errors: [{ code: 10000, message: 'Authentication error' }] } }));
		expect(lignes.join('\n')).toContain('Workers Observability');
	});

	it('ne fait pas échouer le relevé si Cloudflare ne répond pas', async () => {
		const lignes = await releverPages(['gyro-caserne-exemple'], jour, async () => {
			throw new Error('réseau');
		});
		expect(lignes.join('\n')).toContain('indisponible');
	});
});

describe('relevé quotidien', () => {
	const texte = readFileSync(fileURLToPath(new URL('../../../.github/workflows/releve-coupures.yml', import.meta.url)), 'utf8');

	it('ajoute les pages en cause même un jour de coupures, sans jamais échouer pour elles', () => {
		const etape = texte.slice(texte.indexOf('- name: Pages en cause'));
		const ajout = texte.slice(texte.indexOf('# Même en cas de coupures'));
		// Chacune des trois étapes ajoutées (checkout, Node, relevé) : après des coupures, et sans pouvoir faire échouer le relevé.
		expect(ajout.match(/if: \$\{\{ !cancelled\(\) \}\}\n\s+continue-on-error: true/g)).toHaveLength(3);
		expect(etape).toMatch(/pages-en-erreur\.ts \| tee -a "\$GITHUB_STEP_SUMMARY" \|\| echo "::warning::/);
	});
});
