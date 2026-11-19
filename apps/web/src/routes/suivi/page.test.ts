import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';

const { default: Page } = await import('./+page.svelte');

/* eslint-disable @typescript-eslint/no-explicit-any */
const propre = (html: string) => html.replace(/<!--[^>]*-->/g, '').replace(/ ?svelte-[a-z0-9]+/g, '').replace(/ class=""/g, '');
const html = (data: Record<string, unknown>) => propre(render(Page as any, { props: { data: { lignes: [], suite: null, vu: null, sujet: null, aujourdhui: '2026-11-18', ...data } } }).body);
const ligne = (l: Record<string, unknown> = {}) => ({ id: 9, quand: '2026-11-18T19:02', qui: 'Claire Martin', phrase: 'a modifié la manœuvre Feux de forêt', lien: '/planning/preparer/manoeuvre?id=3', ...l });

describe('/suivi', () => {
	it('le titre, le retour vers Caserne ; vide : ce que la page montrera', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>Suivi du centre<\/h1>/);
		expect(page).toContain('href="/caserne"');
		expect(page).toContain('Rien de nouveau au centre');
		expect(page).toContain('Ce qui s’est passé au centre ces trois derniers mois (planning');
	});

	it('une ligne par action, groupée par jour, du plus récent : qui, quoi, l’heure, et le lien vers l’élément', () => {
		const page = html({ lignes: [ligne(), ligne({ id: 8, quand: '2026-11-17T08:15', qui: 'Rémi Leroy', phrase: 'a pris en compte la demande d’habillement d’Alice Martin', lien: '/habillement/4' }), ligne({ id: 7, quand: '2026-11-10', qui: 'Ancien agent', phrase: 'a réglé l’armement des engins', lien: null })] });
		expect(page).toMatch(/<h2[^>]*>Aujourd’hui<\/h2>[\s\S]*Claire Martin a modifié la manœuvre Feux de forêt[\s\S]*<h2[^>]*>Hier<\/h2>[\s\S]*Rémi Leroy a pris en compte[\s\S]*<h2[^>]*>mardi 10 novembre<\/h2>[\s\S]*Ancien agent a réglé/);
		expect(page).toMatch(/href="\/planning\/preparer\/manoeuvre\?id=3"[\s\S]*?19 h 02/);
		expect(page).toContain('href="/habillement/4"');
		// Une ligne sans heure (journalisée à la date) n'en invente pas.
		expect(page).not.toMatch(/Ancien agent a réglé[\s\S]*?0 h/);
	});

	it('la suite : un lien qui marche sans JavaScript, dans le sujet choisi ; l’ajout est annoncé', () => {
		expect(html({ lignes: [ligne()], suite: 9 })).toMatch(/<a[^>]*href="\?avant=9"[^>]*>Voir les plus anciennes<\/a>/);
		expect(html({ lignes: [ligne()], suite: 9, sujet: 'planning' })).toMatch(/<a[^>]*href="\?sujet=planning&amp;avant=9"[^>]*>Voir les plus anciennes<\/a>/);
		expect(html({ lignes: [ligne()] })).not.toContain('Voir les plus anciennes');
		expect(html({ lignes: [ligne()] })).toMatch(/<p class="masque" role="status" aria-live="polite"><\/p>/);
	});

	it('les filtres en haut, en bloc segmenté, par l’adresse ; le choisi est marqué', () => {
		const page = html({ sujet: 'demandes' });
		expect(page).toMatch(/<nav class="segments" aria-label="Filtrer le suivi">/);
		const liens = [...page.matchAll(/<a href="([^"]*)"( aria-current="page")?>([^<]+)<\/a>/g)].map((m) => [m[3], m[1], !!m[2]]);
		expect(liens.slice(0, 6)).toEqual([
			['Tout', '/suivi', false],
			['Planning', '?sujet=planning', false],
			['Nominations', '?sujet=nominations', false],
			['Demandes', '?sujet=demandes', true],
			['Agents', '?sujet=agents', false],
			['Réglages', '?sujet=reglages', false]
		]);
		expect(html({})).toMatch(/<a href="\/suivi" aria-current="page">Tout<\/a>/);
		// Un sujet vide : les filtres restent, un vide discret.
		expect(page).toContain('Rien dans ce sujet ces trois derniers mois.');
		expect(page).not.toContain('Rien de nouveau au centre');
	});

	it('le repère de la dernière visite, entre les nouveautés et le reste ; chaque carte garde son jour', () => {
		const lignes = [ligne({ id: 9 }), ligne({ id: 8, quand: '2026-11-18T08:00', qui: 'Rémi Leroy' }), ligne({ id: 7, quand: '2026-11-17T08:00', qui: 'Ancien agent' })];
		const page = html({ lignes, vu: 8 });
		// Chaque carte a son jour : celui que le repère coupe est redonné dessous.
		expect(page).toMatch(/<h2[^>]*>Aujourd’hui<\/h2>[\s\S]*Claire Martin[\s\S]*<p class="repere">Avant votre dernière visite<\/p>\s*<section[^>]*><h2[^>]*>Aujourd’hui<\/h2>[\s\S]*Rémi Leroy[\s\S]*Hier[\s\S]*Ancien agent/);
		expect(page.match(/<h2[^>]*>Aujourd’hui<\/h2>/g)).toHaveLength(2);
		expect(page).not.toContain('suite');
		// Rien de nouveau, tout est nouveau, ou jamais venu : pas de repère.
		expect(html({ lignes, vu: 9 })).not.toContain('Avant votre dernière visite');
		expect(html({ lignes, vu: 6 })).not.toContain('Avant votre dernière visite');
		expect(html({ lignes, vu: null })).not.toContain('Avant votre dernière visite');
	});
});
