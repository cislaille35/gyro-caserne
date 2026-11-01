import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const bancs = { id: 2, nom: 'Bancs', forme: 'jours', stock: 12, icone: 'groupe', ouverteReserve: false, gestionnaire: { type: 'comite', id: 2, nom: 'Amicale' }, jeGere: false };
const vl = { id: 1, nom: 'VL', forme: 'creneau', stock: null, icone: 'camion', ouverteReserve: true, gestionnaire: { type: 'role', id: 6, nom: 'Référent engins' }, jeGere: false };
const res = (r: Record<string, unknown>) => ({ id: 1, ressourceId: 2, ressource: 'Bancs', forme: 'jours', quantite: 5, mot: null, etat: 'acceptee', demandeur: 'Alice Test', telephone: null, motif: null, creeLe: 'x', mienne: false, annulable: false, ...r });
const html = (data: Record<string, unknown>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { ressource: bancs, reservations: [], peutReserver: true, reserveCitoyenne: false, jour: '2026-11-05', aujourdhui: '2026-11-04', ...data } } }).body;

describe('calendrier d’une ressource', () => {
	it('matériel : sept jours au téléphone, le mois à l’ordinateur, le stock restant chaque jour, qui a pris quoi', () => {
		const page = html({ reservations: [res({ debut: '2026-11-05', fin: '2026-11-06' }), res({ id: 2, debut: '2026-11-06', fin: '2026-11-06', quantite: 4, etat: 'attente', demandeur: 'Bruno Test', mienne: true })] });
		expect(page).toMatch(/<h1[^>]*>Bancs<\/h1>/);
		expect(page).toContain('12 en stock, gérés par Amicale.');
		expect(page).toMatch(/<h2[^>]*>Du 5 au 11 nov\.<\/h2>/);
		expect(page).toMatch(/href="\?jour=2026-10-29"[^>]*>[\s\S]*?Sept jours plus tôt/);
		expect(page).toMatch(/href="\?jour=2026-11-12"[^>]*>[\s\S]*?Sept jours plus tard/);
		expect(page).toMatch(/<h3[^>]*>vendredi 6 nov\.<\/h3>[\s\S]*?Reste 3 sur 12[\s\S]*?5 · Alice Test[\s\S]*?Acceptée[\s\S]*?4 · Bruno Test \(vous\)[\s\S]*?En attente/);
		expect(page).toMatch(/<h3[^>]*>lundi 9 nov\.<\/h3>[\s\S]*?Libre, 12 sur 12/);
		expect(page).toMatch(/<h2[^>]*>novembre 2026<\/h2>/);
		expect(page).toMatch(/<table[\s\S]*?<th[^>]*scope="col"[^>]*><abbr[^>]*title="lundi"[^>]*>lun\.<\/abbr><\/th>/);
		expect(page).toMatch(/href="\?jour=2026-10-01"[^>]*>[\s\S]*?Mois précédent/);
		expect(page).toMatch(/href="\?jour=2026-12-01"[^>]*>[\s\S]*?Mois suivant/);
		expect(page).toMatch(/href="\/reservations\/2\/reserver\?jour=2026-11-05"[^>]*>[\s\S]*?Réserver/);
		expect(page).toMatch(/href="\/reservations"[^>]*>[\s\S]*?Réservations/);
	});

	it('créneau : l’horaire de chaque réservation, le jour où elle tombe', () => {
		const page = html({ ressource: vl, reservations: [res({ ressourceId: 1, forme: 'creneau', ressource: 'VL', quantite: 1, debut: '2026-11-07T09:00', fin: '2026-11-07T12:00', demandeur: 'Mme Durand' })] });
		expect(page).toContain('Gérée par Référent engins. Un créneau libre est à vous tout de suite');
		expect(page).toMatch(/<h3[^>]*>samedi 7 nov\.<\/h3>[\s\S]*?9 h – 12 h · Mme Durand/);
		expect(page).not.toContain('Reste');
	});

	it('le compte de la réserve citoyenne : le nom saisi, sans « (vous) » ; une demande restée sans réponse le dit', () => {
		const page = html({ aujourdhui: '2026-11-06', ressource: vl, reservations: [res({ ressourceId: 1, forme: 'creneau', ressource: 'VL', quantite: 1, debut: '2026-11-05T09:00', fin: '2026-11-05T12:00', etat: 'attente', demandeur: 'M. Roux', nomDemandeur: 'M. Roux', mienne: true })] });
		expect(page).toContain('9 h – 12 h · M. Roux');
		expect(page).not.toContain('M. Roux (vous)');
		expect(page).toMatch(/<h3[^>]*>jeudi 5 nov\.<\/h3>[\s\S]*?Sans réponse/);
	});

	it('sans droit de réserver (gestionnaire seulement) : pas de bouton « Réserver »', () => {
		expect(html({ peutReserver: false })).not.toContain('/reserver');
	});
});
