export const NIVEAUX = ['sobre', 'equilibre', 'vivant'] as const;
export const THEMES = ['auto', 'clair', 'sombre'] as const;

export type Niveau = (typeof NIVEAUX)[number];
export type Theme = (typeof THEMES)[number];
export type Affichage = { niveau: Niveau; theme: Theme };

export const AFFICHAGE_PAR_DEFAUT: Affichage = { niveau: 'vivant', theme: 'auto' };

export function niveauConnu(valeur: unknown): valeur is Niveau {
	return NIVEAUX.some((n) => n === valeur);
}

export function themeConnu(valeur: unknown): valeur is Theme {
	return THEMES.some((t) => t === valeur);
}

// Une valeur inconnue (cookie trafiqué) est ignorée : on ne la recopie jamais dans la page.
export function lireAffichage(cookies: { get(nom: string): string | undefined }): Affichage {
	const niveau = cookies.get('niveau');
	const theme = cookies.get('theme');
	return {
		niveau: niveauConnu(niveau) ? niveau : AFFICHAGE_PAR_DEFAUT.niveau,
		theme: themeConnu(theme) ? theme : AFFICHAGE_PAR_DEFAUT.theme
	};
}

export function appliquerAffichage(html: string, a: Affichage): string {
	return html.replaceAll('%gyro.theme%', a.theme).replaceAll('%gyro.niveau%', a.niveau);
}
