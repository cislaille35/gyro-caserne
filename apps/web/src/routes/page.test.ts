import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const astreinte = { id: 'astreinte', nom: 'Mon astreinte', icone: 'casque', compte: 0 };
const centre = { id: 'centre', nom: 'Le centre', icone: 'etoile', compte: 2 };
const page = (data: Record<string, unknown>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { prenom: 'Alice', peutNominations: false, peutReglages: false, ...data } } }).body;

describe('accueil', () => {
	it('une seule casquette : pas de rangée ; « Bonjour » en tête ; astreinte vide sans fausses données', () => {
		const html = page({ casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' } });
		expect(html).toContain('Bonjour Alice');
		expect(html).not.toContain('aria-label="Casquettes"');
		expect(html).toContain('Votre astreinte s’affichera ici avec le planning.');
	});

	it('plusieurs casquettes : rangée de liens, la choisie marquée, le compteur dans le libellé', () => {
		const html = page({
			casquettes: [centre, astreinte],
			choisie: 'astreinte',
			contenu: { type: 'astreinte' }
		});
		expect(html).toMatch(/<nav[^>]*aria-label="Casquettes"/);
		expect(html).not.toContain('role="tab');
		const lienCentre = html.match(/<a[^>]*href="\?casquette=centre"[^>]*>/)![0];
		expect(lienCentre).toContain('aria-label="Le centre, 2 en attente"');
		expect(lienCentre).not.toContain('aria-current');
		// « true », pas « page » : l'onglet « Accueil » porte déjà « page ».
		expect(html).toMatch(/<a[^>]*href="\?casquette=astreinte"[^>]*aria-current="true"/);
		expect(html).not.toMatch(/aria-current="page"/);
		// Sans puces, VoiceOver perd la liste : rôle explicite.
		expect(html).toMatch(/<nav[^>]*aria-label="Casquettes"[^>]*>\s*<ul[^>]*role="list"/);
		expect(html.indexOf('Bonjour Alice')).toBeLessThan(html.indexOf('aria-label="Casquettes"'));
	});

	it('« Le centre » : « À décider » et les raccourcis permis', () => {
		const html = page({
			casquettes: [centre, astreinte],
			choisie: 'centre',
			peutNominations: true,
			peutReglages: true,
			contenu: { type: 'centre', aDecider: [{ texte: 'Équipe 2 sans chef d’équipe', lien: '/nominations' }] }
		});
		expect(html).toContain('À décider');
		expect(html.match(/<ul[^>]*class="liste[^"]*"[^>]*>/g)!.every((ul) => ul.includes('role="list"'))).toBe(true);
		expect(html).toMatch(/<a[^>]*href="\/nominations"[^>]*>[\s\S]*?Équipe 2 sans chef d’équipe/);
		for (const [href, titre] of [['/agents', 'Agents'], ['/nominations', 'Nominations'], ['/reglages', 'Réglages']]) {
			expect(html).toMatch(new RegExp(`<a[^>]*href="${href}"[^>]*>[\\s\\S]*?${titre}`));
		}
	});

	it('« Le centre » sans rien à décider, sans droit de nommer ni de régler', () => {
		const html = page({ casquettes: [centre, astreinte], choisie: 'centre', contenu: { type: 'centre', aDecider: [] } });
		expect(html).toContain('Rien à décider pour le moment.');
		expect(html).not.toContain('href="/reglages"');
	});

	it('chef d’équipe : vide avec une phrase vraie', () => {
		const html = page({ casquettes: [{ id: 'equipe:1', nom: 'Chef d’équipe · Équipe 1', icone: 'casque', compte: 0 }, astreinte], choisie: 'equipe:1', contenu: { type: 'equipe' } });
		expect(html).toContain('Votre astreinte s’affichera ici avec le planning.');
	});

	it('rôle : ce qu’il permet, en phrases', () => {
		const role = { id: 'role:7', nom: 'Référent pharmacie', icone: 'croix', compte: 0 };
		expect(page({ casquettes: [astreinte, role], choisie: 'role:7', contenu: { type: 'role', permet: ['Gérer le stock et la pharmacie.'] } })).toContain('Gérer le stock et la pharmacie.');
		expect(page({ casquettes: [astreinte, role], choisie: 'role:7', contenu: { type: 'role', permet: [] } })).toContain('Ce rôle n’ajoute rien à ce que fait tout agent.');
	});

	it('comité : membres et rapporteur', () => {
		const html = page({
			casquettes: [astreinte, { id: 'comite:2', nom: 'Amicale', icone: 'groupe', compte: 0 }],
			choisie: 'comite:2',
			contenu: { type: 'comite', membres: [{ personneId: 4, prenom: 'Bruno', nom: 'Petit', role: 'Rapporteur de comité' }, { personneId: 5, prenom: 'Bruno', nom: 'Petit', role: 'Membre de comité' }] }
		});
		expect(html).toContain('Bruno Petit');
		expect(html).toContain('Rapporteur de comité');
		// Deux homonymes : deux lignes (clé par personne).
		expect(html.match(/Bruno Petit/g)).toHaveLength(2);
	});
});
