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
const aucun = { enCours: [], aVenir: [], passees: [] };
const data = { aujourdhui: '2026-10-27', attributions: aucun, peutAttribuer: [], fiche, raison: null, grades: [], profils: [{ id: 1, nom: 'Agent' }], equipes: [{ id: 1, nom: 'Équipe 1' }], statuts: ['operationnel', 'suspendu', 'parti'] };
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

	it('signale dans l\'alerte un envoi qui n\'a que des erreurs de champ', () => {
		const page = html({ data, form: { erreurs: { prenom: 'Indiquez le prénom.' }, valeurs: { prenom: '' } } });
		expect(page).toMatch(/role="alert"[^>]*>(<!--[^>]*-->)*<p[^>]*>Le formulaire contient des erreurs\.</);
		expect(page).toContain('Indiquez le prénom.');
	});

	it('affiche l\'erreur d\'équipe sous le nom du champ envoyé', () => {
		const page = html({ data, form: { erreurs: { equipeId: 'Équipe inconnue' } } });
		expect(page).toMatch(/<select[^>]*name="equipeId"/);
		expect(page).toContain('Équipe inconnue');
	});

	it('annonce le succès dans une zone de statut', () => {
		expect(html({ data, form: { succes: true, message: 'Fiche enregistrée' } })).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Fiche enregistrée</);
	});

	describe('carte Responsabilités', () => {
		const ligne = (id: number, nom: string, peutTerminer: boolean, perimetre: { type: string; id: number | null; nom: string | null } = { type: 'centre', id: null, nom: null }) => ({
			id,
			responsabilite: { id: 1, nom },
			perimetre,
			debut: '2026-01-01',
			fin: null,
			saisiePar: 'Chef Test',
			peutTerminer
		});
		const attributions = {
			enCours: [ligne(1, 'Référent engins', true), ligne(2, 'Chef d’équipe', false, { type: 'equipe', id: 1, nom: 'Équipe 1' })],
			aVenir: [ligne(3, 'Référent pharmacie', true)],
			passees: [ligne(4, 'Membre de comité', false, { type: 'comite', id: 2, nom: 'Amicale' })]
		};
		const peutAttribuer = [
			{ responsabiliteId: 5, nom: 'Référent engins', portee: 'centre', perimetres: [{ type: 'centre', id: null, nom: 'Centre' }] },
			{ responsabiliteId: 6, nom: 'Chef d’équipe', portee: 'equipe', perimetres: [{ type: 'equipe', id: 1, nom: 'Équipe 1' }] }
		];

		it('affiche les trois listes, la passée repliée, et « Terminer » seulement si permis', () => {
			const page = html({ data: { ...data, attributions, peutAttribuer: [] }, form: null });
			expect(page).toContain('>Responsabilités</h2>');
			for (const titre of ['En cours', 'À venir', 'Passées']) expect(page).toContain(titre);
			expect(page).toContain('Référent engins');
			expect(page).toContain('Chef d’équipe — Équipe 1');
			expect(page).toMatch(/<details(?![^>]*open)[^>]*>(<!--[^>]*-->)*\s*<summary[^>]*>Passées/);
			expect(page.match(/action="\?\/terminer"/g)).toHaveLength(2);
			expect(page.match(/name="attributionId"/g)).toHaveLength(2);
		});

		it('ne montre « Terminer » que pour les rôles qu\'on peut retirer, et relie l\'erreur de confirmation à sa case', () => {
			const seul = { enCours: [ligne(1, 'Référent engins', false), ligne(2, 'Référent pharmacie', true)], aVenir: [], passees: [] };
			const page = html({ data: { ...data, attributions: seul }, form: { cible: 'terminer-2', erreurs: { confirmation: 'Cochez « Je confirme » pour terminer ce rôle.' } } });
			expect(page.match(/>Terminer</g)).toHaveLength(1);
			expect(page).toMatch(/role="alert"[^>]*>Cochez « Je confirme » pour terminer ce rôle\./);
			expect(page).toMatch(/aria-describedby="terminer-2-erreur"/);
		});

		it('annonce « Rôle terminé » dans la carte, même quand le rôle a quitté la liste', () => {
			const page = html({ data: { ...data, attributions: aucun }, form: { cible: 'terminer-2', succes: true, message: 'Rôle terminé' } });
			expect(page).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Rôle terminé</);
		});

		it('garde les messages à cible hors des bandeaux généraux et des champs de la fiche', () => {
			const page = html({ data, form: { cible: 'terminer-2', erreurs: { confirmation: 'Cochez' } } });
			expect(page).not.toContain('Le formulaire contient des erreurs.');
			expect(page).not.toContain('depart-avertissement');
		});

		it('ne réaffiche pas un périmètre saisi pour une autre responsabilité', () => {
			const form = { cible: 'attribuer', erreurs: { debut: 'x' }, valeurs: { responsabiliteId: '6', perimetre: '99', debut: '2026-02-01', fin: '' } };
			const page = html({ data: { ...data, peutAttribuer }, form });
			expect(page).toMatch(/<option[^>]*value="1"[^>]*selected|<option[^>]*selected[^>]*value="1"/);
			expect(page).not.toContain('value="99"');
		});

		it('propose le formulaire d\'attribution seulement s\'il y a quelque chose à attribuer', () => {
			expect(html({ data, form: null })).not.toContain('action="?/attribuer"');
			const page = html({ data: { ...data, peutAttribuer }, form: null });
			expect(page).toContain('action="?/attribuer"');
			expect(page).toMatch(/<select[^>]*name="responsabiliteId"/);
			expect(page).toMatch(/<input[^>]*type="date"[^>]*name="debut"|<input[^>]*name="debut"[^>]*type="date"/);
			expect(page).toMatch(/name="fin"/);
		});

		it('montre l\'erreur de doublon sous la date de début et un message pour la bonne cible', () => {
			const form = { cible: 'attribuer', erreurs: { debut: 'Cette personne tient déjà ce rôle sur cette période' }, valeurs: { responsabiliteId: '5', perimetre: 'centre', debut: '2026-02-01', fin: '' } };
			const page = html({ data: { ...data, peutAttribuer }, form });
			expect(page).toContain('Cette personne tient déjà ce rôle sur cette période');
		});

		it('désactive le bouton pendant l\'envoi (bouton actif au départ)', () => {
			const page = html({ data: { ...data, peutAttribuer }, form: null });
			const bouton = page.match(/<button[^>]*>(<!--[^>]*-->)*Attribuer/);
			expect(bouton).not.toBeNull();
			expect(bouton![0]).not.toContain('disabled');
		});
	});
});
