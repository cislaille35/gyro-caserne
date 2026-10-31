import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
const { default: Page } = await import('./+page.svelte');

const bancs = { id: 2, nom: 'Bancs', forme: 'jours', stock: 12, icone: 'groupe', ouverteReserve: false, gestionnaire: { type: 'comite', id: 2, nom: 'Amicale' }, jeGere: false };
const vl = { id: 1, nom: 'VL', forme: 'creneau', stock: null, icone: 'camion', ouverteReserve: true, gestionnaire: { type: 'role', id: 6, nom: 'Référent engins' }, jeGere: false };
const html = (data: Record<string, unknown>, form: unknown = null) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { form, data: { ressource: bancs, prises: [], reserveCitoyenne: false, jour: '2026-11-05', aujourdhui: '2026-11-04', ...data } } }).body;

// Un champ, quel que soit l'ordre de ses attributs.
const champ = (attributs: string[]) => new RegExp(`<input${attributs.map((a) => `(?=[^>]*${a})`).join('')}[^>]*>`);

describe('page « Réserver »', () => {
	it('matériel : du, au, quantité, un mot ; la disponibilité dite tout de suite', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>Réserver · Bancs<\/h1>/);
		expect(page).toMatch(champ(['type="date"', 'name="debut"', 'value="2026-11-05"']));
		expect(page).toMatch(champ(['type="date"', 'name="fin"', 'value="2026-11-05"']));
		expect(page).toMatch(champ(['type="number"', 'name="quantite"', 'value="1"']));
		expect(page).toMatch(/<textarea[^>]*name="mot"/);
		expect(page).toMatch(/role="status"[^>]*>[\s\S]*?Disponible : 12 sur 12 sur toute la période\./);
		expect(page).toMatch(/<button[^>]*type="submit"[^>]*>(?:<!--[^>]*-->)*Demander/);
		expect(page).not.toContain('name="nom"');
		expect(page).toMatch(/href="\/reservations\/2"/);
	});

	it('créneau : début et fin à l’heure près ; la réserve citoyenne donne un nom (obligatoire) et un téléphone', () => {
		const page = html({ ressource: vl, reserveCitoyenne: true });
		expect(page).toMatch(champ(['type="datetime-local"', 'name="debut"', 'value="2026-11-05T09:00"']));
		expect(page).toMatch(champ(['type="datetime-local"', 'name="fin"', 'value="2026-11-05T12:00"']));
		expect(page).toMatch(champ(['name="nom"', 'required']));
		expect(page).toMatch(champ(['type="tel"', 'name="telephone"']));
		expect(page).toMatch(/<button[^>]*type="submit"[^>]*>(?:<!--[^>]*-->)*Réserver/);
	});

	it('un refus : le message et les valeurs saisies', () => {
		const page = html({}, { message: 'Bancs : il en reste 3 le 13 nov.', valeurs: { debut: '2026-11-13', fin: '2026-11-14', quantite: '5', mot: 'Fête' } });
		expect(page).toMatch(/role="alert"[\s\S]*?Bancs : il en reste 3 le 13 nov\./);
		expect(page).toMatch(champ(['name="debut"', 'value="2026-11-13"']));
		expect(page).toMatch(champ(['name="quantite"', 'value="5"']));
		expect(page).toMatch(/<textarea[^>]*name="mot"[^>]*>Fête<\/textarea>/);
	});
});
