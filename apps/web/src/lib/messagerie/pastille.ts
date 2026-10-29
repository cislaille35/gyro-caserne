import { getContext, setContext } from 'svelte';

const CLE = 'non-lus';

// Le nombre de messages non lus, tenu à jour par le layout racine. L'objet peut porter un accesseur.
export function definirNonLus(o: { readonly nombre: number }): void {
	setContext(CLE, o);
}

export function lireNonLus(): { readonly nombre: number } {
	return getContext<{ nombre: number } | undefined>(CLE) ?? { nombre: 0 };
}

// Le nombre de messages non lus, demandé au serveur ; null en cas d'erreur (hors ligne, déconnecté).
export async function lirePastille(): Promise<number | null> {
	try {
		const reponse = await fetch('/echanges/messages/pastille');
		return reponse.ok ? ((await reponse.json()) as { nonLus: number }).nonLus : null;
	} catch {
		return null;
	}
}

const RECENT = 10_000;
const LISTE = '/echanges/messages';

// Suit la pastille à partir du nombre reçu avec la page : toutes les 30 s tant que la page est visible, et au retour sur
// l'onglet si la dernière lecture date de plus de 10 s. Quand le nombre change, `rappel` le reçoit et la liste est relue.
// Une erreur passe sans bruit : le prochain tour réessaiera.
export function suivreNonLus(initial: number, rappel: (nonLus: number) => void, relire: () => void, intervalle = 30_000) {
	let connu = initial;
	let derniere = Date.now();
	const lire = async (relireListe = true) => {
		derniere = Date.now();
		const n = await lirePastille();
		if (n === null || n === connu) return;
		connu = n;
		rappel(n);
		if (relireListe) relire();
	};
	const visible = () => document.visibilityState === 'visible';
	const minuteur = setInterval(() => visible() && lire(), intervalle);
	const auRetour = () => visible() && Date.now() - derniere >= RECENT && lire();
	document.addEventListener('visibilitychange', auRetour);
	return {
		arreter() {
			clearInterval(minuteur);
			document.removeEventListener('visibilitychange', auRetour);
		},
		// En sortant d'une conversation (lue), la pastille est relue sans attendre ; vers la liste, qui vient d'être chargée,
		// sans relancer sa lecture.
		apresNavigation(de: string | undefined, vers: string | undefined) {
			if (de?.startsWith(`${LISTE}/`)) void lire(vers !== LISTE);
		}
	};
}
