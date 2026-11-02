import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Liste from './+page.svelte';
import Anomalie from './[id]/+page.svelte';
import Signaler from './signaler/+page.svelte';

/* eslint-disable @typescript-eslint/no-explicit-any */
const html = (Page: unknown, data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data, form } }).body;
/* eslint-enable @typescript-eslint/no-explicit-any */
const ligne = (id: number, plus: Record<string, unknown> = {}) => ({ id, enginId: 1, engin: 'VTU', zone: 'Coffres', libelle: 'Treuil HS', genre: 'abime', manque: null, etape: 'signalee', motif: null, signaleeLe: '2026-10-30T18:10', bloquante: false, closeLe: null, photo: null, ...plus });
const vue = (plus: Record<string, unknown> = {}) => ({
	id: 3,
	engin: { id: 1, nom: 'VTU', type: 'VTU', etat: 'disponible', situation: 'centre' },
	zone: 'Coffres',
	libelle: 'Treuil HS',
	genre: 'abime',
	manque: null,
	note: 'Ne se déroule plus',
	photo: null,
	etape: 'en_attente',
	motif: 'garage',
	close: null,
	bloquante: false,
	priseId: null,
	signaleeLe: '2026-10-30T18:10',
	signaleePar: 'Alice Martin',
	prisePar: 'Rémi Durand',
	historique: [
		{ quoi: 'signalee', par: 'Alice Martin', le: '2026-10-30T18:10', texte: 'Ne se déroule plus' },
		{ quoi: 'en_attente', par: 'Rémi Durand', le: '2026-10-31T09:00', texte: 'Départ lundi' }
	],
	gestes: [],
	autresBloquantes: 0,
	...plus
});

describe('/engins/anomalies', () => {
	it('les ouvertes par engin, leur étape écrite, l’engin indisponible dit ; « Signaler » pour qui peut', () => {
		const page = html(Liste, { ouvertes: [ligne(1, { bloquante: true, etape: 'en_attente', motif: 'garage' })], closes: [ligne(2, { closeLe: '2026-10-29T10:00' })], engins: [{ id: 1, nom: 'VTU' }], peutSignaler: true, enginId: null });
		expect(page).toMatch(/<h2[^>]*>VTU[\s\S]*?href="\/engins\/anomalies\/1"[\s\S]*?Treuil HS[\s\S]*?Coffres · Abîmé · signalée le 30 oct\. 2026[\s\S]*?Engin indisponible[\s\S]*?En attente · au garage/);
		expect(page).toMatch(/Closes récemment[\s\S]*?Close le 29 oct\. 2026/);
		expect(page).toContain('href="/engins/anomalies/signaler"');
		expect(html(Liste, { ouvertes: [], closes: [], engins: [], peutSignaler: false, enginId: null })).toContain('Aucune anomalie ouverte.');
	});

	it('une anomalie : étapes du centre (en cours marquée), historique, engin resté disponible ; aucun geste sans droit', () => {
		const page = html(Anomalie, { anomalie: vue() });
		expect(page).toMatch(/aria-current="step"[\s\S]*?En attente[\s\S]*?au garage[\s\S]*?: en cours/);
		expect(page).toMatch(/VTU reste disponible/);
		expect(page).toMatch(/Historique[\s\S]*?Signalée[\s\S]*?Alice Martin[\s\S]*?En attente[\s\S]*?Rémi Durand[\s\S]*?Départ lundi/);
		expect(page).not.toContain('name="quoi"');
	});

	it('les gestes permis ; la décision d’indisponibilité à part ; remise en service avec l’alerte des autres blocages', () => {
		const page = html(Anomalie, { anomalie: vue({ etape: 'signalee', motif: null, gestes: ['prendre', 'attente', 'reparee', 'clore', 'indisponible'] }) });
		for (const g of ['prendre', 'attente', 'reparee', 'clore', 'indisponible']) expect(page).toContain(`value="${g}"`);
		expect(page).toMatch(/Disponibilité de VTU[\s\S]*?Rendre l’engin indisponible/);
		const close = html(Anomalie, { anomalie: vue({ close: { le: '2026-11-01T10:00', par: 'Rémi Durand', aLaPrise: false }, bloquante: true, engin: { id: 1, nom: 'VTU', type: 'VTU', etat: 'indisponible', situation: 'centre' }, gestes: ['remettre'], autresBloquantes: 1 }) });
		expect(close).toMatch(/VTU est indisponible[\s\S]*?Décidé depuis cette anomalie/);
		expect(close).toMatch(/Une autre anomalie ouverte le bloque encore[\s\S]*?value="remettre"/);
	});

	it('signaler : l’engin choisi d’avance, abîmé coché par défaut ; refus dit à qui ne peut pas', () => {
		const page = html(Signaler, { engins: [{ id: 1, nom: 'VTU', type: 'VTU' }, { id: 2, nom: 'FPT', type: 'FPT' }], enginId: 1, peutSignaler: true });
		expect(page).toMatch(/<option value="1" selected[^>]*>VTU</);
		expect(page).toMatch(/value="abime" checked/);
		expect(page).toContain('Sur VTU.');
		expect(html(Signaler, { engins: [], enginId: null, peutSignaler: false })).toContain('Le signalement est réservé aux agents du centre.');
	});
});
