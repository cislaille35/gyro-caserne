// L'aide à l'installation de l'appli sur l'écran d'accueil : ce qu'on propose, selon l'appareil.
// Chrome et Edge (Android, ordinateur) proposent l'installation par un évènement (`beforeinstallprompt`) : notre bouton l'ouvre.
// Safari sur iPhone n'a rien de tel : on montre les deux gestes. Déjà installée : rien.

export type Plateforme = { installee: boolean; ios: boolean; invite: boolean };
export const PLUS_TARD_JOURS = 5;
const CLE = 'gyro:installation:plus-tard';

// iPadOS se présente comme un Mac, mais tactile.
export const estIOS = (nav: { userAgent: string; maxTouchPoints: number }) => /iphone|ipad|ipod/i.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
// `pleinEcran` : matchMedia('(display-mode: standalone)') ; `standalone` : Safari, ouverte depuis l'écran d'accueil.
export const estInstallee = (pleinEcran: boolean, nav: { standalone?: boolean }) => pleinEcran || nav.standalone === true;

// L'encart de l'accueil : discret, écarté quelques jours par « Plus tard ».
export function choixEncart(p: Plateforme, plusTardLe: string | null, maintenant: Date): 'iphone' | 'bouton' | 'rien' {
	if (p.installee) return 'rien';
	const ecarte = plusTardLe === null ? NaN : Date.parse(plusTardLe);
	if (maintenant.getTime() - ecarte < PLUS_TARD_JOURS * 864e5) return 'rien';
	return p.ios ? 'iphone' : p.invite ? 'bouton' : 'rien';
}

// Moi → Installer l'appli : toujours une réponse.
export function choixPage(p: Plateforme): 'installee' | 'iphone' | 'bouton' | 'menu' {
	if (p.installee) return 'installee';
	return p.ios ? 'iphone' : p.invite ? 'bouton' : 'menu';
}

type Stockage = { getItem: (cle: string) => string | null; setItem: (cle: string, valeur: string) => void };

export function lirePlusTard(stockage: Stockage | null): string | null {
	try {
		return stockage?.getItem(CLE) ?? null;
	} catch {
		return null;
	}
}

export function noterPlusTard(stockage: Stockage | null, maintenant: Date): void {
	try {
		stockage?.setItem(CLE, maintenant.toISOString());
	} catch {
		// Stockage refusé : l'encart reviendra à la prochaine visite.
	}
}
