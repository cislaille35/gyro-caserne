import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import centre from '$centre';
import { calculerAnnee, feries } from '@gyro-caserne/socle';
import Page from './+page.svelte';

const equipes = [
	{ id: 1, nom: 'Équipe 1', couleur: '#d4a017' },
	{ id: 2, nom: 'Équipe 2', couleur: '#c2185b' },
	{ id: 3, nom: 'Équipe 3', couleur: '#1565c0' },
	{ id: 4, nom: 'Équipe 4', couleur: '#2e7d32' }
];
const semaines = calculerAnnee(2026, centre.astreinte, [1, 2, 3, 4], new Map()).map((s) => ({ ...s, mienne: s.equipeId === 1 }));
const publiee = {
	publiee: true,
	annee: 2026,
	peutPreparer: false,
	equipes,
	semaines,
	manoeuvres: [{ id: 1, debut: '2026-11-15T08:30', theme: 'Sport + SAP', lieu: 'Caserne', convoques: [1], petitDejeuner: true, annulee: false, publiee: false, convoque: true }],
	vacances: [{ id: 1, nom: 'Vacances de Noël', debut: '2026-12-19', fin: '2027-01-04' }],
	feries: feries(2026),
	fetes: { noel: 3, nouvelAn: 4 },
	monEquipe: 1,
	prochaine: {
		astreinte: { debut: '2026-11-06T18:00', fin: '2026-11-13T06:00', equipeId: 1, enCours: false },
		manoeuvre: { id: 1, debut: '2026-11-15T08:30', theme: 'Sport + SAP', lieu: 'Caserne', convoques: [1], petitDejeuner: true, annulee: false, publiee: false },
		fete: null
	}
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (data: Record<string, unknown>) => render(Page as any, { props: { data: { maintenant: '2026-11-01T10:00', vue: 'moi', ...data } } }).body;

describe('onglet Planning', () => {
	it('non publié : un vide soigné ; « Préparer l’année » pour le chef seulement', () => {
		const html = page({ planning: { publiee: false, annee: 2026, peutPreparer: false } });
		expect(html).toContain('Le planning de l’année n’est pas encore publié.');
		expect(html).not.toContain('Préparer l’année');
		expect(page({ planning: { publiee: false, annee: 2026, peutPreparer: true } })).toContain('href="/planning/preparer?annee=2026"');
	});

	it('en haut, la prochaine astreinte et la prochaine manœuvre, en toutes lettres', () => {
		const html = page({ planning: publiee });
		expect(html).toContain('Ma prochaine astreinte');
		expect(html).toContain('Du vendredi 6 novembre, 18 h au vendredi 13 novembre, 6 h');
		expect(html).toContain('Ma prochaine manœuvre');
		expect(html).toContain('Sport + SAP');
		expect(html).toContain('dimanche 15 novembre, 8 h 30');
	});

	it('mon année : douze mois titrés, mes semaines dites « Mon astreinte » (jamais la couleur seule)', () => {
		const html = page({ planning: publiee });
		expect(html.match(/<h2[^>]*>Janvier<\/h2>/)).not.toBeNull();
		expect(html.match(/<h2[^>]*>Décembre<\/h2>/)).not.toBeNull();
		expect((html.match(/Mon astreinte/g) ?? []).length).toBe(semaines.filter((s) => s.mienne).length);
		expect(html).toContain('Lundi de Pâques');
		expect(html).toContain('Vacances de Noël');
		expect(html).toContain('Garde de Noël');
		expect(html).toMatch(/<a[^>]*href="\?annee=2026&amp;vue=moi"[^>]*aria-current="page"/);
	});

	it('toutes les équipes : chaque semaine nomme son équipe', () => {
		const html = page({ planning: publiee, vue: 'equipes' });
		expect(html).not.toContain('Mon astreinte');
		expect((html.match(/Équipe 4/g) ?? []).length).toBeGreaterThanOrEqual(13);
	});
});
