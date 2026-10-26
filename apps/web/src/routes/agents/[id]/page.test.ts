import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const fiche = {
	id: 3,
	email: 'alice@exemple.fr',
	prenom: 'Alice',
	nom: 'Martin',
	surnom: null,
	telephone: null,
	telephoneVisible: 0,
	naissance: '1990-05-01',
	anniversaireVisible: 1,
	entreeCentre: null,
	engagementSpv: null,
	dateGrade: null,
	statut: 'operationnel',
	contactUrgence: null,
	creeLe: '2026-01-01',
	equipe: null,
	grade: null,
	profil: { id: 1, nom: 'Agent' },
	protection: null
};
const data = { fiche, raison: null, grades: [], profils: [{ id: 1, nom: 'Agent' }], equipes: [{ id: 1, nom: 'Équipe 1' }], statuts: ['operationnel', 'suspendu', 'parti'] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (props: Record<string, unknown>) => render(Page as any, { props }).body;

describe('page fiche agent', () => {
	it('montre trois cartes avec chacune un bouton « Enregistrer », sans avertissement de départ', () => {
		const page = html({ data, form: null });
		for (const titre of ['Identité et contact', 'Parcours', 'Équipe et statut']) expect(page).toContain(`>${titre}</h2>`);
		expect(page.match(/>Enregistrer</g)).toHaveLength(4);
		expect(page).toContain('action="?/fiche"');
		expect(page).not.toContain('seront effacés');
	});

	it('avertit et demande « Je confirme » quand « Parti » est choisi', () => {
		const page = html({ data, form: { erreurs: { confirmation: 'Cochez « Je confirme » pour déclarer le départ.' }, valeurs: { statut: 'parti' } } });
		expect(page).toContain("Sa date de naissance et son contact d'urgence seront effacés.");
		expect(page).toMatch(/<input[^>]*type="checkbox"[^>]*name="confirmation"[^>]*value="oui"/);
		expect(page).toContain('Je confirme');
		expect(page).toContain('Cochez « Je confirme » pour déclarer le départ.');
	});

	it('remplace les formulaires par la raison quand la fiche est protégée', () => {
		const raison = 'Seul un super administrateur modifie la fiche du chef de centre.';
		const page = html({ data: { ...data, raison }, form: null });
		expect(page.split(raison)).toHaveLength(4);
		expect(page).not.toContain('<form');
		expect(page).not.toContain('<input');
		expect(page).not.toContain('<select');
	});

	it('annonce le succès dans une zone de statut', () => {
		expect(html({ data, form: { succes: true, message: 'Fiche enregistrée' } })).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Fiche enregistrée</);
	});
});
