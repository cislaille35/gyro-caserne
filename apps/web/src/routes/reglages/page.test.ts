import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import Layout from './+layout.svelte';
import Page from './+page.svelte';

const etat = vi.hoisted(() => ({ page: { url: new URL('http://x/reglages') } }));
vi.mock('$app/state', () => etat);

const role = (id: number, nom: string, champs: Record<string, unknown> = {}) => ({
	id,
	nom,
	nature: 'mission',
	portee: 'centre',
	attributeur: { type: 'chef_centre' },
	droits: [],
	systeme: null,
	archiveeLe: null,
	modele: null,
	icone: null,
	titulaires: 1,
	protegee: false,
	...champs
});
const responsabilites = [
	role(1, 'Chef de centre', { systeme: 'chef_centre', nature: 'fonction' }),
	role(2, 'Chef d’équipe', { systeme: 'chef_equipe', portee: 'equipe', titulaires: 3 }),
	role(7, 'Référent engins 2', { titulaires: 1 }),
	role(3, 'Référent engins', { droits: [{ droit: 'TRAITER_ANOMALIE', verrouille: false }, { droit: 'GERER_FICHES', verrouille: false }, { droit: 'GERER_STOCK', verrouille: false }], modele: 'referent_materiel', titulaires: 2 }),
	role(4, 'Référent pharmacie', { modele: 'referent_pharmacie', droits: [{ droit: 'GERER_STOCK', verrouille: false }], titulaires: 0 }),
	role(5, 'Rapporteur de comité', { portee: 'comite', attributeur: { type: 'comite_vise' } }),
	role(6, 'Ancien rôle', { archiveeLe: '2026-04-02' })
];
const comites = [
	{ id: 1, nom: 'Comité du centre', theme: 'centre', dissousLe: null, estCentre: true, membresEnCours: 4, rapporteurs: ['Alice Martin'] },
	{ id: 2, nom: 'Amicale', theme: 'amicale', dissousLe: null, estCentre: false, membresEnCours: 0, rapporteurs: [] },
	{ id: 3, nom: 'Sport', theme: 'sport', dissousLe: '2026-05-01', estCentre: false, membresEnCours: 0, rapporteurs: [] }
];
const profils = [{ id: 1, nom: 'Agent', typePersonne: 'agent', droits: ['VOIR_PLANNING', 'VOIR_MOTIFS_ABSENCE'] }];
const data = { peutPouvoir: true, responsabilites, comites, profils, comitesChoix: [] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: any, props: Record<string, unknown>) => render(composant, { props }).body;
const ligne = (page: string, id: number) => page.slice(page.indexOf(`href="/reglages/roles/${id}"`), page.indexOf('</a>', page.indexOf(`href="/reglages/roles/${id}"`)));
const groupe = (page: string, titre: string) => page.slice(page.indexOf(`>${titre}<`), page.indexOf('</section>', page.indexOf(`>${titre}<`)));

describe('page Réglages', () => {
	it('range les rôles par thème dans des groupes repliés, avec un résumé', () => {
		const page = html(Page, { data });
		for (const titre of ['Chef de centre et adjoint', 'Chefs d’équipe', 'Référents', 'Comités', 'Profils', 'Archivés']) expect(page).toContain(`>${titre}<`);
		expect(page).toMatch(/aria-expanded="false"/);
		expect(groupe(page, 'Référents')).toContain('3 rôles · 1 sans titulaire');
		expect(ligne(page, 7)).toContain('--icone-camion-fond');
		expect(groupe(page, 'Chef de centre et adjoint')).toContain('Chef de centre');
		expect(groupe(page, 'Chefs d’équipe')).toContain('Chef d’équipe');
	});

	it('une ligne par rôle, qui ouvre sa page : « Aucun titulaire » en alerte, « Personnalisé » en pastille', () => {
		const page = html(Page, { data });
		expect(page).toMatch(/<a href="\/reglages\/roles\/4"[\s\S]*?Référent pharmacie[\s\S]*?var\(--statut-alerte-fond\)[^>]*>(<!---->)?Aucun titulaire/);
		const engins = page.slice(page.indexOf('href="/reglages/roles/3"'), page.indexOf('</a>', page.indexOf('href="/reglages/roles/3"')));
		expect(engins).toContain('2 titulaires');
		expect(engins).toMatch(/var\(--statut-alerte-fond\)[^>]*>(<!---->)?Personnalisé/);
		// Même règle d'icône que l'accueil : le chef de centre, sans icône ni modèle, prend celle de son thème.
		expect(ligne(page, 1)).toContain('--icone-etoile-fond');
		const pharmacie = page.slice(page.indexOf('href="/reglages/roles/4"'), page.indexOf('</a>', page.indexOf('href="/reglages/roles/4"')));
		expect(pharmacie).not.toContain('Personnalisé');
	});

	it('comités en cours avec membres et rapporteur, et les rôles de portée comité', () => {
		const comitesHtml = groupe(html(Page, { data }), 'Comités');
		expect(comitesHtml).toMatch(/href="\/reglages\/comites\/1"[\s\S]*4 membres · rapporteur : Alice Martin/);
		expect(comitesHtml).toContain('pas de rapporteur');
		expect(comitesHtml).toContain('Rapporteur de comité');
		expect(comitesHtml).not.toContain('Sport');
	});

	it('profils avec leurs niveaux ; archivés et dissous à part', () => {
		const page = html(Page, { data });
		expect(groupe(page, 'Profils')).toMatch(/href="\/reglages\/profils\/1"[\s\S]*Planning et gardes : Voir les absences/);
		const archives = groupe(page, 'Archivés');
		expect(archives).toContain('Ancien rôle');
		expect(archives).toContain('Sport, comité dissous');
	});

	it('« + Nouveau rôle » et « + Nouveau comité » selon les droits ; pas de profils sans pouvoir', () => {
		const page = html(Page, { data });
		expect(page).toContain('href="/reglages/roles/nouveau"');
		expect(page).toContain('href="/reglages/comites/nouveau"');
		const sansComites = html(Page, { data: { ...data, comites: null, profils: null } });
		expect(sansComites).not.toContain('/reglages/comites/nouveau');
		expect(sansComites).not.toContain('>Profils<');
		expect(sansComites).toContain('>Référents<');
	});

	it('jauge des photos pour qui a le pouvoir : place prise sur 500 Mo, bandeau d’alerte à partir de 80 %', () => {
		// Mo comptés en millions d'octets, comme la limite.
		const MO = 1000 * 1000;
		const jauge = (octets: number, alerte: boolean) => html(Page, { data: { ...data, photos: { octets, limite: 500 * MO, alerte } } });
		const normale = jauge(120 * MO + 1000, false);
		expect(normale).toContain('Photos : 120 Mo sur 500 Mo');
		expect(normale).not.toContain('presque pleine');
		expect(jauge(Math.round(2.34 * MO), false)).toContain('Photos : 2,3 Mo sur 500 Mo');
		const pleine = jauge(400 * MO, true);
		expect(pleine).toContain('Photos : 400 Mo sur 500 Mo');
		expect(pleine).toContain('La base des photos est presque pleine : il faudra choisir entre l’offre payante (5 $/mois) ou un stockage R2.');
		expect(html(Page, { data: { ...data, photos: null } })).not.toContain('Photos :');
	});

	it('sans JavaScript, les groupes restent ouverts', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const tete = render(Layout as any, { props: { data, children: createRawSnippet(() => ({ render: () => '<p>x</p>' })) } }).head;
		expect(tete).toMatch(/<noscript><style>\.groupe > \[hidden\]/);
	});

	it('sur une page de réglage, la liste est à côté et un lien ramène aux réglages', () => {
		etat.page.url = new URL('http://x/reglages/roles/3');
		const mise = html(Layout, { data, children: createRawSnippet(() => ({ render: () => '<p>Contenu</p>' })) });
		expect(mise).toMatch(/<nav[^>]*aria-label="Réglages du centre"/);
		expect(mise).toMatch(/href="\/reglages\/roles\/3" aria-current="page"/);
		expect(mise).toContain('href="/reglages">‹ Réglages');
		etat.page.url = new URL('http://x/reglages');
		expect(html(Layout, { data, children: createRawSnippet(() => ({ render: () => '<p>Contenu</p>' })) })).not.toContain('<nav');
	});
});
