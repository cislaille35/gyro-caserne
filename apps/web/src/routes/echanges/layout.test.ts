import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

const etat = vi.hoisted(() => ({ page: { params: {} as Record<string, string>, url: new URL('http://x/echanges') } }));
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

const aVenir = [
	{ id: 7, cle: 'centre', nomMur: 'Le centre', titre: 'Manœuvre désincarcération', debut: '2026-11-05T19:00' },
	{ id: 9, cle: 'comite:2', nomMur: 'Amicale', titre: 'Repas de Sainte-Barbe', debut: '2026-11-28T12:30' }
];

function html(data: object = {}, niveau = 'vivant') {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return render(Layout as any, { props: { data: { sections, aujourdhui, aVenir, messagerie: true, avis: null, ...data }, children: contenu }, context: new Map([['affichage', { niveau, theme: 'auto' }]]) }).body;
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

	it('Supervision : ses nouveautés écrites dans le résumé, hors de la phrase d’en-tête', () => {
		etat.page.params = {};
		const supervision = [{ ...sections.supervision[0], nouveautes: 4 }];
		const page = texte(html({ sections: { ...sections, supervision } }, 'sobre'));
		expect(page).toContain('5 nouveautés depuis votre dernière visite.');
		expect(page).toContain('Supervision · 4 nouveautés');
		expect(texte(html({}, 'sobre'))).toContain('Supervision (1)');
		const seule = { ...sections, centre: { ...sections.centre, nouveautes: 0 }, groupes: [], supervision };
		expect(texte(html({ sections: seule }, 'sobre'))).toContain('Rien de neuf depuis votre dernière visite.');
	});

	it('le bouton « Écrire » mène au formulaire', () => {
		etat.page.params = {};
		expect(html()).toMatch(/<a[^>]*href="\/echanges\/publier"[^>]*>[\s\S]*?<span class="libelle[^"]*">Écrire<\/span>/);
	});

	it('Vivant : nouveautés puis une variante choisie par le jour de l’année ; pas de Gyro dans le titre (il reste dans les écrans vides)', () => {
		etat.page.params = {};
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
		let page = html();
		expect(page).not.toContain('class="gyro');
		expect(texte(page)).toContain('5 nouveautés depuis votre dernière visite. Rien ne vous a échappé : Gyro veille.');
		vi.setSystemTime(new Date('2026-01-02T12:00:00Z'));
		page = html();
		expect(texte(page)).toContain('5 nouveautés depuis votre dernière visite. La caserne bavarde, voici l’essentiel.');
		vi.setSystemTime(new Date('2026-01-03T12:00:00Z'));
		expect(texte(html())).toContain('depuis votre dernière visite. Le café est encore chaud.');
	});

	it('deux anniversaires d’homonymes : deux lignes, deux liens « Souhaiter »', () => {
		etat.page.params = {};
		const page = html({ aujourdhui: { anniversaires: [{ prenom: 'Thomas', nom: 'Agent' }, { prenom: 'Thomas', nom: 'Agent' }], evenement: null } });
		expect(texte(page).match(/Thomas Agent fête son anniversaire/g)).toHaveLength(2);
		expect(page.match(/texte=Joyeux%20anniversaire%20Thomas%20!/g)).toHaveLength(2);
		// Une clé tirée du nom ferait planter la page dans le navigateur (each_key_duplicate) : la boucle est indexée.
		const liste = compile(readFileSync(new URL('./+layout.svelte', import.meta.url), 'utf8'), { generate: 'client' }).js.code;
		expect(liste).not.toMatch(/a\.prenom\} \$\{a\.nom/);
	});

	it('les sections repliées : ouvertes au premier rendu si le mur courant y est, puis laissées à la personne', () => {
		etat.page.params = { mur: 'comite:2' };
		expect(html()).toMatch(/<details class="repli[^"]*" open/);
		etat.page.params = {};
		expect(html()).not.toMatch(/<details[^>]* open/);
		// Pas d'attribut suivi : changer de mur ne referme pas une section ouverte.
		const source = readFileSync(new URL('./+layout.svelte', import.meta.url), 'utf8');
		expect(source).not.toMatch(/open=\{s\./);
	});

	it('Équilibré : la première phrase seule ; rien de neuf', () => {
		etat.page.params = {};
		const vide = { ...sections, centre: { ...sections.centre, nouveautes: 0 }, groupes: [], supervision: [] };
		const page = html({ sections: vide }, 'equilibre');
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
		expect(page.match(/<h[1-6]/g)?.[0]).toBe('<h1');
		expect(page).toMatch(/href="\/echanges\/vie" aria-current="page"/);
		expect(texte(page)).not.toContain('3 nouveautés');
		expect(texte(page)).toContain('1 nouveauté');
	});

	it('sur un mur : la colonne Aujourd’hui après le mur, anniversaires et 3 prochains événements', () => {
		etat.page.params = { mur: 'vie' };
		const page = html();
		const colonne = page.slice(page.indexOf('<aside'));
		expect(page.indexOf('<aside')).toBeGreaterThan(page.indexOf('<h1'));
		expect(colonne).toMatch(/<aside[^>]*aria-label="Aujourd’hui"/);
		expect(texte(colonne)).toContain('Aujourd’hui au centre TA Thomas Aubry fête son anniversaire Souhaiter à Thomas');
		expect(texte(colonne)).toContain('À venir');
		expect(colonne).toContain('href="/echanges/centre/7"');
		expect(texte(colonne)).toContain('Jeu. 5 nov., 19 h Manœuvre désincarcération');
		expect(texte(colonne)).toContain('Sam. 28 nov., 12 h 30 Repas de Sainte-Barbe (Amicale)');
		// L'événement sans réponse est déjà dans « À venir » : pas en double.
		expect(texte(colonne)).not.toContain('vous n’avez pas répondu');
	});

	it('sur un mur, rien aujourd’hui ni à venir : pas de colonne', () => {
		etat.page.params = { mur: 'vie' };
		expect(html({ aujourdhui: { anniversaires: [], evenement: null }, aVenir: [] })).not.toContain('<aside');
	});

	it('sur /echanges : pas de colonne Aujourd’hui à part', () => {
		etat.page.params = {};
		expect(html()).not.toContain('<aside');
	});
});

describe('filtres « Murs » | « Messages »', () => {
	const contexte = (nombre: number) => new Map<string, unknown>([['affichage', { niveau: 'vivant', theme: 'auto' }], ['non-lus', { nombre }]]);
	const rendu = (data: object, ctx: Map<string, unknown>) =>
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		render(Layout as any, { props: { data: { sections, aujourdhui, aVenir, messagerie: true, avis: null, ...data }, children: contenu }, context: ctx }).body;

	it('sur /echanges : Murs courant, Messages avec les non-lus du moment', () => {
		etat.page.params = {};
		const page = rendu({}, contexte(3));
		const filtres = page.match(/<nav[^>]*aria-label="Filtrer les échanges"[\s\S]*?<\/nav>/)![0];
		expect(filtres).toMatch(/<a[^>]*href="\/echanges"[^>]*aria-current="page"/);
		expect(texte(filtres)).toContain('Messages 3 , 3 messages non lus');
	});

	it('sans messagerie (extérieur) : pas de filtres', () => {
		etat.page.params = {};
		expect(rendu({ messagerie: false }, contexte(0))).not.toContain('Filtrer les échanges');
	});

	it('au retour d’un refus : la raison, annoncée poliment', () => {
		etat.page.params = {};
		const page = rendu({ avis: 'La messagerie n’est pas ouverte à votre profil.' }, contexte(0));
		expect(page).toMatch(/<p[^>]*role="status"[^>]*>La messagerie n’est pas ouverte à votre profil\.<\/p>/);
	});

	it('sous /echanges/messages : la page des messages seule, sans la liste des murs', () => {
		etat.page.params = {};
		etat.page.url = new URL('http://x/echanges/messages');
		const page = rendu({}, contexte(0));
		etat.page.url = new URL('http://x/echanges');
		expect(page).toContain('<h1>Vie du centre</h1>');
		expect(page).not.toContain('aria-label="Murs"');
		expect(page).not.toContain('Filtrer les échanges');
	});
});
