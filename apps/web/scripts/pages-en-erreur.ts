// Relevé quotidien, suite : coupures et erreurs de la veille par page, lues dans le journal de Cloudflare (Workers Logs, décisions 0036 et 0037).
// Seulement là où le journal est gardé (la préprod) : chaque requête en cause est nommée par son adresse, rendue générique (/agents/[id]) ;
// sans adresse (réveil, ménage), par la ligne « Page … » que l'appli écrit, rattachée à sa requête ($metadata.requestId). En production, le journal
// est coupé : le relevé le dit. Le résumé est public : seulement des noms génériques de pages et des nombres. Ne fait jamais échouer le relevé.
// Usage (CI) : JETON=… COMPTE=… PREPROD="gyro-caserne-exemple" PRODUCTION="gyro-caserne-laille" JOUR=2026-11-14 node --experimental-transform-types scripts/pages-en-erreur.ts

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Reponse = { statut: number; corps: unknown };
export type Demander = (corps: Requete) => Promise<Reponse>;
type Filtre = { key: string; operation: string; type: 'string' | 'number'; value: string | number };
type Requete = { queryId: string; timeframe: { from: number; to: number }; view: 'calculations'; parameters: { calculations: { operator: 'count' }[]; filters: Filtre[]; groupBys: { type: 'string'; value: string }[]; limit: number } };
type Groupes = Record<string, unknown>[];

const REQUETE = '$metadata.requestId';
const MESSAGE = '$metadata.message';
const CHEMIN = '$workers.event.request.path';
const METHODE = '$workers.event.request.method';
const METHODES = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const AUTRE_ADRESSE = '(autre adresse)';
const LIMITE = 2000;
const AU_PLUS = 10;
const SANS_NOM = '(sans nom de page)';
const TRONQUEE = '(non trouvée, liste tronquée)';

// Le nom de la page tel que l'appli l'écrit (page-au-journal.ts, planifie.ts), sans chiffre ; tout autre texte est écarté.
const LIGNE = /^Page ((?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS|autre) (?:\/[A-Za-z_\-./[\]()]*|\(aucune\))(?:\?\/(?:[A-Za-z]+|\(inconnue\)))?|réveil|ménage de la nuit)$/;
export function nomDePage(message: unknown): string {
	return (typeof message === 'string' && LIGNE.exec(message)?.[1]) || '(illisible)';
}

function groupes(corps: unknown): Groupes {
	const agregats = (corps as { result?: { calculations?: { aggregates?: { groups?: { key: string; value: unknown }[] }[] }[] } }).result?.calculations?.[0]?.aggregates ?? [];
	return agregats.map((a) => Object.fromEntries((a.groups ?? []).map((g) => [g.key, g.value])));
}

// Les modèles des pages de l'appli (/agents/[id]), lus dans son dossier de pages.
export function modelesDesPages(dossier: string): string[] {
	return [...new Set(readdirSync(dossier, { recursive: true, withFileTypes: true })
		.filter((f) => /^\+(page|server)\.(ts|svelte)$/.test(f.name))
		.map((f) => f.parentPath.slice(dossier.length).replaceAll('\\', '/') || '/'))];
}

// Le modèle de la page qu'ouvre une adresse ; la partie fixe l'emporte (/agents/nouveau avant /agents/[id]). Jamais l'adresse elle-même.
export function modeleDeChemin(chemin: unknown, modeles: string[]): string {
	if (typeof chemin !== 'string' || !chemin.startsWith('/')) return AUTRE_ADRESSE;
	if (chemin === '/') return modeles.includes('/') ? '/' : AUTRE_ADRESSE;
	if (chemin === '/api/auth' || chemin.startsWith('/api/auth/')) return '/api/auth';
	const morceaux = chemin.slice(1).split('/');
	if (morceaux.length > 1 && morceaux.at(-1) === '') morceaux.pop();
	if (morceaux.includes('')) return AUTRE_ADRESSE;
	let meilleur: [string, string] | undefined;
	for (const modele of modeles) {
		const parties = modele.slice(1).split('/');
		if (modele === '/' || parties.length !== morceaux.length) continue;
		const fixes = parties.map((p) => (/^\[\w+\]$/.test(p) ? '0' : '1')).join('');
		if (parties.every((p, i) => p === morceaux[i] || fixes[i] === '0') && (!meilleur || fixes > meilleur[1])) meilleur = [modele, fixes];
	}
	return meilleur?.[0] ?? AUTRE_ADRESSE;
}

function requete(worker: string, jour: string, filtre: Filtre, groupBys: string[]): Requete {
	const debut = Date.parse(`${jour}T00:00:00Z`);
	return {
		queryId: 'releve-pages',
		timeframe: { from: debut, to: debut + 24 * 3600 * 1000 },
		view: 'calculations',
		parameters: {
			calculations: [{ operator: 'count' }],
			filters: [{ key: '$metadata.service', operation: 'eq', type: 'string', value: worker }, filtre],
			groupBys: groupBys.map((value) => ({ type: 'string', value })),
			limit: LIMITE
		}
	};
}

// Les réponses, ou la raison de leur absence.
async function interroger(demander: Demander, requetes: Requete[]): Promise<Groupes[] | string> {
	let reponses: Reponse[];
	try {
		reponses = await Promise.all(requetes.map(demander));
	} catch {
		return 'répartition par page indisponible (Cloudflare ne répond pas).';
	}
	if (reponses.some((r) => r.statut === 401 || r.statut === 403)) return "répartition par page indisponible, le jeton CLOUDFLARE_API_TOKEN n'a pas le droit « Workers Observability » (Compte › Workers Observability › Modifier).";
	if (reponses.some((r) => r.statut !== 200 || (r.corps as { success?: boolean }).success !== true)) return `répartition par page indisponible (réponse inattendue de Cloudflare, HTTP ${reponses.map((r) => r.statut).join('/')}).`;
	return reponses.map((r) => groupes(r.corps));
}

const ids = (g: Groupes) => new Set(g.map((x) => x[REQUETE]).filter((v): v is string => typeof v === 'string'));

// Coupures (calcul ou mémoire dépassés) et erreurs (réponse 500 et plus, ou erreur imprévue de l'appli) de la veille, par page, pour chaque Worker.
export async function releverPages(workers: { preprod: string[]; production: string[] }, jour: string, demander: Demander, modeles: string[]): Promise<string[]> {
	const lignes = [`#### Pages en cause le ${jour} (journal de Cloudflare)`];
	for (const worker of workers.preprod) {
		const parRequete = [REQUETE, CHEMIN, METHODE];
		const enCause = await interroger(demander, [
			requete(worker, jour, { key: '$workers.outcome', operation: 'starts_with', type: 'string', value: 'exceeded' }, parRequete),
			requete(worker, jour, { key: '$workers.event.response.status', operation: 'gte', type: 'number', value: 500 }, parRequete),
			requete(worker, jour, { key: MESSAGE, operation: 'starts_with', type: 'string', value: 'Erreur imprévue' }, parRequete)
		]);
		if (typeof enCause === 'string') {
			lignes.push(`${worker} : ${enCause}`);
			continue;
		}
		// Le nom de chaque requête en cause, par son adresse rendue générique ; sans adresse, à chercher sur sa ligne « Page ».
		const nomPar = new Map<string, string | undefined>();
		for (const g of enCause.flat()) {
			const r = g[REQUETE];
			if (typeof r !== 'string') continue;
			const methode = typeof g[METHODE] === 'string' && METHODES.has(g[METHODE]) ? g[METHODE] : 'autre';
			if (typeof g[CHEMIN] === 'string') nomPar.set(r, `${methode} ${modeleDeChemin(g[CHEMIN], modeles)}`);
			else if (!nomPar.has(r)) nomPar.set(r, undefined);
		}
		const coupees = ids(enCause[0]!);
		const enErreur = ids([...enCause[1]!, ...enCause[2]!]);
		if (coupees.size + enErreur.size === 0) {
			lignes.push(`${worker} : aucune coupure ni erreur trouvée au journal.`);
			continue;
		}
		let tronquee = false;
		if ([...nomPar.values()].includes(undefined)) {
			const lues = await interroger(demander, [requete(worker, jour, { key: MESSAGE, operation: 'starts_with', type: 'string', value: 'Page ' }, [REQUETE, MESSAGE])]);
			if (typeof lues === 'string') {
				lignes.push(`${worker} : ${lues}`);
				continue;
			}
			tronquee = lues[0]!.length >= LIMITE;
			for (const g of lues[0]!) if (typeof g[REQUETE] === 'string' && nomPar.has(g[REQUETE]) && nomPar.get(g[REQUETE]) === undefined) nomPar.set(g[REQUETE], nomDePage(g[MESSAGE]));
		}
		const totaux = new Map<string, [number, number]>();
		for (const [requetes, rang] of [[coupees, 0], [enErreur, 1]] as const)
			for (const r of requetes) {
				const page = nomPar.get(r) ?? (tronquee ? TRONQUEE : SANS_NOM);
				const t = totaux.get(page) ?? [0, 0];
				t[rang]++;
				totaux.set(page, t);
			}
		const pages = [...totaux].sort((a, b) => b[1][0] + b[1][1] - (a[1][0] + a[1][1]) || a[0].localeCompare(b[0]));
		lignes.push('', `${worker}`, '', '| Page | Coupures | Erreurs (500 et plus) |', '|---|---|---|');
		for (const [page, [c, e]] of pages.slice(0, AU_PLUS)) lignes.push(`| ${page} | ${c} | ${e} |`);
		if (pages.length > AU_PLUS) lignes.push(`| … ${pages.length - AU_PLUS} autres pages | | |`);
		if (tronquee || enCause.some((g) => g.length >= LIMITE)) lignes.push('', `Plus de ${LIMITE} requêtes ce jour-là : liste tronquée, des requêtes en cause peuvent manquer.`);
	}
	// Production : rien n'est gardé chez Cloudflare (décision 0036). Les coupures et le temps de calcul sont dans le tableau du relevé, plus haut.
	for (const worker of workers.production) lignes.push(`${worker} : journal coupé, pas de répartition par page (les coupures sont comptées dans le tableau ci-dessus).`);
	return lignes;
}

async function lancer() {
	const { JETON, COMPTE, PREPROD, PRODUCTION, JOUR } = process.env;
	const demander: Demander = async (corps) => {
		const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${COMPTE}/workers/observability/telemetry/query`, {
			method: 'POST',
			headers: { authorization: `Bearer ${JETON}`, 'content-type': 'application/json' },
			body: JSON.stringify(corps),
			signal: AbortSignal.timeout(20_000)
		});
		return { statut: r.status, corps: await r.json().catch(() => null) };
	};
	const liste = (centres = '') => centres.split(/\s+/).filter(Boolean).map((c) => `gyro-caserne-${c}`);
	const modeles = modelesDesPages(fileURLToPath(new URL('../src/routes', import.meta.url)));
	for (const ligne of await releverPages({ preprod: liste(PREPROD), production: liste(PRODUCTION) }, JOUR ?? '', demander, modeles)) console.log(ligne);
}

if (import.meta.main) await lancer();
