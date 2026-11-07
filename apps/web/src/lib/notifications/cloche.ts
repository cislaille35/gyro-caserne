// Le nombre de la cloche, demandé au serveur ; null en cas d'erreur (hors ligne, déconnecté).
export async function lireCloche(): Promise<number | null> {
	try {
		const reponse = await fetch('/notifications/cloche');
		return reponse.ok ? ((await reponse.json()) as { cloche: number }).cloche : null;
	} catch {
		return null;
	}
}
