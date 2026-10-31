import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
const { default: Page } = await import('./+page.svelte');

const vl = { id: 1, nom: 'VL', forme: 'creneau', stock: null, icone: 'camion', ouverteReserve: true, gestionnaire: { type: 'role', id: 6, nom: 'Référent engins' }, jeGere: true };
const bancs = { id: 2, nom: 'Bancs', forme: 'jours', stock: 12, icone: 'groupe', ouverteReserve: false, gestionnaire: { type: 'comite', id: 2, nom: 'Amicale' }, jeGere: true };
const html = (data: Record<string, unknown>, form: unknown = null) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { form, data: { ressources: [bancs], comites: [{ id: 2, nom: 'Amicale' }], confirmer: null, ...data } } }).body;

describe('page « Gérer le matériel »', () => {
	it('ajouter : nom, stock, icône ; le comité choisi d’office s’il est seul', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>Gérer le matériel<\/h1>/);
		expect(page).toMatch(/action="\?\/ajouter"[\s\S]*?name="nom"[\s\S]*?name="stock"[\s\S]*?name="icone"/);
		expect(page).toMatch(/<input type="hidden" name="comite" value="2"/);
		expect(page).not.toContain('<select');
	});

	it('plusieurs comités : on choisit lequel gère', () => {
		const page = html({ comites: [{ id: 2, nom: 'Amicale' }, { id: 3, nom: 'Sport' }] });
		expect(page).toMatch(/<select[^>]*name="comite"[\s\S]*?Amicale[\s\S]*?Sport/);
	});

	it('chaque ressource : modifier (le stock pour le matériel) et retirer ; la VL se renomme sans stock ni retrait', () => {
		const page = html({ ressources: [vl, bancs] });
		expect(page).toMatch(/Bancs[\s\S]*?12 en stock[\s\S]*?action="\?\/modifier"[\s\S]*?name="stock"[^>]*value="12"[\s\S]*?href="\?retirer=2"/);
		expect(page).not.toContain('?retirer=1');
	});

	it('?retirer=<id> : la confirmation dans la carte', () => {
		const page = html({ confirmer: 2 });
		expect(page).toMatch(/Retirer Bancs \?[\s\S]*?Les réservations à venir sont annulées et leurs demandeurs prévenus\.[\s\S]*?action="\?\/retirer"[\s\S]*?name="id" value="2"/);
	});

	it('ni ressource ni comité : rien à gérer', () => {
		expect(html({ ressources: [], comites: [] })).toContain('Rien à gérer pour vous.');
	});
});
