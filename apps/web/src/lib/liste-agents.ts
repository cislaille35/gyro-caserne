// La recherche et le filtre de la liste des agents, gardés d'une page à l'autre ; jamais le nom d'une action envoyée sans JavaScript.
export function rechercheListe(url: { searchParams: { get(cle: string): string | null } }): string {
	const garde = new URLSearchParams();
	for (const cle of ['texte', 'filtre']) {
		const valeur = url.searchParams.get(cle);
		if (valeur) garde.set(cle, valeur);
	}
	const recherche = garde.toString();
	return recherche ? `?${recherche}` : '';
}
