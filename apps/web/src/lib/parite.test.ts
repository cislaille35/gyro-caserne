import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Téléphone et ordinateur : mêmes fonctions, mêmes informations. Le rendu est le même aux deux tailles ; seule la mise en page
// change. Ce test garantit qu'aucune règle « selon la largeur » des écrans du lot ne cache quelque chose.
const ECRANS = [
	'routes/remplacements/+page.svelte',
	'routes/remplacements/demander/+page.svelte',
	'routes/remplacements/[id]/+page.svelte',
	'routes/remplacements/manoeuvre/+page.svelte',
	'routes/moi/agenda/+page.svelte',
	'routes/planning/+page.svelte',
	'routes/+page.svelte',
	'lib/remplacements/ChoixSemaine.svelte',
	'lib/remplacements/ListeCollegues.svelte',
	'lib/remplacements/Progression.svelte',
	'lib/remplacements/Frise.svelte',
	'lib/remplacements/CarteDemande.svelte',
	'lib/planning/CarteAstreinte.svelte',
	'lib/planning/VueSemaine.svelte',
	'lib/planning/VueMois.svelte',
	'routes/planning/ete/+page.svelte',
	'routes/planning/preparer/fichier/+page.svelte',
	'routes/planning/preparer/+page.svelte',
	'routes/moi/vacances/+page.svelte',
	'routes/reglages/armement/+page.svelte',
	'routes/engins/+page.svelte',
	'routes/engins/[id]/+page.svelte',
	'routes/engins/fiches/+page.svelte',
	'routes/engins/fiches/[id]/+page.svelte',
	'routes/engins/fiches/fichier/+page.svelte',
	'routes/engins/prise/+page.svelte',
	'routes/engins/[id]/prise/+page.svelte',
	'routes/engins/[id]/prises/[prise]/+page.svelte',
	'lib/engins/FormulaireEngin.svelte',
	'lib/engins/ZonesFiche.svelte',
	'lib/planning/Panneau.svelte',
	'lib/ui/BarreActions.svelte',
	'lib/ui/EnTetePage.svelte'
];
const CACHE = /display:\s*none|visibility:\s*hidden|clip-path|clip:|opacity:\s*0[;\s]|width:\s*1px|height:\s*0/;

// Le contenu de chaque bloc @media, accolades équilibrées.
function blocsMedia(css: string): string[] {
	const blocs: string[] = [];
	for (let i = css.indexOf('@media'); i >= 0; i = css.indexOf('@media', i + 1)) {
		let profondeur = 0;
		let j = css.indexOf('{', i);
		const debut = j;
		for (; j < css.length; j++) {
			if (css[j] === '{') profondeur++;
			if (css[j] === '}' && --profondeur === 0) break;
		}
		blocs.push(css.slice(debut, j));
	}
	return blocs;
}

describe('téléphone et ordinateur : rien qui n’existe qu’à une taille', () => {
	it.each(ECRANS)('%s', (fichier) => {
		const source = readFileSync(new URL(`../${fichier}`, import.meta.url), 'utf8');
		const css = source.match(/<style>([\s\S]*)<\/style>/)?.[1] ?? '';
		for (const bloc of blocsMedia(css).filter((b) => !/prefers-reduced-motion/.test(b))) expect(bloc).not.toMatch(CACHE);
		// Ni classe ni condition propres à une taille dans le balisage.
		expect(source).not.toMatch(/innerWidth|matchMedia\(|seulement-(telephone|ordinateur)/);
	});
});

it('le contrôle voit bien une règle qui cache selon la largeur', () => {
	const [bloc] = blocsMedia('.a { color: red; } @media (min-width: 640px) { .b { display: none; } }');
	expect(bloc).toMatch(CACHE);
	expect(blocsMedia(readFileSync(new URL('./remplacements/ChoixSemaine.svelte', import.meta.url), 'utf8')).length).toBeGreaterThan(0);
});
