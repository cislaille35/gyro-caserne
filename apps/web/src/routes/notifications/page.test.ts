import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const html = (data: Record<string, unknown>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { annonces: [], evenements: [], sondages: [], ...data } } }).body;

describe('page des notifications', () => {
	it('rien de nouveau : une phrase, pas de liste vide', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>Notifications<\/h1>/);
		expect(page).toContain('Rien de nouveau pour vous.');
		expect(page).not.toContain('<ul');
	});

	it('une liste de liens vers chaque publication, avec ce qu’il faut faire écrit', () => {
		const page = html({
			annonces: [{ id: 1, cle: 'centre', nomMur: 'Le centre', titre: 'Note de service' }],
			evenements: [
				{ id: 2, cle: 'equipe:1', nomMur: 'Équipe 1', titre: 'Manœuvre', debut: '2026-10-29T19:00', demain: true, reponse: null, sondage: false },
				{ id: 5, cle: 'centre', nomMur: 'Le centre', titre: 'Repas', debut: '2026-11-05T12:00', demain: false, reponse: 'present', sondage: true }
			],
			sondages: [{ id: 3, cle: 'vie', nomMur: 'Vie du centre', titre: 'Repas' }]
		});
		expect(page).not.toContain('Rien de nouveau');
		expect(page).toMatch(/<ul[^>]*role="list"/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/centre\/1"[^>]*>[\s\S]*?Note de service[\s\S]*?Annonce à prendre en compte · Le centre/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/equipe:1\/2"[^>]*>[\s\S]*?Manœuvre[\s\S]*?Événement demain, à répondre · Équipe 1/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/centre\/5"[^>]*>[\s\S]*?Repas[\s\S]*?Événement avec sondage, à voter · Le centre/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/vie\/3"[^>]*>[\s\S]*?Repas[\s\S]*?Sondage à répondre · Vie du centre/);
	});
});
