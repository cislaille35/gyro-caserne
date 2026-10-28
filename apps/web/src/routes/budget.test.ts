import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import centre from '$centre';
import { attribution, chargerJeuDeDepart, personne, profil, publication, responsabilite } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { load as racine } from './+layout.server';
import { load as accueil } from './+page.server';
import { load as echanges } from './echanges/+layout.server';
import { actions as actionsMur, load as mur } from './echanges/[mur]/+page.server';
import { load as listeAgents } from './agents/+layout.server';
import { actions as actionsFiche, load as fiche } from './agents/[id]/+page.server';
import { load as nominations } from './nominations/+page.server';
import { load as reglages } from './reglages/+layout.server';
import { load as role } from './reglages/roles/[id]/+page.server';

// D1 gratuit : 50 requêtes par appel du Worker. 45 au plus pour les pages, la session des hooks en prend quelques-unes.
const BUDGET = 45;

// Chef de centre et 150 agents.
async function centreDe150() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centre);
	const [p] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const [chef] = await base.insert(personne).values({ email: 'chef@exemple.fr', prenom: 'Chef', nom: 'Test', profilId: p!.id }).returning();
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: chef!.id, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	for (let i = 0; i < 150; i++) await base.insert(personne).values({ email: `agent${i}@exemple.fr`, prenom: `Agent${i}`, nom: 'Test', profilId: p!.id });
	const [agent] = await base.select().from(personne).where(eq(personne.email, 'agent0@exemple.fr'));
	const locals = { base, acteur: { type: 'personne' as const, id: chef!.id }, superAdmins: [], affichage: {} };
	const compter = async (etapes: () => Promise<unknown>) => {
		const avant = base.requetes;
		await etapes();
		return base.requetes - avant;
	};
	return { base, locals, agent: agent!, compter };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('budget de requêtes, chef de centre avec 150 agents', () => {
	it('/agents/[id] : layouts et fiche', async () => {
		const { locals, agent, compter } = await centreDe150();
		const url = new URL(`http://localhost/agents/${agent.id}`);
		const n = await compter(async () => {
			await (racine as any)({ locals });
			await (listeAgents as any)({ locals, url });
			await (fiche as any)({ locals, params: { id: String(agent.id) } });
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
	});

	it('/agents/[id]?/fiche : action puis rechargement', async () => {
		const { locals, agent, compter } = await centreDe150();
		const url = new URL(`http://localhost/agents/${agent.id}`);
		const params = { id: String(agent.id) };
		const request = new Request('http://localhost', { method: 'POST', body: new URLSearchParams({ nom: 'Nouveau' }) });
		const n = await compter(async () => {
			expect(await (actionsFiche.fiche as any)({ locals, params, request })).toMatchObject({ succes: true });
			await (racine as any)({ locals });
			await (listeAgents as any)({ locals, url });
			await (fiche as any)({ locals, params });
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
	});

	it('/reglages/roles/[id]', async () => {
		const { base, locals, compter } = await centreDe150();
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent engins'));
		const n = await compter(async () => {
			await (racine as any)({ locals });
			await (reglages as any)({ locals });
			await (role as any)({ locals, params: { id: String(r!.id) } });
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
	});

	it('/nominations', async () => {
		const { locals, compter } = await centreDe150();
		const n = await compter(async () => {
			await (racine as any)({ locals });
			await (nominations as any)({ locals, url: new URL('http://localhost/nominations') });
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
	});

	it('/ (accueil)', async () => {
		const { locals, compter } = await centreDe150();
		const n = await compter(async () => {
			await (racine as any)({ locals });
			await (accueil as any)({ locals, url: new URL('http://localhost/') });
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
	});

	it('/echanges/[mur] : 300 publications, puis une publication et le rechargement', async () => {
		const { base, locals, compter } = await centreDe150();
		const lignes = Array.from({ length: 300 }, (_, i) => ({ mur: 'centre', auteur: `personne:${locals.acteur.id}`, type: 'message' as const, texte: `Publication ${i}`, creeLe: '2026-10-01T10:00:00', epinglee: i < 12 ? 1 : 0 }));
		for (let i = 0; i < lignes.length; i += 50) await base.insert(publication).values(lignes.slice(i, i + 50));
		const params = { mur: 'centre' };
		const url = new URL('http://localhost/echanges/centre');
		const page = async () => {
			await (racine as any)({ locals });
			await (echanges as any)({ locals });
			return (mur as any)({ locals, params, url });
		};
		const n = await compter(async () => {
			const data = await page();
			expect(data.publications).toHaveLength(20);
			expect(data.epinglees).toHaveLength(10);
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
		const formulaire = new FormData();
		formulaire.append('type', 'message');
		formulaire.append('texte', 'Nouvelle');
		const request = new Request('http://localhost', { method: 'POST', body: formulaire });
		const n2 = await compter(async () => {
			expect(await (actionsMur.publier as any)({ locals, params, url, request })).toMatchObject({ succes: expect.any(String) });
			await page();
		});
		expect(n2).toBeLessThanOrEqual(BUDGET);
	});
});
