import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({ invalidate: () => {} }));
const { default: Page } = await import('./+page.svelte');

const visage = (prenom: string, nom: string, couleur: string | null = '#d4a017') => ({ id: 9, prenom, nom, couleur });
const conversations = [
	{
		id: 3,
		type: 'groupe',
		nom: 'Départ de Thomas',
		icone: 'coeur',
		personne: null,
		apercu: 'Manon : J’ai trouvé le cadeau !',
		dernier_le: '2026-10-29T10:12',
		nonLus: 2
	},
	{
		id: 5,
		type: 'deux',
		nom: 'Élodie Chef-Équipe',
		icone: null,
		personne: visage('Élodie', 'Chef-Équipe'),
		apercu: 'Élodie : Tu peux prendre ma place ?',
		dernier_le: '2026-10-29T09:40',
		nonLus: 1
	},
	{
		id: 8,
		type: 'deux',
		nom: 'Romain Rapporteur',
		icone: null,
		personne: visage('Romain', 'Rapporteur', null),
		apercu: 'Vous : Merci pour les tickets !',
		dernier_le: '2026-10-20T18:00',
		nonLus: 0
	}
];

function html(data: object = {}, niveau = 'vivant') {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return render(Page as any, {
		props: { data: { conversations, q: '', ...data } },
		context: new Map([['affichage', { niveau, theme: 'auto' }]])
	}).body;
}
const texte = (page: string) => page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const liens = (page: string) => [...page.matchAll(/<a\b[^>]*href="(\/echanges\/messages\/\d+)"/g)].map((m) => m[1]);

describe('liste des messages', () => {
	it('le titre et les filtres « Murs » | « Messages », Messages courant avec ses non-lus', () => {
		const page = html();
		expect(page).toMatch(/<h1[^>]*>Échanges<\/h1>/);
		const filtres = page.match(/<nav[^>]*aria-label="Filtrer les échanges"[\s\S]*?<\/nav>/)![0];
		expect(filtres).toMatch(/<a[^>]*href="\/echanges"[^>]*>\s*Murs/);
		expect(filtres).toMatch(/<a[^>]*href="\/echanges\/messages"[^>]*aria-current="page"/);
		expect(texte(filtres)).toContain('Messages 3 , 3 messages non lus');
		expect(filtres).not.toContain('Tout');
	});

	it('les conversations dans l’ordre reçu, avec leur visage, leur aperçu et leur heure', () => {
		const page = html();
		expect(liens(page)).toEqual(['/echanges/messages/3', '/echanges/messages/5', '/echanges/messages/8']);
		const t = texte(page);
		expect(t).toContain('Départ de Thomas 10 h 12');
		expect(t).toContain('Vous : Merci pour les tickets !');
		// À deux, l'autre n'est pas nommé une seconde fois devant son message.
		expect(t).toContain('Élodie Chef-Équipe 9 h 40 Tu peux prendre ma place ?');
		// Le groupe a son icône sur sa teinte ; la personne, ses initiales.
		expect(page).toContain('var(--icone-coeur-fond)');
		expect(t).toContain('ÉC');
	});

	it('non-lus : la ligne en gras, l’heure en couleur, la pastille avec son texte', () => {
		const page = html();
		const lignes = page.split('<li').slice(1);
		expect(lignes[0]).toMatch(/class="conversation[^"]*non-lue/);
		expect(texte(lignes[0]!)).toContain('2 messages non lus');
		expect(texte(lignes[1]!)).toContain('1 message non lu');
		expect(lignes[2]).not.toContain('non-lue');
		expect(texte(lignes[2]!)).not.toContain('non lu');
	});

	it('la recherche filtre par nom, sans accent ni casse ; sans JavaScript elle passe par q', () => {
		const page = html({ q: 'elodie' });
		expect(page).toMatch(/<form[^>]*method="get"[^>]*role="search"|<form[^>]*role="search"[^>]*method="get"/);
		expect(page).toMatch(/<input[^>]*name="q"[^>]*value="elodie"|<input[^>]*value="elodie"[^>]*name="q"/);
		expect(page).toMatch(/<label[^>]*for="recherche"[^>]*>Rechercher une conversation/);
		expect(page).toMatch(/<input[^>]*placeholder="Rechercher une conversation"/);
		expect(liens(page)).toEqual(['/echanges/messages/5']);
		expect(html({ q: 'zzz' })).toMatch(/<p[^>]*role="status"[^>]*>Aucune conversation à ce nom\.<\/p>/);
		// La zone d'annonce reste présente, masquée, quand la recherche trouve.
		expect(page).toMatch(/<p class="aucune[^"]*\bmasque\b[^"]*" role="status"><\/p>/);
	});

	it('le bouton crayon « Nouveau message » et la phrase de confidentialité', () => {
		const page = html();
		expect(page).toMatch(/<a[^>]*href="\/echanges\/messages\/nouveau"[^>]*aria-label="Nouveau message"|<a[^>]*aria-label="Nouveau message"[^>]*href="\/echanges\/messages\/nouveau"/);
		expect(texte(page)).toContain('Seuls les membres d’une conversation la lisent.');
	});

	it('vide : Gyro et la phrase ; au niveau Sobre, sans Gyro', () => {
		const vide = html({ conversations: [] });
		expect(texte(vide)).toContain('Aucune conversation. Écrivez à un collègue avec le crayon.');
		expect(vide).toContain('class="gyro');
		expect(vide).not.toContain('role="search"');
		expect(vide).toContain('aria-label="Nouveau message"');
		const sobre = html({ conversations: [] }, 'sobre');
		expect(texte(sobre)).toContain('Aucune conversation.');
		expect(sobre).not.toContain('class="gyro');
	});
});
