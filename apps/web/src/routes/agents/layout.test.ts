import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import Layout from './+layout.svelte';
import Erreur from './+error.svelte';
import Page from './+page.svelte';

const etat = vi.hoisted(() => ({ page: { url: new URL('http://x/agents'), status: 200, error: null as { message: string } | null } }));
vi.mock('$app/state', () => etat);

const enfants = createRawSnippet(() => ({ render: () => '<p>Contenu de la page</p>' }));
const groupes = [{ titre: 'Équipe 1', personnes: [{ id: 1, prenom: 'Alice', nom: 'Martin', grade: null }] }];
const lignes = [{ id: 1, prenom: 'Alice', nom: 'Martin', email: 'alice@exemple.fr', grade: null, equipe: null, statut: 'operationnel' }];
const filtres = { texte: '', equipe: '', statut: '' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: any, props: Record<string, unknown>) => render(composant, { props }).body;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tete = (composant: any, props: Record<string, unknown>) => render(composant, { props }).head;

describe('/agents : mise en page', () => {
	it('montre à un agent ordinaire la seule vue groupée, sans invite ni volet', () => {
		const data = { gestion: false, groupes };
		const mise = html(Layout, { data, children: enfants });
		expect(mise).toContain('Alice Martin');
		expect(mise).not.toContain('class="detail');
		expect(mise).not.toContain('Contenu de la page');
		expect(tete(Layout, { data, children: enfants })).toContain('<title>Agents · Gyro Caserne</title>');
		expect(html(Page, { data })).not.toContain('Choisissez un agent');
	});

	it('montre à la gestion la liste, le volet et l\'invite', () => {
		const data = { gestion: true, lignes, equipes: [], statuts: ['operationnel'], filtres };
		const mise = html(Layout, { data, children: enfants });
		expect(mise).toContain('Voir la fiche');
		expect(mise).toContain('class="detail');
		expect(mise).toContain('Contenu de la page');
		expect(tete(Layout, { data, children: enfants })).not.toContain('<title>');
		expect(html(Page, { data })).toContain('Choisissez un agent dans la liste.');
	});

	it('garde la liste visible et affiche le refus quand un agent ordinaire ouvre une fiche', () => {
		Object.assign(etat.page, { url: new URL('http://x/agents/3'), status: 403, error: { message: 'Accès réservé au chef de centre et à son adjoint' } });
		try {
			const data = { gestion: false, groupes };
			const mise = html(Layout, { data, children: createRawSnippet(() => ({ render: () => `<div>${html(Erreur, {})}</div>` })) });
			expect(mise).toContain('Alice Martin');
			expect(mise).not.toMatch(/class="liste[^"]*masquee/);
			expect(mise).toContain('403');
			expect(mise).toContain('Accès réservé au chef de centre et à son adjoint');
		} finally {
			Object.assign(etat.page, { url: new URL('http://x/agents'), status: 200, error: null });
		}
	});

	it('masque la liste derrière la fiche pour la gestion', () => {
		Object.assign(etat.page, { url: new URL('http://x/agents/3') });
		try {
			const data = { gestion: true, lignes, equipes: [], statuts: ['operationnel'], filtres };
			expect(html(Layout, { data, children: enfants })).toMatch(/class="liste[^"]*masquee/);
		} finally {
			Object.assign(etat.page, { url: new URL('http://x/agents') });
		}
	});
});
