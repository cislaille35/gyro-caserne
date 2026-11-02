import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: Record<string, unknown>) => render(Page as any, { props: { data } }).body;
const engin = (id: number, nom: string, plus: Record<string, unknown> = {}) => ({ id, nom, type: 'VSAV', typeId: 1, immatriculation: null, situation: 'centre', provenance: null, etat: 'disponible', partiLe: null, ...plus });

describe('/engins', () => {
	const engins = [engin(1, 'VSAV 1', { immatriculation: 'AB-123-CD' }), engin(2, 'VSAV 23', { situation: 'prete', provenance: 'CIS Exemple-Nord', etat: 'indisponible' }), engin(3, 'FPT 2', { type: 'FPT', situation: 'parti', partiLe: '2026-10-01' })];

	it('chaque engin présent, son type, sa plaque, son prêt et son état écrits ; les partis repliés à part', () => {
		const page = html({ engins, gere: false });
		expect(page).toMatch(/href="\/engins\/1"[\s\S]*?VSAV 1[\s\S]*?VSAV · AB-123-CD[\s\S]*?Disponible/);
		expect(page).toMatch(/href="\/engins\/2"[\s\S]*?prêté par CIS Exemple-Nord[\s\S]*?Indisponible/);
		expect(page).toMatch(/Partis[\s\S]*?1 engin sorti[\s\S]*?hidden[\s\S]*?FPT 2[\s\S]*?Parti le 1 oct\. 2026/);
	});

	it('un agent ne voit ni « Ajouter » ni les fiches ; qui gère, si', () => {
		const agent = html({ engins, gere: false });
		expect(agent).not.toContain('href="/engins/nouveau"');
		expect(agent).not.toContain('href="/engins/fiches"');
		const chef = html({ engins, gere: true });
		expect(chef).toContain('href="/engins/nouveau"');
		expect(chef).toContain('href="/engins/fiches"');
		expect(chef).toContain('href="/engins/fiches/fichier"');
	});

	it('sans engin : le dire, et proposer d’en ajouter à qui gère', () => {
		expect(html({ engins: [], gere: false })).toContain('Aucun engin pour l’instant.');
		expect(html({ engins: [], gere: true })).toMatch(/Aucun engin[\s\S]*href="\/engins\/nouveau"/);
	});

	it('la prise de la relève sous chaque engin, et l’entrée « Prise de garde »', () => {
		const releve = { debut: '2026-10-30T18:00', equipe: { id: 2, nom: 'Équipe 2', couleur: '#000000' } };
		const prises = { 1: { prise: { etat: 'validee', valideeLe: '2026-10-30T18:40', equipe: 'Équipe 2', par: 'A' }, ouvertes: 2 }, 2: { prise: null, ouvertes: 0 } };
		const page = html({ engins, gere: false, releve, prises });
		expect(page).toMatch(/href="\/engins\/prise"[\s\S]*?Relève du ven\. 30 oct\., équipe 2[\s\S]*?1 sur 2 prise faite/);
		expect(page).toMatch(/VSAV 1[\s\S]*?Prise faite par l’équipe 2, ven\. 18 h 40 · 2 anomalies ouvertes[\s\S]*?Avertissement/);
		expect(page).toMatch(/VSAV 23[\s\S]*?Prise à faire/);
		expect(page).toMatch(/href="\/engins\/anomalies"[\s\S]*?2 ouvertes, à suivre jusqu’à la réparation/);
	});
});
