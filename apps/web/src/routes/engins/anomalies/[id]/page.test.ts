import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

// La page lit son adresse : `?panneau=` ouvre un panneau.
const adresse = vi.hoisted(() => ({ url: new URL('http://x/engins/anomalies/3') }));
vi.mock('$app/state', () => ({ page: adresse }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
const { default: Page } = await import('./+page.svelte');

const anomalie = (autres: Record<string, unknown> = {}) => ({
	id: 3,
	engin: { id: 1, nom: 'FPT', type: 'FPT', etat: 'disponible', situation: 'centre' },
	zone: 'Cabine',
	libelle: 'Radio',
	genre: 'defectueux',
	manque: null,
	note: null,
	photo: null,
	etape: 'prise_en_charge',
	motif: null,
	close: null,
	bloquante: false,
	priseId: null,
	signaleeLe: '2026-11-02T09:00',
	signaleePar: 'Alice Martin',
	prisePar: 'Bruno Petit',
	historique: [{ quoi: 'prise_en_charge', le: '2026-11-02T10:00', par: 'Bruno Petit', texte: null }],
	gestes: ['attente', 'reparee', 'clore'],
	autresBloquantes: 0,
	...autres
});
const page = (url: string, form: unknown = null, a = anomalie()) => {
	adresse.url = new URL(`http://x/engins/anomalies/3${url}`);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return render(Page as any, { props: { data: { anomalie: a }, form } }).body.replace(/<!--[^>]*-->/g, '').replace(/ ?svelte-[a-z0-9]+/g, '').replace(/ class=""/g, '');
};
const panneau = (html: string) => html.match(/<dialog[\s\S]*?<\/dialog>/)?.[0] ?? '';

describe('/engins/anomalies/[id] : les gestes en panneaux', () => {
	it('fermés : un lien par geste, aucun formulaire posé dans la page', () => {
		const html = page('');
		expect(html).not.toContain('<dialog');
		expect(html).not.toContain('<details');
		expect(html).not.toContain('name="texte"');
		expect(html).toMatch(/<a [^>]*href="\?panneau=attente"[^>]*>Mettre en attente…<\/a>/);
		expect(html).toMatch(/<a [^>]*href="\?panneau=reparee"[^>]*>Réparée…<\/a>/);
		expect(html).toMatch(/<a [^>]*href="\?panneau=clore"[^>]*>Clore sans réparation…<\/a>/);
	});

	it.each([
		['reparee', 'Réparée', 'Enregistrer la réparation'],
		['clore', 'Clore sans réparation', 'Clore'],
		['attente', 'Mettre en attente', 'Mettre en attente']
	])('?panneau=%s : le panneau « %s » ouvert, son formulaire dedans', (cle, titre, bouton) => {
		const ouvert = panneau(page(`?panneau=${cle}`));
		expect(ouvert).toMatch(new RegExp(`<h2[^>]*tabindex="-1"[^>]*>${titre}</h2>`));
		expect(ouvert).toContain(`name="quoi" value="${cle}"`);
		expect(ouvert).toContain(`>${bouton}</button>`);
		// Sans JavaScript, l'envoi revient à la page sans le panneau : une réussite le ferme.
		expect(ouvert).toMatch(/<form method="POST" action="\?"/);
		expect(ouvert).toMatch(/<a class="fermer" href="\?"/);
	});

	it('les autres paramètres de l’adresse sont gardés', () => {
		expect(page('?signalee')).toMatch(/href="\?signalee=&amp;panneau=clore"/);
		expect(panneau(page('?signalee=&panneau=clore'))).toMatch(/<form method="POST" action="\?signalee="/);
	});

	it('un refus rouvre son panneau avec le message, même sans le paramètre', () => {
		const ouvert = panneau(page('', { quoi: 'clore', message: 'Seuls le référent engins… clôturent sans réparation.' }));
		expect(ouvert).toContain('Clore sans réparation');
		expect(ouvert).toContain('role="alert"');
		expect(ouvert).toContain('clôturent sans réparation');
	});

	it('un geste interdit ne s’ouvre pas par l’adresse', () => {
		expect(page('?panneau=clore', null, anomalie({ gestes: ['reparee'] }))).not.toContain('<dialog');
		expect(page('?panneau=inconnu')).not.toContain('<dialog');
	});

	it('« Je la prends en charge » reste un bouton dans la page', () => {
		const html = page('', null, anomalie({ etape: 'signalee', prisePar: null, historique: [], gestes: ['prendre', 'clore'] }));
		expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Je la prends en charge<\/button>/);
		expect(html).not.toContain('<dialog');
	});
});
