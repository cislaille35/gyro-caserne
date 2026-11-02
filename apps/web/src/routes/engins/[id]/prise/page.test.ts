import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

// La page lit son adresse : `?participants` ouvre le panneau.
const adresse = vi.hoisted(() => ({ url: new URL('http://x/engins/1/prise') }));
vi.mock('$app/state', () => ({ page: adresse }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
const { default: Page } = await import('./+page.svelte');

const zones = [
	{ ref: 1, nom: 'Cabine', elements: [{ ref: 10, libelle: 'Radio : essai', quantite: null }] },
	{ ref: 2, nom: 'Coffres', elements: [{ ref: 20, libelle: 'Lances', quantite: 2 }] }
];
const data = (saisie: Record<string, unknown> = {}) => ({
	engin: { id: 1, nom: 'FPT', type: 'FPT', typeId: 2, immatriculation: null, situation: 'centre', provenance: null, etat: 'disponible', partiLe: null },
	releve: { debut: '2026-10-30T18:00', equipe: { id: 4, nom: 'Équipe 4', couleur: '#000000' } },
	peutFaire: true,
	prise: { id: 7, etat: 'en_cours', commenceePar: 'Thomas Agent', commenceeLe: '2026-10-30T18:05', modifieePar: 'Thomas Agent', modifieeLe: '2026-10-30T18:05', valideeLe: null, saisie: { zones: [], ecarts: {}, retrouves: [], participants: [1, 2, 9], ...saisie } },
	zones,
	ouvertes: [],
	agents: [
		{ id: 2, nom: 'Mila Clément', astreinte: true },
		{ id: 3, nom: 'Adam Fournier', astreinte: true },
		{ id: 1, nom: 'Thomas Agent', astreinte: false },
		{ id: 9, nom: 'Élodie Chef-de-Garde', astreinte: false },
		{ id: 5, nom: 'Noah André', astreinte: false }
	],
	moi: 1
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (d: unknown, form: unknown = null) => render(Page as any, { props: { data: d, form } }).body;

describe('/engins/[id]/prise', () => {
	it('« Tout est complet » en tête de chaque zone, avant ses éléments ; une zone complète dite « Complet »', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data());
		expect(page).toMatch(/Tout est complet[\s\S]*?Puis touchez seulement un élément à problème[\s\S]*?Radio : essai/);
		expect(html(data({ zones: [1] }))).toMatch(/Complète[\s\S]*?Complet<\/p>[\s\S]*?Revoir la zone[\s\S]*?Radio : essai/);
	});

	it('les participants : une rangée en tête (« vous + 2 »), rappelés à la validation ; pas de liste à plat', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data());
		expect(page).toMatch(/href="\?participants"[\s\S]*?Participants :<\/strong> vous \+ 2/);
		expect(page).toMatch(/La prise sera au nom de : <strong>Mila Clément, vous, Élodie Chef-de-Garde<\/strong>/);
		expect(page).not.toContain('name="participant"');
	});

	it('le panneau : l’équipe d’astreinte d’abord, une recherche, les cochés en pastilles ; sans JavaScript, tous les agents', () => {
		adresse.url = new URL('http://x/engins/1/prise?participants');
		const page = html(data());
		expect(page).toMatch(/<dialog[\s\S]*?Équipe 4[\s\S]*?Mila Clément[\s\S]*?Adam Fournier[\s\S]*?Chercher un agent[\s\S]*?Thomas Agent \(vous\)[\s\S]*?Noah André/);
		expect(page).toMatch(/value="2" checked/);
		expect(page).not.toMatch(/value="3" checked/);
		expect(page).not.toMatch(/<label class="pastille-choix" hidden/);
		expect(html(data(), { cible: 'participants', message: 'Un des participants n’est plus agent du centre.' })).toMatch(/<dialog[\s\S]*?role="alert">Un des participants/);
	});
});
