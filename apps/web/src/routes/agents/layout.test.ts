import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import Layout from './+layout.svelte';
import Erreur from './+error.svelte';
import Page from './+page.svelte';

const etat = vi.hoisted(() => ({ page: { url: new URL('http://x/agents'), status: 200, error: null as { message: string } | null } }));
vi.mock('$app/state', () => etat);

const enfants = createRawSnippet(() => ({ render: () => '<p>Contenu de la page</p>' }));
const groupes = [
	{
		titre: 'Équipe 1',
		equipe: { couleur: '#b3121f', chefs: ['A. Martin'] },
		personnes: [
			{ id: 1, prenom: 'Alice', nom: 'Martin', grade: 'Sergent-chef', roles: ['Chef d’équipe (Équipe 1)', 'Rapporteur (Amicale)'] },
			{ id: 2, prenom: 'Paul', nom: 'Durand', grade: null, roles: [] }
		]
	},
	{ titre: 'Équipe 4', equipe: { couleur: '#9a4b00', chefs: [] }, personnes: [{ id: 3, prenom: 'Inès', nom: 'Faure', grade: 'Caporal', roles: [] }] },
	{ titre: 'Sans équipe', equipe: null, personnes: [{ id: 4, prenom: 'Test', nom: 'Fictif', grade: null, roles: [] }] }
];
const ligne = (id: number, prenom: string, nom: string, autres: Record<string, unknown> = {}) => ({
	id,
	prenom,
	nom,
	email: `${prenom.toLowerCase()}@exemple.fr`,
	grade: 'Sapeur',
	statut: 'operationnel',
	roles: [],
	aCompleter: false,
	...autres
});
const gestion = (autres: Record<string, unknown> = {}) => ({
	gestion: true,
	groupes: [
		{ titre: 'Équipe 1', equipe: { couleur: '#b3121f', chefs: [] }, personnes: [ligne(1, 'Alice', 'Martin', { statut: 'stagiaire', aCompleter: true }), ligne(2, 'Paul', 'Durand')] },
		{ titre: 'Partis', equipe: null, personnes: [ligne(5, 'Zoé', 'Zorro', { statut: 'parti' })] }
	],
	comptes: { 'a-completer': 1, indisponibles: 1, partis: 1 },
	filtres: { texte: '', filtre: '' },
	...autres
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: any, props: Record<string, unknown>) => render(composant, { props }).body;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tete = (composant: any, props: Record<string, unknown>) => render(composant, { props }).head;
const boutonDuGroupe = (mise: string, titre: string) => mise.match(new RegExp(`<button[^>]*aria-expanded="(true|false)"[^>]*>\\s*<span class="textes[^"]*">\\s*<span class="titre[^"]*">${titre}`))?.[1];

describe('/agents : vue de tous', () => {
	const data = { gestion: false, groupes };

	it('groupe par équipe, ouverts, avec liseré, effectif et chef en résumé', () => {
		const mise = html(Layout, { data, children: enfants });
		expect(mise).toMatch(/<h1[^>]*>Agents<\/h1>/);
		expect(mise).toMatch(/<h2[^>]*>\s*<button[\s\S]*Équipe 1[\s\S]*2 agents · chef : A\. Martin/);
		expect(mise).toContain('border-left: 6px solid #b3121f');
		expect(boutonDuGroupe(mise, 'Équipe 1')).toBe('true');
		expect(boutonDuGroupe(mise, 'Sans équipe')).toBe('true');
		expect(mise).toMatch(/Sans équipe[\s\S]*1 agent</);
	});

	it('signale en alerte une équipe sans chef d’équipe', () => {
		const mise = html(Layout, { data, children: enfants });
		expect(mise).toMatch(/class="resume[^"]*alerte[^"]*">1 agent · sans chef d’équipe</);
		expect(mise.match(/class="resume[^"]*alerte/g)).toHaveLength(1);
	});

	it('montre nom, grade et rôles, sans statut, e-mail, filtres ni lien vers la fiche', () => {
		const mise = html(Layout, { data, children: enfants });
		expect(mise).toContain('Alice Martin');
		expect(mise).toContain('Sergent-chef');
		expect(mise).toMatch(/Rôles\s*:[\s\S]*Chef d’équipe \(Équipe 1\)[\s\S]*Rapporteur \(Amicale\)/);
		expect(mise.match(/Rôles/g)).toHaveLength(1);
		expect(mise).not.toContain('@exemple.fr');
		expect(mise).not.toContain('aria-pressed');
		expect(mise).not.toContain('class="statut');
		expect(mise).not.toContain('href="/agents/');
		expect(mise).not.toContain('class="detail');
		expect(mise).not.toContain('Contenu de la page');
		expect(tete(Layout, { data, children: enfants })).toContain('<title>Agents · Gyro Caserne</title>');
		expect(html(Page, { data })).not.toContain('Choisissez un agent');
	});

	it('garde la liste visible et affiche le refus quand un agent ordinaire ouvre une fiche', () => {
		Object.assign(etat.page, { url: new URL('http://x/agents/3'), status: 403, error: { message: 'Accès réservé au chef de centre et à son adjoint' } });
		try {
			const mise = html(Layout, { data, children: createRawSnippet(() => ({ render: () => `<div>${html(Erreur, {})}</div>` })) });
			expect(mise).toContain('Alice Martin');
			expect(mise).not.toMatch(/class="liste[^"]*masquee/);
			expect(mise).toContain('403');
			expect(mise).toContain('Accès réservé au chef de centre et à son adjoint');
		} finally {
			Object.assign(etat.page, { url: new URL('http://x/agents'), status: 200, error: null });
		}
	});
});

describe('/agents : gestion', () => {
	it('montre la liste, le volet, l’invite et les liens de gestion', () => {
		const mise = html(Layout, { data: gestion(), children: enfants });
		expect(mise).toMatch(/<a[^>]*href="\/agents\/fichier"[^>]*>Fichier de l'effectif<\/a>/);
		expect(mise).toContain('class="detail');
		expect(mise).toContain('Contenu de la page');
		expect(tete(Layout, { data: gestion(), children: enfants })).not.toContain('<title>');
		expect(html(Page, { data: gestion() })).toContain('Choisissez un agent dans la liste.');
	});

	it('une ligne : lien vers la fiche au nom de l’agent, e-mail, statut hors opérationnel, fiche à compléter', () => {
		const mise = html(Layout, { data: gestion(), children: enfants });
		expect(mise).toMatch(/<a[^>]*href="\/agents\/1"[^>]*>Alice Martin<\/a>/);
		expect(mise).toContain('alice@exemple.fr');
		expect(mise).toMatch(/Alice Martin[\s\S]*Stagiaire[\s\S]*À compléter[\s\S]*Paul Durand/);
		expect(mise).not.toContain('Opérationnel');
		expect(mise).toMatch(/class="resume[^"]*alerte[^"]*">2 agents · sans chef d’équipe</);
	});

	it('replie les partis, sauf s’ils sont filtrés ou cherchés', () => {
		expect(boutonDuGroupe(html(Layout, { data: gestion(), children: enfants }), 'Équipe 1')).toBe('true');
		expect(boutonDuGroupe(html(Layout, { data: gestion(), children: enfants }), 'Partis')).toBe('false');
		expect(boutonDuGroupe(html(Layout, { data: gestion({ filtres: { texte: '', filtre: 'partis' } }), children: enfants }), 'Partis')).toBe('true');
		expect(boutonDuGroupe(html(Layout, { data: gestion({ filtres: { texte: 'zo', filtre: '' } }), children: enfants }), 'Partis')).toBe('true');
	});

	it('filtres en boutons pressés, dans le formulaire GET avec la recherche', () => {
		const mise = html(Layout, { data: gestion({ filtres: { texte: 'mar', filtre: 'a-completer' } }), children: enfants });
		const formulaire = mise.match(/<form[^>]*method="GET"[\s\S]*?<\/form>/)![0];
		expect(formulaire).toMatch(/<input[^>]*name="texte"[^>]*value="mar"/);
		// Entrée dans la recherche garde le filtre en cours : le premier bouton le porte.
		expect(formulaire.match(/<button[^>]*>/)![0]).toMatch(/name="filtre"[^>]*value="a-completer"|value="a-completer"[^>]*name="filtre"/);
		const pastille = (libelle: string) => formulaire.match(new RegExp(`<button[^>]*aria-pressed="(true|false)"[^>]*>${libelle}`))?.[1];
		expect(pastille('Tous')).toBe('false');
		expect(pastille('À compléter \\(1\\)')).toBe('true');
		expect(pastille('Indisponibles \\(1\\)')).toBe('false');
		expect(pastille('Partis')).toBe('false');
		expect(html(Layout, { data: gestion(), children: enfants })).toMatch(/aria-pressed="true"[^>]*>Tous/);
	});

	it('dit quand aucun agent ne correspond', () => {
		expect(html(Layout, { data: gestion({ groupes: [] }), children: enfants })).toContain('Aucun agent ne correspond.');
	});

	it('masque la liste derrière la fiche et marque l’agent affiché', () => {
		Object.assign(etat.page, { url: new URL('http://x/agents/2') });
		try {
			const mise = html(Layout, { data: gestion(), children: enfants });
			expect(mise).toMatch(/class="liste[^"]*masquee/);
			expect(mise).toMatch(/<a[^>]*href="\/agents\/2"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/agents\/2"/);
			expect(mise.match(/aria-current="page"/g)).toHaveLength(1);
		} finally {
			Object.assign(etat.page, { url: new URL('http://x/agents') });
		}
	});
});
