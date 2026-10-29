import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

const etat = vi.hoisted(() => ({ page: { params: { id: '3' } as Record<string, string>, url: new URL('http://x/echanges/messages/3') } }));
vi.mock('$app/state', () => etat);
const { default: Layout } = await import('./+layout.svelte');

const conversations = [
	{ id: 3, type: 'groupe', nom: 'Départ de Thomas', icone: 'coeur', personne: null, apercu: 'Manon : J’ai trouvé le cadeau !', dernier_le: '2026-10-29T10:12', nonLus: 2 },
	{ id: 5, type: 'deux', nom: 'Élodie Chef-Équipe', icone: null, personne: { id: 9, prenom: 'Élodie', nom: 'Chef-Équipe', couleur: '#d4a017' }, apercu: 'Élodie : Tu peux prendre ma place ?', dernier_le: '2026-10-29T09:40', nonLus: 1 }
];
const contenu = createRawSnippet(() => ({ render: () => '<h1>Départ de Thomas</h1>' }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: object) => render(Layout as any, { props: { data, children: contenu }, context: new Map([['affichage', { niveau: 'vivant', theme: 'auto' }]]) }).body;
const texte = (page: string) => page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('layout des messages', () => {
	it('sans liste (téléphone d’abord, ou page sans colonnes) : la page seule', () => {
		const page = html({ conversations: null });
		expect(page).toContain('<h1>Départ de Thomas</h1>');
		expect(page).not.toContain('aria-label="Conversations"');
	});

	it('dans une conversation : la liste avant la conversation (ordre du clavier), la conversation ouverte marquée, sans sa pastille', () => {
		const page = html({ conversations });
		const liste = page.match(/<nav[^>]*aria-label="Conversations"[\s\S]*?<\/nav>\s*<\/div>/)?.[0] ?? page.match(/<nav[^>]*aria-label="Conversations"[\s\S]*/)![0];
		expect(page.indexOf('aria-label="Conversations"')).toBeLessThan(page.indexOf('<h1>Départ de Thomas</h1>'));
		expect(liste).toMatch(/<a[^>]*href="\/echanges\/messages\/3"[^>]*aria-current="page"/);
		expect(texte(liste)).not.toContain('2 messages non lus');
		expect(texte(liste)).toContain('1 message non lu');
		expect(liste).toMatch(/<a[^>]*href="\/echanges\/messages\/nouveau"[^>]*aria-label="Nouveau message"/);
		expect(liste).toMatch(/aria-label="Filtrer les échanges"/);
		// La recherche sans JavaScript mène à la liste.
		expect(liste).toMatch(/<form[^>]*action="\/echanges\/messages"[^>]*role="search"/);
		// Dans la colonne étroite (1024 px et plus), un texte d'aide court qui tient ; le champ garde son nom complet.
		expect(liste).toMatch(/<input[^>]*placeholder="Rechercher"/);
		expect(liste).toMatch(/<label[^>]*for="recherche"[^>]*>Rechercher une conversation/);
		// Aucun titre avant celui de la conversation.
		expect(page.slice(0, page.indexOf('<h1>Départ de Thomas</h1>'))).not.toMatch(/<h[1-6]/);
	});
});
