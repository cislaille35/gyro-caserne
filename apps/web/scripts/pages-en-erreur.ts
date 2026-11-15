// Relevé quotidien, suite : coupures et erreurs de la veille par page, lues dans le journal de Cloudflare (Workers Logs, décisions 0036 et 0037).
// L'appli écrit à chaque requête une ligne « Page GET /agents/[id] » ; Cloudflare la rattache à sa requête ($metadata.requestId).
// Le résumé est public : seulement des noms génériques de pages et des nombres. Ne fait jamais échouer le relevé.
// Usage (CI) : JETON=… COMPTE=… WORKERS="gyro-caserne-exemple …" JOUR=2026-11-14 node --experimental-transform-types scripts/pages-en-erreur.ts

type Reponse = { statut: number; corps: unknown };
export type Demander = (corps: Requete) => Promise<Reponse>;
type Filtre = { key: string; operation: string; type: 'string' | 'number'; value: string | number };
type Requete = { queryId: string; timeframe: { from: number; to: number }; view: 'calculations'; parameters: { calculations: { operator: 'count' }[]; filters: Filtre[]; groupBys: { type: 'string'; value: string }[]; limit: number } };
type Groupes = Record<string, unknown>[];

const REQUETE = '$metadata.requestId';
const MESSAGE = '$metadata.message';
const LIMITE = 2000;
const AU_PLUS = 10;
const SANS_NOM = '(sans nom de page)';

// Le nom de la page tel que l'appli l'écrit (page-au-journal.ts, planifie.ts) ; tout autre texte est écarté.
const LIGNE = /^Page ((?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS|autre) (?:\/[\w\-./[\]()]*|\(aucune\))(?:\?\/(?:\w+|\(inconnue\)))?|réveil|ménage de la nuit)$/;
export function nomDePage(message: unknown): string {
	return (typeof message === 'string' && LIGNE.exec(message)?.[1]) || '(illisible)';
}

function groupes(corps: unknown): Groupes {
	const agregats = (corps as { result?: { calculations?: { aggregates?: { groups?: { key: string; value: unknown }[] }[] }[] } }).result?.calculations?.[0]?.aggregates ?? [];
	return agregats.map((a) => Object.fromEntries((a.groups ?? []).map((g) => [g.key, g.value])));
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
export async function releverPages(workers: string[], jour: string, demander: Demander): Promise<string[]> {
	const lignes = [`#### Pages en cause le ${jour} (journal de Cloudflare)`];
	for (const worker of workers) {
		const enCause = await interroger(demander, [
			requete(worker, jour, { key: '$workers.outcome', operation: 'starts_with', type: 'string', value: 'exceeded' }, [REQUETE]),
			requete(worker, jour, { key: '$workers.event.response.status', operation: 'gte', type: 'number', value: 500 }, [REQUETE]),
			requete(worker, jour, { key: MESSAGE, operation: 'starts_with', type: 'string', value: 'Erreur imprévue' }, [REQUETE])
		]);
		if (typeof enCause === 'string') {
			lignes.push(`${worker} : ${enCause}`);
			continue;
		}
		const coupees = ids(enCause[0]!);
		const enErreur = ids([...enCause[1]!, ...enCause[2]!]);
		if (coupees.size + enErreur.size === 0) {
			lignes.push(`${worker} : aucune coupure ni erreur au journal.`);
			continue;
		}
		const lues = await interroger(demander, [requete(worker, jour, { key: MESSAGE, operation: 'starts_with', type: 'string', value: 'Page ' }, [REQUETE, MESSAGE])]);
		if (typeof lues === 'string') {
			lignes.push(`${worker} : ${lues}`);
			continue;
		}
		const pageDe = new Map(lues[0]!.map((g) => [g[REQUETE], nomDePage(g[MESSAGE])]));
		const totaux = new Map<string, [number, number]>();
		for (const [requetes, rang] of [[coupees, 0], [enErreur, 1]] as const)
			for (const r of requetes) {
				const page = pageDe.get(r) ?? SANS_NOM;
				const t = totaux.get(page) ?? [0, 0];
				t[rang]++;
				totaux.set(page, t);
			}
		const pages = [...totaux].sort((a, b) => b[1][0] + b[1][1] - (a[1][0] + a[1][1]) || a[0].localeCompare(b[0]));
		lignes.push('', `${worker}`, '', '| Page | Coupures | Erreurs (500 et plus) |', '|---|---|---|');
		for (const [page, [c, e]] of pages.slice(0, AU_PLUS)) lignes.push(`| ${page} | ${c} | ${e} |`);
		if (pages.length > AU_PLUS) lignes.push(`| … ${pages.length - AU_PLUS} autres pages | | |`);
		if (lues[0]!.length >= LIMITE) lignes.push('', `Plus de ${LIMITE} requêtes ce jour-là : certaines pages en cause peuvent manquer.`);
	}
	return lignes;
}

async function lancer() {
	const { JETON, COMPTE, WORKERS, JOUR } = process.env;
	const demander: Demander = async (corps) => {
		const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${COMPTE}/workers/observability/telemetry/query`, {
			method: 'POST',
			headers: { authorization: `Bearer ${JETON}`, 'content-type': 'application/json' },
			body: JSON.stringify(corps),
			signal: AbortSignal.timeout(20_000)
		});
		return { statut: r.status, corps: await r.json().catch(() => null) };
	};
	for (const ligne of await releverPages((WORKERS ?? '').split(/\s+/).filter(Boolean), JOUR ?? '', demander)) console.log(ligne);
}

if (import.meta.main) await lancer();
