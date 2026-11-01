import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const vl = { id: 1, nom: 'VL', forme: 'creneau', stock: null, icone: 'camion', ouverteReserve: true, gestionnaire: { type: 'role', id: 6, nom: 'Référent engins' }, jeGere: false };
const bancs = { id: 2, nom: 'Bancs', forme: 'jours', stock: 12, icone: 'groupe', ouverteReserve: false, gestionnaire: { type: 'comite', id: 2, nom: 'Amicale' }, jeGere: false };
const html = (data: Record<string, unknown>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { ressources: [vl, bancs], peutReserver: true, reserveCitoyenne: false, aValider: 0, mesAVenir: 0, peutGererMateriel: false, ...data } } }).body;

describe('page des réservations', () => {
	it('« Mes réservations » en tête, puis la VL, puis le matériel ; retour à Caserne', () => {
		const page = html({ mesAVenir: 2 });
		expect(page).toMatch(/<h1[^>]*>Réservations<\/h1>/);
		expect(page).toMatch(/href="\/caserne"[^>]*>[\s\S]*?Caserne/);
		expect(page).toMatch(/href="\/reservations\/miennes"[\s\S]*?Mes réservations[\s\S]*?2 à venir[\s\S]*?href="\/reservations\/1"[\s\S]*?VL[\s\S]*?Par créneau, acceptée d’office si libre[\s\S]*?href="\/reservations\/2"[\s\S]*?Bancs[\s\S]*?12 en stock · validé par Amicale/);
		expect(page).not.toContain('/reservations/a-valider');
		expect(page).not.toContain('/reservations/materiel');
	});

	it('qui gère : « À valider » avec son compte, « Gérer le matériel »', () => {
		const page = html({ aValider: 3, peutGererMateriel: true });
		expect(page).toMatch(/href="\/reservations\/a-valider"[\s\S]*?À valider[\s\S]*?3 en attente/);
		expect(page).toMatch(/href="\/reservations\/materiel"[\s\S]*?Gérer le matériel/);
	});

	it('rien à réserver : un écran vide qui l’explique', () => {
		const page = html({ ressources: [], peutReserver: false });
		expect(page).toContain('Rien à réserver pour vous.');
	});
});
