// Relevé quotidien, suite : coupures et erreurs de la veille par page, lues dans le journal de Cloudflare (Workers Logs, décision 0036).
// Le résumé est public : seulement des chemins génériques (/agents/:id) et des nombres. Ne fait jamais échouer le relevé.
// Usage (CI) : JETON=… COMPTE=… WORKERS="gyro-caserne-exemple …" JOUR=2026-11-14 node --experimental-transform-types scripts/pages-en-erreur.ts

type Reponse = { statut: number; corps: unknown };
export type Demander = (corps: Requete) => Promise<Reponse>;
type Filtre = { key: string; operation: string; type: 'string' | 'number'; value: string | number };
type Requete = { queryId: string; timeframe: { from: number; to: number }; view: 'calculations'; parameters: { calculations: { operator: 'count' }[]; filters: Filtre[]; groupBys: { type: 'string'; value: string }[]; limit: number } };

const CHEMIN = '$workers.event.request.path';
const AU_PLUS = 10;

// Un morceau avec un chiffre, long ou inhabituel est un identifiant ou un jeton : remplacé par :id.
export function cheminGenerique(chemin: string): string {
	const morceaux = chemin.split(/[?#]/)[0]!.split('/').filter(Boolean);
	return '/' + morceaux.map((m) => (/^[a-z-]{1,19}$/i.test(m) ? m : ':id')).join('/');
}

// Chemins génériques et leur nombre, du plus fréquent au moins fréquent.
export function regrouper(corps: unknown): [string, number][] {
	const agregats = (corps as { result?: { calculations?: { aggregates?: { count?: number; groups?: { key: string; value: unknown }[] }[] }[] } }).result?.calculations?.[0]?.aggregates ?? [];
	const totaux = new Map<string, number>();
	for (const a of agregats) {
		const chemin = a.groups?.find((g) => g.key === CHEMIN)?.value;
		const generique = typeof chemin === 'string' ? cheminGenerique(chemin) : '(inconnue)';
		totaux.set(generique, (totaux.get(generique) ?? 0) + Math.round(a.count ?? 0));
	}
	return [...totaux].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function requete(worker: string, jour: string, filtre: Filtre): Requete {
	const debut = Date.parse(`${jour}T00:00:00Z`);
	return {
		queryId: 'releve-pages',
		timeframe: { from: debut, to: debut + 24 * 3600 * 1000 },
		view: 'calculations',
		parameters: {
			calculations: [{ operator: 'count' }],
			filters: [{ key: '$metadata.service', operation: 'eq', type: 'string', value: worker }, filtre],
			groupBys: [{ type: 'string', value: CHEMIN }],
			limit: 1000
		}
	};
}

// Coupures (calcul ou mémoire dépassés) et erreurs (réponse 500 et plus) de la veille, par page, pour chaque Worker.
export async function releverPages(workers: string[], jour: string, demander: Demander): Promise<string[]> {
	const lignes = [`#### Pages en cause le ${jour} (journal de Cloudflare)`];
	for (const worker of workers) {
		let reponses: Reponse[];
		try {
			reponses = await Promise.all([
				demander(requete(worker, jour, { key: '$workers.outcome', operation: 'starts_with', type: 'string', value: 'exceeded' })),
				demander(requete(worker, jour, { key: '$workers.event.response.status', operation: 'gte', type: 'number', value: 500 }))
			]);
		} catch {
			lignes.push(`${worker} : répartition par page indisponible (Cloudflare ne répond pas).`);
			continue;
		}
		if (reponses.some((r) => r.statut === 401 || r.statut === 403)) {
			lignes.push(`${worker} : répartition par page indisponible, le jeton CLOUDFLARE_API_TOKEN n'a pas le droit « Workers Observability » (Compte › Workers Observability › Modifier).`);
			continue;
		}
		if (reponses.some((r) => r.statut !== 200 || (r.corps as { success?: boolean }).success !== true)) {
			lignes.push(`${worker} : répartition par page indisponible (réponse inattendue de Cloudflare, HTTP ${reponses.map((r) => r.statut).join('/')}).`);
			continue;
		}
		const [coupures, erreurs] = reponses.map((r) => new Map(regrouper(r.corps)));
		const pages = [...new Set([...coupures!.keys(), ...erreurs!.keys()])]
			.map((page) => [page, coupures!.get(page) ?? 0, erreurs!.get(page) ?? 0] as const)
			.sort((a, b) => b[1] + b[2] - (a[1] + a[2]) || a[0].localeCompare(b[0]));
		if (pages.length === 0) {
			lignes.push(`${worker} : rien au journal (journal coupé, ou aucune coupure ni erreur).`);
			continue;
		}
		lignes.push('', `${worker}`, '', '| Page | Coupures | Erreurs (500 et plus) |', '|---|---|---|');
		for (const [page, c, e] of pages.slice(0, AU_PLUS)) lignes.push(`| ${page} | ${c} | ${e} |`);
		if (pages.length > AU_PLUS) lignes.push(`| … ${pages.length - AU_PLUS} autres pages | | |`);
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
