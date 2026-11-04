import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { VueDemande } from '@gyro-caserne/socle';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
const { default: Page } = await import('./+page.svelte');

const gestes = { accepter: false, refuser: false, ouvrir: false, annuler: false, desister: false, valider: false };
const demande = (v: Partial<VueDemande> = {}): VueDemande => ({
	id: 7,
	genre: 'remplacement',
	etat: 'attente',
	demandeur: { id: 1, prenom: 'Alice', nom: 'Test' },
	cible: null,
	remplacant: null,
	periodes: [{ debut: '2026-11-09T18:00', fin: '2026-11-10T06:00' }],
	periodesCible: [],
	manoeuvre: null,
	manoeuvreCible: null,
	texte: 'nuit du lundi 9 novembre',
	mot: null,
	motif: null,
	manque: [],
	creeLe: '2026-11-01T10:00',
	debut: '2026-11-09T18:00',
	fin: '2026-11-10T06:00',
	ouverte: true,
	moi: 'destinataire',
	manquePourMoi: [],
	gestes,
	...v
});
const page = (data: Record<string, unknown>, form: unknown = null) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { personne: true, pourMoi: [], miennes: [], aValider: [], historique: [], avecValider: false, onglet: 'pour-moi', ...data }, form } }).body;

describe('page Remplacements', () => {
	it('après un geste fait sur la page d’une demande : le résultat est dit', () => {
		expect(page({ fait: 'Demande refusée.' })).toMatch(/role="status"[^>]*>Demande refusée\.</);
	});

	it('onglets en liens, l’actif marqué ; vide soigné', () => {
		const html = page({});
		expect(html).toMatch(/<a[^>]*href="\?onglet=pour-moi"[^>]*aria-current="page"/);
		expect(html).not.toContain('À valider');
		expect(html).toContain('Aucune demande pour vous.');
	});

	it('une demande reçue : qui, quand, état écrit, Accepter et Refuser ; l’aptitude manquante prévenue avant d’accepter', () => {
		const html = page({ pourMoi: [demande({ manquePourMoi: ['CA1'], gestes: { ...gestes, accepter: true, refuser: true } })] });
		expect(html).toContain('Alice Test cherche un remplaçant');
		expect(html).toContain('Nuit du lundi 9 novembre');
		expect(html).toContain('En attente');
		expect(html).toContain('il vous manque CA1');
		expect(html).toMatch(/<form[^>]*action="\?\/accepter"[\s\S]*?Accepter/);
		expect(html).toMatch(/<form[^>]*action="\?\/refuser"[\s\S]*?Refuser/);
	});

	it('à valider : le manque dit en texte, Valider et Refuser avec un motif', () => {
		const v = demande({ etat: 'a_valider', moi: 'valideur', remplacant: { id: 2, prenom: 'Bruno', nom: 'Test' }, manque: ['CA1'], gestes: { ...gestes, valider: true, annuler: true } });
		const html = page({ aValider: [v], avecValider: true, onglet: 'a-valider' });
		expect(html).toContain('Bruno Test remplace Alice Test');
		expect(html).toContain('il manque CA1 au remplaçant');
		expect(html).toMatch(/action="\?\/valider"/);
		expect(html).toMatch(/action="\?\/refuserValidation"[\s\S]*?Motif \(facultatif\)/);
	});

	it('« Me faire remplacer » est un vrai bouton écrit ; les deux échanges à côté ; Mes demandes vides : le déroulé en 3 lignes', () => {
		const html = page({ onglet: 'miennes' });
		expect(html).toMatch(/<a class="principal[^"]*" href="\/remplacements\/demander">[\s\S]*?Me faire remplacer<\/a>/);
		expect(html).toContain('href="/remplacements/demander?mode=echange"');
		expect(html).toContain('Échanger ma place à une manœuvre');
		expect(html).toContain('Comment ça marche ?');
		expect(html.match(/<ol[^>]*>[\s\S]*?<\/ol>/)![0].match(/<li>/g)).toHaveLength(3);
	});
});
