import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const equipes = [1, 2].map((id) => ({ id, nom: `Équipe ${id}`, couleur: '#c2185b' }));
const plage = (debut: string, fin: string, arme: boolean) => ({ debut, fin, arme, manque: arme ? [] : ['ca2'], presents: [{ id: 1, prenom: 'Cora', nom: 'Test', renfort: false }, { id: 2, prenom: 'Alice', nom: 'Test', renfort: true }] });
const ete = (autres: Record<string, unknown> = {}) => ({
	annee: 2027,
	ete: { annee: 2027, debut: '2027-06-25', fin: '2027-09-03', dateLimite: '2027-05-15', publiee: false },
	defaut: { debut: '2027-06-25', fin: '2027-08-27', dateLimite: '2027-05-15' },
	sansRoulement: false,
	equipes,
	reponses: [
		{ id: 1, prenom: 'Cora', nom: 'Test', equipeId: 2, reponse: 'tout', periodes: [] },
		{ id: 3, prenom: 'Gina', nom: 'Test', equipeId: 2, reponse: 'vacances', periodes: [{ debut: '2027-07-10', fin: '2027-07-20' }] },
		{ id: 4, prenom: 'Hugo', nom: 'Test', equipeId: 1, reponse: null, periodes: [] }
	],
	proposee: true,
	semaines: [{ debut: '2027-06-25', equipeId: 2, plages: [plage('2027-06-25T18:00', '2027-06-26T06:00', true), plage('2027-06-26T06:00', '2027-06-27T06:00', false)] }],
	impossibles: ['24 h du samedi 26 juin : pas de CA tout engins disponible'],
	conflits: [],
	detail: null,
	...autres
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (e = ete()) => render(Page as any, { props: { data: { ete: e }, form: null } }).body.replace(/<!--[^>]*-->/g, '');

describe('Été : le tableau du chef', () => {
	it('qui a répondu, en texte ; sans réponse = disponible', () => {
		const html = page();
		expect(html).toContain('<strong>2 sur 3</strong> ont répondu.');
		expect(html).toContain('Sans réponse (1)');
		expect(html).toContain('Hugo Test');
		expect(html).toContain('Gina Test</strong> · 10 – 20 juil.');
	});

	it('chaque plage : son nom, « FPT armé » en texte, les présents et les renforts marqués ; un lien pour la modifier', () => {
		const html = page();
		expect(html).toMatch(/<a href="\?annee=2027&amp;plage=2027-06-25T18%3A00"[^>]*><span class="jour[^"]*">Ven\. 25 juin · nuit<\/span><span class="masque[^"]*"> : modifier<\/span>/);
		expect(html).toContain('FPT armé : oui');
		expect(html).toContain('FPT armé : non, manque CA tout engins');
		expect(html).toMatch(/Alice Test<span class="etiquette[^"]*">renfort<\/span>/);
		expect(html).toContain('1 plage impossible');
		expect(html).toContain('Publier l’été 2027');
	});

	it('pas encore ouvert : ouvrir la saisie, avec la période par défaut', () => {
		const html = page(ete({ ete: null, proposee: false, semaines: [], impossibles: [] }));
		expect(html).toContain('Ouvrir la saisie des vacances');
		expect(html).toMatch(/name="debut" required="" value="2027-06-25"/);
		expect(html).not.toContain('Proposer la répartition');
	});

	it('une plage ouverte : retirer ou ajouter, chaque bouton nommé', () => {
		const detail = { ...plage('2027-06-25T18:00', '2027-06-26T06:00', true), candidats: [{ id: 4, prenom: 'Hugo', nom: 'Test', equipeId: 1, vacances: false, postes: ['cod1'] }, { id: 3, prenom: 'Gina', nom: 'Test', equipeId: 2, vacances: true, postes: [] }] };
		const html = page(ete({ detail }));
		expect(html).toMatch(/Retirer<span class="masque[^"]*"> Alice Test<\/span>/);
		expect(html).toMatch(/Ajouter<span class="masque[^"]*"> Hugo Test<\/span>/);
		expect(html).toContain('· Équipe 1 · conducteur');
		expect(html).toContain('· en vacances');
	});
});
