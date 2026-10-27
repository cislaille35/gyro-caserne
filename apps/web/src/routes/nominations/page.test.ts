import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const titulaire = (id: number, prenom: string, perimetre: { type: string; id: number | null; nom: string | null } = { type: 'comite', id: 2, nom: 'Amicale' }) => ({
	id,
	personne: { id: id + 10, prenom, nom: 'Martin' },
	perimetre,
	debut: '2026-01-01',
	fin: null
});
const roles = [
	{ responsabiliteId: 5, nom: 'Référent engins', portee: 'centre', perimetres: [{ type: 'centre', id: null, nom: 'Centre' }], titulaires: [titulaire(1, 'Alice', { type: 'centre', id: null, nom: null })] },
	{ responsabiliteId: 6, nom: 'Membre de comité', portee: 'comite', perimetres: [{ type: 'comite', id: 2, nom: 'Amicale' }], titulaires: [] }
];
const data = { aujourdhui: '2026-10-27', roles, agents: [{ id: 3, nom: 'Bob Durand', equipe: 'Équipe 1' }] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (props: Record<string, unknown>) => render(Page as any, { props }).body;

describe('/nominations : page', () => {
	it('montre, pour chaque rôle, ses titulaires et un formulaire « Nommer »', () => {
		const page = html({ data, form: null });
		expect(page).toContain('>Nominations</h1>');
		for (const nom of ['Référent engins', 'Membre de comité']) expect(page).toContain(`>${nom}</h2>`);
		expect(page).toContain('Alice Martin');
		expect(page).toContain("Personne n'a ce rôle pour le moment.");
		expect(page.match(/action="\?\/attribuer"/g)).toHaveLength(2);
		expect(page.match(/action="\?\/terminer"/g)).toHaveLength(1);
		expect(page).toContain('Bob Durand (Équipe 1)');
		expect(page).toMatch(/<select[^>]*name="personneId"/);
		expect(page).toMatch(/<select[^>]*name="perimetre"/);
		expect(page).toMatch(/name="fin"/);
	});

	it('affiche l’erreur sous le bon champ du bon rôle, sans bandeau ailleurs', () => {
		const form = { cible: 'attribuer-5', erreurs: { personneId: 'Choisissez un agent.' }, valeurs: { responsabiliteId: '5', personneId: '', perimetre: 'centre', debut: '2026-10-27', fin: '' } };
		const page = html({ data, form });
		expect(page.match(/Choisissez un agent\./g)).toHaveLength(1);
		expect(page.match(/role="alert"/g)).toHaveLength(1);
	});

	it('annonce la réussite dans une zone de statut', () => {
		expect(html({ data, form: { cible: 'attribuer-5', succes: true, message: 'Rôle attribué' } })).toMatch(/role="status"[^>]*>Rôle attribué</);
	});

	it('annonce « Rôle terminé » même quand le titulaire a quitté la liste', () => {
		const sansTitulaire = { ...data, roles: roles.map((r) => ({ ...r, titulaires: [] })) };
		expect(html({ data: sansTitulaire, form: { cible: 'terminer-1', succes: true, message: 'Rôle terminé' } })).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Rôle terminé</);
	});

	it('relie l’erreur de confirmation à la case du titulaire concerné', () => {
		const page = html({ data, form: { cible: 'terminer-1', erreurs: { confirmation: 'Cochez « Je confirme » pour terminer ce rôle.' } } });
		expect(page).toMatch(/role="alert"[^>]*>Cochez « Je confirme » pour terminer ce rôle\./);
		expect(page).toMatch(/aria-describedby="terminer-1-erreur"/);
	});

	it('réaffiche la saisie seulement pour le rôle concerné', () => {
		const form = { cible: 'attribuer-5', erreurs: { debut: 'x' }, valeurs: { responsabiliteId: '5', personneId: '3', perimetre: 'centre', debut: '2026-12-01', fin: '' } };
		const page = html({ data, form });
		expect(page.match(/value="2026-12-01"/g)).toHaveLength(1);
		expect(page.match(/value="2026-10-27"/g)).toHaveLength(1);
	});

	it('laisse les boutons actifs au départ', () => {
		expect(html({ data, form: null })).not.toMatch(/<button[^>]*disabled/);
	});
});
