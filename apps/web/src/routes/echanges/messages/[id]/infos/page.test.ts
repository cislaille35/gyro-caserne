import type { InfosConversation } from '@gyro-caserne/socle';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
const { default: Page } = await import('./+page.svelte');

const membre = (id: number, prenom: string, nom: string, autres: Partial<InfosConversation['membres'][number]> = {}) => ({ id, prenom, nom, animateur: false, equipe: null, role: null, telephone: null, ...autres });
const infos: InfosConversation = {
	type: 'groupe',
	nom: 'Départ de Thomas',
	icone: 'coeur',
	creePar: 2,
	creeParPrenom: 'Romain',
	membres: [
		membre(2, 'Romain', 'Rapporteur', { animateur: true, equipe: { numero: 2, couleur: '#c2185b' } }),
		membre(1, 'Thomas', 'Agent', { animateur: true, equipe: { numero: 1, couleur: '#d4a017' } }),
		membre(4, 'Claire', 'Chef', { role: 'Chef de centre' }),
		membre(3, 'Manon', 'Membre', { equipe: { numero: 3, couleur: '#1565c0' } })
	],
	moiAnimateur: true
};

function html(data: Record<string, unknown> = {}, form: unknown = null) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return render(Page as any, { props: { data: { id: 7, moiId: 1, infos, mode: null, fiche: null, ...data }, form } }).body;
}
const texte = (page: string) =>
	page
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

describe('infos d’un groupe', () => {
	it('l’en-tête : retour à la conversation, nom, résumé, Renommer, et la confidentialité', () => {
		const page = html();
		expect(page).toMatch(/<a[^>]*href="\/echanges\/messages\/7"[^>]*aria-label="Retour à la conversation"/);
		expect(page).toMatch(/<h1[^>]*>Départ de Thomas<\/h1>/);
		const t = texte(page);
		expect(t).toContain('Groupe · 4 membres · créé par Romain');
		expect(t).toContain('Seuls les membres lisent ce groupe.');
		expect(page).toMatch(/<a[^>]*href="\?renommer"[^>]*>Renommer<\/a>/);
	});

	it('les membres : « Vous », « Animateur » en texte, un menu par membre sauf soi (masqué sans JavaScript)', () => {
		const page = html();
		const t = texte(page);
		expect(t).toContain('4 membres');
		expect(t).toMatch(/Romain Rapporteur Équipe 2 Animateur/);
		expect(t).toMatch(/Vous Équipe 1 Animateur/);
		expect(t).toMatch(/Claire Chef Chef de centre/);
		const menus = [...page.matchAll(/<button[^>]*aria-haspopup="menu"[^>]*>/g)].map((b) => b[0]);
		expect(menus).toHaveLength(3);
		for (const b of menus) expect(b).toContain('hidden');
		expect(menus.join()).toContain('aria-label="Actions pour Manon Membre"');
		expect(menus.join()).not.toContain('Thomas');
	});

	it('animateur : « Ajouter des membres » vers la sélection ; pas pour un simple membre', () => {
		expect(html()).toMatch(/<a[^>]*href="\/echanges\/messages\/nouveau\/groupe\?ajouter=7"[^>]*>[\s\S]*Ajouter des membres/);
		expect(texte(html({ infos: { ...infos, moiAnimateur: false } }))).not.toContain('Ajouter des membres');
	});

	it('quitter : un lien qui marche sans JavaScript ; sa confirmation ; renommer dans la page', () => {
		expect(html()).toMatch(/<a[^>]*href="\?quitter"[^>]*>[\s\S]*Quitter le groupe/);
		const quitter = html({ mode: 'quitter' });
		expect(quitter).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/quitter"/);
		expect(texte(quitter)).toContain('Quitter « Départ de Thomas » ?');
		const renommer = html({ mode: 'renommer' });
		expect(renommer).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/renommer"/);
		expect(renommer).toMatch(/<input[^>]*name="nom"[^>]*value="Départ de Thomas"/);
		expect(renommer).toMatch(/<a[^>]*href="\/echanges\/messages\/7\/infos"[^>]*>Annuler/);
	});

	it('une erreur s’affiche dans une alerte', () => {
		const page = html({}, { cible: 'membre', message: 'Seuls les animateurs du groupe peuvent faire cela.' });
		expect(page).toMatch(/role="alert"[^>]*>[^<]*Seuls les animateurs du groupe peuvent faire cela\./);
		const nom = html({ mode: 'renommer' }, { cible: 'renommer', message: 'Donnez un nom au groupe.', valeurs: { nom: '' } });
		expect(nom).toMatch(/aria-invalid="true"/);
		expect(texte(nom)).toContain('Donnez un nom au groupe.');
	});
});

describe('infos d’une conversation à deux', () => {
	const aDeux: InfosConversation = { type: 'deux', nom: 'Élodie Martin', icone: null, creePar: 1, creeParPrenom: 'Thomas', membres: [membre(1, 'Thomas', 'Agent'), membre(5, 'Élodie', 'Martin', { role: 'Chef de garde', equipe: { numero: 2, couleur: '#c2185b' }, telephone: '06 11 22 33 44' })], moiAnimateur: false };

	it('la fiche courte : équipe, rôle, téléphone ; ni membres, ni quitter', () => {
		const page = html({ infos: aDeux });
		expect(page).toMatch(/<h1[^>]*>Élodie Martin<\/h1>/);
		const t = texte(page);
		expect(t).toContain('Équipe 2');
		expect(t).toContain('Chef de garde');
		expect(page).toMatch(/<a[^>]*href="tel:0611223344"[^>]*>[\s\S]*06 11 22 33 44/);
		expect(t).toContain('Seuls vous deux lisez cette conversation.');
		expect(t).not.toContain('Quitter');
		expect(t).not.toContain('Voir la fiche');
		expect(page).not.toContain('aria-haspopup');
	});

	it('« Voir la fiche » quand elle est ouverte à la personne', () => {
		expect(html({ infos: aDeux, fiche: '/agents/5' })).toMatch(/<a[^>]*href="\/agents\/5"[^>]*>Voir la fiche/);
	});
});
