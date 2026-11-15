import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { modeleDeChemin, modelesDesPages, nomDePage, releverPages, type Demander } from '../scripts/pages-en-erreur.ts';

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
		for (const message of ['Page GET /agents/42', 'Page POST /echanges?/a1', 'Page GET /agents/42?courriel=alice@exemple.fr', 'Page GET /x y', 'Page JETON /', 'Page GET /a?/b c', 'Erreur imprévue /x', 42, undefined])
			expect(nomDePage(message)).toBe('(illisible)');
	});
});

// Le nom générique d'une adresse : le modèle de la page qu'elle ouvre, jamais l'adresse elle-même.
describe('modeleDeChemin', () => {
	const modeles = modelesDesPages(fileURLToPath(new URL('routes', import.meta.url)));

	it('trouve les pages de l’appli dans son dossier', () => {
		expect(modeles.length).toBeGreaterThan(50);
		expect(modeles).toContain('/');
		expect(modeles).toContain('/agents/[id]');
		// Chaque modèle se retrouve lui-même à partir d'une adresse.
		for (const modele of modeles) expect(modeleDeChemin(modele.replace(/\[\w+\]/g, 'x1'), modeles)).toBe(modele);
	});

	it('donne le modèle, la partie fixe d’abord', () => {
		expect(modeleDeChemin('/', modeles)).toBe('/');
		expect(modeleDeChemin('/agents/42', modeles)).toBe('/agents/[id]');
		expect(modeleDeChemin('/agents/nouveau', modeles)).toBe('/agents/nouveau');
		expect(modeleDeChemin('/agents/42/', modeles)).toBe('/agents/[id]');
		expect(modeleDeChemin('/echanges/messages', modeles)).toBe('/echanges/messages');
		expect(modeleDeChemin('/echanges/vie/12', modeles)).toBe('/echanges/[mur]/[id]');
		expect(modeleDeChemin('/agenda/cle-secrete-de-l-agent.ics', modeles)).toBe('/agenda/[fichier]');
		expect(modeleDeChemin('/api/auth/magic-link/verify', modeles)).toBe('/api/auth');
	});

	it('ne rend jamais une adresse inconnue', () => {
		for (const chemin of ['/agents/42/alice@exemple.fr', '/inconnue', '/_app/immutable/x.js', '//', '/agents//', 'agents', 42, undefined])
			expect(modeleDeChemin(chemin, modeles)).toBe('(autre adresse)');
	});
});

type Corps = Parameters<Demander>[0];
const cle = (corps: Corps) => corps.parameters.filters[1]!.key;
// Une réponse de l'API : des groupes (clé → valeur) et leur nombre.
const reponse = (groupes: Record<string, string>[]) => ({
	statut: 200,
	corps: { success: true, result: { calculations: [{ aggregates: groupes.map((g) => ({ count: 1, groups: Object.entries(g).map(([key, value]) => ({ key, value })) })) }] } }
});
const id = (requestId: string, path?: string, method = 'GET') => ({ '$metadata.requestId': requestId, ...(path ? { '$workers.event.request.path': path, '$workers.event.request.method': method } : {}) });
const page = (requestId: string, message: string) => ({ '$metadata.requestId': requestId, '$metadata.message': message });
const MODELES = ['/', '/agents/[id]', '/agents/nouveau', '/planning', '/agenda/[fichier]'];

describe('releverPages', () => {
	const jour = '2026-11-14';
	// Par la requête elle-même : r1 coupée sur /agents/42, r2 en erreur 500 (POST) sur /agents/7, r3 erreur imprévue sur /planning, r6 coupée sur une
	// adresse inconnue, r7 coupée sur un agenda. Sans adresse : r4 coupée sans ligne, r5 coupée au réveil (lue sur la ligne « Page »).
	const journal = (corps: Corps) => {
		switch (cle(corps)) {
			case '$workers.outcome':
				return reponse([id('r1', '/agents/42'), id('r4'), id('r5'), id('r6', '/x/alice@exemple.fr'), id('r7', '/agenda/cle-secrete.ics')]);
			case '$workers.event.response.status':
				return reponse([id('r2', '/agents/7', 'POST'), id('r3', '/planning')]);
			case '$metadata.message':
				if ((corps.parameters.filters[1]!.value as string).startsWith('Erreur')) return reponse([id('r3', '/planning')]);
				return reponse([page('r1', 'Page GET /moi'), page('r5', 'Page réveil'), page('r9', 'Page GET /moi')]);
		}
		throw new Error('requête inattendue');
	};

	it('en préprod, nomme coupures et erreurs par l’adresse de leur requête, rendue générique', async () => {
		const demander = vi.fn(async (corps: Corps) => journal(corps));
		const texte = (await releverPages({ preprod: ['gyro-caserne-exemple'], production: [] }, jour, demander, MODELES)).join('\n');
		expect(texte).toContain('| GET /agents/[id] | 1 | 0 |');
		expect(texte).toContain('| POST /agents/[id] | 0 | 1 |');
		expect(texte).toContain('| GET /planning | 0 | 1 |');
		expect(texte).toContain('| GET /agenda/[fichier] | 1 | 0 |');
		expect(texte).toContain('| GET (autre adresse) | 1 | 0 |');
		// Sans adresse (le réveil), la ligne « Page » en appoint ; sans l'une ni l'autre, « sans nom de page ».
		expect(texte).toContain('| réveil | 1 | 0 |');
		expect(texte).toContain('| (sans nom de page) | 1 | 0 |');
		// L'adresse prime sur la ligne « Page » ; ni adresse, ni identifiant, ni page sans coupure dans le résumé.
		expect(texte).not.toMatch(/\/moi|r\d|42|alice|cle-secrete/);
		const corps = demander.mock.calls[0]![0];
		expect(corps.timeframe).toEqual({ from: Date.parse('2026-11-14T00:00:00Z'), to: Date.parse('2026-11-15T00:00:00Z') });
		expect(corps.parameters.filters[0]).toEqual({ key: '$metadata.service', operation: 'eq', type: 'string', value: 'gyro-caserne-exemple' });
		expect(corps.parameters.groupBys.map((g) => g.value)).toEqual(['$metadata.requestId', '$workers.event.request.path', '$workers.event.request.method']);
	});

	it('ne lit pas les lignes « Page » quand chaque requête en cause a son adresse', async () => {
		const demander = vi.fn(async (corps: Corps) => (cle(corps) === '$workers.outcome' ? reponse([id('r1', '/agents/42')]) : reponse([])));
		const texte = (await releverPages({ preprod: ['gyro-caserne-exemple'], production: [] }, jour, demander, MODELES)).join('\n');
		expect(texte).toContain('| GET /agents/[id] | 1 | 0 |');
		expect(demander).toHaveBeenCalledTimes(3);
	});

	it('en production, dit que le journal est coupé, sans rien demander à Cloudflare', async () => {
		const demander = vi.fn(async () => reponse([]));
		const texte = (await releverPages({ preprod: [], production: ['gyro-caserne-laille'] }, jour, demander, MODELES)).join('\n');
		expect(texte).toContain('gyro-caserne-laille : journal coupé');
		expect(demander).not.toHaveBeenCalled();
	});

	it('ne demande pas les pages quand rien n’est en cause, et le dit', async () => {
		const demander = vi.fn(async () => reponse([]));
		const lignes = await releverPages({ preprod: ['gyro-caserne-exemple'], production: [] }, jour, demander, MODELES);
		expect(lignes.join('\n')).toContain('aucune coupure ni erreur trouvée au journal');
		expect(demander).toHaveBeenCalledTimes(3);
	});

	it('prévient quand la liste des pages est tronquée', async () => {
		const demander = async (corps: Corps) => (corps.parameters.groupBys.length === 2 ? reponse(Array.from({ length: 2000 }, (_, i) => page(`p${i}`, 'Page GET /'))) : reponse([id('r1')]));
		const texte = (await releverPages({ preprod: ['gyro-caserne-exemple'], production: [] }, jour, demander, MODELES)).join('\n');
		expect(texte).toContain('Plus de 2000 requêtes');
		// Une requête en cause absente de la liste tronquée n'est pas une ligne perdue.
		expect(texte).toContain('| (non trouvée, liste tronquée) | 1 | 1 |');
	});

	it('écarte une ligne « Page » qui n’a pas la forme écrite par l’appli', async () => {
		const demander = async (corps: Corps) => (corps.parameters.groupBys.length === 2 ? reponse([page('r1', 'Page GET /agents/42')]) : reponse([id('r1')]));
		const texte = (await releverPages({ preprod: ['gyro-caserne-exemple'], production: [] }, jour, demander, MODELES)).join('\n');
		expect(texte).toContain('| (illisible) | 1 | 1 |');
		expect(texte).not.toContain('42');
	});

	it('écarte une méthode inconnue', async () => {
		const demander = async (corps: Corps) => (cle(corps) === '$workers.outcome' ? reponse([id('r1', '/planning', 'JETON')]) : reponse([]));
		expect((await releverPages({ preprod: ['gyro-caserne-exemple'], production: [] }, jour, demander, MODELES)).join('\n')).toContain('| autre /planning | 1 | 0 |');
	});

	it('dit quand seules les pages sont indisponibles', async () => {
		const demander = async (corps: Corps) => (corps.parameters.groupBys.length === 2 ? { statut: 500, corps: { success: false } } : reponse([id('r1')]));
		expect((await releverPages({ preprod: ['gyro-caserne-exemple'], production: [] }, jour, demander, MODELES)).join('\n')).toContain('gyro-caserne-exemple : répartition par page indisponible (réponse inattendue de Cloudflare, HTTP 500).');
	});

	it('ne fait pas échouer le relevé sans le droit de lire le journal : il le dit', async () => {
		const lignes = await releverPages({ preprod: ['gyro-caserne-exemple'], production: [] }, jour, async () => ({ statut: 403, corps: { success: false, errors: [{ code: 10000, message: 'Authentication error' }] } }), MODELES);
		expect(lignes.join('\n')).toContain('Workers Observability');
	});

	it('ne fait pas échouer le relevé si Cloudflare ne répond pas', async () => {
		const lignes = await releverPages({ preprod: ['gyro-caserne-exemple'], production: [] }, jour, async () => {
			throw new Error('réseau');
		}, MODELES);
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

	it('dit au relevé quel Worker garde le journal : la préprod seulement', () => {
		const etape = texte.slice(texte.indexOf('- name: Pages en cause'));
		expect(etape).toContain('PREPROD: ${{ vars.CENTRE_PREPROD }}');
		expect(etape).toContain('PRODUCTION: ${{ vars.CENTRE_PRODUCTION }}');
		// Les modèles des pages viennent du dépôt.
		expect(texte).toMatch(/sparse-checkout: \|[\s\S]*apps\/web\/src\/routes/);
	});
});
