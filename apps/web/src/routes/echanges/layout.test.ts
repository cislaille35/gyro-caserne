import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

const etat = vi.hoisted(() => ({ page: { params: {} as Record<string, string> } }));
vi.mock('$app/state', () => etat);
const { default: Layout } = await import('./+layout.svelte');

const murs = [
	{ cle: 'centre', nom: 'Le centre', type: 'centre', lectureSeule: false, nouveautes: 0 },
	{ cle: 'vie', nom: 'Vie du centre', type: 'vie', lectureSeule: false, nouveautes: 3 },
	{ cle: 'equipe:1', nom: 'Équipe 1', type: 'equipe', lectureSeule: true, nouveautes: 1 }
];
const contenu = createRawSnippet(() => ({ render: () => '<h1>Vie du centre</h1>' }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = () => render(Layout as any, { props: { data: { murs }, children: contenu } }).body;

describe('liste des murs', () => {
	it('sur /echanges : le titre de la page, les murs et leurs nouveautés', () => {
		etat.page.params = {};
		const page = html();
		expect(page).toMatch(/<h1[^>]*>Échanges<\/h1>/);
		expect(page).toContain('<nav class="murs svelte-');
		expect(page).toContain('aria-label="Murs"');
		expect(page).toContain('3 nouveautés');
		expect(page).toContain('Lecture seule');
		expect(page).toContain('href="/echanges/equipe:1"');
	});

	it('sur un mur : pas de titre avant celui du mur (RGAA 9.1), mur courant marqué, sans son compteur', () => {
		etat.page.params = { mur: 'vie' };
		const page = html();
		expect(page).not.toMatch(/<h[1-6][^>]*>Échanges/);
		expect(page.match(/<h[1-6]/g)).toEqual(['<h1']);
		expect(page).toMatch(/href="\/echanges\/vie" aria-current="page"/);
		expect(page).not.toContain('3 nouveautés');
		expect(page).toContain('1 nouveauté');
	});
});
