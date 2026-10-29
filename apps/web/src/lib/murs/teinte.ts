import type { Mur } from '@gyro-caserne/socle';

// Les couleurs d'un mur (bande du mur, choix du mur), selon les mêmes règles que sa pastille.
export function teinteDuMur(type: Mur['type'], { icone, couleur }: { icone: string | null; couleur: string | null }) {
	if (type === 'centre') return { fond: 'var(--rouge)', encre: 'var(--sur-rouge)', trait: 'transparent' };
	if (icone && icone !== 'maison') return { fond: `var(--icone-${icone}-fond)`, encre: `var(--icone-${icone}-texte)`, trait: 'transparent' };
	if (couleur) return { fond: `color-mix(in srgb, ${couleur} 30%, var(--surface))`, encre: 'var(--encre)', trait: couleur };
	return { fond: 'var(--statut-neutre-fond)', encre: 'var(--encre)', trait: 'transparent' };
}
