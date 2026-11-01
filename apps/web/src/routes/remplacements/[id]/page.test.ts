import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { VueDemande } from '@gyro-caserne/socle';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
const { default: Page } = await import('./+page.svelte');

const gestes = { accepter: false, refuser: false, ouvrir: false, annuler: true, desister: false, valider: false };
const bruno = { id: 2, prenom: 'Bruno', nom: 'Test' };
const demande = (v: Partial<VueDemande> = {}) =>
	({
		id: 7,
		genre: 'remplacement',
		etat: 'attente',
		demandeur: { id: 1, prenom: 'Alice', nom: 'Test' },
		cible: null,
		remplacant: null,
		periodes: [{ debut: '2026-11-09T18:00', fin: '2026-11-10T06:00' }],
		periodesCible: [],
		manoeuvre: null,
		manoeuvreCible: null,
		texte: 'nuit du lundi 9 novembre',
		mot: null,
		motif: null,
		manque: [],
		creeLe: '2026-11-01T10:00',
		debut: '2026-11-09T18:00',
		fin: '2026-11-10T06:00',
		ouverte: true,
		moi: 'demandeur',
		manquePourMoi: [],
		gestes,
		...v
	}) as VueDemande;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (data: Record<string, unknown>) => render(Page as any, { props: { data: { disponibles: [], recue: 3, valideurs: [], envoyee: false, ...data }, form: null } }).body;

describe('page d’une demande', () => {
	it('juste envoyée : le dit ; la frise montre où elle en est ; les gestes possibles', () => {
		const html = page({ demande: demande(), envoyee: true });
		expect(html).toContain('Demande envoyée.');
		expect(html).toMatch(/Envoyée<span class="masque[^"]*"> : fait/);
		expect(html).toMatch(/aria-current="step"[\s\S]*?En attente d’un collègue/);
		expect(html).toContain('Annuler la demande');
	});

	it('conclue : frise complète et rappel de l’appli du SDIS', () => {
		const html = page({ demande: demande({ etat: 'conclue', remplacant: bruno, gestes: { ...gestes, annuler: false } }) });
		expect(html).toContain('Acceptée par Bruno Test');
		expect(html).toMatch(/Conclue<span class="masque[^"]*"> : fait/);
		expect(html).toContain('mettez à jour votre disponibilité dans l’appli du SDIS');
	});

	it('« Demande envoyée » n’est dit qu’au demandeur', () => {
		expect(page({ demande: demande({ moi: 'destinataire' }), envoyee: true })).not.toContain('Demande envoyée.');
	});
});
