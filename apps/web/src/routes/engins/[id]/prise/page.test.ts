import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

// La page lit son adresse : `?participants` ouvre le panneau.
const adresse = vi.hoisted(() => ({ url: new URL('http://x/engins/1/prise') }));
vi.mock('$app/state', () => ({ page: adresse }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
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

const zonesLongues = [
	{ ref: 1, nom: 'Cabine', elements: [{ ref: 10, libelle: 'Radio : essai', quantite: null }] },
	...Array.from({ length: 6 }, (_, i) => ({ ref: i + 2, nom: `Coffre arrière droit numéro ${i + 2} sous le marchepied`, elements: [] }))
];
const lecture = (autres: Record<string, unknown> = {}) => ({ ...data(), prise: null, ...autres });
const avant = (texte: string, apres: string, page: string) => page.indexOf(texte) >= 0 && page.indexOf(texte) < page.indexOf(apres);

describe('/engins/[id]/prise', () => {
	it('toutes les zones au sélecteur, seule celle à voir dessous ; « Tout est complet » après sa liste', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data());
		expect(page).toMatch(/<nav[^>]*aria-label="Zones de l’engin"/);
		expect(page).toMatch(/href="\?zone=1#titre-zone"[^>]*aria-current="true"[\s\S]*?Cabine[\s\S]*?1 à voir/);
		expect(page).toMatch(/href="\?zone=2#titre-zone"[\s\S]*?Coffres[\s\S]*?1 à voir/);
		expect(page).toContain('Radio : essai');
		expect(page).not.toContain('Lances');
		expect(avant('Radio : essai', 'Tout est complet', page)).toBe(true);
	});

	it('une ligne : le lien « Écart » nommé pour les lecteurs d’écran, la quantité attendue visible', () => {
		adresse.url = new URL('http://x/engins/1/prise?zone=2');
		const page = html(data());
		expect(page).toContain('Lances');
		expect(page).toMatch(/2<span class="masque[^"]*"> attendus/);
		expect(page).toMatch(/<summary[^>]*>Écart<span class="masque[^"]*"> : Lances<\/span><\/summary>/);
		expect(page).not.toContain('Signaler un écart');
	});

	it('plus de quatre zones aux noms longs : toutes listées', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html({ ...data(), zones: zonesLongues });
		for (const z of zonesLongues) expect(page).toContain(`href="?zone=${z.ref}#titre-zone"`);
		expect(page).toContain('Coffre arrière droit numéro 7 sous le marchepied');
	});

	it('après « Tout est complet » : la zone suivante à voir, et la possibilité d’annuler', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data({ zones: [1] }), { cible: 'zone:1', zone: null, zoneFaite: 1, succes: 'Zone complète.' });
		expect(page).toMatch(/href="\?zone=2#titre-zone"[^>]*aria-current="true"/);
		expect(page).toContain('Lances');
		expect(page).not.toContain('Radio : essai');
		expect(page).toMatch(/name="zone" value="1"[\s\S]*?Cabine : complète[\s\S]*?name="vue" value="0"[\s\S]*?Annuler/);
		expect(page).toMatch(/href="\?zone=1#titre-zone"[\s\S]*?Complète/);
	});

	it('une zone déjà complète se revoit : « Complet », et le geste s’annule', () => {
		adresse.url = new URL('http://x/engins/1/prise?zone=1');
		const page = html(data({ zones: [1] }));
		expect(page).toMatch(/Radio : essai[\s\S]*?Complet<\/p>[\s\S]*?Revoir la zone/);
	});

	it('un refus ou un écart : on reste sur la zone touchée', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data(), { cible: 'zone:2', zone: 2, message: 'Prise changée entre-temps.' });
		expect(page).toContain('Lances');
		expect(page).toContain('Prise changée entre-temps.');
	});

	it('« Valider la prise » : seulement quand les zones sont vues, au-dessus des zones', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		expect(html(data({ zones: [1] }))).not.toContain('Valider la prise');
		const page = html(data({ zones: [1, 2] }));
		expect(avant('Valider la prise', 'aria-label="Zones de l’engin"', page)).toBe(true);
		expect(page).toContain('Abandonner la prise');
	});

	it('avant de commencer : les zones se lisent, le premier geste part sans prise ; plus de bouton « Commencer »', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(lecture());
		expect(page).toContain('Radio : essai');
		expect(page).toMatch(/name="prise" value=""/);
		expect(page).toContain('Tout est complet');
		expect(page).toContain('Le premier geste commence la prise');
		expect(page).not.toContain('Commencer la prise');
		expect(page).not.toContain('Valider la prise');
		expect(page).not.toContain('Participants :');
		expect(page).not.toContain('Abandonner');
	});

	it('une fiche sans zone : « Commencer la prise » reste le seul moyen de la faire', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		expect(html(lecture({ zones: [] }))).toContain('Commencer la prise');
	});

	it('lecture seule, brouillon ou non : les zones et les écarts se lisent, aucun geste', () => {
		const ouverte = { id: 3, ref: 10, zone: 'Cabine', libelle: 'Radio : essai', genre: 'abime', manque: null, note: null, photo: null, signaleeLe: '2026-10-23T18:30', signaleePar: 'Mila Clément', etape: 'signalee', motif: null, bloquante: false };
		for (const url of ['http://x/engins/1/prise', 'http://x/engins/1/prise?participants']) {
			adresse.url = new URL(url);
			for (const d of [lecture({ peutFaire: false, ouvertes: [ouverte] }), { ...data({ zones: [1, 2], ecarts: { '10': { genre: 'abime', manque: null, note: '', photo: null } } }), peutFaire: false, ouvertes: [ouverte] }]) {
				const page = html(d);
				expect(page).toContain('Radio : essai');
				expect(page).not.toContain('<form');
				expect(page).not.toContain('<summary');
				expect(page).not.toContain('Tout est complet');
				expect(page).not.toContain('<dialog');
				expect(page).not.toContain('Modifier');
				expect(page).toContain('Abîmé');
			}
		}
	});

	const commune = { genre: 'abime', manque: null, note: null, photo: null, signaleeLe: '2026-10-23T18:30', signaleePar: 'Mila Clément', etape: 'signalee', motif: null, bloquante: false };
	const surRadio = { ...commune, id: 3, ref: 10, zone: 'Cabine', libelle: 'Radio : essai' };
	const horsFiche = { ...commune, id: 4, ref: null, zone: 'Autre', libelle: 'Phare avant' };

	it('avant de commencer : le compte des signalements de la fiche, ceux hors de la fiche listés, le sélecteur le dit', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(lecture({ ouvertes: [surRadio, horsFiche] }));
		expect(page).toContain('1 écart encore signalé sur cet engin, à voir dans sa zone.');
		expect(page).toMatch(/Signalé hors de la fiche[\s\S]*?Phare avant[\s\S]*?Signalé le/);
		expect(page).toContain('1 à voir · 1 signalé');
		expect(page).toContain('Oui, clore le signalement');
		expect(page).not.toContain('Aucun écart ouvert');
	});

	it('seulement hors de la fiche : pas de phrase qui renvoie à une zone', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(lecture({ ouvertes: [horsFiche] }));
		expect(page).not.toContain('à voir dans');
		expect(page).not.toContain('Aucun écart ouvert');
	});

	it('la prise commencée : les signalements hors de la fiche et le compte par zone restent', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html({ ...data(), ouvertes: [surRadio, horsFiche] });
		expect(page).toContain('Phare avant');
		expect(page).toContain('1 à voir · 1 signalé');
		// Retrouvé, il n'est plus compté.
		expect(html({ ...data({ retrouves: [3] }), ouvertes: [surRadio] })).not.toContain('· 1 signalé');
	});

	it('« Annuler » vient après le titre de la zone, où se pose le focus', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data({ zones: [1] }), { cible: 'zone:1', zone: null, zoneFaite: 1, succes: 'Zone complète.' });
		expect(page).toMatch(/id="titre-zone"[\s\S]*?Cabine : complète[\s\S]*?Annuler[\s\S]*?Lances/);
	});

	it('les participants : une rangée en tête (« vous + 2 »), rappelés à la validation ; pas de liste à plat', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data());
		expect(page).toMatch(/href="\?participants"[\s\S]*?Participants :<\/strong> vous \+ 2/);
		expect(html(data({ zones: [1, 2] }))).toMatch(/La prise sera au nom de : <strong>Mila Clément, vous, Élodie Chef-de-Garde<\/strong>/);
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
