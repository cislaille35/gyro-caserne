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

// L'e-mail est montré quand c'est lui, et pas le nom, qui répond à la recherche (même règle que le socle).
export function emailCherche(p: { prenom: string; nom: string; email?: string }, recherche: string): boolean {
	const texte = recherche.trim().toLowerCase();
	if (!texte || !p.email) return false;
	return p.email.toLowerCase().includes(texte) && ![p.prenom, p.nom].some((champ) => champ.toLowerCase().includes(texte));
}
