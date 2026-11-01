// Safari, en actualisant, renvoie parfois le dernier formulaire envoyé à la page affichée depuis (après une navigation dans l'appli).
// Cette page n'attend aucun formulaire et répondrait 404 : on la recharge simplement.
export function formulaireEgare(request: Request, url: URL, reponse: Response): Response | null {
	if (request.method !== 'POST' || reponse.status !== 404) return null;
	if (request.headers.has('x-sveltekit-action') || !request.headers.get('accept')?.includes('text/html')) return null;
	if ([...url.searchParams.keys()].some((cle) => cle.startsWith('/'))) return null;
	return new Response(null, { status: 303, headers: { location: url.pathname + url.search } });
}
