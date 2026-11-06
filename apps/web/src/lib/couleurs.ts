// Le texte posé sur une couleur venue du centre (équipe) : l'anthracite de l'appli ou le blanc, le plus lisible des deux ;
// si aucun n'atteint 4,5:1 (un bleu moyen), le noir pur, qui y arrive toujours dans ce cas.
const ANTHRACITE = '#1d2733';
const BLANC = '#ffffff';
const NOIR = '#000000';

function hex6(couleur: string): string | null {
	const c = couleur.trim().toLowerCase();
	if (/^#[0-9a-f]{6}$/.test(c)) return c;
	if (/^#[0-9a-f]{3}$/.test(c)) return `#${[...c.slice(1)].map((x) => x + x).join('')}`;
	return null;
}

function lumiere(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const contraste = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

export function encreSur(couleur: string): string {
	const hex = hex6(couleur);
	if (!hex) return ANTHRACITE;
	const l = lumiere(hex);
	const [fonce, clair] = [contraste(l, lumiere(ANTHRACITE)), contraste(l, 1)];
	if (Math.max(fonce, clair) >= 4.5) return fonce >= clair ? ANTHRACITE : BLANC;
	return NOIR;
}
