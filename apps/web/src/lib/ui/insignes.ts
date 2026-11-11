// Les insignes de grade des sapeurs-pompiers : des dessins génériques à nous, d'après la description réglementaire
// (sources : docs/decisions/0028-insignes-de-grade.md). Le grade est reconnu par son libellé : un grade saisi à la main
// sous un autre nom n'a pas d'insigne.

export type Couleur = 'rouge' | 'or' | 'argent';
// `trait` : le galon est traversé d'un trait rouge (adjudant, adjudant-chef).
export type Galon = { forme: 'barre' | 'chevron'; couleur: Couleur; trait?: true };

const barres = (...couleurs: Couleur[]): Galon[] => couleurs.map((couleur) => ({ forme: 'barre', couleur }));
const chevrons = (n: number, couleur: Couleur): Galon[] => Array.from({ length: n }, () => ({ forme: 'chevron', couleur }));

// Par libellé, sans accents ni majuscules (voir `cleDe`).
export const INSIGNES: Record<string, Galon[]> = {
	'sapeur 1re classe': chevrons(1, 'rouge'),
	caporal: chevrons(2, 'rouge'),
	'caporal chef': chevrons(3, 'rouge'),
	sergent: barres('or', 'or'),
	'sergent chef': barres('or', 'or', 'or'),
	adjudant: [{ forme: 'barre', couleur: 'argent', trait: true }],
	'adjudant chef': [{ forme: 'barre', couleur: 'or', trait: true }],
	lieutenant: barres('argent', 'argent'),
	capitaine: barres('argent', 'argent', 'argent'),
	commandant: barres('argent', 'argent', 'argent', 'argent'),
	'lieutenant colonel': barres('argent', 'or', 'argent', 'or', 'argent'),
	colonel: barres('argent', 'argent', 'argent', 'argent', 'argent')
};

// Les autres façons courantes d'écrire un grade.
const SYNONYMES: Record<string, string> = {
	'sapeur de 1re classe': 'sapeur 1re classe',
	'sapeur premiere classe': 'sapeur 1re classe',
	'sapeur de premiere classe': 'sapeur 1re classe'
};

// « Caporal-Chef », « caporal chef » et « CAPORAL-CHEF » se valent ; « 1ère », « 1re » et « 1e » aussi.
export function cleDe(libelle: string): string {
	const c = libelle
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[-'’]/g, ' ')
		.replace(/\b1(ere|re|e|ere)\b/g, '1re')
		.replace(/\s+/g, ' ')
		.trim();
	return SYNONYMES[c] ?? c;
}

export const insigneDe = (libelle: string | null | undefined): Galon[] | null => (libelle ? (INSIGNES[cleDe(libelle)] ?? null) : null);

// Le dessin, dans une case de 24 : les galons empilés et centrés sur la patte (barres de 2,4, chevrons de 4 de haut).
export function dessinDe(libelle: string | null | undefined): (Galon & { y: number; h: number })[] | null {
	const galons = insigneDe(libelle);
	if (!galons || galons.length === 0) return null;
	const hauteur = (g: Galon) => (g.forme === 'chevron' ? 4 : g.trait ? 4 : 2.4);
	const ecart = galons[0]!.forme === 'chevron' ? 1.6 : 1.2;
	const total = galons.reduce((n, g) => n + hauteur(g), 0) + ecart * (galons.length - 1);
	let y = 12 - total / 2;
	return galons.map((g) => {
		const d = { ...g, y, h: hauteur(g) };
		y += hauteur(g) + ecart;
		return d;
	});
}
