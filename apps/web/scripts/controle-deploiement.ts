// Contrôle après un déploiement : les réglages indispensables sont sur le Worker, et l'appli répond.
// N'affiche que des noms de réglages et l'adresse publique de l'appli, jamais une valeur de secret. N'envoie aucun courriel.
// Usage : CENTRE=<id> pnpm --filter @gyro-caserne/web controle-deploiement
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SECRETS_INDISPENSABLES = ['BETTER_AUTH_SECRET', 'SUPER_ADMINS', 'BREVO_CLE'];

// L'adresse peut venir de la config (en clair) ou, à défaut, d'un secret.
export function reglagesManquants(secrets: string[], vars: Record<string, unknown>): string[] {
	const manquants = SECRETS_INDISPENSABLES.filter((nom) => !secrets.includes(nom));
	if (!vars.BETTER_AUTH_URL && !secrets.includes('BETTER_AUTH_URL')) manquants.push('BETTER_AUTH_URL');
	return manquants;
}

// Sortie de `wrangler secret list` : on n'en garde que les noms. Une sortie inattendue n'est jamais recopiée.
export function nomsDesSecrets(texte: string): string[] {
	let liste: unknown;
	try {
		liste = JSON.parse(texte);
	} catch {
		liste = null;
	}
	if (!Array.isArray(liste) || !liste.every((s) => typeof s?.name === 'string')) throw new Error('Liste des secrets illisible : sortie de Wrangler inattendue, non affichée');
	return liste.map((s: { name: string }) => s.name);
}

type Outils = { demander: (url: string) => Promise<number>; attendre: () => Promise<void> };

// GET /connexion doit répondre 200 (une redirection ne compte pas) ; plusieurs essais, le temps que la nouvelle version arrive.
export async function controleDeVie(adresse: string, { demander, attendre }: Outils, essais = 6): Promise<boolean> {
	for (let i = 0; i < essais; i++) {
		if (i > 0) await attendre();
		try {
			if ((await demander(`${adresse}/connexion`)) === 200) return true;
		} catch {
			// Réseau : essai raté
		}
	}
	return false;
}

// Le contrôle, sans accès à Cloudflare : il reçoit les noms des secrets et la config, et rend ce qu'il faut écrire au journal.
export async function controler(centre: string, secrets: string[], vars: Record<string, unknown>, outils: Outils) {
	const manquants = reglagesManquants(secrets, vars);
	if (manquants.length)
		return { ok: false, messages: [`::error::Réglages manquants sur le Worker gyro-caserne-${centre} : ${manquants.join(', ')}. Voir docs/technique/installer-un-centre.md.`] };
	const messages = ['Réglages indispensables présents : ' + [...SECRETS_INDISPENSABLES, 'BETTER_AUTH_URL'].join(', ') + '.'];
	// L'adresse contrôlée est celle de la config : chaque déploiement la pose sur le Worker.
	const adresse = typeof vars.BETTER_AUTH_URL === 'string' ? vars.BETTER_AUTH_URL : '';
	if (!adresse) {
		messages.push("::warning::Adresse de l'appli en secret seulement : contrôle de vie impossible. Mettez-la dans vars de la config du centre.");
		return { ok: true, messages };
	}
	if (!(await controleDeVie(adresse, outils))) return { ok: false, messages: [...messages, `::error::${adresse}/connexion ne répond pas 200 après le déploiement.`] };
	return { ok: true, messages: [...messages, `${adresse}/connexion répond 200.`] };
}

async function lancer() {
	const centre = process.env.CENTRE;
	if (!centre) throw new Error('CENTRE à préciser, par exemple CENTRE=laille');
	const appli = fileURLToPath(new URL('..', import.meta.url));
	const config = `../../centres/${centre}/wrangler.jsonc`;
	const { unstable_readConfig } = await import('wrangler');
	const vars = unstable_readConfig({ config: `${appli}${config}` }).vars as Record<string, unknown>;

	let sortie: string;
	try {
		sortie = execFileSync('pnpm', ['exec', 'wrangler', 'secret', 'list', '--format', 'json', '--config', config], {
			cwd: appli,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'inherit'],
			env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }
		});
	} catch {
		// L'erreur de Node recopierait la sortie : seul le message de Wrangler, plus haut, est affiché.
		throw new Error('wrangler secret list a échoué (voir son message ci-dessus)');
	}
	const { ok, messages } = await controler(centre, nomsDesSecrets(sortie), vars, {
		demander: async (url) => (await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })).status,
		attendre: () => new Promise((r) => setTimeout(r, 10_000))
	});
	for (const message of messages) console.log(message);
	if (!ok) process.exit(1);
}

if (import.meta.main) await lancer();
