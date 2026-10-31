import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
const { default: Page } = await import('./+page.svelte');

const res = (r: Record<string, unknown>) => ({ id: 1, ressourceId: 2, ressource: 'Bancs', forme: 'jours', debut: '2026-11-12', fin: '2026-11-14', quantite: 4, mot: 'Anniversaire', etat: 'attente', demandeur: 'Alice Test', nomDemandeur: null, telephone: null, motif: null, creeLe: 'x', mienne: true, annulable: true, ...r });
const html = (data: Record<string, unknown>, form: unknown = null) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { form, data: { aVenir: [], passees: [], reservee: null, confirmer: null, ...data } } }).body;

describe('page « Mes réservations »', () => {
	it('rien : un écran vide qui mène aux réservations', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>Mes réservations<\/h1>/);
		expect(page).toContain('Aucune réservation pour le moment.');
		expect(page).toMatch(/href="\/reservations"[^>]*>Réserver/);
	});

	it('à venir : la ressource, la période, la quantité, l’état écrit, le mot ; « Annuler » ; puis les passées avec leur motif', () => {
		const page = html({
			aVenir: [res({}), res({ id: 2, ressource: 'VL', forme: 'creneau', debut: '2026-11-07T09:00', fin: '2026-11-07T12:00', quantite: 1, etat: 'acceptee', mot: null, demandeur: 'Mme Durand', nomDemandeur: 'Mme Durand', annulable: false })],
			passees: [res({ id: 3, etat: 'refusee', motif: 'Déjà prêtés', annulable: false })]
		});
		expect(page).toMatch(/<h2[^>]*>À venir<\/h2>[\s\S]*?id="reservation-1"[\s\S]*?Bancs[\s\S]*?En attente[\s\S]*?4 · du 12 au 14 nov\.[\s\S]*?Anniversaire[\s\S]*?href="\?annuler=1"[^>]*>Annuler/);
		expect(page).toMatch(/id="reservation-2"[\s\S]*?VL[\s\S]*?Acceptée[\s\S]*?7 nov\., 9 h – 12 h[\s\S]*?Pour Mme Durand/);
		expect(page).not.toContain('?annuler=2');
		expect(page).toMatch(/<h2[^>]*>Passées<\/h2>[\s\S]*?Refusée[\s\S]*?Déjà prêtés/);
	});

	it('?annuler=<id> : la confirmation dans la carte ; après une réservation, la phrase de réussite', () => {
		const page = html({ aVenir: [res({})], confirmer: 1, reservee: 'attente' });
		expect(page).toMatch(/Annuler cette réservation \?[\s\S]*?<form[^>]*method="POST"[^>]*action="\?\/annuler"[\s\S]*?name="id" value="1"/);
		expect(page).toMatch(/role="status"[^>]*>[\s\S]*?Demande envoyée : vous serez prévenu de la réponse\./);
		expect(html({ reservee: 'acceptee' })).toContain('Réservation acceptée : elle est à vous.');
	});
});
