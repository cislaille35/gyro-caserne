import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const titulaire = (id: number, prenom: string, perimetre: { type: string; id: number | null; nom: string | null } = { type: 'comite', id: 2, nom: 'Amicale' }) => ({
	id,
	personne: { id: id + 10, prenom, nom: 'Martin' },
	perimetre,
	debut: '2026-01-01',
	fin: null
});
const roles = [
	{ responsabiliteId: 5, nom: 'Référent engins', portee: 'centre', icone: 'camion', perimetres: [{ type: 'centre', id: null, nom: 'Centre' }], titulaires: [titulaire(1, 'Alice', { type: 'centre', id: null, nom: null })] },
	{ responsabiliteId: 6, nom: 'Membre de comité', portee: 'comite', icone: 'groupe', perimetres: [{ type: 'comite', id: 2, nom: 'Amicale' }], titulaires: [] },
	{
		responsabiliteId: 7,
		nom: 'Chef d’équipe',
		portee: 'equipe',
		icone: 'casque',
		perimetres: [
			{ type: 'equipe', id: 1, nom: 'Équipe 1' },
			{ type: 'equipe', id: 2, nom: 'Équipe 2' }
		],
		titulaires: [titulaire(2, 'Bruno', { type: 'equipe', id: 1, nom: 'Équipe 1' })]
	}
];
const data = { aujourdhui: '2026-10-27', roles, agents: [{ id: 3, nom: 'Bob Durand', equipe: 'Équipe 1' }], nommer: null, retirer: null, recherche: '' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (props: Record<string, unknown>) => render(Page as any, { props }).body;
// Le morceau de page de la carte d'un rôle.
const carte = (page: string, nom: string) => {
	const debut = page.lastIndexOf('<section', page.indexOf(`>${nom}</h2>`));
	return page.slice(debut, page.indexOf('</section>', debut));
};

describe('/nominations : cartes', () => {
	it('une carte par rôle : icône, nom, périmètre', () => {
		const page = html({ data, form: null });
		expect(page).toContain('>Nominations</h1>');
		// Un seul « Nommer » par rôle, en secondaire : pas de mur de boutons rouges.
		expect(page).not.toContain('principal');
		expect(page.match(/class="nommer/g)).toHaveLength(data.roles.length);
		expect(carte(page, 'Référent engins')).toContain('Tout le centre');
		expect(carte(page, 'Référent engins')).toContain('--icone-camion-fond');
		expect(carte(page, 'Membre de comité')).toContain('Amicale');
		expect(carte(page, 'Chef d’équipe')).toContain('Équipe 1, Équipe 2');
	});

	it('montre les titulaires en pastilles : de vrais boutons « Retirer <nom> »', () => {
		const page = html({ data, form: null });
		expect(carte(page, 'Référent engins')).toMatch(/<button[^>]*aria-label="Retirer Alice Martin"[^>]*>/);
		expect(carte(page, 'Référent engins')).toMatch(/<button[^>]*name="retirer"[^>]*value="1"/);
		expect(carte(page, 'Chef d’équipe')).toMatch(/<button[^>]*aria-label="Retirer Bruno Martin — Équipe 1"/);
		// Sans JavaScript, les boutons passent par le formulaire de l'adresse.
		expect(page).toMatch(/<form[^>]*id="choix"[^>]*method="GET"|<form[^>]*method="GET"[^>]*id="choix"/);
	});

	it('signale « Aucun titulaire » en alerte', () => {
		const vide = carte(html({ data, form: null }), 'Membre de comité');
		expect(vide).toMatch(/--statut-alerte-fond[^>]*>(<!--[^>]*-->)*À pourvoir</);
		expect(vide).not.toContain('Retirer');
	});

	it('a une zone d’annonce par carte dès le chargement, et des boutons actifs', () => {
		const page = html({ data, form: null });
		// Trois cartes, plus le résultat de la recherche.
		expect(page.match(/role="status"/g)).toHaveLength(4);
		expect(page).not.toMatch(/<button[^>]*disabled/);
	});
});

describe('/nominations : panneau « Nommer »', () => {
	it('est fermé au départ : un bouton « Nommer » par carte', () => {
		const page = html({ data, form: null });
		expect(page).not.toContain('<dialog');
		expect(page).not.toContain('?/attribuer');
		expect(carte(page, 'Référent engins')).toMatch(/<button[^>]*name="nommer"[^>]*value="5"[^>]*>Nommer<\/button>/);
	});

	it('s’ouvre dans la carte demandée : agent, début aujourd’hui, dates repliées', () => {
		const page = html({ data: { ...data, nommer: 5 }, form: null });
		expect(page.match(/<dialog/g)).toHaveLength(1);
		const panneau = carte(page, 'Référent engins');
		expect(panneau).toMatch(/<dialog[^>]*open/);
		expect(panneau).toContain('Nommer : Référent engins');
		expect(panneau).toMatch(/<form[^>]*action="\?\/attribuer"/);
		expect(panneau).toMatch(/<select[^>]*name="personneId"/);
		expect(panneau).toContain('Bob Durand (Équipe 1)');
		expect(panneau).toMatch(/<input type="hidden" name="perimetre" value="centre"/);
		expect(panneau).toContain('À partir d’aujourd’hui');
		expect(panneau).toMatch(/<details>(?:(?!<\/details>)[\s\S])*Changer les dates[\s\S]*name="debut"[^>]*value="2026-10-27"/);
		expect(panneau).toMatch(/name="fin"/);
	});

	it('demande le périmètre seulement s’il y a le choix', () => {
		const comite = carte(html({ data: { ...data, nommer: 6 }, form: null }), 'Membre de comité');
		expect(comite).toMatch(/<input type="hidden" name="perimetre" value="2"/);
		expect(comite).not.toMatch(/<select[^>]*name="perimetre"/);
		const equipe = carte(html({ data: { ...data, nommer: 7 }, form: null }), 'Chef d’équipe');
		expect(equipe).toMatch(/<select[^>]*name="perimetre"/);
		expect(equipe).toContain('>Équipe</label>');
	});

	it('ne montre rien pour un rôle ou un titulaire absent de la page (adresse fabriquée)', () => {
		const page = html({ data: { ...data, nommer: 99, retirer: 99 }, form: null });
		expect(page).not.toContain('<dialog');
		expect(page).not.toContain('?/attribuer');
		expect(page).not.toContain('?/terminer');
		expect(page).not.toContain('?/finir');
		expect(page).toBe(html({ data, form: null }));
	});

	it('reste ouvert sur une erreur du serveur, affichée dans le panneau, dates dépliées si elles sont en cause', () => {
		const form = { cible: 'attribuer-5', erreurs: { debut: 'Cette personne tient déjà ce rôle sur cette période' }, valeurs: { responsabiliteId: '5', personneId: '3', perimetre: 'centre', debut: '2026-12-01', fin: '' } };
		const page = html({ data, form });
		const panneau = page.slice(page.indexOf('<dialog'), page.indexOf('</dialog>'));
		expect(panneau).toContain('Cette personne tient déjà ce rôle sur cette période');
		expect(panneau).toMatch(/role="alert"[^>]*>(<!--[^>]*-->)*<p[^>]*>Le formulaire contient des erreurs\./);
		expect(panneau).toContain('<details open');
		expect(panneau).toContain('value="2026-12-01"');
		expect(carte(page, 'Référent engins')).toContain('<dialog');
	});

	it('se ferme sur une réussite, annoncée dans la carte', () => {
		const page = html({ data: { ...data, nommer: 5 }, form: { cible: 'attribuer-5', succes: true, message: 'Rôle attribué' } });
		expect(page).not.toContain('<dialog');
		expect(carte(page, 'Référent engins')).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Rôle attribué</);
	});
});

describe('/nominations : retirer un titulaire', () => {
	it('demande confirmation avant de retirer, et propose aussi une date de fin', () => {
		const page = html({ data: { ...data, retirer: 1 }, form: null });
		const etape = carte(page, 'Référent engins');
		expect(etape).toContain('Retirer Alice Martin ?');
		expect(etape).toMatch(/<form[^>]*action="\?\/terminer"[\s\S]*name="confirmation" value="oui"[\s\S]*>Confirmer le retrait</);
		expect(etape).toMatch(/action="\?\/finir"/);
		expect(etape).toContain('>Annuler<');
		expect(page.match(/\?\/terminer/g)).toHaveLength(1);
	});

	it('n’affiche aucune confirmation sans demande', () => {
		expect(html({ data, form: null })).not.toContain('?/terminer');
	});

	it('montre une erreur du serveur dans l’étape de confirmation', () => {
		const page = html({ data, form: { cible: 'finir-1', role: 5, erreurs: { fin: 'Une attribution ne peut qu’être raccourcie' }, valeurs: { fin: '2100-01-01' } } });
		const etape = carte(page, 'Référent engins');
		expect(etape).toContain('Retirer Alice Martin ?');
		expect(etape).toMatch(/id="nouvelle-fin-1-erreur"[^>]*>Une attribution ne peut qu’être raccourcie/);
		const refus = html({ data, form: { cible: 'terminer-1', role: 5, message: 'Action non autorisée' } });
		expect(carte(refus, 'Référent engins')).toMatch(/role="alert"[^>]*>Action non autorisée/);
	});

	it('annonce « Rôle terminé » dans la carte, même quand le titulaire a quitté la liste', () => {
		const page = html({ data: { ...data, retirer: 1, roles: roles.map((r) => ({ ...r, titulaires: [] })) }, form: { cible: 'terminer-1', role: 6, succes: true, message: 'Rôle terminé' } });
		expect(page.match(/Rôle terminé/g)).toHaveLength(1);
		expect(carte(page, 'Membre de comité')).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Rôle terminé</);
		expect(page).not.toContain('?/terminer');
	});
});

describe('/nominations : recherche', () => {
	it('filtre par rôle ou par agent, sans tenir compte des accents ni des majuscules', () => {
		const parRole = html({ data: { ...data, recherche: 'referent' }, form: null });
		expect(parRole).toContain('>Référent engins</h2>');
		expect(parRole).not.toContain('>Membre de comité</h2>');
		const parAgent = html({ data: { ...data, recherche: 'BRUNO' }, form: null });
		expect(parAgent).toContain('>Chef d’équipe</h2>');
		expect(parAgent).not.toContain('>Référent engins</h2>');
		expect(parAgent).toMatch(/<input[^>]*type="search"[^>]*name="q"[^>]*value="BRUNO"|<input[^>]*value="BRUNO"[^>]*name="q"/);
	});

	it('dit quand rien ne correspond', () => {
		expect(html({ data: { ...data, recherche: 'zzz' }, form: null })).toMatch(/<p role="status"[^>]*>Aucun rôle ni agent ne correspond à « zzz »\.<\/p>/);
	});

	it('annonce le nombre de cartes trouvées dans une zone de statut, présente dès le chargement (RGAA 7.5)', () => {
		const statut = (recherche: string) => html({ data: { ...data, recherche }, form: null }).match(/<p role="status"[^>]*>([^<]*)<\/p>/)?.[1];
		expect(statut('')).toBe('');
		expect(statut('referent')).toBe('1 rôle correspond.');
		expect(statut('martin')).toBe('2 rôles correspondent.');
	});
});
