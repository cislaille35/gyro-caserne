import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import Demander from '../demander/+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data, form } }).body;
const debuts = [
	{ debut: '2026-11-09T19:15', max: 3 },
	{ debut: '2026-11-09T19:30', max: 3 },
	{ debut: '2026-11-10T04:00', max: 2 }
];

describe('Quelques heures', () => {
	it('le début au quart d’heure dans la liste du téléphone, 2 ou 3 h, la phrase récapitulative et l’envoi', () => {
		const html = page({ debuts });
		expect(html).toMatch(/<h1[^>]*>Quelques heures<\/h1>/);
		expect(html).toMatch(/<select[^>]*name="debut"/);
		expect(html).toContain('>19 h 15</option>');
		expect(html).toContain('>4 h, mardi 10 novembre</option>');
		expect(html).toMatch(/name="duree" value="2" checked/);
		expect(html).toContain('3 h');
		expect(html).toContain('Remplacement de 19 h 15 à 21 h 15, ouvert à tous les disponibles.');
		expect(html).toContain('Envoyer la demande');
		expect(html).toContain('peut refuser jusqu’au début');
	});

	it('aucune plage libre aujourd’hui (pas d’astreinte, déjà demandée, trop tard) : le dit, et mène aux jours', () => {
		const html = page({ debuts: [] });
		expect(html).toContain('Aucune plage de 2 h libre aujourd’hui.');
		expect(html).toContain('href="/remplacements/demander"');
		expect(html).not.toContain('Envoyer la demande');
	});

	it('un refus du socle est dit sur la page', () => {
		expect(page({ debuts }, { message: 'La plage doit tenir dans votre astreinte du jour.' })).toMatch(/role="alert"[^>]*>La plage doit tenir/);
	});

	it('« Me faire remplacer » propose quelques heures, seulement le jour de l’astreinte', () => {
		const base = { manqueMoi: [], mode: 'remplacement', maintenant: '2026-11-09T19:10', etape: 'quand', message: null, semaines: [], semaine: null, choisies: [], candidats: [], echangeables: [], pour: null, avec: null, semainesAvec: [], semaineAvec: null, choisiesAvec: [], recherche: '' };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const demander = (data: Record<string, unknown>) => render(Demander as any, { props: { data: { ...base, ...data }, form: null } }).body;
		expect(demander({ court: true })).toMatch(/<a[^>]*href="\/remplacements\/court"[^>]*>Demander 2 ou 3 h<\/a>/);
		expect(demander({ court: false })).not.toContain('/remplacements/court');
		expect(demander({ court: true, mode: 'echange' })).not.toContain('/remplacements/court');
	});
});
