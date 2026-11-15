import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cheminGenerique, regrouper, releverPages } from '../scripts/pages-en-erreur.ts';

// Le résumé du relevé est public : des chemins génériques et des nombres, jamais un identifiant, un jeton ou un paramètre.
describe('cheminGenerique', () => {
	it('remplace les identifiants et les jetons par :id', () => {
		expect(cheminGenerique('/agents/123')).toBe('/agents/:id');
		expect(cheminGenerique('/echanges/messages/42/photo/7')).toBe('/echanges/messages/:id/photo/:id');
		expect(cheminGenerique('/agenda/ZxkQmPvRtLwBnCaaaaaaaaaa.ics')).toBe('/agenda/:id');
		expect(cheminGenerique('/planning/2027')).toBe('/planning/:id');
	});

	it('retire les paramètres', () => {
		expect(cheminGenerique('/api/auth/magic-link/verify?token=abc&callbackURL=%2F')).toBe('/api/auth/magic-link/verify');
	});

	it('ne laisse passer aucun morceau inhabituel (adresse, caractère encodé)', () => {
		expect(cheminGenerique('/echanges/messages/a/alice%40exemple.fr')).toBe('/echanges/messages/a/:id');
		expect(cheminGenerique('/x/a@b.fr')).toBe('/x/:id');
	});

	it('garde la racine', () => {
		expect(cheminGenerique('/')).toBe('/');
	});
});

const reponse = (groupes: [string, number][]) => ({
	success: true,
	result: { calculations: [{ aggregates: groupes.map(([chemin, nombre]) => ({ count: nombre, value: nombre, groups: [{ key: '$workers.event.request.path', value: chemin }] })) }] }
});

describe('regrouper', () => {
	it('additionne les chemins qui ne diffèrent que par un identifiant, du plus fréquent au moins fréquent', () => {
		expect(regrouper(reponse([['/agents/1', 2], ['/agents/2', 3], ['/planning', 1]]))).toEqual([
			['/agents/:id', 5],
			['/planning', 1]
		]);
	});

	it('rend une liste vide pour une réponse sans résultat', () => {
		expect(regrouper({ success: true, result: { calculations: [] } })).toEqual([]);
	});
});

describe('releverPages', () => {
	const jour = '2026-11-14';

	it('écrit un tableau par Worker, coupures et erreurs par page', async () => {
		const demander = vi.fn(async (corps: { parameters: { filters: { key: string }[] } }) => {
			const coupures = corps.parameters.filters.some((f) => f.key === '$workers.outcome');
			return { statut: 200, corps: coupures ? reponse([['/planning/2027', 2]]) : reponse([['/agents/9', 1], ['/planning/2026', 1]]) };
		});
		const lignes = await releverPages(['gyro-caserne-exemple'], jour, demander);
		const texte = lignes.join('\n');
		expect(texte).toContain('| /planning/:id | 2 | 1 |');
		expect(texte).toContain('| /agents/:id | 0 | 1 |');
		expect(texte).not.toMatch(/2027|\/9\b/);
		// La veille, de minuit à minuit (UTC).
		const corps = demander.mock.calls[0]![0] as unknown as { timeframe: { from: number; to: number } };
		expect(corps.timeframe).toEqual({ from: Date.parse('2026-11-14T00:00:00Z'), to: Date.parse('2026-11-15T00:00:00Z') });
	});

	it('dit quand rien n’est en cause', async () => {
		const lignes = await releverPages(['gyro-caserne-exemple'], jour, async () => ({ statut: 200, corps: reponse([]) }));
		expect(lignes.join('\n')).toContain('aucune coupure ni erreur au journal');
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
		expect(etape).toMatch(/if: always\(\)/);
		expect(etape).toMatch(/pages-en-erreur\.ts \| tee -a "\$GITHUB_STEP_SUMMARY" \|\| echo "::warning::/);
	});
});
