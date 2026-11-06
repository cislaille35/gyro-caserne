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
			['lib/ui/Rangee.svelte', '.rangee'],
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
