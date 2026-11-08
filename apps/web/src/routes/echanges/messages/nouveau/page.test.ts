import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const personne = (id: number, prenom: string, nom: string, sous: string, couleur: string | null = '#1565c0', surnom: string | null = null) => ({ id, prenom, nom, surnom, couleur, sous, lien: `/echanges/messages/a/${id}` });
const elodie = { ...personne(4, 'Élodie', 'Chef-de-Garde', 'Chef de garde', '#d4a017'), lien: '/echanges/messages/12' };
const personnes = [personne(2, 'Antoine', 'Adjoint', 'Adjoint', null), elodie, personne(6, 'Manon', 'Membre', 'Équipe 3', '#1565c0', 'Mamie')];
const pourVous = {
	chefs: [elodie],
	equipes: [{ id: 1, numero: 1, nom: 'Équipe 1', couleur: '#d4a017', membres: 9, lien: '/echanges/messages/nouveau/groupe?equipe=1' }],
	comites: [{ id: 3, nom: 'Amicale', icone: 'coeur', membres: 1, lien: '/echanges/messages/nouveau/groupe?comite=3' }]
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: object = {}) => render(Page as any, { props: { data: { personnes, pourVous, q: '', ...data } } }).body;
const texte = (page: string) => page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const liens = (page: string) => [...page.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
const section = (page: string, titre: string) => page.split(new RegExp(`<h2[^>]*>${titre}</h2>`))[1]!.split('<h2')[0]!;

describe('nouveau message', () => {
	it('« Annuler » vers la liste, le titre, la recherche par nom, prénom ou surnom', () => {
		const page = html();
		expect(page).toMatch(/<a[^>]*href="\/echanges\/messages"[^>]*>Annuler<\/a>/);
		expect(page).toMatch(/<h1[^>]*>Nouveau message<\/h1>/);
		expect(page).toMatch(/<form[^>]*role="search"/);
		expect(page).toMatch(/<label[^>]*for="recherche"[^>]*>Écrire à<\/label>/);
		expect(page).toMatch(/<input[^>]*placeholder="Nom, prénom ou surnom"/);
		expect(page).toMatch(/<input[^>]*name="q"/);
	});

	it('« Nouveau groupe » en tête, puis « Pour vous » et « Tout le centre »', () => {
		const page = html();
		const ordre = ['NOUVEAU GROUPE', 'POUR VOUS', 'TOUT LE CENTRE'].map((t) => texte(page).toUpperCase().indexOf(t));
		expect(ordre.every((i) => i >= 0)).toBe(true);
		expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
		expect(liens(page)).toContain('/echanges/messages/nouveau/groupe');
	});

	it('pour vous : le chef de garde, le groupe de l’équipe et celui du comité, avec leurs liens', () => {
		const t = section(html(), 'Pour vous');
		expect(liens(t)).toEqual(['/echanges/messages/12', '/echanges/messages/nouveau/groupe?equipe=1', '/echanges/messages/nouveau/groupe?comite=3']);
		expect(texte(t)).toContain('Élodie Chef-de-Garde votre chef de garde');
		expect(texte(t)).toContain('Groupe avec l’équipe 1 9 membres, ajoutés d’un coup');
		expect(texte(t)).toContain('Groupe avec l’Amicale 1 membre du comité');
		// L'équipe a son numéro sur sa teinte, le comité son icône.
		expect(t).not.toContain('--icone-');
	});

	it('un comité dont le nom commence par une consonne, sans élision', () => {
		const sport = { ...pourVous, comites: [{ ...pourVous.comites[0], nom: 'Sport' }] };
		expect(texte(html({ pourVous: sport }))).toContain('Groupe avec Sport 1 membre du comité');
	});

	it('sans raccourci, « Pour vous » n’apparaît pas', () => {
		expect(texte(html({ pourVous: { chefs: [], equipes: [], comites: [] } })).toUpperCase()).not.toContain('POUR VOUS');
	});

	it('tout le centre : chaque agent avec son rôle ou son équipe, vers sa conversation', () => {
		const t = section(html(), 'Tout le centre');
		expect(liens(t)).toEqual(['/echanges/messages/a/2', '/echanges/messages/12', '/echanges/messages/a/6']);
		expect(texte(t)).toContain('Antoine Adjoint Adjoint');
		expect(texte(t)).toContain('Manon Membre Équipe 3');
		expect(texte(t)).toContain('MM');
	});

	it('la recherche filtre par nom, prénom ou surnom, sans accent ni casse, et laisse de côté les raccourcis', () => {
		for (const q of ['elodie', 'CHEF-de-garde', 'mamie']) {
			const page = html({ q });
			expect(liens(page), q).toEqual(['/echanges/messages', q === 'mamie' ? '/echanges/messages/a/6' : '/echanges/messages/12']);
			expect(texte(page).toUpperCase()).not.toContain('POUR VOUS');
		}
		expect(html({ q: 'zzz' })).toMatch(/<p[^>]*role="status"[^>]*>Personne à ce nom\.<\/p>/);
		expect(html()).toMatch(/<p class="aucune[^"]*\bmasque\b[^"]*" role="status"><\/p>/);
	});

	it('seul dans l’annuaire : une phrase', () => {
		expect(texte(html({ personnes: [], pourVous: { chefs: [], equipes: [], comites: [] } }))).toContain('Personne d’autre dans l’annuaire pour l’instant.');
	});
});
