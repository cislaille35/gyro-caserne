import { createRawSnippet, type Component } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Bouton from './Bouton.svelte';
import Carte from './Carte.svelte';
import Champ from './Champ.svelte';
import PastilleEquipe from './PastilleEquipe.svelte';
import Statut from './Statut.svelte';
import Tableau from './Tableau.svelte';

const contenu = createRawSnippet(() => ({ render: () => '<span>Contenu</span>' }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: Component<any>, props: Record<string, unknown>) => render(composant, { props }).body;

describe('Champ', () => {
	const base = { id: 'email', libelle: 'Adresse e-mail', name: 'email' };

	it("relie le libellé à l'input", () => {
		const page = html(Champ, base);
		expect(page).toContain('<label for="email"');
		expect(page).toMatch(/<input[^>]*id="email"/);
		expect(page).toMatch(/<input[^>]*name="email"/);
		expect(page).not.toContain('aria-invalid');
	});

	it("signale l'erreur et la relie à l'input", () => {
		const page = html(Champ, { ...base, erreur: 'Adresse invalide' });
		expect(page).toContain('aria-invalid="true"');
		const ref = page.match(/aria-describedby="([^"]+)"/)![1];
		expect(page).toMatch(new RegExp(`id="${ref}"[^>]*>[^<]*Adresse invalide`));
	});

	it("relie l'aide à l'input", () => {
		const page = html(Champ, { ...base, aide: 'Celle de la caserne' });
		const ref = page.match(/aria-describedby="([^"]+)"/)![1];
		expect(page).toMatch(new RegExp(`id="${ref}"[^>]*>[^<]*Celle de la caserne`));
	});

	it("relie l'aide et l'erreur ensemble", () => {
		const page = html(Champ, { ...base, aide: 'Aide', erreur: 'Erreur' });
		const refs = page.match(/aria-describedby="([^"]+)"/)![1].split(' ');
		expect(refs).toHaveLength(2);
	});
});

describe('PastilleEquipe', () => {
	it('écrit le nom et cache la pastille de couleur', () => {
		const page = html(PastilleEquipe, { nom: 'Équipe A', couleur: '#2e7a1f' });
		expect(page).toContain('Équipe A');
		expect(page).toMatch(/<span[^>]*aria-hidden="true"/);
	});
});

describe('Statut', () => {
	it.each([
		['operationnel', 'Opérationnel'],
		['stagiaire', 'Stagiaire'],
		['inapte_temporaire', 'Inapte temporaire'],
		['suspendu', 'Suspendu'],
		['parti', 'Parti']
	])('%s s’écrit « %s »', (statut, texte) => {
		expect(html(Statut, { statut })).toContain(texte);
	});
});

describe('Tableau', () => {
	it('met la légende dans <caption>', () => {
		const page = html(Tableau, { legende: 'Liste des agents', children: contenu });
		expect(page).toMatch(/<caption[^>]*>\s*Liste des agents\s*<\/caption>/);
		expect(page).toContain('Contenu');
	});
});

describe('Carte', () => {
	it('relie le titre h2 à la section', () => {
		const page = html(Carte, { titre: 'Prochaine garde', children: contenu });
		const ref = page.match(/<section[^>]*aria-labelledby="([^"]+)"/)![1];
		expect(page).toMatch(new RegExp(`<h2[^>]*id="${ref}"[^>]*>Prochaine garde</h2>`));
	});
});

describe('Bouton', () => {
	it('est de type button par défaut', () => {
		expect(html(Bouton, { children: contenu })).toContain('type="button"');
	});
	it('accepte le type submit', () => {
		expect(html(Bouton, { type: 'submit', children: contenu })).toContain('type="submit"');
	});
});
