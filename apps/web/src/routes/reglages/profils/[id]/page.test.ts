import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const data = { profil: { id: 1, nom: 'Agent', typePersonne: 'agent', droits: ['VOIR_PLANNING', 'RESERVER'] } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (props: Record<string, unknown>) => render(Page as any, { props }).body;

describe('page d’un profil', () => {
	it('les domaines seulement, au niveau actuel, sans administration ni modèle', () => {
		const page = html({ data, form: null });
		expect(page).toMatch(/<h1[^>]*>Agent<\/h1>/);
		expect(page).toMatch(/name="niveau-reservations" value="1" checked/);
		expect(page).toContain('Rien dans ce domaine.');
		expect(page).not.toContain('Administration');
		expect(page).not.toContain('Revenir au modèle');
		expect(page).toMatch(/<form method="POST"/);
		expect(page).toMatch(/>(<!---->)?Enregistrer/);
	});

	it('annonce le succès', () => {
		expect(html({ data, form: { cible: 'profil', succes: 'Le profil « Agent » est enregistré.' } })).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Le profil « Agent »/);
	});
	it('ne parle pas des droits sans effet (annuaire, motifs d’absence)', () => {
		const page = html({ data: { profil: { ...data.profil, droits: ['VOIR_PLANNING', 'VOIR_ANNUAIRE', 'VOIR_MOTIFS_ABSENCE'] } } });
		expect(page).not.toMatch(/annuaire|motifs d’absence/);
	});
});
