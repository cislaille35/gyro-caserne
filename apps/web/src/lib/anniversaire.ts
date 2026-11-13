// « Paul Martin, Marie Durand et 3 autres collègues vous l'ont souhaité. » : trois noms au plus, puis un nombre.
export function phraseSouhaits(par: { prenom: string; nom: string }[]): string {
	if (par.length === 0) return '';
	const noms = par.map((p) => `${p.prenom} ${p.nom}`.trim());
	const liste = noms.length <= 3 ? noms : [...noms.slice(0, 2), `${noms.length - 2} autres collègues`];
	return `${new Intl.ListFormat('fr', { type: 'conjunction' }).format(liste)} vous ${par.length === 1 ? 'l’a' : 'l’ont'} souhaité.`;
}
