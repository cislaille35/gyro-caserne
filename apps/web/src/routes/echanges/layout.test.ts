import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

const etat = vi.hoisted(() => ({ page: { params: {} as Record<string, string> } }));
vi.mock('$app/state', () => etat);
const { default: Layout } = await import('./+layout.svelte');

const tuile = (cle: string, nom: string, type: string, plus: object = {}) => ({
	cle,
	nom,
	type,
	membre: true,
	icone: null,
	couleur: null,
	numero: null,
	derniere: null,
	lectureSeule: false,
	nouveautes: 0,
	aConfirmer: 0,
	...plus
});
const sections = {
	centre: tuile('centre', 'Le centre', 'centre', { icone: 'maison', aConfirmer: 1, nouveautes: 1, derniere: { auteur: 'Claire', texte: 'Nouvelle consigne ARI', creeLe: '2026-10-29T08:00:00' } }),
	groupes: [
		tuile('equipe:1', 'Équipe 1', 'equipe', { couleur: '#d4a017', numero: 1, nouveautes: 1, lectureSeule: true, derniere: { auteur: 'Élodie', texte: 'Pensez à vos dispos', creeLe: '2026-10-29T09:00:00' } }),
		tuile('vie', 'Vie du centre', 'vie', { icone: 'ballon', nouveautes: 3 })
	],
	autres: [tuile('comite:1', 'Comité A', 'comite', { icone: 'groupe' }), tuile('comite:2', 'Comité B', 'comite', { icone: 'groupe' }), tuile('comite:3', 'Comité C', 'comite', { icone: 'groupe' })],
	supervision: [tuile('equipe:2', 'Équipe 2', 'equipe', { membre: false, couleur: '#1565c0', numero: 2 })]
};
const aujourdhui = { anniversaires: [{ prenom: 'Thomas', nom: 'Aubry' }], evenement: { id: 7, cle: 'centre', titre: 'Manœuvre désincarcération', debut: '2026-11-05T19:00' } };
const contenu = createRawSnippet(() => ({ render: () => '<h1>Vie du centre</h1>' }));

function html(data: object = {}, niveau = 'vivant') {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return render(Layout as any, { props: { data: { sections, aujourdhui, ...data }, children: contenu }, context: new Map([['affichage', { niveau, theme: 'auto' }]]) }).body;
}
const texte = (page: string) => page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

afterEach(() => vi.useRealTimers());

describe('liste des murs', () => {
	it('sur /echanges : le titre, puis les sections dans l’ordre', () => {
		etat.page.params = {};
		const page = html();
		expect(page).toMatch(/<h1[^>]*>Échanges<\/h1>/);
		expect(page).toContain('aria-label="Murs"');
		const titres = [...page.matchAll(/<(h2|summary)[^>]*>([^<]+)/g)].map((m) => `${m[1]} ${m[2]!.trim()}`);
		expect(titres).toEqual(['h2 Aujourd’hui au centre', 'h2 Le centre', 'h2 Mes groupes', 'summary Autres comités', 'summary Supervision']);
		expect(page.match(/<details/g)).toHaveLength(2);
		expect(page).toContain('href="/echanges/equipe:1"');
	});

	it('les tuiles : badge « Officiel » écrit, annonces à confirmer, aperçu, nouveautés en clair, lecture seule', () => {
		etat.page.params = {};
		const t = texte(html());
		expect(t).toContain('Officiel');
		expect(t).toContain('1 annonce à lire et confirmer');
		expect(t).toContain('Claire : Nouvelle consigne ARI');
		expect(t).toContain('Élodie : Pensez à vos dispos');
		expect(t).toContain('3 nouveautés');
		expect(t).toContain('1 nouveauté');
		expect(t).toContain('Lecture seule');
		expect(t).toContain('mon équipe');
		expect(t).toContain('tout le monde');
		expect(t).toContain('Autres comités (3, rien de neuf)');
	});

	it('une tuile sans publication le dit', () => {
		etat.page.params = {};
		expect(texte(html())).toContain('Vie du centre · tout le monde Rien de publié pour l’instant');
	});

	it('Aujourd’hui : anniversaire avec « Souhaiter », et l’événement sans réponse', () => {
		etat.page.params = {};
		const page = html();
		expect(texte(page)).toContain('Thomas Aubry fête son anniversaire');
		expect(page).toContain('href="/echanges/publier?mur=vie&amp;texte=Joyeux%20anniversaire%20Thomas%20!"');
		expect(page).toContain('href="/echanges/centre/7"');
		expect(texte(page)).toContain('vous n’avez pas répondu');
	});

	it('sans rien aujourd’hui, ni groupe, ni supervision : pas de section vide', () => {
		etat.page.params = {};
		const page = html({ sections: { ...sections, groupes: [], autres: [], supervision: [] }, aujourdhui: { anniversaires: [], evenement: null } });
		expect(page).not.toContain('Aujourd’hui au centre');
		expect(page).not.toContain('Mes groupes');
		expect(page).not.toContain('Supervision');
		expect(page).not.toContain('<details');
	});

	it('le bouton « Écrire » mène au formulaire', () => {
		etat.page.params = {};
		expect(html()).toMatch(/<a[^>]*href="\/echanges\/publier"[^>]*>/);
	});

	it('Vivant : Gyro animé, nouveautés puis une variante choisie par le jour de l’année', () => {
		etat.page.params = {};
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
		let page = html();
		expect(page).toContain('class="gyro');
		expect(page).toContain('a-respire');
		expect(texte(page)).toContain('5 nouveautés depuis votre dernière visite. Rien ne vous a échappé : Gyro veille.');
		vi.setSystemTime(new Date('2026-01-02T12:00:00Z'));
		page = html();
		expect(texte(page)).toContain('5 nouveautés depuis votre dernière visite. La caserne bavarde, voici l’essentiel.');
		vi.setSystemTime(new Date('2026-01-03T12:00:00Z'));
		expect(texte(html())).toContain('depuis votre dernière visite. Le café est encore chaud.');
	});

	it('Équilibré : Gyro immobile et la première phrase seule ; rien de neuf', () => {
		etat.page.params = {};
		const vide = { ...sections, centre: { ...sections.centre, nouveautes: 0 }, groupes: [], supervision: [] };
		const page = html({ sections: vide }, 'equilibre');
		expect(page).toContain('class="gyro');
		expect(page).not.toContain('a-respire');
		expect(texte(page)).toMatch(/Rien de neuf depuis votre dernière visite\. (?!Le café|Rien ne|La caserne)/);
		expect(texte(html({ sections: { ...vide, groupes: [sections.groupes[0]] } }, 'equilibre'))).toContain('1 nouveauté depuis votre dernière visite.');
	});

	it('Sobre : aucun Gyro', () => {
		etat.page.params = {};
		const page = html({}, 'sobre');
		expect(page).not.toContain('class="gyro');
		expect(texte(page)).toContain('5 nouveautés depuis votre dernière visite.');
	});

	it('sur un mur : pas de titre avant celui du mur (RGAA 9.1), mur courant marqué, sans son compteur', () => {
		etat.page.params = { mur: 'vie' };
		const page = html();
		expect(page).not.toMatch(/<h[1-6][^>]*>Échanges/);
		expect(page.match(/<h[1-6]/g)).toEqual(['<h1']);
		expect(page).not.toContain('Aujourd’hui au centre');
		expect(page).toMatch(/href="\/echanges\/vie" aria-current="page"/);
		expect(texte(page)).not.toContain('3 nouveautés');
		expect(texte(page)).toContain('1 nouveauté');
	});
});
