import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
const { default: Page } = await import('./+page.svelte');

const html = (data: Record<string, unknown>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { annonces: [], evenements: [], sondages: [], signalements: [], ...data } } }).body;

describe('page des notifications', () => {
	it('rien de nouveau : une phrase, pas de liste vide', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>Notifications<\/h1>/);
		expect(page).toContain('Rien de nouveau pour vous.');
		expect(page).toContain('Tout est à jour');
		expect(page).toMatch(/<a[^>]*href="\/echanges"[^>]*>Voir les échanges<\/a>/);
		expect(page).not.toContain('<ul');
	});

	it('une liste de liens vers chaque publication, avec ce qu’il faut faire écrit', () => {
		const page = html({
			annonces: [{ id: 1, cle: 'centre', nomMur: 'Le centre', titre: 'Note de service' }],
			evenements: [
				{ id: 2, cle: 'equipe:1', nomMur: 'Équipe 1', titre: 'Manœuvre', debut: '2026-10-29T19:00', demain: true, reponse: null, sondage: false },
				{ id: 5, cle: 'centre', nomMur: 'Le centre', titre: 'Repas', debut: '2026-11-05T12:00', demain: false, reponse: 'present', sondage: true }
			],
			sondages: [{ id: 3, cle: 'vie', nomMur: 'Vie du centre', titre: 'Repas' }]
		});
		expect(page).not.toContain('Rien de nouveau');
		expect(page).toMatch(/<ul[^>]*role="list"/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/centre\/1"[^>]*>[\s\S]*?Note de service[\s\S]*?Annonce à prendre en compte · Le centre/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/equipe:1\/2"[^>]*>[\s\S]*?Manœuvre[\s\S]*?Événement demain, à répondre · Équipe 1/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/centre\/5"[^>]*>[\s\S]*?Repas[\s\S]*?Événement avec sondage, à voter · Le centre/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/vie\/3"[^>]*>[\s\S]*?Repas[\s\S]*?Sondage à répondre · Vie du centre/);
		// Un événement montre sa date ; le compte est dit en tête.
		expect(page).toMatch(/role="img"[^>]*aria-label="jeudi 29 octobre"/);
		expect(page).toContain('4 choses demandent votre attention.');
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
