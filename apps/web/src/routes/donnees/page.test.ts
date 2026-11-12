import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import Connexion from '../connexion/+page.svelte';
import Moi from '../moi/+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: unknown, data: Record<string, unknown>) => render(composant as any, { props: { data } }).body;

describe('/donnees', () => {
	it('le titre, et ce qui est gardé, où, qui le voit, combien de temps', () => {
		const page = html(Page, { connecte: true });
		expect(page).toMatch(/<h1[^>]*>Vos données dans Gyro Caserne<\/h1>/);
		for (const titre of ['Ce qui est gardé', 'Où', 'Qui les voit', 'Combien de temps', 'Copie de sécurité', 'Corriger ou effacer']) expect(page).toMatch(new RegExp(`<h2[^>]*>${titre}</h2>`));
		expect(page).toContain('Cloudflare');
		expect(page).toContain('Union européenne');
	});

	it('les durées : celles du centre pour les messages et les publications, 12 mois après un départ, copies 3 mois', () => {
		const page = html(Page, { connecte: true });
		// Centre fictif : réglages par défaut
		expect(page).toContain('Messages : 12 mois');
		expect(page).toContain('Publications des murs et leurs photos : 24 mois');
		expect(page).toContain('12 mois après votre départ');
		expect(page).toContain('gardées 3 mois');
	});

	it('qui voit quoi, sans dire plus que le code : aptitudes et fiche entière aux gestionnaires, anniversaire visible sauf s’il est masqué, message signalé lu par la modération', () => {
		const page = html(Page, { connecte: true });
		expect(page).not.toMatch(/photo\./);
		expect(page).toContain('Les agents du centre : votre nom, votre équipe, votre grade et le planning.');
		expect(page).toContain('Votre anniversaire, sauf si vous l’avez masqué');
		expect(page).toContain('Le chef de centre, son adjoint et le responsable de l’appli : votre fiche entière');
		expect(page).toContain('s’il est signalé, la personne chargée de la modération');
		expect(page).toMatch(/Saisi par le centre :[^<]*date de naissance/);
	});

	it('effacement sur demande auprès du chef de centre ; profil corrigé soi-même', () => {
		const page = html(Page, { connecte: true });
		expect(page).toContain('chef de centre');
		expect(page).toMatch(/<a[^>]*href="\/profil"/);
	});

	it('ouverte à tous : retour vers Moi une fois connecté, vers la connexion sinon, et pas de lien vers le profil sans connexion', () => {
		expect(html(Page, { connecte: true })).toMatch(/<a[^>]*href="\/moi"[^>]*>[\s\S]*?Moi/);
		const dehors = html(Page, { connecte: false });
		expect(dehors).toMatch(/<a[^>]*href="\/connexion"[^>]*>[\s\S]*?Connexion/);
		expect(dehors).not.toMatch(/href="\/profil"/);
	});

	it('un lien depuis Moi et depuis la connexion', () => {
		expect(html(Moi, { estPersonne: true })).toMatch(/<a[^>]*href="\/donnees"[^>]*>[\s\S]*?Vos données/);
		expect(html(Moi, { estPersonne: false })).toMatch(/<a[^>]*href="\/donnees"/);
		expect(html(Connexion, {})).toMatch(/<a[^>]*href="\/donnees"[^>]*>[\s\S]*?Vos données/);
	});
});
