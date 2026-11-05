import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import Layout from './+layout.svelte';
import Erreur from './+error.svelte';
import Page from './+page.svelte';

const etat = vi.hoisted(() => ({ page: { url: new URL('http://x/agents'), status: 200, error: null as { message: string } | null } }));
vi.mock('$app/state', () => etat);

const enfants = createRawSnippet(() => ({ render: () => '<p>Contenu de la page</p>' }));
const groupes = [
	{
		cle: 'equipe:1',
		titre: 'Équipe 1',
		equipe: { couleur: '#b3121f', chefs: ['A. Martin'] },
		personnes: [
			{ id: 1, prenom: 'Alice', nom: 'Martin', grade: 'Sergent-chef', roles: ['Chef de garde (Équipe 1)', 'Rapporteur (Amicale)'] },
			{ id: 2, prenom: 'Paul', nom: 'Durand', grade: null, roles: [] }
		]
	},
	{ cle: 'equipe:4', titre: 'Équipe 4', equipe: { couleur: '#9a4b00', chefs: [] }, personnes: [{ id: 3, prenom: 'Inès', nom: 'Faure', grade: 'Caporal', roles: [] }] },
	{ cle: 'sans-equipe', titre: 'Sans équipe', equipe: null, personnes: [{ id: 4, prenom: 'Test', nom: 'Fictif', grade: null, roles: [] }] }
];
const ligne = (id: number, prenom: string, nom: string, autres: Record<string, unknown> = {}) => ({
	id,
	prenom,
	nom,
	email: `${prenom.toLowerCase()}@exemple.fr`,
	grade: 'Sapeur',
	statut: 'operationnel',
	roles: [],
	aCompleter: false,
	...autres
});
const gestion = (autres: Record<string, unknown> = {}) => ({
	gestion: true,
	groupes: [
		{ cle: 'equipe:1', titre: 'Équipe 1', equipe: { couleur: '#b3121f', chefs: [] }, personnes: [ligne(1, 'Alice', 'Martin', { statut: 'stagiaire', aCompleter: true }), ligne(2, 'Paul', 'Durand')] },
		{ cle: 'partis', titre: 'Partis', equipe: null, personnes: [ligne(5, 'Zoé', 'Zorro', { statut: 'parti' })] }
	],
	comptes: { 'a-completer': 1, indisponibles: 1, partis: 1 },
	filtres: { texte: '', filtre: '' },
	...autres
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: any, props: Record<string, unknown>) => render(composant, { props }).body;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tete = (composant: any, props: Record<string, unknown>) => render(composant, { props }).head;
const boutonDuGroupe = (mise: string, titre: string) => mise.match(new RegExp(`<button[^>]*aria-expanded="(true|false)"[^>]*>(?:\\s|<!--[^>]*-->)*<span class="textes[^"]*">\\s*<span class="titre[^"]*">${titre}`))?.[1];

describe('/agents : vue de tous', () => {
	const data = { gestion: false, groupes };

	it('groupe par équipe, ouverts, avec liseré, effectif et chef en résumé', () => {
		const mise = html(Layout, { data, children: enfants });
		expect(mise).toMatch(/<h1[^>]*>Agents<\/h1>/);
		// Le visage à la couleur de l'équipe ; gris sans équipe.
		expect(mise).toMatch(/background: #b3121f[^>]*>AM</);
		expect(mise).toMatch(/background: var\(--statut-neutre-fond\)[^>]*>TF</);
		expect(mise).toMatch(/<h2[^>]*>\s*<button[\s\S]*Équipe 1[\s\S]*2 agents · chef : A\. Martin/);
		expect(mise).toContain('border-left: 6px solid #b3121f');
		expect(boutonDuGroupe(mise, 'Équipe 1')).toBe('true');
		expect(boutonDuGroupe(mise, 'Sans équipe')).toBe('true');
		expect(mise).toMatch(/Sans équipe[\s\S]*1 agent</);
	});

	it('signale en alerte une équipe sans chef de garde', () => {
		const mise = html(Layout, { data, children: enfants });
		expect(mise).toMatch(/class="resume[^"]*alerte[^"]*">1 agent · sans chef de garde</);
		expect(mise.match(/class="resume[^"]*alerte/g)).toHaveLength(1);
		expect(mise).not.toContain('/nominations');
	});

	it('montre nom, grade et rôles, sans statut, e-mail, filtres ni lien vers la fiche', () => {
		const mise = html(Layout, { data, children: enfants });
		expect(mise).toContain('Alice Martin');
		expect(mise).toContain('Sergent-chef');
		expect(mise).toMatch(/Sergent-chef(<!--[^>]*-->)* · (<!--[^>]*-->)*<span class="masque[^"]*">Rôles :<\/span> Chef de garde \(Équipe 1\) · Rapporteur \(Amicale\)/);
		expect(mise.match(/Rôles/g)).toHaveLength(1);
		// Une espace entre « Rôles : » (lu seulement) et les rôles, pour le texte lu.
		expect(mise).toMatch(/Rôles :<\/span> Chef de garde/);
		expect(mise).not.toContain('@exemple.fr');
		expect(mise).not.toContain('aria-pressed');
		expect(mise).not.toContain('class="statut');
		expect(mise).not.toContain('href="/agents/');
		expect(mise).not.toContain('class="detail');
		expect(mise).not.toContain('Contenu de la page');
		expect(tete(Layout, { data, children: enfants })).toContain('<title>Agents · Gyro Caserne</title>');
		expect(html(Page, { data })).not.toContain('Choisissez un agent');
	});

	it('garde la liste visible et affiche le refus quand un agent ordinaire ouvre une fiche', () => {
		Object.assign(etat.page, { url: new URL('http://x/agents/3'), status: 403, error: { message: 'Accès réservé au chef de centre et à son adjoint' } });
		try {
			const mise = html(Layout, { data, children: createRawSnippet(() => ({ render: () => `<div>${html(Erreur, {})}</div>` })) });
			expect(mise).toContain('Alice Martin');
			expect(mise).not.toMatch(/class="liste[^"]*masquee/);
			expect(mise).toContain('Page indisponible');
			expect(mise).toContain('Accès réservé au chef de centre et à son adjoint');
		} finally {
			Object.assign(etat.page, { url: new URL('http://x/agents'), status: 200, error: null });
		}
	});
});

describe('/agents : les colonnes', () => {
	const equipe = (n: number) => ({ cle: `equipe:${n}`, titre: `Équipe ${n}`, equipe: { couleur: '#b3121f', chefs: ['A. Martin'] }, personnes: [{ id: n, prenom: 'Alice', nom: `Martin${n}`, grade: null, roles: [] }] });
	const hors = (cle: string, titre: string) => ({ cle, titre, equipe: null, personnes: [{ id: 90 + titre.length, prenom: 'Test', nom: titre, grade: null, roles: [] }] });
	const colonnes = (mise: string) => {
		const bloc = mise.slice(mise.indexOf('class="colonnes'));
		return { equipes: bloc.slice(0, bloc.indexOf('class="pile')), pile: bloc.slice(bloc.indexOf('class="pile')) };
	};

	it('de 2 à 6 équipes : une colonne chacune, dans l’ordre ; les autres groupes ensemble dans une dernière colonne', () => {
		for (const n of [2, 6]) {
			const liste = Array.from({ length: n }, (_, i) => equipe(i + 1));
			const { equipes, pile } = colonnes(html(Layout, { data: { gestion: false, groupes: [...liste, hors('sans-equipe', 'Sans équipe'), hors('exterieurs', 'Extérieurs')] }, children: enfants }));
			expect([...equipes.matchAll(/<span class="titre[^"]*">(Équipe \d)/g)].map((m) => m[1])).toEqual(liste.map((e) => e.titre));
			expect(equipes).not.toContain('Extérieurs');
			expect(pile).toMatch(/Sans équipe[\s\S]*Extérieurs/);
		}
	});

	it('sans autre groupe : pas de colonne vide', () => {
		expect(html(Layout, { data: { gestion: false, groupes: [equipe(1)] }, children: enfants })).not.toContain('class="pile');
	});

	it('une fiche ouverte : la liste passe à côté d’elle', () => {
		Object.assign(etat.page, { url: new URL('http://x/agents/2') });
		try {
			expect(html(Layout, { data: gestion(), children: enfants })).toMatch(/class="page[^"]*a-cote/);
		} finally {
			Object.assign(etat.page, { url: new URL('http://x/agents') });
		}
	});
});

describe('/agents : gestion', () => {
	it('montre la liste et les liens de gestion ; sans fiche ouverte, plus d’invite à côté : les colonnes prennent la place', () => {
		const mise = html(Layout, { data: gestion(), children: enfants });
		expect(mise).toMatch(/<a[^>]*href="\/agents\/fichier"[^>]*>[\s\S]*?Fichier<span class="masque[^"]*"> de l’effectif<\/span><\/a>/);
		expect(mise).toMatch(/<a class="action[^"]*" href="\/agents\/nouveau">[\s\S]*?Ajouter<\/span>/);
		expect(mise).toContain('class="detail');
		expect(mise).toContain('Contenu de la page');
		expect(tete(Layout, { data: gestion(), children: enfants })).not.toContain('<title>');
		expect(html(Page, { data: gestion() })).not.toContain('Choisissez un agent');
		expect(mise).not.toMatch(/class="page[^"]*a-cote/);
	});

	it('une ligne : lien vers la fiche au nom de l’agent, grade, statut hors opérationnel, fiche à compléter ; pas d’e-mail', () => {
		const mise = html(Layout, { data: gestion(), children: enfants });
		expect(mise).toMatch(/<a[^>]*href="\/agents\/1"[^>]*>Alice Martin<\/a>/);
		expect(mise).toMatch(/Alice Martin<\/a>[\s\S]*?Sapeur/);
		expect(mise).not.toContain('alice@exemple.fr');
		expect(mise).toMatch(/Alice Martin[\s\S]*Stagiaire[\s\S]*À compléter[\s\S]*Paul Durand/);
		expect(mise).not.toContain('Opérationnel');
		expect(mise).toMatch(/class="resume[^"]*alerte[^"]*">2 agents · sans chef de garde</);
	});

	it('montre l’e-mail dans la sous-ligne quand c’est lui qui répond à la recherche', () => {
		const parEmail = html(Layout, { data: gestion({ filtres: { texte: 'ALICE@', filtre: '' } }), children: enfants });
		expect(parEmail).toMatch(/Alice Martin<\/a>[\s\S]*?class="sous[^"]*"[^>]*>[\s\S]*?alice@exemple\.fr/);
		expect(parEmail).not.toContain('paul@exemple.fr');
		// Le nom répond déjà : pas d'e-mail.
		expect(html(Layout, { data: gestion({ filtres: { texte: 'alice', filtre: '' } }), children: enfants })).not.toContain('alice@exemple.fr');
	});

	it('la recherche : libellé lu, aide reliée au champ', () => {
		const mise = html(Layout, { data: gestion(), children: enfants });
		const champ = mise.match(/<input[^>]*name="texte"[^>]*>/)![0];
		const aide = champ.match(/aria-describedby="([^"]+)"/)![1];
		expect(mise).toMatch(new RegExp(`id="${aide}"[^>]*>Nom, prénom ou e-mail<`));
	});

	it('propose « Nommer » à côté d’une équipe sans chef', () => {
		const mise = html(Layout, { data: gestion(), children: enfants });
		expect(mise).toMatch(/<a[^>]*href="\/nominations"[^>]*>Nommer <span class="masque[^"]*">un chef pour Équipe 1<\/span><\/a>/);
		expect(mise.match(/href="\/nominations"/g)).toHaveLength(1);
	});

	it('garde la recherche et le filtre dans le lien vers la fiche', () => {
		Object.assign(etat.page, { url: new URL('http://x/agents?texte=mar&filtre=partis') });
		try {
			const mise = html(Layout, { data: gestion({ filtres: { texte: 'mar', filtre: 'partis' } }), children: enfants });
			expect(mise).toContain('href="/agents/5?texte=mar&amp;filtre=partis"');
			expect(boutonDuGroupe(mise, 'Partis')).toBe('true');
		} finally {
			Object.assign(etat.page, { url: new URL('http://x/agents') });
		}
	});

	it('après un enregistrement sans JavaScript, garde recherche et filtre sans le nom de l’action (liens et retour « ‹ Agents »)', () => {
		Object.assign(etat.page, { url: new URL('http://x/agents/1?/fiche&texte=mar&filtre=a-completer') });
		try {
			const mise = html(Layout, { data: gestion({ filtres: { texte: 'mar', filtre: 'a-completer' } }), children: enfants });
			expect(mise).toContain('href="/agents/2?texte=mar&amp;filtre=a-completer"');
			expect(mise).toMatch(/<a class="retour[^"]*" href="\/agents\?texte=mar&amp;filtre=a-completer">[\s\S]*?Retour : <\/span>Agents<\/a>/);
			expect(mise).not.toContain('/fiche');
		} finally {
			Object.assign(etat.page, { url: new URL('http://x/agents') });
		}
	});

	it('replie le groupe des partis par sa clé, pas par son titre : une équipe nommée « Partis » reste ouverte', () => {
		const groupes = [
			{ cle: 'equipe:7', titre: 'Partis', equipe: { couleur: '#b3121f', chefs: ['A. Martin'] }, personnes: [ligne(1, 'Alice', 'Martin')] },
			{ cle: 'partis', titre: 'Anciens', equipe: null, personnes: [ligne(5, 'Zoé', 'Zorro', { statut: 'parti' })] }
		];
		const mise = html(Layout, { data: gestion({ groupes }), children: enfants });
		expect(boutonDuGroupe(mise, 'Partis')).toBe('true');
		expect(boutonDuGroupe(mise, 'Anciens')).toBe('false');
	});

	it('replie les partis, sauf s’ils sont filtrés ou cherchés', () => {
		expect(boutonDuGroupe(html(Layout, { data: gestion(), children: enfants }), 'Équipe 1')).toBe('true');
		expect(boutonDuGroupe(html(Layout, { data: gestion(), children: enfants }), 'Partis')).toBe('false');
		expect(boutonDuGroupe(html(Layout, { data: gestion({ filtres: { texte: '', filtre: 'partis' } }), children: enfants }), 'Partis')).toBe('true');
		expect(boutonDuGroupe(html(Layout, { data: gestion({ filtres: { texte: 'zo', filtre: '' } }), children: enfants }), 'Partis')).toBe('true');
	});

	it('filtres en boutons pressés, dans le formulaire GET avec la recherche', () => {
		const mise = html(Layout, { data: gestion({ filtres: { texte: 'mar', filtre: 'a-completer' } }), children: enfants });
		const formulaire = mise.match(/<form[^>]*method="GET"[\s\S]*?<\/form>/)![0];
		expect(formulaire).toMatch(/<input[^>]*name="texte"[^>]*value="mar"/);
		// Entrée dans la recherche garde le filtre en cours : le premier bouton le porte.
		expect(formulaire.match(/<button[^>]*>/)![0]).toMatch(/name="filtre"[^>]*value="a-completer"|value="a-completer"[^>]*name="filtre"/);
		const pastille = (libelle: string) => formulaire.match(new RegExp(`<button[^>]*aria-pressed="(true|false)"[^>]*>${libelle}`))?.[1];
		expect(pastille('Tous')).toBe('false');
		expect(pastille('À compléter \\(1\\)')).toBe('true');
		expect(pastille('Indisponibles \\(1\\)')).toBe('false');
		expect(pastille('Partis \\(1\\)')).toBe('false');
		expect(html(Layout, { data: gestion(), children: enfants })).toMatch(/aria-pressed="true"[^>]*>Tous/);
	});

	it('dit quand aucun agent ne correspond', () => {
		expect(html(Layout, { data: gestion({ groupes: [] }), children: enfants })).toContain('Aucun agent à afficher');
		const cherche = html(Layout, { data: gestion({ groupes: [], filtres: { texte: 'zz', filtre: '' } }), children: enfants });
		expect(cherche).toContain('Aucun agent ne correspond.');
		expect(cherche).toMatch(/<a class="action[^"]*" href="\/agents">Tout afficher<\/a>/);
	});

	it('masque la liste derrière la fiche et marque l’agent affiché', () => {
		Object.assign(etat.page, { url: new URL('http://x/agents/2') });
		try {
			const mise = html(Layout, { data: gestion(), children: enfants });
			expect(mise).toMatch(/class="liste[^"]*masquee/);
			expect(mise).toMatch(/<a[^>]*href="\/agents\/2"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/agents\/2"/);
			expect(mise.match(/aria-current="page"/g)).toHaveLength(1);
			// Pas la couleur seule : la ligne porte aussi un repère (liseré, gras).
			expect(mise).toMatch(/<li class="agent[^"]*courant[^"]*">[\s\S]*?Paul Durand/);
			expect(mise.match(/courant/g)).toHaveLength(1);
		} finally {
			Object.assign(etat.page, { url: new URL('http://x/agents') });
		}
	});
});
