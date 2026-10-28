const MO = 1024 * 1024;
// Tout envoi : 2 Mo au plus (une ligne de la base D1 n'en contient pas plus).
const ENVOI_MAX = 2 * MO;
// Aperçu du fichier des agents : 2 000 lignes en JSON, de 0,5 Mo en pratique à 2,2 Mo au pire mesuré (champs à leur longueur maximale, 20 colonnes de rôles).
const LIMITES: Record<string, number> = { '/agents/fichier/apercu': 4 * MO };

// Avant toute lecture du corps, pour ne pas saturer la mémoire du serveur : un envoi sans longueur annoncée ou trop lourd est refusé.
// Un envoi sans corps (ni longueur ni contenu) passe : il n'y a rien à lire.
export function envoiRefuse(request: Request, chemin: string): Response | null {
	if (request.method === 'GET' || request.method === 'HEAD') return null;
	const annoncee = request.headers.get('content-length');
	if (annoncee === null && request.body === null) return null;
	const longueur = annoncee === null || !/^\d+$/.test(annoncee) ? NaN : Number(annoncee);
	const max = LIMITES[chemin] ?? ENVOI_MAX;
	if (longueur <= max) return null;
	const message = `Envoi trop lourd : ${max / MO} Mo au plus.`;
	if (request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ message }, { status: 413 });
	return new Response(message, { status: 413, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
