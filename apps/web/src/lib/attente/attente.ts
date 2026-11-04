// L'attente quand le serveur est coupé (offre gratuite : erreur Cloudflare 1102) ou le réseau absent. Le service worker s'en sert ;
// rien ici ne dépend du serveur, et rien n'est mis en cache.

export const DELAIS_ATTENTE = [5, 10, 20];

// Dit par le service worker à la page d'erreur de l'appli : c'est une coupure, un nouvel essai est permis.
export const MESSAGE_COUPURE = 'Le serveur n’a pas pu répondre.';
const MESSAGE_ENVOI = 'Le serveur n’a pas pu répondre : votre envoi n’est peut-être pas passé. Vérifiez, puis réessayez dans un instant.';

export type Genre = 'page' | 'formulaire' | 'donnees' | 'action';

// 1102 : 503 en texte brut, « error code: 1102 ». Une page d'erreur habillée est aussi prévue. Tout le reste vient de l'appli.
export const estCoupure = (status: number, texte: string) => status === 503 && /error(\s+code:)?\s*(<[^>]*>\s*)*1102|exceeded resource limits/i.test(texte);

// Ce que le service worker surveille. Tout le reste passe sans lui.
export function genreDeRequete(r: { url: string; method: string; mode: string; headers: Headers }, origine: string): Genre | null {
	const url = new URL(r.url);
	if (url.origin !== origine) return null;
	if (r.mode === 'navigate') return r.method === 'GET' ? 'page' : 'formulaire';
	if (r.method === 'POST' && r.headers.has('x-sveltekit-action')) return 'action';
	if (r.method === 'GET' && url.pathname.endsWith('/__data.json')) return 'donnees';
	return null;
}

// Le prochain délai d'attente (null : on ne réessaie plus seul). Passée dans la page sous forme de texte : ne dépend de rien d'autre.
export function prochainEssai(etat: { essai: number; le: number } | null | undefined, maintenant: number, delais: number[]): { delai: number | null; etat: { essai: number; le: number } } {
	// Plus de 5 minutes : c'est une autre coupure.
	const essai = etat && maintenant - etat.le < 300000 ? etat.essai : 0;
	return { delai: essai < delais.length ? delais[essai]! : null, etat: { essai: essai + 1, le: maintenant } };
}

// Le refus d'un envoi, au format de SvelteKit : la page et la saisie restent, `EnvoiCoupe.svelte` montre `form.coupure` sur tous les écrans.
export const reponseAction = () => JSON.stringify({ type: 'failure', status: 503, data: JSON.stringify([{ coupure: 1 }, MESSAGE_ENVOI]) });

// Les données d'une page : SvelteKit montre `+error.svelte` avec ce message.
export const reponseDonnees = () => JSON.stringify({ message: MESSAGE_COUPURE });

const GYRO = `<svg class="gyro" aria-hidden="true" viewBox="0 0 512 512" width="112" height="112">
<g class="rayons" stroke-linecap="round" stroke-width="22"><line x1="121" y1="180" x2="78" y2="153" stroke="#f2c200"/><line x1="201" y1="114" x2="184" y2="67" stroke="#e5699a"/><line x1="311" y1="114" x2="328" y2="67" stroke="#3d7fd6"/><line x1="391" y1="180" x2="434" y2="153" stroke="#3fa34d"/></g>
<g transform="translate(4 4) scale(4.2)"><path d="M32 94V62Q32 30 60 30Q88 30 88 62V94Z" fill="#e3262b"/><ellipse cx="49" cy="64" rx="8" ry="10" fill="#fff"/><ellipse cx="71" cy="64" rx="8" ry="10" fill="#fff"/><circle cx="51" cy="66" r="4.5" fill="#1d2733"/><circle cx="73" cy="66" r="4.5" fill="#1d2733"/><path d="M50 80Q60 88 70 80" fill="none" stroke="#1d2733" stroke-width="4" stroke-linecap="round"/><rect x="24" y="92" width="72" height="16" rx="5" fill="#1d2733"/></g>
</svg>`;

// Les couleurs de l'appli, en clair et en sombre (selon l'appareil : le choix du thème de l'appli n'est pas lisible ici).
const STYLE = `:root{color-scheme:light dark;--fond:#f6f3ef;--encre:#1d2733;--doux:#4a5562}
@media (prefers-color-scheme: dark){:root{--fond:#11171f;--encre:#e6ebf0;--doux:#a7b2bd}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--fond);color:var(--encre);font:400 1.0625rem/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
main{max-width:26rem;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
h1{margin:0;font:700 1.875rem/1.15 'Arial Narrow',system-ui,sans-serif}
p{margin:0;color:var(--doux)}
.bouton{min-height:48px;margin-top:8px;padding:0 24px;border:0;border-radius:999px;background:#b3121f;color:#fff;font:600 1rem/1 inherit;font-family:inherit;cursor:pointer}
.bouton:focus-visible{outline:3px solid var(--encre);outline-offset:3px}
.rayons{animation:lueur 2.4s ease-in-out infinite}
@keyframes lueur{50%{opacity:.25}}
@media (prefers-reduced-motion: reduce){.rayons{animation:none}}`;

const page = (corps: string, script: string) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#c8102e"><title>Un instant · Gyro Caserne</title><style>${STYLE}</style></head>
<body><main>${GYRO}${corps}</main><script>${script}</script></body></html>`;

// La page montrée à la place de l'erreur. Après une page : nouveaux essais seuls, avec le nombre d'essais gardé dans l'historique
// (il survit au rechargement). Après un formulaire : jamais de renvoi, retour au formulaire où le navigateur a gardé la saisie.
export function pageAttente(genre: 'page' | 'formulaire'): string {
	if (genre === 'formulaire') {
		return page(
			`<h1>Un instant, ça arrive…</h1><p aria-live="polite">Le serveur n’a pas pu répondre. Votre envoi n’est peut-être pas passé : rien n’est renvoyé sans vous.</p><button class="bouton" type="button" id="retour">Revenir au formulaire</button>`,
			`document.getElementById('retour').addEventListener('click',function(){history.back()})`
		);
	}
	return page(
		`<h1>Un instant, ça arrive…</h1><p id="etat" aria-live="polite">Le serveur reprend dans quelques secondes. La page va se recharger toute seule.</p><button class="bouton" type="button" id="essai" hidden>Réessayer</button>`,
		`var calcul=(${prochainEssai.toString()})((history.state||{}).attenteGyro,Date.now(),${JSON.stringify(DELAIS_ATTENTE)});
history.replaceState(Object.assign({},history.state,{attenteGyro:calcul.etat}),'');
document.getElementById('essai').addEventListener('click',function(){location.reload()});
if(calcul.delai===null){document.getElementById('etat').textContent='Le serveur met plus de temps que d’habitude. Réessayez dans un moment.';document.getElementById('essai').hidden=false}
else{setTimeout(function(){location.reload()},calcul.delai*1000)}`
	);
}

// Les en-têtes des réponses faites par le service worker : jamais gardées par le navigateur ; cette page n'exécute que son propre contenu.
export const ENTETES_ATTENTE = {
	'content-type': 'text/html; charset=utf-8',
	'cache-control': 'no-store',
	'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};
