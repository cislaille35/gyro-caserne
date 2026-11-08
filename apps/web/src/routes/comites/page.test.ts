import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { attribution, comite, personne, profil, responsabilite } from '@gyro-caserne/socle';
import Page from './+page.svelte';
import { load } from './+page.server';
import { preparer } from '../echanges/de-test.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
const html = (data: Record<string, unknown>) => render(Page as any, { props: { data: { ...vue, peutNominations: false, peutReglages: false, ...data } } }).body;

const vue = {
	comites: [
		{
			id: 2,
			nom: 'Amicale',
			icone: 'coeur',
			mur: true,
			membres: [
				{ id: 5, nom: 'Bruno Petit', roles: ['Rapporteur'] },
				{ id: 4, nom: 'Alice Bernard', roles: ['Membre', 'Trésorière'] }
			],
			ressources: [{ id: 7, nom: 'Barnum', icone: 'outil' }]
		},
		{ id: 1, nom: 'Comité du centre', icone: 'etoile', mur: false, membres: [], ressources: [] }
	],
	commandement: [
		{ id: 1, nom: 'Chef de centre', icone: 'etoile', titulaires: ['Claire Martin'] },
		{ id: 2, nom: 'Chef de centre adjoint', icone: 'etoile', titulaires: [] }
	],
	equipes: [{ id: 3, nom: 'Chef de garde', systeme: 'chef_equipe', parEquipe: [{ equipe: 'Équipe 1', titulaires: ['Bruno Petit'] }, { equipe: 'Équipe 2', titulaires: [] }] }],
	referents: [
		{ id: 6, nom: 'Référent pharmacie', icone: 'croix', titulaires: ['Alice Bernard', 'Denis Roux'] },
		{ id: 7, nom: 'Référent engins', icone: 'camion', titulaires: [] }
	]
};

describe('/comites', () => {
	it('demande la connexion ; refusée au compte de la réserve citoyenne', async () => {
		await expect((load as any)({ locals: { acteur: null } })).rejects.toMatchObject({ status: 303, location: '/connexion' });
		const { base } = await preparer();
		const [ext] = await base.select().from(profil).where(eq(profil.typePersonne, 'exterieur'));
		const [p] = await base.insert(personne).values({ email: 'reserve@exemple.fr', prenom: 'Réserve', nom: 'Citoyenne', profilId: ext!.id }).returning();
		await expect((load as any)({ locals: { base, acteur: { type: 'personne', id: p!.id } } })).rejects.toMatchObject({ status: 403 });
	});

	it('ouverte à tout agent : les comités et les rôles du centre', async () => {
		const { base, alice } = await preparer();
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		const [membre] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Membre de comité'));
		await base.insert(attribution).values({ personneId: alice.id, responsabiliteId: membre!.id, perimetreType: 'comite', perimetreId: amicale!.id, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const data = await (load as any)({ locals: { base, acteur: alice } });
		expect(data.comites.find((c: { nom: string }) => c.nom === 'Amicale')).toMatchObject({ mur: true, membres: [{ nom: 'Alice Test', roles: ['Membre'] }] });
		expect(data.commandement[0]).toMatchObject({ nom: 'Chef de centre', titulaires: ['Chef Test'] });
	});

	it('un titre par page, une section par sorte, un groupe par comité ou par thème', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>Comités et référents<\/h1>/);
		expect(page).toMatch(/<h2[^>]*>Comités<\/h2>/);
		expect(page).toMatch(/<h2[^>]*>Référents et rôles<\/h2>/);
		for (const titre of ['Amicale', 'Comité du centre', 'Chef de centre et adjoint', 'Chefs de garde', 'Référents']) expect(page).toMatch(new RegExp(`<h3[^>]*>${titre}`));
		// Une carte par groupe, pas une par ligne.
		expect(page.match(/<ul role="list" class="lignes"/g)).toHaveLength(5);
	});

	it('un comité : ses membres et leur rôle, son mur, son matériel', () => {
		const page = html({});
		expect(page).toMatch(/Bruno Petit[\s\S]*?Rapporteur[\s\S]*?Alice Bernard[\s\S]*?Membre, Trésorière/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/comite:2"[^>]*>[\s\S]*?Le mur de l’Amicale/);
		expect(page).toMatch(/<a[^>]*href="\/reservations\/7"[^>]*>[\s\S]*?Barnum[\s\S]*?Calendrier des réservations/);
	});

	it('pas de lien vers un mur qu’on ne lit pas ; un comité vide le dit', () => {
		const page = html({});
		expect(page).not.toContain('href="/echanges/comite:1"');
		expect(page).toContain('Aucun membre pour l’instant');
	});

	it('sans comité en cours : la section le dit', () => {
		expect(html({ comites: [] })).toMatch(/<h2[^>]*>Comités<\/h2>[\s\S]*?Aucun comité pour l’instant/);
	});

	it('chaque rôle et ses titulaires ; « Personne pour l’instant » s’il est vide ; les chefs de garde par équipe', () => {
		const page = html({});
		expect(page).toMatch(/Chef de centre<\/span>[\s\S]*?Claire Martin/);
		expect(page).toMatch(/Chef de centre adjoint<\/span>[\s\S]*?Personne pour l’instant/);
		expect(page).toMatch(/Équipe 1<\/span>[\s\S]*?Bruno Petit/);
		expect(page).toMatch(/Équipe 2<\/span>[\s\S]*?Personne pour l’instant/);
		expect(page).toMatch(/Référent pharmacie<\/span>[\s\S]*?Alice Bernard, Denis Roux/);
		expect(page).toMatch(/Référent engins<\/span>[\s\S]*?Personne pour l’instant/);
		// Ni droits ni lien vers une fiche réservée aux gestionnaires.
		expect(page).not.toContain('href="/agents/');
		expect(page).not.toContain('GERER_');
	});

	it('« Gérer » seulement pour qui peut nommer ou régler', () => {
		expect(html({})).not.toMatch(/>Gérer</);
		expect(html({ peutNominations: true, peutReglages: true })).toMatch(/<a[^>]*href="\/nominations"[^>]*>Gérer<span class="masque"> les nominations<\/span><\/a>/);
		expect(html({ peutReglages: true })).toMatch(/<a[^>]*href="\/reglages"[^>]*>Gérer<span class="masque"> les réglages du centre<\/span><\/a>/);
	});
});
