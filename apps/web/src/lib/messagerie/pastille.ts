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

// Interroge la pastille toutes les 30 s tant que la page est visible, et tout de suite quand elle le redevient.
// Une erreur passe sans bruit : le prochain tour réessaiera. Rend la fonction qui arrête le suivi.
export function suivreNonLus(rappel: (nonLus: number) => void, intervalle = 30_000): () => void {
	const lire = async () => {
		if (document.visibilityState !== 'visible') return;
		const n = await lirePastille();
		if (n !== null) rappel(n);
	};
	const minuteur = setInterval(lire, intervalle);
	document.addEventListener('visibilitychange', lire);
	return () => {
		clearInterval(minuteur);
		document.removeEventListener('visibilitychange', lire);
	};
}
