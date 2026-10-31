import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
const { default: Page } = await import('./+page.svelte');

const res = (r: Record<string, unknown>) => ({ id: 1, ressourceId: 2, ressource: 'Bancs', forme: 'jours', debut: '2026-11-12', fin: '2026-11-14', quantite: 4, mot: 'Anniversaire', etat: 'attente', demandeur: 'Alice Test', nomDemandeur: null, telephone: null, motif: null, creeLe: 'x', mienne: false, annulable: false, ...r });
const html = (data: Record<string, unknown>, form: unknown = null) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { form, data: { demandes: [], acceptees: [], ...data } } }).body;

describe('page « À valider »', () => {
	it('rien en attente : un écran vide', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>À valider<\/h1>/);
		expect(page).toContain('Aucune demande en attente.');
	});

	it('une demande : qui, quoi, quand, le mot ; « Accepter » d’un geste, « Refuser » avec un motif facultatif', () => {
		const page = html({ demandes: [{ demande: res({}), conflits: [] }] });
		expect(page).toMatch(/Bancs[\s\S]*?4 · du 12 au 14 nov\.[\s\S]*?Demandé par Alice Test[\s\S]*?Anniversaire/);
		expect(page).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/accepter"[\s\S]*?name="id" value="1"[\s\S]*?Accepter<span class="masque[^"]*"> la demande de Alice Test<\/span>/);
		expect(page).toMatch(/<summary[^>]*>Refuser[\s\S]*?action="\?\/refuser"[\s\S]*?<textarea[^>]*name="motif"/);
	});

	it('VL en conflit : la réservation acceptée qui chevauche, « Garder cette demande » ou « Garder l’autre »', () => {
		const page = html({
			demandes: [
				{
					demande: res({ id: 2, ressource: 'VL', forme: 'creneau', debut: '2026-11-07T10:00', fin: '2026-11-07T11:00', quantite: 1, demandeur: 'Bruno Test', mot: null }),
					conflits: [res({ id: 3, ressource: 'VL', forme: 'creneau', debut: '2026-11-07T09:00', fin: '2026-11-07T12:00', quantite: 1, etat: 'acceptee', demandeur: 'Mme Durand', telephone: '0600' })]
				}
			]
		});
		expect(page).toMatch(/Déjà réservée sur ce créneau[\s\S]*?Mme Durand[\s\S]*?7 nov\., 9 h – 12 h/);
		expect(page).toMatch(/action="\?\/accepter"[\s\S]*?Garder cette demande/);
		expect(page).toMatch(/action="\?\/refuser"[\s\S]*?name="motif" value="Créneau déjà réservé"[\s\S]*?Garder l’autre/);
	});

	it('les acceptées à venir, avec « Annuler » et un mot pour le demandeur ; téléphone de la réserve citoyenne', () => {
		const page = html({ acceptees: [res({ id: 5, etat: 'acceptee', nomDemandeur: 'Mme Durand', demandeur: 'Mme Durand', telephone: '06 00' })] });
		expect(page).toMatch(/<h2[^>]*>Acceptées à venir<\/h2>[\s\S]*?Demandé par Mme Durand[\s\S]*?href="tel:06 00"[\s\S]*?<summary[^>]*>Annuler[\s\S]*?action="\?\/annuler"[\s\S]*?name="mot"/);
	});
});
