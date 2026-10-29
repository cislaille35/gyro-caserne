import type { VueConversation, VueMessage } from '@gyro-caserne/socle';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({ invalidate: () => {}, goto: () => {}, afterNavigate: () => {} }));
vi.mock('$app/forms', () => ({ enhance: () => ({}), applyAction: () => {}, deserialize: () => ({}) }));
const { default: Page } = await import('./+page.svelte');

const aujourdhui = new Date().toISOString().slice(0, 10);
const romain = { id: 2, prenom: 'Romain', nom: 'Test', couleur: '#a3195b' };
const manon = { id: 3, prenom: 'Manon', nom: 'Test', couleur: null };
const moi = { id: 1, prenom: 'Thomas', nom: 'Test', couleur: null };

function m(id: number, auteur: VueMessage['auteur'], heure: string, autres: Partial<VueMessage> = {}): VueMessage {
	return { id, auteur, texte: `Message ${id}`, cree_le: `${aujourdhui}T${heure}`, modifie: false, supprime: null, systeme: null, reponse: null, photos: [], reactions: [], moi: auteur?.id === 1, coche: auteur?.id === 1 ? 'lu' : null, ...autres };
}

const vue: VueConversation = {
	id: 7,
	type: 'groupe',
	nom: 'Départ de Thomas',
	icone: 'coeur',
	membres: [moi, romain, manon],
	messages: [m(1, null, '09:00', { systeme: 'Romain a créé le groupe', texte: '' }), m(2, romain, '09:01'), m(3, moi, '09:03'), m(4, manon, '10:11'), m(5, manon, '10:12')],
	premierNonLu: 4,
	lectureSeule: false,
	plusAnciens: false,
	majLe: `${aujourdhui}T10:20:00`
};

function html(data: Partial<{ vue: VueConversation; sousTitre: string; avant: number | null; autrePrenom: string | null }> = {}, form: unknown = null) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return render(Page as any, {
		props: { data: { vue, moiId: 1, sousTitre: 'Manon, Romain, vous', avant: null, autrePrenom: null, ...data }, form },
		context: new Map([['affichage', { niveau: 'vivant', theme: 'auto' }]])
	}).body;
}
const texte = (page: string) =>
	page
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

describe('une conversation', () => {
	it('l’en-tête : retour, nom, membres, et le lien vers les infos', () => {
		const page = html();
		expect(page).toMatch(/<a[^>]*href="\/echanges\/messages"[^>]*aria-label="Retour aux messages"/);
		const infos = page.match(/<a[^>]*href="\/echanges\/messages\/7\/infos"[^>]*>[\s\S]*?<\/a>/)![0];
		expect(infos).toMatch(/<h1[^>]*>Départ de Thomas<\/h1>/);
		expect(texte(infos)).toContain('Manon, Romain, vous');
	});

	it('le fil : role="log", nommé, avec ses jours, son message système et le bandeau des non-lus', () => {
		const page = html();
		expect(page).toMatch(/<div[^>]*role="log"[^>]*aria-label="Messages de Départ de Thomas"/);
		expect(page).not.toContain('assertive');
		const t = texte(page);
		expect(t).toContain('Aujourd’hui');
		expect(t).toContain('Romain a créé le groupe');
		expect(t).toMatch(/2 messages non lus.*Manon Message 4/);
		// Le bloc de Manon : son nom une fois, en tête.
		expect(page.match(/<strong class="auteur/g)).toHaveLength(2);
	});

	it('la saisie : photos, champ nommé, bouton « Envoyer », qui marche sans JavaScript', () => {
		const page = html();
		const form = page.match(/<form[^>]*action="\?\/envoyer"[\s\S]*?<\/form>/)![0];
		expect(form).toMatch(/method="POST"/);
		expect(form).toMatch(/enctype="multipart\/form-data"/);
		expect(form).toMatch(/<textarea[^>]*name="texte"[^>]*maxlength="4000"/);
		expect(form).toMatch(/<label[^>]*for="saisie-texte"[^>]*>[\s\S]*Votre message/);
		expect(form).toMatch(/<input[^>]*type="file"[^>]*name="photos"[^>]*accept="image\/jpeg,image\/webp"[^>]*multiple/);
		expect(form).toMatch(/<label[^>]*for="saisie-photos"[^>]*>[\s\S]*Ajouter des photos/);
		expect(form).toMatch(/<button[^>]*type="submit"[^>]*aria-label="Envoyer"/);
	});

	it('sans JavaScript, les boutons « ⋯ » sont masqués : ils ne servent qu’avec lui', () => {
		const page = html();
		const boutons = [...page.matchAll(/<button[^>]*class="gestes[^"]*"[^>]*>/g)].map((b) => b[0]);
		expect(boutons).toHaveLength(4);
		for (const b of boutons) {
			expect(b).toMatch(/hidden/);
			expect(b).toMatch(/aria-haspopup="menu"/);
		}
		expect(boutons[0]).toMatch(/aria-label="Gestes sur le message de Romain, \d+ h \d+"/);
	});

	it('un refus d’envoi : la phrase annoncée et la saisie gardée', () => {
		const page = html({}, { cible: 'envoyer', message: 'Écrivez votre message.', valeurs: { texte: 'Brouillon gardé', reponseA: '' } });
		expect(page).toMatch(/role="alert"[^>]*>[\s\S]*Écrivez votre message\./);
		expect(page).toMatch(/<textarea[^>]*>Brouillon gardé<\/textarea>/);
	});

	it('une conversation à deux dont l’autre a quitté l’annuaire : la phrase à la place de la saisie', () => {
		const page = html({ vue: { ...vue, type: 'deux', nom: 'Manon Test', lectureSeule: true }, autrePrenom: 'Manon' });
		expect(page).not.toContain('action="?/envoyer"');
		expect(texte(page)).toContain('Manon n’est plus dans l’annuaire.');
		// Les réactions ne se touchent plus.
		expect(page).not.toContain('action="?/reagir"');
	});

	it('des messages plus anciens : un lien qui marche sans JavaScript ; sur une page ancienne, le retour aux récents', () => {
		expect(html({ vue: { ...vue, plusAnciens: true } })).toMatch(/<a[^>]*href="\?avant=1"[^>]*>Messages plus anciens<\/a>/);
		const ancienne = html({ avant: 20 });
		expect(ancienne).toMatch(/<a[^>]*href="\/echanges\/messages\/7"[^>]*>Messages plus récents<\/a>/);
		// Sur une page ancienne, pas de bandeau.
		expect(texte(ancienne)).not.toContain('non lus');
	});
});
