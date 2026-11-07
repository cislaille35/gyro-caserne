import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import { load } from './+page.server';
import Installer from '#lib/ui/Installer.svelte';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('/moi/installer', () => {
	it('connecté : la page, sans requête à la base ; sinon, la connexion', async () => {
		expect(await (load as any)({ locals: { acteur: { type: 'personne', id: 1 } } })).toEqual({});
		await expect((load as any)({ locals: { acteur: null } })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('côté serveur : le titre, et une attente le temps que le navigateur dise s’il est déjà installé (sans JavaScript : le menu du navigateur)', () => {
		const page = render(Page as any, { props: { data: {} } }).body;
		expect(page).toMatch(/<h1[^>]*>[\s\S]*?Installer l’appli/);
		expect(page).toContain('Vérification de cet appareil');
		expect(page).toMatch(/<noscript>[\s\S]*?Installer l’appli/);
	});

	it('l’encart de l’accueil n’est jamais rendu côté serveur : rien ne clignote dans l’appli installée', () => {
		expect(render(Installer as any, { props: { mode: 'encart' } }).body).not.toMatch(/<section/);
	});
});
