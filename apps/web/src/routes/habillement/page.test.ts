import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

const adresse = vi.hoisted(() => ({ url: new URL('http://x/habillement/3') }));
vi.mock('$app/state', () => ({ page: adresse }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
const { default: Liste } = await import('./+page.svelte');
const { default: Demande } = await import('./[id]/+page.svelte');
const { default: Toutes } = await import('./toutes/+page.svelte');

/* eslint-disable @typescript-eslint/no-explicit-any */
const propre = (html: string) => html.replace(/<!--[^>]*-->/g, '').replace(/ ?svelte-[a-z0-9]+/g, '').replace(/ class=""/g, '');
const ligne = (autres: Record<string, unknown> = {}) => ({ id: 3, texte: 'Rangers, taille 43.', etape: 'question', issue: null, demandeur: 'Alice Martin', prisePar: 'Bruno Petit', creeLe: '2026-11-08T09:00', majLe: '2026-11-08T10:00', finLe: null, ...autres });
const vue = (autres: Record<string, unknown> = {}) => ({
	...ligne(),
	livraison: null,
	sienne: true,
	fil: [
		{ quoi: 'prise', texte: null, par: 'Bruno Petit', le: '2026-11-08T09:30', deLAgent: false },
		{ quoi: 'question', texte: 'Montantes ou basses ?', par: 'Bruno Petit', le: '2026-11-08T10:00', deLAgent: false }
	],
	gestes: ['repondre', 'annuler'],
	...autres
});
const demande = (url: string, d = vue(), form: unknown = null) => {
	adresse.url = new URL(`http://x/habillement/3${url}`);
	return propre(render(Demande as any, { props: { data: { demande: d }, form } }).body);
};

describe('/habillement', () => {
	it('le formulaire d’un seul champ, avec son aide ; mes demandes avec leur état écrit', () => {
		const page = propre(render(Liste as any, { props: { data: { enCours: [ligne()], terminees: [ligne({ id: 4, etape: 'livree', finLe: '2026-11-01T10:00' })], gere: false }, form: null } }).body);
		expect(page.match(/<textarea/g)).toHaveLength(1);
		expect(page).toContain('Quelle pièce, quelle taille, pourquoi ? (ex. : veste textile en L, la mienne est déchirée)');
		expect(page).toMatch(/href="\/habillement\/3"[\s\S]*?Rangers, taille 43\.[\s\S]*?Question posée/);
		expect(page).toMatch(/href="\/habillement\/4"[\s\S]*?Finie le[\s\S]*?Livrée/);
		expect(page).not.toContain('href="/habillement/toutes"');
	});

	it('vide : une phrase et Gyro ; qui gère a le lien vers toutes les demandes', () => {
		const page = propre(render(Liste as any, { props: { data: { enCours: [], terminees: [], gere: true }, form: null } }).body);
		expect(page).toContain('Vos demandes de tenue et leur suivi s’afficheront ici.');
		expect(page).toContain('href="/habillement/toutes"');
	});
});

describe('/habillement/[id]', () => {
	it('l’agent : le suivi (étape en cours), le fil dans l’ordre, la réponse à la question et l’annulation', () => {
		const page = demande('');
		expect(page).toMatch(/aria-current="step"[\s\S]*?Prise en compte/);
		expect(page).toMatch(/Demande[\s\S]*?Alice Martin[\s\S]*?Rangers, taille 43\.[\s\S]*?Prise en compte[\s\S]*?Question[\s\S]*?Montantes ou basses \?/);
		expect(page).toContain('Votre réponse');
		expect(page).toContain('Annuler ma demande');
		expect(page).not.toContain('<dialog');
		expect(page).toContain('Suivie par Bruno Petit.');
		// La question en attente est rappelée dans le suivi, avec un lien vers la réponse.
		expect(page).toMatch(/Bruno Petit vous demande :<\/strong> Montantes ou basses \? <a href="#texte-repondre">Répondre<\/a>/);
	});

	it('le référent : prendre en compte, puis les panneaux (question, traiter, livrer) ouverts par l’adresse', () => {
		const nouvelle = vue({ etape: 'demandee', prisePar: null, fil: [], sienne: false, gestes: ['prendre', 'question', 'traiter'] });
		const page = demande('', nouvelle);
		expect(page).toContain('Je la prends en compte');
		expect(page).toContain('href="?panneau=traiter"');
		expect(page).toContain('Demandée par Alice Martin');
		const traiter = demande('?panneau=traiter', nouvelle);
		expect(traiter).toMatch(/<dialog[\s\S]*?Traiter la demande[\s\S]*?En stock[\s\S]*?Commandée au SDIS[\s\S]*?Refusée/);
		const livrer = demande('?panneau=livrer', vue({ etape: 'traitee', issue: 'commande', sienne: false, gestes: ['livrer'] }));
		expect(livrer).toMatch(/<dialog[\s\S]*?À récupérer au centre[\s\S]*?Dans votre casier[\s\S]*?Autre/);
		// Un panneau qui n'est pas permis ne s'ouvre pas.
		expect(demande('?panneau=livrer', nouvelle)).not.toContain('<dialog');
	});

	it('un collègue la reprend ; finie, plus aucun geste et l’info de récupération', () => {
		expect(demande('', vue({ etape: 'prise', sienne: false, gestes: ['reprendre'] }))).toContain('Je la reprends');
		const livree = demande('', vue({ etape: 'livree', issue: 'stock', livraison: 'Dans votre casier', finLe: '2026-11-08T11:00', gestes: [] }));
		expect(livree).toContain('Dans votre casier');
		expect(livree).not.toContain('<form');
		expect(livree).toMatch(/En stock/);
	});

	it('un refus du serveur est lu (alerte), le panneau rouvert', () => {
		const page = demande('', vue({ etape: 'prise', sienne: false, gestes: ['question', 'traiter'] }), { quoi: 'traiter', message: 'Expliquez le refus en un mot : l’agent le lira.' });
		expect(page).toMatch(/<dialog[\s\S]*?role="alert"|<dialog[\s\S]*?Expliquez le refus/);
	});
});

describe('/habillement/toutes', () => {
	it('en cours puis terminées : le demandeur et qui la suit, l’état écrit', () => {
		const page = propre(render(Toutes as any, { props: { data: { enCours: [ligne({ etape: 'demandee', prisePar: null })], terminees: [ligne({ id: 4, etape: 'refusee', finLe: '2026-11-02T10:00' })] } } }).body);
		expect(page).toMatch(/En cours[\s\S]*?Alice Martin, le 8 [\s\S]*?Demandée/);
		expect(page).toMatch(/Terminées[\s\S]*?finie le 2 [\s\S]*?Refusée/);
	});
});
