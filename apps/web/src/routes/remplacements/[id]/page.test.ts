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

	describe('les disponibles, groupés', () => {
		const agent = (id: number, prenom: string, aptitudes: boolean) => ({ id, prenom, nom: 'Test', aptitudes });
		const PHRASE_OK = 'Ont vos aptitudes contrôlées.';
		const PHRASE_CHEF = 'Il leur manque une de vos aptitudes contrôlées.';
		const nb = (html: string, texte: string) => html.split(texte).length - 1;

		it('« Sans validation » puis « À faire valider par le chef », la phrase une seule fois, les nombres venus des données', () => {
			const html = page({ demande: demande(), disponibles: [agent(1, 'Ana', true), agent(2, 'Bob', true), agent(3, 'Cléa', true), agent(4, 'Dan', false)] });
			expect(html).toMatch(/Disponibles[\s\S]*?<span class="compte[^"]*">4<[\s\S]*?Sans validation[\s\S]*?<span class="compte[^"]*">3<[\s\S]*?À faire valider par le chef[\s\S]*?<span class="compte[^"]*">1</);
			expect(nb(html, PHRASE_OK)).toBe(1);
			expect(nb(html, PHRASE_CHEF)).toBe(1);
			expect(html).toMatch(/Ana Test[\s\S]*?Cléa Test[\s\S]*?Il leur manque[\s\S]*?Dan Test/);
		});

		it('un groupe vide n’apparaît pas', () => {
			const html = page({ demande: demande(), disponibles: [agent(4, 'Dan', false)] });
			expect(html).not.toContain('Sans validation');
			expect(html).toContain('À faire valider par le chef');
		});

		it('personne de disponible : dit une fois', () => {
			const html = page({ demande: demande(), disponibles: [] });
			expect(html).toContain('Personne n’est disponible sur ces périodes pour le moment.');
			expect(html).not.toContain('Sans validation');
		});
	});

	it('« Demande envoyée » n’est dit qu’au demandeur', () => {
		expect(page({ demande: demande({ moi: 'destinataire' }), envoyee: true })).not.toContain('Demande envoyée.');
	});
});
