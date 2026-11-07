// La pastille sur l'icône de l'appli (API Badging) : le chiffre de la cloche. Posée par le service worker à chaque notification
// reçue, et par l'appli ouverte. Seuls Chrome et Edge (appli installée) et Safari (iPhone, écran d'accueil) la montrent ;
// Android n'en montre souvent qu'un point. Ailleurs, rien, sans erreur.
type AvecPastille = { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

export async function poserPastille(nav: AvecPastille, n: unknown): Promise<void> {
	if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || typeof nav.setAppBadge !== 'function') return;
	try {
		if (n > 0) await nav.setAppBadge(n);
		else await nav.clearAppBadge?.();
	} catch {
		// Refusée (autorisation des notifications retirée) : la cloche de l'appli reste juste.
	}
}
