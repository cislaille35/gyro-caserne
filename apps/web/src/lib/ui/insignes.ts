// Les insignes de grade des sapeurs-pompiers : des dessins génériques à nous, d'après l'annexe II de l'arrêté du 8 avril 2015
// modifié (sources : docs/decisions/0028-insignes-de-grade.md). Sur un carré noir : des galons obliques (inclinés à 22°) pour les
// sapeurs, caporaux et sergents, droits pour les adjudants et les officiers. Le grade est reconnu par son libellé : un grade saisi
// à la main sous un autre nom n'a pas d'insigne.

export type Couleur = 'rouge' | 'or' | 'argent';
// `bord` : galon argent bordé de rouge (sergents) ; `raie` : galon traversé d'une raie rouge (adjudants).
export type Galon = { forme: 'oblique' | 'droit'; couleur: Couleur; bord?: true; raie?: true };

const obliques = (n: number, couleur: Couleur, bord?: true): Galon[] => Array.from({ length: n }, () => ({ forme: 'oblique', couleur, ...(bord ? { bord } : {}) }));
const droits = (...couleurs: Couleur[]): Galon[] => couleurs.map((couleur) => ({ forme: 'droit', couleur }));

// Par libellé, sans accents ni majuscules (voir `cleDe`). Le sapeur de 2e classe n'a pas de galon : « Sapeur » seul non plus.
export const INSIGNES: Record<string, Galon[]> = {
	'sapeur 1re classe': obliques(1, 'rouge'),
	caporal: obliques(2, 'rouge'),
	'caporal chef': obliques(3, 'rouge'),
	sergent: obliques(1, 'argent', true),
	'sergent chef': obliques(3, 'argent', true),
	adjudant: [{ forme: 'droit', couleur: 'or', raie: true }],
	'adjudant chef': [{ forme: 'droit', couleur: 'argent', raie: true }],
	lieutenant: droits('argent', 'argent'),
	capitaine: droits('argent', 'argent', 'argent'),
	commandant: droits('argent', 'argent', 'argent', 'argent'),
	'lieutenant colonel': droits('argent', 'or', 'argent', 'or', 'argent'),
	colonel: droits('argent', 'argent', 'argent', 'argent', 'argent')
};

// Les autres façons courantes d'écrire un grade.
const SYNONYMES: Record<string, string> = {
	'sapeur de 1re classe': 'sapeur 1re classe',
	'sapeur premiere classe': 'sapeur 1re classe',
	'sapeur de premiere classe': 'sapeur 1re classe',
	'colonel hors classe': 'colonel',
	'lieutenant 1re classe': 'lieutenant',
	'lieutenant 2e classe': 'lieutenant',
	'lieutenant hors classe': 'lieutenant'
};

// « Caporal-Chef », « caporal chef » et « CAPORAL-CHEF » se valent ; « 1ère », « 1re » et « 1e » aussi.
export function cleDe(libelle: string): string {
	const c = libelle
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[-'’]/g, ' ')
		.replace(/\b1(ere|re|e)\b/g, '1re')
		.replace(/\b(de )?(1re|2e) classe\b/g, (_, _de, n) => `${n} classe`)
		.replace(/\s+/g, ' ')
		.trim();
	return SYNONYMES[c] ?? c;
}

export const insigneDe = (libelle: string | null | undefined): Galon[] | null => (libelle ? (INSIGNES[cleDe(libelle)] ?? null) : null);

// Les formes à tracer dans une case de 24, sur le carré noir (de 2 à 22) : des rectangles pour les galons droits, des
// parallélogrammes pour les obliques. Coordonnées arrondies au dixième.
export type Forme = { couleur: Couleur; bord?: true; raie?: true } & ({ x: number; y: number; l: number; h: number } | { points: string });
const r = (n: number) => Math.round(n * 10) / 10;
const PENTE = 16 * Math.tan((22 * Math.PI) / 180);

export function dessinDe(libelle: string | null | undefined): Forme[] | null {
	const galons = insigneDe(libelle);
	if (!galons || galons.length === 0) return null;
	if (galons[0]!.forme === 'oblique') {
		const l = 2.8;
		const ecart = 1.3;
		const total = galons.length * l + (galons.length - 1) * ecart + PENTE;
		return galons.map((g, i) => {
			const x = 12 - total / 2 + i * (l + ecart);
			const points = [
				[x, 20],
				[x + l, 20],
				[x + l + PENTE, 4],
				[x + PENTE, 4]
			]
				.map(([a, b]) => `${r(a!)},${r(b!)}`)
				.join(' ');
			return { couleur: g.couleur, ...(g.bord ? { bord: true } : {}), points };
		});
	}
	// Un galon seul (adjudants) est plus large, pour porter sa raie.
	const h = galons.length === 1 ? 5 : galons.length >= 4 ? 2.2 : 2.6;
	const ecart = galons.length >= 4 ? 1.4 : 1.8;
	const total = galons.length * h + (galons.length - 1) * ecart;
	return galons.map((g, i) => ({ couleur: g.couleur, ...(g.raie ? { raie: true } : {}), x: 4.5, y: r(12 - total / 2 + i * (h + ecart)), l: 15, h }));
}
