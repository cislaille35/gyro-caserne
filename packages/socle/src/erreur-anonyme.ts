// Ce que l'appli écrit au journal du Worker est gardé par Cloudflare (décision 0036) : jamais d'adresse, de lien, de jeton,
// ni de valeur de la base. Une erreur de requête de Drizzle recopie ses valeurs (« params: … ») : elles sont retirées.

const LONGUEUR_MAX = 1000;

// Une suite de lettres et chiffres de 20 caractères et plus est un jeton ou une clé, sauf un nom de colonne (minuscules et _).
export function sansDonnees(texte: string): string {
	return texte
		.replace(/[\p{L}\p{N}._%+-]+(@|%40)[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+/gu, '[adresse]')
		.replace(/((?:https?:)?\/[^\s?#]*)[?#]\S*/g, '$1?[…]')
		.replace(/[A-Za-z0-9_-]{20,}/g, (suite) => (/^[a-z_]+$/.test(suite) ? suite : '[jeton]'));
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
	// La pile recommence par le message : il est retiré d'abord, pour qu'une fausse ligne « at … » n'y passe pas.
	const tete = `${erreur.name}: ${erreur.message}`;
	const pile = erreur.stack?.startsWith(tete) ? erreur.stack.slice(tete.length) : sansDonnees(erreur.stack ?? '');
	parties.push(...pile.split('\n').filter((ligne) => /^\s+at /.test(ligne)).slice(0, 5).map((ligne) => ligne.trim()));
	return parties.join('\n').slice(0, LONGUEUR_MAX);
}
