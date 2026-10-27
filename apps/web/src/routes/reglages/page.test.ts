import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const comites = [
	{ id: 1, nom: 'Comité du centre', theme: 'centre', dissousLe: null, estCentre: true, membresEnCours: 4 },
	{ id: 2, nom: 'Amicale', theme: 'amicale', dissousLe: null, estCentre: false, membresEnCours: 3 },
	{ id: 3, nom: 'Sport', theme: 'sport', dissousLe: '2026-05-01', estCentre: false, membresEnCours: 0 }
];
const responsabilites = [
	{ id: 10, nom: 'Chef d’équipe', nature: 'fonction', portee: 'equipe', attributeur: { type: 'chef_centre' }, droits: [{ droit: 'VALIDER_REMPLACEMENT', verrouille: true }], systeme: 'chef_equipe', archiveeLe: null, titulaires: 3, protegee: false },
	{ id: 11, nom: 'Référent engins', nature: 'mission', portee: 'centre', attributeur: { type: 'chef_centre' }, droits: [{ droit: 'TRAITER_ANOMALIE', verrouille: false }], systeme: null, archiveeLe: null, titulaires: 2, protegee: false },
	{ id: 12, nom: 'Rapporteur de comité', nature: 'mission', portee: 'comite', attributeur: { type: 'comite_vise' }, droits: [{ droit: 'ATTRIBUER_RESPONSABILITE', verrouille: false }], systeme: null, archiveeLe: null, titulaires: 2, protegee: true },
	{ id: 13, nom: 'Ancien rôle', nature: 'mission', portee: 'centre', attributeur: { type: 'comite', id: 2 }, droits: [], systeme: null, archiveeLe: '2026-04-02', titulaires: 0, protegee: false }
];
const data = { comites, responsabilites, comitesChoix: [{ id: 1, nom: 'Comité du centre' }, { id: 2, nom: 'Amicale' }], peutPouvoir: false,
	droitsMetier: ['VOIR_PLANNING', 'TRAITER_ANOMALIE', 'VALIDER_REMPLACEMENT'],
	droitsPouvoir: ['GERER_ACCES', 'ATTRIBUER_RESPONSABILITE', 'GERER_LISTES', 'GERER_COMITES']
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (props: Record<string, unknown>) => render(Page as any, { props }).body;

describe('page Réglages', () => {
	it('range les droits en deux groupes, métier et pouvoir', () => {
		const page = html({ data, form: null });
		expect(page).toMatch(/<legend[^>]*>\s*Droits métier\s*<\/legend>/);
		expect(page).toMatch(/<legend[^>]*>\s*Droits de pouvoir\s*<\/legend>/);
	});

	it('désactive les cases de pouvoir du référent technique et dit pourquoi', () => {
		const page = html({ data, form: null });
		expect(page).toMatch(/<input[^>]*value="GERER_ACCES"[^>]*disabled/);
		expect(page).not.toMatch(/<input[^>]*value="VOIR_PLANNING"[^>]*disabled/);
		expect(page).toContain('Seuls le chef de centre');
	});

	it('laisse les cases de pouvoir libres à qui gère le pouvoir', () => {
		const page = html({ data: { ...data, peutPouvoir: true }, form: null });
		expect(page).not.toMatch(/<input[^>]*value="GERER_ACCES"[^>]*disabled/);
	});

	it('montre la raison, sans formulaire, pour une responsabilité protégée', () => {
		const page = html({ data, form: null });
		expect(page).toContain('Cette responsabilité donne un droit de pouvoir');
		expect(page).not.toMatch(/name="id" value="12"/);
		expect(page).toMatch(/name="id" value="11"/);
	});

	it('bloque l’archivage d’une responsabilité système et la dissolution du comité du centre', () => {
		const page = html({ data, form: null });
		expect(page).not.toMatch(/name="id" value="10"[^>]*>[\s\S]{0,300}Je confirme/);
		expect(page).toContain('ne s’archive pas');
		expect(page).toContain('ne se dissout pas');
	});

	it('avertit avant dissolution et archivage, avec la case « Je confirme »', () => {
		const page = html({ data, form: null });
		expect(page).toContain('Les 3 personnes qui tiennent un rôle dans ce comité le perdent aujourd’hui, avec ses droits ; les nominations à venir sont annulées. Les responsabilités qu’il attribuait seront attribuées par le chef de centre.');
		expect(page).toContain('Les 2 personnes qui tiennent ce rôle le perdent aujourd’hui, avec ses droits.');
		expect(page).toContain('Je confirme');
		expect(page).toMatch(/<input[^>]*name="confirmation"[^>]*value="oui"/);
	});

	it('range dissous et archivés dans une section repliée « Anciens »', () => {
		const page = html({ data, form: null });
		expect(page).toMatch(/<details[^>]*>\s*<summary[^>]*>Anciens/);
		expect(page).toContain('Sport');
		expect(page).toContain('Ancien rôle');
	});

	it('n’affiche pas la carte dont la liste est nulle', () => {
		const page = html({ data: { ...data, comites: null }, form: null });
		expect(page).not.toContain('>Comités<');
		expect(page).toContain('>Responsabilités<');
	});

	it('affiche l’erreur à côté du bon formulaire seulement', () => {
		const page = html({ data, form: { cible: 'comite-2', erreurs: { nom: 'Ce nom est déjà utilisé' }, valeurs: { nom: 'Sport', theme: 'x' } } });
		expect(page.match(/Ce nom est déjà utilisé/g)).toHaveLength(1);
		expect(page).toContain('Le formulaire contient des erreurs.');
		expect(page.match(/Le formulaire contient des erreurs\./g)).toHaveLength(1);
		expect(page).toMatch(/<details[^>]*open/);
	});

	it('lie le message des droits aux deux groupes de droits', () => {
		const page = html({ data, form: { cible: 'resp-11', erreurs: { droits: 'Un droit verrouillé ne se retire pas.' }, valeurs: { nom: 'Référent engins' } } });
		expect(page).toMatch(/<p[^>]*id="resp-11-droits-erreur"[^>]*>Un droit verrouillé/);
		const groupes = page.match(/<fieldset[^>]*resp-11-droits-erreur[^>]*>/g) ?? [];
		expect(groupes).toHaveLength(2);
		expect(html({ data, form: null })).not.toContain('droits-erreur');
	});

	it('met dans le bandeau du haut le message d’un formulaire inconnu', () => {
		for (const cible of ['comite-?', 'resp-?', 'comite-3']) {
			const page = html({ data, form: { cible, message: 'Comité inconnu.' } });
			expect(page).toMatch(/<h1[^>]*>[^<]*<\/h1> <div role="alert">(<!--[^>]*-->)*<p[^>]*class="echec[^"]*"[^>]*>Comité inconnu\./);
			expect(page.match(/Comité inconnu\./g)).toHaveLength(1);
		}
		const connu = html({ data, form: { cible: 'comite-2', message: 'Comité inconnu.' } });
		expect(connu.indexOf('Comité inconnu.')).toBeGreaterThan(connu.indexOf('Modifier ou dissoudre « Amicale »'));
	});

	it('n’impose pas d’attribut open à un bloc sans cible : l’hydratation ne le referme pas', () => {
		const page = html({ data, form: null });
		expect(page).not.toMatch(/<details[^>]*\sopen/);
		expect(html({ data, form: { cible: 'comite-2', message: 'x' } }).match(/<details[^>]*\sopen/g)).toHaveLength(1);
	});

	it('annonce un succès dans une région de statut', () => {
		const page = html({ data, form: { cible: 'comite-nouveau', succes: 'Le comité « Sport » est créé.' } });
		expect(page).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Le comité « Sport » est créé\./);
	});

	it('garde les formulaires hors des tableaux, pour qu’ils tiennent sur un téléphone', () => {
		const page = html({ data, form: null });
		for (const tableau of page.match(/<table[\s\S]*?<\/table>/g) ?? []) expect(tableau).not.toMatch(/<form|<details/);
		expect(page).toMatch(/<summary[^>]*>Modifier ou dissoudre « Amicale »/);
		expect(page).toMatch(/<summary[^>]*>Modifier ou archiver « Référent engins »/);
	});

	it('borne les noms à 60 caractères', () => {
		expect(html({ data, form: null })).toMatch(/id="comite-nouveau-nom"[^>]*maxlength="60"/);
	});
});
