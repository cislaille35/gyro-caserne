import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { PublicationVue } from '@gyro-caserne/socle';
import Page from './+page.svelte';

const publication: PublicationVue = {
	id: 7,
	cle: 'centre',
	auteur: { prenom: 'Chef', nom: 'Martin' },
	type: 'annonce',
	texte: 'Note de service',
	creeLe: '2026-10-28T14:05:00',
	modifieeLe: null,
	epinglee: false,
	commentairesFermes: false,
	photos: [],
	jaime: 0,
	commentaires: 3,
	jaimeParMoi: false,
	evenement: null,
	sondage: null,
	priseDeConnaissance: { le: null },
	derniersCommentaires: [],
	droits: { modifier: true, supprimer: true, epingler: true, fermer: true }
};
const mur = { cle: 'centre', nom: 'Le centre', type: 'centre', peutPublier: true, peutModerer: true, lectureSeule: false };
const commentaires = ['Un', 'Deux', 'Trois'].map((texte, i) => ({ id: i + 1, auteur: { prenom: 'Alice', nom: 'Petit' }, texte, creeLe: '2026-10-28T15:00', supprimable: i === 0 }));
const personne = (prenom: string) => ({ id: prenom.length, prenom, nom: 'Test' });
const html = (data: Record<string, unknown> = {}, form: unknown = null) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { mur, publication, commentaires, suivi: null, equipes: [], estPersonne: true, ...data }, form } }).body;

describe('page d’une publication', () => {
	it('tous les commentaires, supprimables selon le droit, et le formulaire pour commenter', () => {
		const page = html();
		for (const texte of ['Un', 'Deux', 'Trois']) expect(page).toContain(`>${texte}<`);
		expect(page.match(/action="\?\/supprimerCommentaire"/g)).toHaveLength(1);
		expect(page).toContain('aria-label="Supprimer le commentaire de Alice Petit"');
		expect(page).toMatch(/<form[^>]*action="\?\/commenter"[^>]*id="commenter"|<form[^>]*id="commenter"[^>]*action="\?\/commenter"/);
		expect(page).toContain('name="texte"');
		expect(page).not.toContain('Voir les 3 commentaires');
		// Les gestes de modération restent sur le mur.
		expect(page).not.toContain('?/epingler');
		expect(page).toContain('href="/echanges/centre"');
	});

	it('cibles du focus après « Commenter » : chaque commentaire, puis le titre de la liste', () => {
		const page = html();
		for (const c of commentaires) expect(page).toMatch(new RegExp(`<li[^>]*id="commentaire-${c.id}"[^>]*tabindex="-1"`));
		expect(page).toMatch(/<h2 id="titre-commentaires" tabindex="-1"/);
	});

	it('commentaires fermés ou mur en lecture seule : pas de formulaire, un message', () => {
		const fermes = html({ publication: { ...publication, commentairesFermes: true } });
		expect(fermes).not.toContain('?/commenter');
		expect(fermes).toContain('Les commentaires sont fermés.');
		expect(html({ mur: { ...mur, lectureSeule: true } })).not.toContain('?/commenter');
	});

	it('refus du commentaire : message et saisie gardée ; une seule zone annoncée', () => {
		const page = html({}, { cible: 'publication:7', message: 'Le commentaire ne peut pas dépasser 2 000 caractères.', valeurs: { texte: 'Mon avis' } });
		expect(page).toContain('Mon avis</textarea>');
		expect(page).toMatch(/role="alert">Le commentaire ne peut pas dépasser 2 000 caractères\.</);
		expect(page.match(/role="status"/g)).toHaveLength(1);
		expect(page.match(/role="alert"/g)).toHaveLength(1);
	});

	it('suivi de la prise de connaissance : nombres et noms', () => {
		const page = html({ suivi: { priseDeConnaissance: { faite: [personne('Alice'), personne('Bruno')], manquante: [personne('Chloé')] } } });
		expect(page).toContain('id="suivi"');
		expect(page).toContain('2 ont pris connaissance, 1 pas encore : Chloé Test.');
		expect(page).toContain('Alice Test, Bruno Test');
		expect(html({ suivi: { priseDeConnaissance: { faite: [personne('Alice')], manquante: [] } } })).toContain('1 a pris connaissance, personne d’autre n’est attendu.');
		expect(html()).not.toContain('id="suivi"');
	});

	it('suivi d’un événement : réponses par catégorie', () => {
		const page = html({ suivi: { evenement: { present: [personne('Alice')], absent: [], incertain: [personne('Bruno')], sans_reponse: [personne('Chloé'), personne('David')] } } });
		expect(page).toContain('Présents (1)');
		expect(page).toContain('Absents (0)');
		expect(page).toContain('Sans réponse (2)');
		expect(page).toContain('Chloé Test, David Test');
		expect(page).toContain('personne');
	});
});
