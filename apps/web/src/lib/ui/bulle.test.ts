import type { VueMessage } from '@gyro-caserne/socle';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Bulle, { contraste, teinteNom } from './Bulle.svelte';

const romain = { id: 2, prenom: 'Romain', nom: 'Test', couleur: '#d4a017' };
const moi = { id: 1, prenom: 'Thomas', nom: 'Test', couleur: null };

function message(autres: Partial<VueMessage> = {}): VueMessage {
	return {
		id: 40,
		auteur: romain,
		texte: 'Thomas part fin novembre. On lui fait une surprise ?',
		cree_le: '2026-10-28T18:01:12',
		modifie: false,
		supprime: null,
		systeme: null,
		reponse: null,
		photos: [],
		reactions: [],
		moi: false,
		coche: null,
		...autres
	};
}

function html(m: VueMessage, props: Record<string, unknown> = {}) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return render(Bulle as any, { props: { message: m, conversation: 7, moiId: 1, groupe: true, premiere: true, actif: true, ...props } }).body;
}
const texte = (page: string) =>
	page
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

describe('Bulle', () => {
	it('dans un groupe, la première bulle d’un autre porte son nom en couleur, le texte et l’heure', () => {
		const page = html(message());
		expect(page).toContain('id="message-40"');
		expect(page).toMatch(/<strong class="auteur[^"]*"[^>]*style="[^"]*--clair: #[0-9a-f]{6};[^"]*--sombre: #[0-9a-f]{6}/);
		expect(page).toMatch(/<time datetime="2026-10-28T18:01:12"[^>]*>18 h 01<\/time>/);
		expect(texte(page)).toBe('Romain Thomas part fin novembre. On lui fait une surprise ? 18 h 01');
		expect(page).not.toContain('class="moi');
	});

	it('les bulles suivantes, et toute bulle à deux, gardent le nom pour les lecteurs d’écran seulement', () => {
		for (const props of [{ premiere: false }, { groupe: false }]) {
			const page = html(message(), props);
			expect(page).not.toMatch(/<strong class="auteur/);
			expect(page).toMatch(/<span class="masque[^"]*">Romain :<\/span>/);
		}
	});

	it('mes messages : à droite, « Vous », la coche et son texte', () => {
		const lu = html(message({ auteur: moi, moi: true, coche: 'lu' }));
		expect(lu).toMatch(/class="bulle[^"]* moi/);
		expect(lu).toMatch(/<span class="masque[^"]*">Vous :<\/span>/);
		expect(lu).not.toMatch(/<strong class="auteur/);
		expect(lu).toMatch(/<span class="coche[^"]* lu" aria-hidden="true">✓✓<\/span><span class="masque[^"]*">, lu<\/span>/);
		const envoye = html(message({ auteur: moi, moi: true, coche: 'envoye' }));
		expect(envoye).toMatch(/<span class="coche[^"]*" aria-hidden="true">✓<\/span><span class="masque[^"]*">, envoyé<\/span>/);
		expect(html(message({ auteur: moi, moi: true, coche: null }))).not.toContain('coche');
	});

	it('la citation : un lien vers le message cité, « Vous » quand c’est le mien', () => {
		const page = html(message({ reponse: { id: 12, auteur: moi, extrait: 'Carrément, je m’occupe de la carte.' } }));
		const citation = page.match(/<a class="citation[^"]*"[^>]*href="#message-12"[^>]*>[\s\S]*?<\/a>/)![0];
		expect(texte(citation)).toBe('En réponse à Vous Carrément, je m’occupe de la carte.');
		const autre = html(message({ reponse: { id: 12, auteur: romain, extrait: '' } }));
		expect(texte(autre.match(/<a class="citation[^"]*"[\s\S]*?<\/a>/)![0])).toBe('En réponse à Romain Message supprimé');
	});

	it('les photos, servies par la conversation, avec un texte', () => {
		const page = html(message({ photos: [12, 13], texte: '' }));
		expect(page).toMatch(/<img[^>]*src="\/echanges\/messages\/7\/photo\/12"[^>]*alt="Photo 1 sur 2"/);
		expect(page).toMatch(/<img[^>]*src="\/echanges\/messages\/7\/photo\/13"[^>]*alt="Photo 2 sur 2"/);
		expect(page).toMatch(/class="bulle[^"]* photo-seule/);
		expect(html(message({ photos: [12] }))).toMatch(/alt="Photo"/);
	});

	it('les réactions, en texte : des boutons qui ajoutent ou retirent la mienne', () => {
		const m = message({
			reactions: [
				{ emoji: '👏', nombre: 2, deMoi: true },
				{ emoji: '❤️', nombre: 1, deMoi: false },
				{ emoji: '👍', nombre: 1, deMoi: true }
			]
		});
		const page = html(m);
		const form = page.match(/<form[^>]*action="\?\/reagir"[\s\S]*?<\/form>/)![0];
		expect(form).toMatch(/<input type="hidden" name="id" value="40"/);
		expect(form).toMatch(/<button[^>]*name="emoji" value="👏"[^>]*aria-pressed="true"[^>]*aria-label="👏 2, dont vous"/);
		expect(form).toMatch(/<button[^>]*name="emoji" value="❤️"[^>]*aria-pressed="false"[^>]*aria-label="❤️ 1"/);
		expect(form).toMatch(/aria-label="👍 1, vous"/);
		// Lecture seule : le texte reste, sans bouton.
		const fige = html(m, { actif: false });
		expect(fige).not.toContain('<form');
		expect(fige).toContain('👏 2, dont vous');
	});

	it('« modifié », « Message supprimé » et « Message retiré par la modération »', () => {
		expect(texte(html(message({ modifie: true })))).toContain('modifié · 18 h 01');
		const supprime = html(message({ supprime: 'auteur', texte: '' }));
		expect(texte(supprime)).toContain('Message supprimé');
		expect(supprime).toMatch(/class="bulle[^"]* supprime/);
		expect(texte(html(message({ supprime: 'moderation', texte: '' })))).toContain('Message retiré par la modération');
	});

	it('un message système : la phrase seule, centrée', () => {
		const page = html(message({ auteur: null, systeme: 'Romain a créé le groupe', texte: '' }));
		expect(page).toMatch(/<p class="systeme[^"]*"[^>]*id="message-40"[^>]*>Romain a créé le groupe<\/p>/);
		expect(page).not.toContain('<time');
	});
});

describe('teinteNom', () => {
	it('la couleur de l’équipe, assombrie en clair et éclaircie en sombre jusqu’au contraste AA', () => {
		for (const couleur of ['#d4a017', '#ffeb3b', '#0f1a40', '#a3195b']) {
			const t = teinteNom(couleur)!;
			expect(contraste(t.clair, '#ffffff'), couleur).toBeGreaterThanOrEqual(4.5);
			expect(contraste(t.sombre, '#1a222c'), couleur).toBeGreaterThanOrEqual(4.5);
		}
		// Déjà lisible : inchangée.
		expect(teinteNom('#a3195b')!.clair).toBe('#a3195b');
		expect(teinteNom(null)).toBeNull();
		expect(teinteNom('rouge')).toBeNull();
	});
});
