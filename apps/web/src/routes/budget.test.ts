import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import centre from '$centre';
import { attribution, chargerJeuDeDepart, commentaire, personne, prendreConnaissance, profil, publication, publier, responsabilite } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { jpeg, requeteFormulaire } from './echanges/de-test.ts';
import { load as racine } from './+layout.server';
import { actions as actionsAccueil, load as accueil } from './+page.server';
import { load as notifications } from './notifications/+page.server';
import { load as echanges } from './echanges/+layout.server';
import { actions as actionsMur, load as mur } from './echanges/[mur]/+page.server';
import { actions as actionsPublication, load as publicationSeule } from './echanges/[mur]/[id]/+page.server';
import { load as listeAgents } from './agents/+layout.server';
import { actions as actionsFiche, load as fiche } from './agents/[id]/+page.server';
import { load as nominations } from './nominations/+page.server';
import { load as reglages } from './reglages/+layout.server';
import { load as role } from './reglages/roles/[id]/+page.server';

const datesSondage = (m: string) => ({ ouverture: m.slice(0, 16), cloture: new Date(Date.parse(`${m.slice(0, 16)}:00Z`) + 7 * 864e5).toISOString().slice(0, 16) });

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

	it('/ (accueil), « À ne pas manquer » rempli ; puis chaque geste et le rechargement ; /notifications', async () => {
		const { base, locals, agent, compter } = await centreDe150();
		const maintenant = maintenantParis();
		const ids: number[] = [];
		for (let i = 0; i < 20; i++) ids.push(await publier(base, locals.acteur, 'centre', { type: 'annonce', texte: `Note ${i}`, priseDeConnaissance: true }, maintenant));
		for (let i = 0; i < 10; i++) ids.push(await publier(base, locals.acteur, 'vie', { type: 'evenement', texte: `Repas ${i}`, evenement: { debut: `2099-01-${String(i + 1).padStart(2, '0')}T19:00`, lieu: 'Caserne', convoques: 'tous' }, sondage: { question: 'Petit déjeuner ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenant) } }, maintenant));
		await base.update(publication).set({ epinglee: 1 });
		const deLAgent = { ...locals, acteur: { type: 'personne' as const, id: agent.id } };
		const url = new URL('http://localhost/');
		for (const l of [locals, deLAgent]) {
			const n = await compter(async () => {
				await (racine as any)({ locals: l });
				await (accueil as any)({ locals: l, url });
			});
			expect(n).toBeLessThanOrEqual(BUDGET);
		}
		const gestes: [string, [string, string][]][] = [
			['prendreConnaissance', [['id', String(ids[0])]]],
			['repondre', [['id', String(ids[20])], ['reponse', 'present']]]
		];
		for (const [nom, champs] of gestes) {
			const n = await compter(async () => {
				expect(await (actionsAccueil as any)[nom]({ locals: deLAgent, params: {}, url, request: await requeteFormulaire(champs) })).toMatchObject({ succes: expect.any(String) });
				await (racine as any)({ locals: deLAgent });
				const data = await (accueil as any)({ locals: deLAgent, url });
				expect(data.aNePasManquer.annonces).toHaveLength(19);
			});
			expect(n, nom).toBeLessThanOrEqual(BUDGET);
		}
		const n = await compter(async () => {
			await (racine as any)({ locals: deLAgent });
			await (notifications as any)({ locals: deLAgent });
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
	});

	it('/echanges/[mur] : 300 publications, puis une publication avec 4 photos et le rechargement', async () => {
		const { base, locals, compter } = await centreDe150();
		const lignes = Array.from({ length: 300 }, (_, i) => ({ mur: 'centre', auteur: `personne:${locals.acteur.id}`, type: 'message' as const, texte: `Publication ${i}`, creeLe: '2026-10-01T10:00:00', epinglee: i < 12 ? 1 : 0 }));
		for (let i = 0; i < lignes.length; i += 50) await base.insert(publication).values(lignes.slice(i, i + 50));
		const params = { mur: 'centre' };
		const url = new URL('http://localhost/echanges/centre');
		const page = async () => {
			await (racine as any)({ locals });
			await (echanges as any)({ locals, url: new URL('http://localhost/echanges/centre') });
			return (mur as any)({ locals, params, url });
		};
		const n = await compter(async () => {
			const data = await page();
			expect(data.publications).toHaveLength(20);
			expect(data.epinglees).toHaveLength(10);
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
		// Publication avec 4 photos, puis rechargement.
		const photos = Array.from({ length: 4 }, (_, i): [string, File] => ['photos', jpeg(350 * 1024, `p${i}.jpg`)]);
		const request = await requeteFormulaire([['type', 'message'], ['texte', 'Nouvelle'], ...photos]);
		const n2 = await compter(async () => {
			expect(await (actionsMur.publier as any)({ locals, params, url, request })).toMatchObject({ succes: expect.any(String) });
			await page();
		});
		expect(n2).toBeLessThanOrEqual(BUDGET);
	});

	it('/echanges/[mur]/[id] : annonce suivie, 50 commentaires ; chaque geste puis le rechargement', async () => {
		const { base, locals, compter } = await centreDe150();
		const maintenant = '2026-10-28T10:00:00';
		const annonce = await publier(base, locals.acteur, 'centre', { type: 'annonce', texte: 'Note', priseDeConnaissance: true, sondage: { question: 'Lu ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenant) } }, maintenant);
		const evenement = await publier(base, locals.acteur, 'centre', { type: 'evenement', texte: 'Manœuvre', evenement: { debut: '2099-01-01T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		const agents = await base.select({ id: personne.id }).from(personne);
		for (const a of agents.slice(0, 100)) await prendreConnaissance(base, { type: 'personne', id: a.id }, annonce, maintenant);
		await base.insert(commentaire).values(Array.from({ length: 50 }, (_, i) => ({ publicationId: annonce, auteur: `personne:${agents[i]!.id}`, texte: `Commentaire ${i}`, creeLe: maintenant })));
		const params = (id: number) => ({ mur: 'centre', id: String(id) });
		const page = async (id: number) => {
			await (racine as any)({ locals });
			await (echanges as any)({ locals, url: new URL('http://localhost/echanges/centre') });
			return (publicationSeule as any)({ locals, params: params(id) });
		};
		for (const id of [annonce, evenement]) {
			const n = await compter(async () => {
				const data = await page(id);
				expect(data.suivi).not.toBeNull();
			});
			expect(n).toBeLessThanOrEqual(BUDGET);
		}
		const [dernier] = await base.select({ id: commentaire.id }).from(commentaire).orderBy(commentaire.id).limit(1);
		const gestes: [string, number, [string, string][]][] = [
			['commenter', annonce, [['texte', 'Vu']]],
			['supprimerCommentaire', annonce, [['commentaire', String(dernier!.id)]]],
			['aimer', annonce, [['oui', '1']]],
			['voter', annonce, [['reponse', '0']]],
			['prendreConnaissance', annonce, []],
			['fermerCommentaires', annonce, [['oui', '1']]],
			['repondre', evenement, [['reponse', 'present']]]
		];
		const url = new URL('http://localhost/echanges/centre');
		for (const [nom, id, champs] of gestes) {
			// Depuis la page de la publication, puis depuis le mur.
			const n = await compter(async () => {
				const r = await (actionsPublication as any)[nom]({ locals, params: params(id), request: await requeteFormulaire([['id', String(id)], ...champs]) });
				expect(r, nom).toMatchObject({ succes: expect.any(String) });
				await page(id);
			});
			expect(n, nom).toBeLessThanOrEqual(BUDGET);
			const n2 = await compter(async () => {
				await (actionsMur as any)[nom]({ locals, params: { mur: 'centre' }, url, request: await requeteFormulaire([['id', String(id)], ...champs]) });
				await (racine as any)({ locals });
				await (echanges as any)({ locals, url: new URL('http://localhost/echanges/centre') });
				await (mur as any)({ locals, params: { mur: 'centre' }, url });
			});
			expect(n2, nom).toBeLessThanOrEqual(BUDGET);
		}
	});
});
