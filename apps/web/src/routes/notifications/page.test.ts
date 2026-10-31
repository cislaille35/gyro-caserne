import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
const { default: Page } = await import('./+page.svelte');

const html = (data: Record<string, unknown>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { lignes: [], nonLues: 0, aujourdhui: '2026-10-31', signalements: [], ...data } } }).body;

describe('page des notifications', () => {
	it('rien de reçu : une phrase, pas de liste vide, pas de « Tout marquer comme lu »', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>Notifications<\/h1>/);
		expect(page).toContain('Rien de nouveau pour vous.');
		expect(page).toMatch(/<a[^>]*href="\/echanges"[^>]*>Voir les échanges<\/a>/);
		expect(page).not.toContain('<ul');
		expect(page).not.toContain('?/toutLu');
	});

	const ligne = (l: Record<string, unknown>) => ({ id: 1, type: 'publication', cle: 'centre', nomMur: 'Le centre', publicationId: 10, auteur: { prenom: 'Élodie', nom: 'Martin', couleur: '#c2185b' }, extrait: 'Manœuvre samedi', creeLe: '2026-10-31T09:00', lue: false, ...l });

	it('le fil groupé « Aujourd’hui » puis « Plus tôt », chaque ligne vers sa publication ; les non lues dites et marquées', () => {
		const page = html({
			nonLues: 1,
			lignes: [
				ligne({}),
				ligne({ id: 2, type: 'commentaire', cle: 'vie', nomMur: 'Vie du centre', publicationId: 11, extrait: 'Bravo', creeLe: '2026-10-29T18:00', lue: true, auteur: { prenom: 'Romain', nom: 'Petit', couleur: null } })
			]
		});
		expect(page).toMatch(/<h2[^>]*>Aujourd’hui<\/h2>[\s\S]*Élodie Martin[\s\S]*<h2[^>]*>Plus tôt<\/h2>[\s\S]*Romain Petit/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/centre\/10"[^>]*>[\s\S]*?Élodie Martin a publié dans Le centre[\s\S]*?Manœuvre samedi[\s\S]*?<\/a>/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/vie\/11"[^>]*>[\s\S]*?Romain Petit a commenté votre publication[\s\S]*?Bravo/);
		expect(page).toMatch(/class="visage[^"]*"[^>]*style="background: #c2185b;/);
		// Non lue : écrit pour les lecteurs d'écran, pas seulement montré.
		expect(page).toMatch(/non-lue[\s\S]*?<span class="masque[^"]*">Non lu, <\/span>[\s\S]*?Élodie Martin/);
		expect(page.match(/Non lu, /g)).toHaveLength(1);
		expect(page).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/toutLu"[\s\S]*?Tout marquer comme lu/);
		expect(page).toContain('1 notification non lue.');
	});

	it('tout lu : plus de bouton « Tout marquer comme lu »', () => {
		const page = html({ lignes: [ligne({ lue: true })] });
		expect(page).not.toContain('?/toutLu');
		expect(page).toContain('Tout est lu.');
	});

	it('un signalement : le texte copié, ses photos, l’auteur, la date et qui a signalé ; « Retirer le message » et « Classer »', () => {
		const page = html({
			signalements: [
				{ id: 7, le: '2026-10-29T10:05', par: { id: 2, prenom: 'Alice', nom: 'Martin' }, auteur: { id: 3, prenom: 'Bruno', nom: 'Petit' }, envoye_le: '2026-10-29T10:00', texte: 'Texte grave', photos: [41, 42], retirable: true }
			]
		});
		expect(page).not.toContain('Rien de nouveau');
		expect(page).toMatch(/<h2[^>]*>Messages signalés<\/h2>/);
		expect(page).toContain('Seul le message signalé vous est transmis');
		expect(page).toMatch(/<blockquote[^>]*>[\s\S]*Texte grave[\s\S]*<\/blockquote>/);
		expect(page).toContain('Bruno Petit');
		expect(page).toContain('jeudi 29 oct., 10 h');
		expect(page).toContain('Signalé par Alice Martin');
		expect(page).toContain('src="/notifications/signalements/7/photo/41"');
		expect(page).toContain('src="/notifications/signalements/7/photo/42"');
		expect(page).toMatch(/alt="Photo 1 sur 2 du message signalé"/);
		// Sans JavaScript, « Retirer le message » est un lien qui ouvre la confirmation dans la carte.
		expect(page).toMatch(/<a[^>]*href="\?retirer=7"[^>]*>Retirer le message<span class="masque[^"]*"> de Bruno Petit<\/span>/);
		expect(page).not.toContain('action="?/retirer"');
		expect(page).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/classer"[\s\S]*?name="id" value="7"[\s\S]*?Classer<span class="masque[^"]*"> le signalement du message de Bruno Petit<\/span>/);
	});

	it('un message déjà supprimé par son auteur : seulement « Classer », et la raison écrite', () => {
		const page = html({
			signalements: [{ id: 8, le: '2026-10-29T10:05', par: { id: 2, prenom: 'Alice', nom: 'Martin' }, auteur: { id: 3, prenom: 'Bruno', nom: 'Petit' }, envoye_le: '2026-10-29T10:00', texte: '', photos: [], retirable: false }]
		});
		expect(page).not.toContain('?/retirer');
		expect(page).toContain('?/classer');
		expect(page).toContain('Ce message n’est plus dans la conversation : il ne reste qu’à classer le signalement.');
		expect(page).toContain('Sans texte');
	});

	it('?retirer=<id> : la confirmation dans la carte, « Annuler » d’abord, puis le formulaire qui retire', () => {
		const signale = { id: 7, le: '2026-10-29T10:05', par: { id: 2, prenom: 'Alice', nom: 'Martin' }, auteur: { id: 3, prenom: 'Bruno', nom: 'Petit' }, envoye_le: '2026-10-29T10:00', texte: 'Texte grave', photos: [], retirable: true };
		const page = html({ signalements: [signale], confirmer: 7 });
		const carte = page.slice(page.indexOf('<li class="signalement'));
		expect(carte).toMatch(/Retirer ce message \?/);
		expect(carte).toMatch(/<a[^>]*href="\/notifications"[^>]*>Annuler<\/a>[\s\S]*?<form[^>]*method="POST"[^>]*action="\?\/retirer"[\s\S]*?name="id" value="7"[\s\S]*?>Retirer<\/button>/);
		expect(carte).not.toContain('href="?retirer=7"');
		// Un autre identifiant : rien ne s'ouvre.
		expect(html({ signalements: [signale], confirmer: 9 })).not.toContain('Retirer ce message ?');
	});
});
