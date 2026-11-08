import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// La nouvelle identité : boutons en rectangles arrondis, cartes arrondies, la pilule réservée aux états
// (pastilles, compteurs, interrupteurs, marques écrites).
const racine = new URL('.', import.meta.url).pathname;
const fichiers = (dossier: string): string[] =>
	readdirSync(join(racine, dossier), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? fichiers(join(dossier, e.name)) : e.name.endsWith('.svelte') ? [join(dossier, e.name)] : []));
const source = (f: string) => readFileSync(join(racine, f), 'utf8');

function pilules(f: string): string[] {
	const s = source(f);
	const css = s.slice(Math.max(0, s.indexOf('<style')));
	return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
		.filter((m) => m[2].includes('border-radius: 999px'))
		.map((m) => `${f} | ${m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/<style>/, '').replace(/\s+/g, ' ').trim()}`);
}

// Les seules pilules : des états et des nombres, jamais un bouton ni un lien d'action.
const ETATS = [
	'lib/ui/Pastille.svelte | .pastille',
	'lib/ui/Statut.svelte | .statut',
	'lib/ui/Coquille.svelte | .nombre',
	'lib/ui/Bulle.svelte | .photo-seule .meta',
	'lib/ui/Bulle.svelte | .reaction',
	'lib/messagerie/Conversation.svelte | .jour span',
	'lib/messagerie/Conversation.svelte | .descendre .nombre',
	'lib/messagerie/Conversation.svelte | .annonce.visible',
	'lib/messagerie/InfosCote.svelte | .animateur',
	'routes/echanges/messages/[id]/infos/+page.svelte | .animateur',
	'lib/remplacements/ChoixSemaine.svelte | .choisie',
	'lib/remplacements/ChoixSemaine.svelte | .plage',
	'lib/planning/VueSemaine.svelte | .plage',
	'lib/planning/VueSemaine.svelte | .marque',
	'lib/planning/VueAnnee.svelte | .marque',
	'lib/engins/ZonesFiche.svelte | .quantite',
	'routes/engins/[id]/prise/+page.svelte | .quantite',
	'routes/engins/fiches/[id]/+page.svelte | .quantite',
	'routes/echanges/+layout.svelte | .officiel',
	'routes/agents/[id]/+page.svelte | .expiree',
	'routes/agents/[id]/+page.svelte | .role',
	'routes/remplacements/+page.svelte | .compte',
	'routes/planning/ete/+page.svelte | .compte',
	'routes/planning/ete/+page.svelte | .etiquette',
	'routes/nominations/+page.svelte | .titulaire',
	"routes/moi/notifications/+page.svelte | [role='switch']",
	'routes/moi/notifications/+page.svelte | .glissiere'
];

describe('formes', () => {
	it('la pilule est réservée aux états : aucun bouton ni lien d’action en pilule', () => {
		const trouvees = [...fichiers('lib'), ...fichiers('routes')].flatMap(pilules);
		expect(trouvees.filter((p) => !ETATS.includes(p))).toEqual([]);
	});

	it('les boutons et liens d’action : le rayon des boutons', () => {
		expect(source('lib/ui/Bouton.svelte')).toMatch(/button \{[^}]*border-radius: var\(--rayon-bouton\)/);
		expect(source('lib/ui/EnTetePage.svelte')).toMatch(/\.action \{[^}]*border-radius: var\(--rayon-bouton\)/);
		expect(readFileSync(join(racine, 'app.css'), 'utf8')).toMatch(/\.lien-secondaire \{[^}]*border-radius: var\(--rayon-bouton\)/);
	});

	it('les choix en blocs segmentés : vues du Planning, casquettes, Murs | Messages, réponses Présent / Absent / Incertain, onglets des remplacements', () => {
		expect(source('routes/planning/+page.svelte')).toMatch(/<nav class="segments vues" aria-label="Vue du planning">/);
		expect(source('lib/ui/Casquettes.svelte')).toMatch(/<ul role="list" class="segments">/);
		expect(source('lib/ui/FiltresEchanges.svelte')).toMatch(/<nav class="segments filtres" aria-label="Filtrer les échanges">/);
		expect(source('routes/remplacements/+page.svelte')).toMatch(/<nav class="segments onglets" aria-label="Remplacements">/);
		expect(source('lib/ui/ANePasManquer.svelte')).toMatch(/role="group"[^>]*class="segments boutons"/);
		expect(source('lib/ui/Publication.svelte')).toMatch(/role="group"[^>]*class="segments reponses"/);
		expect(source('routes/planning/+page.svelte')).toMatch(/role="group"[^>]*class="segments boutons"/);
		// L'ancienne forme a disparu de ces écrans.
		for (const f of ['routes/planning/+page.svelte', 'lib/ui/ANePasManquer.svelte', 'lib/ui/Publication.svelte']) expect(source(f), f).not.toMatch(/^\s*\.(bascule|reponse)\b/m);
	});

	it('les cartes : sans bord fin, l’ombre douce et le rayon des cartes (un bord transparent reste pour le mode contrasté)', () => {
		const cartes: [string, string][] = [
			['lib/ui/Carte.svelte', 'section'],
			['lib/ui/Groupe.svelte', '.groupe'],
			['lib/ui/Publication.svelte', '.publication'],
			['routes/echanges/+layout.svelte', '.centre'],
			['lib/planning/CarteAstreinte.svelte', '.plaque'],
			['lib/planning/VueMois.svelte', '.carte']
		];
		for (const [f, sel] of cartes) {
			const regle = source(f).match(new RegExp(`\\n\\t${sel.replace('.', '\\.')} \\{([^}]*)\\}`))![1];
			expect(regle, f).toMatch(/border: 1px solid transparent;/);
			expect(regle, f).toMatch(/box-shadow: var\(--ombre-carte\);/);
			expect(regle, f).toMatch(/border-radius: var\(--rayon-grand\);/);
		}
	});

	it('une carte par groupe de lignes : les lignes séparées par un trait fin, sans carte chacune', () => {
		const css = readFileSync(join(racine, 'app.css'), 'utf8');
		const carte = css.match(/\n\.lignes \{([^}]*)\}/)![1];
		expect(carte).toMatch(/border: 1px solid transparent;/);
		expect(carte).toMatch(/box-shadow: var\(--ombre-carte\);/);
		expect(carte).toMatch(/border-radius: var\(--rayon-grand\);/);
		expect(carte).toMatch(/background: var\(--surface\);/);
		expect(css).toMatch(/\.lignes > li \+ li \{\s*border-top: 1px solid var\(--trait-doux\);/);
		// Le titre du groupe au-dessus de la carte : un vrai titre, en condensé, à l'encre.
		expect(css).toMatch(/\.titre-groupe \{[^}]*font: 700 var\(--texte-18\)\/1\.2 var\(--police-titre\);[^}]*color: var\(--encre\);/);
		expect(css.match(/\.titre-groupe \{([^}]*)\}/)![1]).not.toMatch(/uppercase|letter-spacing/);
		// Une ligne n'est plus une carte.
		const ligne = source('lib/ui/Rangee.svelte').match(/\n\t\.rangee \{([^}]*)\}/)![1];
		expect(ligne).not.toMatch(/box-shadow|border-radius|border:/);
		// Les listes faites à la main suivent la même forme.
		const aLaMain: [string, RegExp][] = [
			['routes/notifications/+page.svelte', /<ul class="lignes" role="list">/],
			['routes/remplacements/+page.svelte', /<ul role="list" class="lignes">/],
			['routes/echanges/+layout.svelte', /<ul class="lignes">\s*\{#each s\.groupes/],
			['routes/reservations/miennes/+page.svelte', /<ul role="list" class="lignes">/],
			['routes/reservations/a-valider/+page.svelte', /<ul role="list" class="lignes">/],
			['lib/messagerie/ListeConversations.svelte', /<ul class="lignes"/]
		];
		for (const [f, motif] of aLaMain) expect(source(f), f).toMatch(motif);
	});

	it('la ligne entière est cliquable, son repère du clavier visible sur toute la ligne, cible de 44 px au moins', () => {
		const s = source('lib/ui/Rangee.svelte');
		expect(s).toMatch(/\n\t\.rangee \{[^}]*min-height: var\(--cible\);/);
		expect(s).toMatch(/a\.rangee:focus-visible \{\s*outline-offset: -3px;/);
		// Avec des gestes, le titre s'étend à la ligne ; son repère entoure la ligne ; les gestes restent au-dessus.
		expect(s).toMatch(/\.etire::after \{[^}]*position: absolute;[^}]*inset: 0;/);
		expect(s).toMatch(/\.etire:focus-visible::after \{[^}]*outline: 3px solid var\(--focus\);[^}]*outline-offset: -3px;/);
		expect(s).toMatch(/\.inclus \{[^}]*position: relative;[^}]*z-index: 1;/);
	});

	it('« Gérer » du chef : trois cases de gestes courts', () => {
		expect(source('routes/+page.svelte')).toMatch(/<ul role="list" class="lignes grille-gestes">/);
	});

	it('le repère du clavier reste visible : dans les liens de la bande de la plaque (rognée) et sur « ma semaine »', () => {
		expect(source('lib/planning/CarteAstreinte.svelte')).toMatch(/\.gestes a:focus-visible \{\s*outline-offset: -3px;/);
		expect(source('lib/planning/VueMois.svelte')).toMatch(/\.mienne td a \{[^}]*outline-offset: -3px;/);
		expect(source('lib/planning/CarteAstreinte.svelte')).toMatch(/\.aplat \{[^}]*--focus: var\(--sur-equipe\)/);
	});

	it('le bloc de choix : un fond, l’option choisie en encre pleine, en gras, avec la coche pour une bascule', () => {
		const css = readFileSync(join(racine, 'app.css'), 'utf8');
		expect(css).toMatch(/\.segments \{[^}]*background: var\(--segment-fond\)/);
		expect(css).toMatch(/\.segments :is\(\[aria-current='page'\], \[aria-current='true'\], \[aria-pressed='true'\]\) \{[^}]*background: var\(--encre\);[^}]*color: var\(--fond\);[^}]*font-weight: 700/);
		expect(css).toMatch(/\.segments \[aria-pressed='true'\]::before \{[^}]*content: '✓' \/ ''/);
		expect(css).toMatch(/\.segments :is\(a, button\) \{[^}]*min-height: var\(--cible\)/);
		// En mode contrasté, le fond plein disparaît : un contour le remplace.
		expect(css).toMatch(/@media \(forced-colors: active\) \{\s*\.segments :is\(\[aria-current='page'\], \[aria-current='true'\], \[aria-pressed='true'\]\) \{\s*outline: 2px solid CanvasText;/);
		// Quatre onglets des remplacements : à la ligne, aucun caché hors de l'écran.
		expect(source('routes/remplacements/+page.svelte')).toMatch(/\.onglets \{\s*flex-wrap: wrap;/);
	});
});

// La direction B (décision 0026) : ni halo ni dégradé, et des échelles en jetons plutôt que des valeurs en dur.
describe('direction B', () => {
	const HORS_ECHELLE = /^lib\/(gyro|meteo|animations)\//;
	const ecrans = [...fichiers('lib'), ...fichiers('routes')].filter((f) => f.endsWith('.svelte') && !HORS_ECHELLE.test(f));
	const style = (f: string) => {
		const s = source(f);
		return s.slice(Math.max(0, s.indexOf('<style')));
	};
	const relever = (motif: RegExp) => ['app.css', ...ecrans].flatMap((f) => [...(f === 'app.css' ? source(f) : style(f)).matchAll(motif)].map((m) => `${f} | ${m[0].trim()}`));

	it('la graisse 700 de Barlow est servie : pas de faux gras', () => {
		expect(source('app.css')).toContain("@import '@fontsource/barlow/700.css';");
	});

	it('aucun halo coloré sous un bouton', () => {
		expect(relever(/box-shadow:[^;]*--rouge[^;]*;/g)).toEqual([]);
	});

	it('aucun dégradé, hors la bande de marquage et la colonne du menu', () => {
		const dehors = relever(/(linear|radial)-gradient\([^;]*;/g).filter((l) => !l.startsWith('app.css |') && !l.startsWith('lib/ui/Coquille.svelte'));
		expect(dehors).toEqual([]);
	});

	it('une icône sans tuile : ni fond ni teinte', () => {
		const s = source('lib/ui/IconeRole.svelte');
		expect(s).not.toMatch(/style:background/);
		expect(s).not.toMatch(/--icone-/);
	});

	it('les espacements viennent de l’échelle', () => {
		expect(relever(/(?:^|\n)\s*(?:gap|row-gap|column-gap|padding[a-z-]*|margin[a-z-]*):[^;]*(?<![-\d.])(?:[4-9]|[1-3]\d|4[0-8])px[^;]*;/g)).toEqual([]);
	});

	it('les tailles de texte viennent de l’échelle', () => {
		expect(relever(/(?:font-size: *|font: *\d+ +)(?:0?\.\d+|1(?:\.\d+)?|2)rem/g)).toEqual([]);
	});

	it('les rayons viennent des jetons, sauf la pilule et les petits détails', () => {
		expect(relever(/border-radius: *(?:[5-9]|[1-9]\d|[1-8]\d\d)px/g)).toEqual([]);
	});

	it('un seul bouton principal : à-plat rouge, sans contour', () => {
		const principal = source('lib/ui/Bouton.svelte').match(/\.principal \{([^}]*)\}/)![1];
		expect(principal).toMatch(/background: var\(--rouge\);/);
		expect(principal).toMatch(/border: 1px solid transparent;/);
		expect(relever(/border: 2px solid var\(--encre\);[^}]*background: var\(--rouge\)|background: var\(--rouge\);[^}]*border: 2px solid var\(--encre\)/g)).toEqual([]);
	});

	it('un seul bouton secondaire : le contour fin de « .lien-secondaire »', () => {
		const secondaire = source('lib/ui/Bouton.svelte').match(/\.secondaire \{([^}]*)\}/)![1];
		expect(secondaire).toMatch(/border: 1px solid var\(--trait\);/);
		expect(relever(/border: 2px solid var\(--trait\);/g)).toEqual([]);
	});

	it('un seul style de champ, posé par app.css', () => {
		expect(source('app.css')).toMatch(/:where\(textarea, select, input:not\(\[type='checkbox'\], \[type='radio'\], \[type='file'\]\)\) \{[^}]*border: 1px solid var\(--doux\);/);
		// L'interrupteur de la vue Année est une case dessinée, pas un champ.
		const ecrit = ecrans.filter((f) => f !== 'lib/planning/VueAnnee.svelte').filter((f) => /(?:^|\n)\s*(?:[.\w-]+ )?(?:input|textarea|select)(?:\s|,)[^{}]*\{[^}]*border: [^;]*var\(--(?:doux|trait|encre|statut-neutre-trait)\)/.test(style(f)));
		expect(ecrit).toEqual([]);
		expect(style('lib/ui/FormulairePublication.svelte')).not.toMatch(/\.saisie \{[^}]*border:/);
	});

	it('une seule couleur de bouton radio, posée par app.css', () => {
		expect(source('app.css')).toMatch(/:where\(input\[type='radio'\]\) \{[^}]*accent-color: var\(--encre\);/);
		expect(relever(/accent-color: (?!var\(--encre\))[^;]*;/g)).toEqual([]);
	});

	it('une liste déroulante passe par « Choix »', () => {
		expect(ecrans.filter((f) => f !== 'lib/ui/Choix.svelte' && /<select\b/.test(source(f)))).toEqual([]);
	});

	it('un champ fichier est dessiné : aucun champ natif visible hors « ChampPhoto »', () => {
		expect(ecrans.filter((f) => !['lib/ui/ChampPhoto.svelte', 'lib/messagerie/Saisie.svelte'].includes(f) && /type="file"/.test(source(f)))).toEqual([]);
	});

	it('un fichier à importer : pas de nom ni de « Retirer », la page reprend la main sur le champ', () => {
		const s = source('lib/ui/ChampPhoto.svelte');
		expect(s).toMatch(/const lire = \(\) => \{\s*if \(icone === 'fichier'\) return;/);
		expect(s).toMatch(/\.js \.zone:has\(input:disabled\) \{[^}]*opacity:/);
	});

	it('« Géré par » garde un comité après une action', () => {
		expect(source('routes/reservations/materiel/+page.svelte')).toMatch(/<Choix id="ajouter-comite"[^>]*valeur=\{valeur\('comite'\) \|\| String\(data\.comites\[0\]!\.id\)\}/);
	});

	it('« Aujourd’hui au centre » : des initiales lisibles et « Souhaiter » qui a l’air d’une action', () => {
		const s = style('routes/echanges/+layout.svelte');
		expect(s).toMatch(/background: var\(--statut-neutre-fond\);\s*color: var\(--statut-neutre-texte\);/);
		expect(s).toMatch(/\.souhaiter \{[^}]*border: 1px solid var\(--trait\);/);
	});

	it('une option choisie ne saute pas : son bord plus épais est repris sur le retrait', () => {
		const fautifs = ecrans.filter((f) => /border: 2px solid var\(--encre\);\s*padding: var\(--espace-8\) var\(--espace-12\);/.test(style(f)));
		expect(fautifs).toEqual([]);
	});

	it('l’interrupteur de la vue Année garde sa piste : ce n’est pas un champ', () => {
		expect(style('lib/planning/VueAnnee.svelte')).toMatch(/\.interrupteur input \{[^}]*border: 2px solid var\(--doux\);[^}]*border-radius: var\(--rayon-grand\);/);
	});

	// Le mouvement (lot 2) : des jetons, un retour à l'appui commun, des panneaux qui viennent de quelque part.
	it('des durées et des courbes en jetons, jamais écrites dans un écran', () => {
		const css = source('app.css');
		for (const jeton of ['--courbe-sortie: cubic-bezier(0.23, 1, 0.32, 1);', '--courbe-tiroir: cubic-bezier(0.32, 0.72, 0, 1);', '--duree-appui: 160ms;', '--duree-panneau: 240ms;', '--duree-etat: 150ms;']) expect(css).toContain(jeton);
		expect(relever(/transition: *(?!none)[^;]*\d(?:ms|s)\b[^;]*;/g)).toEqual([]);
	});

	it('tout ce qui se touche répond à l’appui, sauf si le mouvement est réduit', () => {
		expect(source('app.css')).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{[^@]*:where\(button:not\(:disabled\)[^)]*\)[^{]*:active \{\s*transform: scale\(0\.97\);/);
	});

	it('le panneau et les fenêtres s’ouvrent en glissant ou en apparaissant, sans mouvement si c’est réduit', () => {
		const panneau = style('lib/planning/Panneau.svelte');
		expect(panneau).toMatch(/prefers-reduced-motion: no-preference[\s\S]*\.panneau \{[^}]*transition: transform var\(--duree-panneau\) var\(--courbe-tiroir\);[\s\S]*@starting-style \{\s*transform: translateY\(100%\);/);
		expect(source('app.css')).toMatch(/prefers-reduced-motion: no-preference[\s\S]*dialog\[open\]:not\(\.panneau\)[^{]*\{[^}]*transition:[^;]*var\(--duree-panneau\)[\s\S]*@starting-style \{\s*opacity: 0;\s*transform: scale\(0\.97\);/);
	});

	it('tirer pour actualiser suit le doigt : la hauteur n’est pas animée', () => {
		expect(source('lib/animations/TirerPourActualiser.svelte')).not.toMatch(/transition: height/);
	});

	it('le survol est réservé aux appareils qui en ont un', () => {
		// Sans les blocs déjà réservés, aucune règle de survol ne doit rester.
		const dehors = ['app.css', ...ecrans].flatMap((f) => {
			const sans = (f === 'app.css' ? source(f) : style(f)).replace(/@media \(hover: hover\) and \(pointer: fine\) \{(?:[^{}]*\{[^{}]*\})*\s*\}/g, '');
			return [...sans.matchAll(/[^{}\n]*:hover[^{}]*\{/g)].map((m) => `${f} | ${m[0].trim()}`);
		});
		expect(dehors).toEqual([]);
	});
});
