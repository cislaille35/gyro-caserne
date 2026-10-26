import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import Layout from './+layout.svelte';
import Page from './+page.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://x/agents') } }));

const enfants = createRawSnippet(() => ({ render: () => '<p>Contenu de la page</p>' }));
const groupes = [{ titre: 'Équipe 1', personnes: [{ id: 1, prenom: 'Alice', nom: 'Martin', grade: null }] }];
const lignes = [{ id: 1, prenom: 'Alice', nom: 'Martin', email: 'alice@exemple.fr', grade: null, equipe: null, statut: 'operationnel' }];
const filtres = { texte: '', equipe: '', statut: '' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: any, props: Record<string, unknown>) => render(composant, { props }).body;

describe('/agents : mise en page', () => {
	it('montre à un agent ordinaire la seule vue groupée, sans invite ni volet', () => {
		const data = { gestion: false, groupes };
		const mise = html(Layout, { data, children: enfants });
		expect(mise).toContain('Alice Martin');
		expect(mise).not.toContain('class="detail');
		expect(mise).not.toContain('Contenu de la page');
		expect(html(Page, { data })).not.toContain('Choisissez un agent');
	});

	it('montre à la gestion la liste, le volet et l\'invite', () => {
		const data = { gestion: true, lignes, equipes: [], statuts: ['operationnel'], filtres };
		const mise = html(Layout, { data, children: enfants });
		expect(mise).toContain('Voir la fiche');
		expect(mise).toContain('class="detail');
		expect(mise).toContain('Contenu de la page');
		expect(html(Page, { data })).toContain('Choisissez un agent dans la liste.');
	});
});
