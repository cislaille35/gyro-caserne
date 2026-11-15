// Ce que l'appli écrit au journal du Worker est gardé par Cloudflare (décision 0036) : jamais d'adresse, de lien, de jeton,
// ni de valeur de la base. Une erreur de requête de Drizzle recopie ses valeurs (« params: … ») : elles sont retirées.

const LONGUEUR_MAX = 1000;

export function sansDonnees(texte: string): string {
	return texte
		.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[adresse]')
		.replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, '$1?[…]')
		.replace(/[A-Za-z0-9_-]{20,}/g, '[jeton]');
}

function message(erreur: Error): string {
	// Drizzle : la requête (avec ses « ? ») est gardée, ses valeurs non.
	const texte = erreur.message.split('\nparams:')[0]!;
	return sansDonnees(`${erreur.name}: ${texte}`);
}

// Nom, message nettoyé, cause et lignes de pile (le code en cause, sans donnée) d'une erreur. Rien d'un objet quelconque.
export function resumeErreur(erreur: unknown): string {
	if (!(erreur instanceof Error)) return typeof erreur;
	const parties = [message(erreur)];
	if (erreur.cause instanceof Error) parties.push(`cause : ${message(erreur.cause)}`);
	const pile = (erreur.stack ?? '').split('\n').filter((ligne) => /^\s+at /.test(ligne)).slice(0, 5);
	parties.push(...pile.map((ligne) => ligne.trim()));
	return parties.join('\n').slice(0, LONGUEUR_MAX);
}
