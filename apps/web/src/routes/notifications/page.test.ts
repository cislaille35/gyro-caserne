import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
const { default: Page } = await import('./+page.svelte');
const { default: source } = await import('./+page.svelte?raw');

const html = (data: Record<string, unknown>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { lignes: [], nonLues: 0, aujourdhui: '2026-10-31', signalements: [], aValider: 0, ...data } } }).body;

// Une ligne non lue passe par /notifications/ouvrir, qui la marque lue puis mène à sa page ; une ligne lue y mène tout droit.
const ouvre = (genre: string, id: number, vers: string) => `/notifications/ouvrir?${new URLSearchParams({ genre, id: String(id), vers })}`.replaceAll('&', '&amp;');

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
		expect(page).toContain(`href="${ouvre('publication', 1, '/echanges/centre/10')}"`);
		expect(page).toMatch(/<a[^>]*>[\s\S]*?Élodie Martin a publié dans Le centre[\s\S]*?Manœuvre samedi[\s\S]*?<\/a>/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/vie\/11"[^>]*>[\s\S]*?Romain Petit a commenté votre publication[\s\S]*?Bravo/);
		expect(page).toMatch(/class="visage[^"]*"[^>]*style="background: #c2185b;/);
		// Non lue : écrit pour les lecteurs d'écran, pas seulement montré.
		expect(page).toMatch(/non-lue[\s\S]*?<span class="masque[^"]*">Non lu, <\/span>[\s\S]*?Élodie Martin/);
		expect(page.match(/Non lu, /g)).toHaveLength(1);
		expect(page).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/toutLu"[\s\S]*?Tout marquer comme lu/);
		expect(page).toContain('1 notification non lue.');
	});

	it('non lue : le point, « Non lu, » écrit pour les lecteurs d’écran et le titre en gras ; pas de bande à gauche', () => {
		expect(html({ nonLues: 1, lignes: [ligne({})] })).toMatch(/class="ligne[^"]*non-lue[\s\S]*?Non lu, [\s\S]*?<span class="point[^"]*" aria-hidden="true">/);
		expect(source).toMatch(/\.non-lue \.quoi \{\s*font-weight: 700;/);
		expect(source).not.toMatch(/\.non-lue \{[^}]*(box-shadow|border-left)/);
	});

	it('un avis de réservation : vers « Mes réservations », ce qui a été décidé, la période et le motif', () => {
		const page = html({ nonLues: 1, lignes: [{ id: 5, type: 'reservation', reservationId: 9, quoi: 'refusee', ressource: 'Bancs', periode: 'du 12 au 13 nov.', motif: 'Déjà prêtés', creeLe: '2026-10-31T09:00', lue: false }] });
		expect(page).toContain(`href="${ouvre('reservation', 5, '/reservations/miennes#reservation-9')}"`);
		expect(page).toMatch(/<a[^>]*>[\s\S]*?Non lu, [\s\S]*?Bancs : demande refusée[\s\S]*?du 12 au 13 nov\. · Déjà prêtés[\s\S]*?<\/a>/);
	});

	it('un avis de remplacement : vers la demande, son titre et ses périodes ; les remplacements à valider en tête', () => {
		const page = html({ nonLues: 1, remplacementsAValider: 1, lignes: [{ id: 3, type: 'remplacement', demandeId: 8, quoi: 'recue', titre: 'Demande de remplacement', texte: 'Alice Test · nuit du lundi 9 novembre', creeLe: '2026-10-31T09:00', lue: false }] });
		expect(page).toContain(`href="${ouvre('remplacement', 3, '/remplacements/8')}"`);
		expect(page).toMatch(/<a[^>]*>[\s\S]*?Non lu, [\s\S]*?Demande de remplacement[\s\S]*?Alice Test · nuit du lundi 9 novembre/);
		expect(page).toMatch(/<a[^>]*href="\/remplacements\?onglet=a-valider"[^>]*>[\s\S]*?1 remplacement à valider/);
	});

	it('un avis de l’été : vers son lien, son titre et son texte', () => {
		const page = html({ nonLues: 1, lignes: [{ id: 4, type: 'ete', quoi: 'rappel', titre: 'Vos vacances d’été', texte: 'Donnez vos vacances d’été avant le 15/05/2027.', url: '/moi/vacances', creeLe: '2027-04-15T08:00', lue: false }] });
		expect(page).toContain(`href="${ouvre('ete', 4, '/moi/vacances')}"`);
		expect(page).toMatch(/<a[^>]*>[\s\S]*?Non lu, [\s\S]*?Vos vacances d’été[\s\S]*?avant le 15\/05\/2027/);
	});

	it('un avis d’anomalie : vers l’anomalie, son titre et son texte', () => {
		const page = html({ nonLues: 1, lignes: [{ id: 5, type: 'anomalie', titre: 'VTU · Treuil HS', texte: 'Prise en charge par Rémi Fictif', url: '/engins/anomalies/3', creeLe: '2026-10-30T18:00', lue: false }] });
		expect(page).toContain(`href="${ouvre('anomalie', 5, '/engins/anomalies/3')}"`);
		expect(page).toMatch(/<a[^>]*>[\s\S]*?Non lu, [\s\S]*?VTU · Treuil HS[\s\S]*?Prise en charge par Rémi Fictif/);
	});

	it('un avis d’habillement : vers la demande, avec la veste, son titre et son texte', () => {
		const page = html({ nonLues: 1, lignes: [{ id: 6, type: 'habillement', titre: 'Question sur votre demande', texte: 'Rémi Fictif : Quelle taille ?', url: '/habillement/2', creeLe: '2026-11-08T10:00', lue: false }] });
		expect(page).toContain(`href="${ouvre('habillement', 6, '/habillement/2')}"`);
		expect(page).toContain('M9 3l3 3 3-3 5 3-2 5h-2v10H8V11H6L4 6z');
		expect(page).toMatch(/<a[^>]*>[\s\S]*?Non lu, [\s\S]*?Question sur votre demande[\s\S]*?Rémi Fictif : Quelle taille \?/);
	});

	it('des demandes de réservation à trancher : une rangée en tête, vers « À valider »', () => {
		const page = html({ aValider: 2 });
		expect(page).toMatch(/<a[^>]*href="\/reservations\/a-valider"[^>]*>[\s\S]*?2 demandes de réservation à valider/);
		expect(page).not.toContain('Rien de nouveau');
		expect(html({ aValider: 1 })).toContain('1 demande de réservation à valider');
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
