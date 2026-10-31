import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import centre from '$centre';
import { attribution, chargerJeuDeDepart, commentaire, creerGroupe, envoyer, message, personne, prendreConnaissance, profil, publication, publier, responsabilite, signaler } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { maintenantParis, septJoursPlusTard } from '#lib/aujourdhui.ts';
import { jpeg, requeteFormulaire } from './echanges/de-test.ts';
import { load as racine } from './+layout.server';
import { actions as actionsAccueil, load as accueil } from './+page.server';
import { actions as actionsNotifications, load as notifications } from './notifications/+page.server';
import { load as echanges } from './echanges/+layout.server';
import { load as messages } from './echanges/messages/+page.server';
import { load as layoutMessages } from './echanges/messages/+layout.server';
import { GET as pastille } from './echanges/messages/pastille/+server';
import { load as nouveauMessage } from './echanges/messages/nouveau/+page.server';
import { actions as actionsConversation, load as conversationOuverte } from './echanges/messages/[id]/+page.server';
import { GET as suite } from './echanges/messages/[id]/suite/+server';
import { actions as actionsGroupe, load as nouveauGroupe } from './echanges/messages/nouveau/groupe/+page.server';
import { actions as actionsInfos, load as infos } from './echanges/messages/[id]/infos/+page.server';
import { actions as actionsMur, load as mur } from './echanges/[mur]/+page.server';
import { actions as actionsPublier, load as pagePublier } from './echanges/publier/+page.server';
import { actions as actionsPublication, load as publicationSeule } from './echanges/[mur]/[id]/+page.server';
import { load as listeAgents } from './agents/+layout.server';
import { actions as actionsFiche, load as fiche } from './agents/[id]/+page.server';
import { load as nominations } from './nominations/+page.server';
import { load as caserne } from './caserne/+page.server';
import { load as moi } from './moi/+page.server';
import { load as reglages } from './reglages/+layout.server';
import { load as pageReglages } from './reglages/+page.server';
import { load as role } from './reglages/roles/[id]/+page.server';

const datesSondage = (m: string) => ({ ouverture: m.slice(0, 16), cloture: septJoursPlusTard(m) });

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
	const locals = { base, basePhotos: base.photos, acteur: { type: 'personne' as const, id: chef!.id }, superAdmins: [], affichage: {} };
	const compter = async (etapes: () => Promise<unknown>) => {
		const avant = base.requetes;
		await etapes();
		return base.requetes - avant;
	};
	return { base, locals, agent: agent!, compter };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Le chef de centre et 300 publications sur « Le centre », dont 12 épinglées.
async function centreDe300Publications() {
	const c = await centreDe150();
	const lignes = Array.from({ length: 300 }, (_, i) => ({ mur: 'centre', auteur: `personne:${c.locals.acteur.id}`, type: 'message' as const, texte: `Publication ${i}`, creeLe: '2026-10-01T10:00:00', epinglee: i < 12 ? 1 : 0 }));
	for (let i = 0; i < lignes.length; i += 50) await c.base.insert(publication).values(lignes.slice(i, i + 50));
	return c;
}

// Le mur « Le centre » tel que SvelteKit le charge : la racine, la liste, puis le mur.
async function pageDuMur(locals: unknown) {
	const url = new URL('http://localhost/echanges/centre');
	await (racine as any)({ locals });
	await (echanges as any)({ locals, url });
	return (mur as any)({ locals, params: { mur: 'centre' }, url });
}

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

	it('/reglages : la liste et la jauge des photos', async () => {
		const { locals, compter } = await centreDe150();
		const n = await compter(async () => {
			await (racine as any)({ locals });
			// SvelteKit charge la liste une fois et la passe à la page (parent).
			const liste = await (reglages as any)({ locals });
			const data = await (pageReglages as any)({ locals, parent: async () => liste });
			expect(data.photos).toMatchObject({ octets: 0 });
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

	it('/caserne : l’effectif et ce qui est à pourvoir', async () => {
		const { locals, compter } = await centreDe150();
		const n = await compter(async () => {
			await (racine as any)({ locals });
			const data = await (caserne as any)({ locals });
			expect(data.agents).toBe(151);
			expect(data.aPourvoir).toBeGreaterThan(0);
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
	});

	it('/moi : la carte d’identité', async () => {
		const { locals, compter } = await centreDe150();
		const n = await compter(async () => {
			await (racine as any)({ locals });
			expect((await (moi as any)({ locals })).identite).toMatchObject({ prenom: 'Chef' });
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
	});

	it('/ (accueil), « À ne pas manquer » rempli ; puis chaque geste et le rechargement ; /notifications', async () => {
		const { base, locals, agent, compter } = await centreDe150();
		const maintenant = maintenantParis();
		const ids: number[] = [];
		for (let i = 0; i < 20; i++) ids.push(await publier(base, base.photos, locals.acteur, 'centre', { type: 'annonce', texte: `Note ${i}`, priseDeConnaissance: true }, maintenant));
		for (let i = 0; i < 10; i++) ids.push(await publier(base, base.photos, locals.acteur, 'vie', { type: 'evenement', texte: `Repas ${i}`, evenement: { debut: `2099-01-${String(i + 1).padStart(2, '0')}T19:00`, lieu: 'Caserne', convoques: 'tous' }, sondage: { question: 'Petit déjeuner ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenant) } }, maintenant));
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
			await (notifications as any)({ locals: deLAgent, url: new URL('http://localhost/notifications') });
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
	});

	it('/notifications du chef de centre : 30 messages signalés ; retirer et classer, puis le rechargement', async () => {
		const { base, locals, compter } = await centreDe150();
		const autres = await base.select({ id: personne.id }).from(personne).limit(31);
		const ids = autres.map((p) => p.id).filter((id) => id !== locals.acteur.id).slice(0, 30);
		for (const [i, id] of ids.entries()) {
			const auteur = ids[(i + 1) % ids.length]!;
			const { message: m } = await envoyer(base, base.photos, { type: 'personne', id: auteur }, { personne: id }, { texte: `Grave ${i}` }, maintenantParis());
			await signaler(base, { type: 'personne', id }, m, maintenantParis());
		}
		// La racine, sur chaque page : la cloche n'y ajoute qu'un compte, sans lire les 30 copies.
		expect(await compter(() => (racine as any)({ locals }))).toBeLessThanOrEqual(11);
		let liste: { id: number }[] = [];
		const page = await compter(async () => {
			expect((await (racine as any)({ locals })).cloche).toBe(30);
			liste = (await (notifications as any)({ locals, url: new URL('http://localhost/notifications') })).signalements;
		});
		expect(liste).toHaveLength(30);
		expect(page).toBeLessThanOrEqual(BUDGET);
		for (const [nom, s] of [['retirer', liste[0]!], ['classer', liste[1]!]] as const) {
			const n = await compter(async () => {
				expect(await (actionsNotifications as any)[nom]({ locals, request: await requeteFormulaire([['id', String(s.id)]]) })).toMatchObject({ succes: expect.any(String) });
				await (racine as any)({ locals });
				await (notifications as any)({ locals, url: new URL('http://localhost/notifications') });
			});
			expect(n, nom).toBeLessThanOrEqual(BUDGET);
		}
	});

	it('/echanges : la liste rangée en sections', async () => {
		const { base, locals, compter } = await centreDe150();
		const lignes = Array.from({ length: 100 }, (_, i) => ({ mur: i % 2 ? 'centre' : 'vie', auteur: 'personne:2', type: 'message' as const, texte: `Publication ${i}`, creeLe: '2026-10-01T10:00:00' }));
		await base.insert(publication).values(lignes.slice(0, 50));
		await base.insert(publication).values(lignes.slice(50));
		const n = await compter(async () => {
			await (racine as any)({ locals });
			const data = await (echanges as any)({ locals, url: new URL('http://localhost/echanges') });
			expect(data.sections.centre.derniere).not.toBeNull();
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
	});

	it('/echanges/[mur] : 300 publications', async () => {
		const { locals, compter } = await centreDe300Publications();
		const n = await compter(async () => {
			const data = await pageDuMur(locals);
			expect(data.publications).toHaveLength(20);
			expect(data.epinglees).toHaveLength(10);
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
	});

	it('/echanges/publier : la page, puis une publication avec 4 photos et le mur rechargé', async () => {
		const { locals, compter } = await centreDe300Publications();
		const n = await compter(async () => {
			await (racine as any)({ locals });
			const data = await (pagePublier as any)({ locals, url: new URL('http://localhost/echanges/publier?mur=centre') });
			expect(data.choisi).toBe('centre');
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
		const photos = Array.from({ length: 4 }, (_, i): [string, File] => ['photos', jpeg(200 * 1024, `p${i}.jpg`)]);
		const request = await requeteFormulaire([['mur', 'centre'], ['type', 'message'], ['texte', 'Nouvelle'], ...photos]);
		const n2 = await compter(async () => {
			await expect((actionsPublier.publier as any)({ locals, params: {}, url: new URL('http://localhost/echanges/publier'), request })).rejects.toMatchObject({ status: 303 });
			await pageDuMur(locals);
		});
		expect(n2).toBeLessThanOrEqual(BUDGET);
	});

	it('/echanges/[mur]/[id] : annonce suivie, 50 commentaires ; chaque geste puis le rechargement', async () => {
		const { base, locals, compter } = await centreDe150();
		const maintenant = '2026-10-28T10:00:00';
		const annonce = await publier(base, base.photos, locals.acteur, 'centre', { type: 'annonce', texte: 'Note', priseDeConnaissance: true, sondage: { question: 'Lu ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenant) } }, maintenant);
		const evenement = await publier(base, base.photos, locals.acteur, 'centre', { type: 'evenement', texte: 'Manœuvre', evenement: { debut: '2099-01-01T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
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

	it('/echanges/messages : 30 conversations, dont un groupe de 60 ; la pastille en 2 requêtes au plus', async () => {
		const { base, locals, compter } = await centreDe150();
		const autres = await base.select({ id: personne.id }).from(personne).limit(61);
		const ids = autres.map((p) => p.id).filter((id) => id !== locals.acteur.id);
		for (const id of ids.slice(0, 29)) await envoyer(base, base.photos, { type: 'personne', id }, { personne: locals.acteur.id }, { texte: 'Bonjour' }, maintenantParis());
		await creerGroupe(base, locals.acteur, { nom: 'Tout le monde', membres: ids.slice(0, 59) }, maintenantParis());
		const url = new URL('http://localhost/echanges/messages');
		const n = await compter(async () => {
			await (racine as any)({ locals });
			await (echanges as any)({ locals, url });
			const { conversations } = await (messages as any)({ locals, url, depends: () => {} });
			expect(conversations).toHaveLength(30);
		});
		expect(n).toBeLessThanOrEqual(BUDGET);
		expect(await compter(() => (pastille as any)({ locals }))).toBeLessThanOrEqual(2);
	});

	it('/echanges/messages/nouveau, puis un groupe de 60 : chaque étape et la création', async () => {
		const { base, locals, compter } = await centreDe150();
		const autres = await base.select({ id: personne.id }).from(personne).limit(61);
		const ids = autres.map((p) => p.id).filter((id) => id !== locals.acteur.id).slice(0, 59);
		for (const id of ids.slice(0, 30)) await envoyer(base, base.photos, { type: 'personne', id }, { personne: locals.acteur.id }, { texte: 'Bonjour' }, maintenantParis());
		const page = async (chemin: string, charger: () => Promise<unknown>) =>
			compter(async () => {
				await (racine as any)({ locals });
				await (echanges as any)({ locals, url: new URL(`http://localhost${chemin}`) });
				await charger();
			});
		const url = (q: string) => new URL(`http://localhost/echanges/messages/nouveau/groupe${q}`);
		const n = [
			await page('/echanges/messages/nouveau', async () => expect((await (nouveauMessage as any)({ locals, url: new URL('http://localhost/echanges/messages/nouveau') })).personnes).toHaveLength(150)),
			await page('/echanges/messages/nouveau/groupe', () => (nouveauGroupe as any)({ locals, url: url('?equipe=1') })),
			await page('/echanges/messages/nouveau/groupe', () => (nouveauGroupe as any)({ locals, url: url(`?etape=nom&nom=Tous${ids.map((id) => `&membres=${id}`).join('')}`) })),
			await compter(async () => {
				const request = await requeteFormulaire([['nom', 'Tous'], ...ids.map((id): [string, string] => ['membres', String(id)])]);
				await expect((actionsGroupe.creer as any)({ locals, request })).rejects.toMatchObject({ status: 303 });
			})
		];
		for (const x of n) expect(x).toBeLessThanOrEqual(BUDGET);
	});
	it('/echanges/messages/[id] : un groupe de 60 et 2 000 messages, par « Répondre en privé » ; l’envoi ; la suite en 3 requêtes au plus', async () => {
		const { base, locals, compter } = await centreDe150();
		const autres = await base.select({ id: personne.id }).from(personne).limit(61);
		const ids = autres.map((p) => p.id).filter((id) => id !== locals.acteur.id).slice(0, 59);
		const id = await creerGroupe(base, locals.acteur, { nom: 'Tout le monde', membres: ids }, '2026-10-01T09:00');
		const lignes = Array.from({ length: 2000 }, (_, i) => ({ conversationId: id, auteur: ids[i % 59]!, texte: `Message ${i}`, creeLe: '2026-10-02T10:00:00', majLe: '2026-10-02T10:00:00' }));
		for (let i = 0; i < lignes.length; i += 10) await base.insert(message).values(lignes.slice(i, i + 10));
		const params = { id: String(id) };
		const url = new URL(`http://localhost/echanges/messages/${id}`);
		let vue: { messages: { id: number }[]; majLe: string } | undefined;
		// Avec 30 autres conversations pour la colonne de gauche.
		for (const autre of ids.slice(0, 30)) await envoyer(base, base.photos, { type: 'personne', id: autre }, { personne: locals.acteur.id }, { texte: 'Bonjour' }, maintenantParis());
		// Arrivée par « Répondre en privé » : la publication est lue par le serveur.
		const pub = await publier(base, base.photos, { type: 'personne', id: ids[0]! }, 'vie', { type: 'message', texte: 'Repas de Noël' }, maintenantParis());
		const n = await compter(async () => {
			await (racine as any)({ locals });
			await (echanges as any)({ locals, url });
			expect((await (layoutMessages as any)({ locals, url, depends: () => {} })).conversations).toHaveLength(31);
			const page = await (conversationOuverte as any)({ locals, params, url: new URL(`${url}?publication=${pub}`) });
			expect(page.prerempli).toBe('À propos de « Repas de Noël » : ');
			vue = page.vue;
		});
		expect(vue!.messages).toHaveLength(40);
		expect(n).toBeLessThanOrEqual(BUDGET);
		const envoi = await compter(async () => {
			await expect((actionsConversation.envoyer as any)({ locals, params, url, request: await requeteFormulaire([['texte', 'Bonjour à tous']]) })).rejects.toMatchObject({ status: 303 });
		});
		expect(envoi).toBeLessThanOrEqual(BUDGET);
		const dernier = vue!.messages.at(-1)!.id;
		const tour = await compter(() => (suite as any)({ locals, params, url: new URL(`http://localhost/echanges/messages/${id}/suite?dernier=${dernier}&maj=${encodeURIComponent(vue!.majLe)}`) }));
		expect(tour).toBeLessThanOrEqual(3);
	});

	it('/echanges/messages/[id]/infos : un groupe de 60 ; chaque geste ; l’ajout de membres', async () => {
		const { base, locals, compter } = await centreDe150();
		const autres = await base.select({ id: personne.id }).from(personne).limit(62);
		const ids = autres.map((p) => p.id).filter((id) => id !== locals.acteur.id);
		const id = await creerGroupe(base, locals.acteur, { nom: 'Tout le monde', membres: ids.slice(0, 58) }, '2026-10-01T09:00');
		const params = { id: String(id) };
		const url = new URL(`http://localhost/echanges/messages/${id}/infos`);
		const page = await compter(async () => {
			await (racine as any)({ locals });
			await (echanges as any)({ locals, url });
			expect((await (infos as any)({ locals, params, url })).infos.membres).toHaveLength(59);
		});
		expect(page).toBeLessThanOrEqual(BUDGET);
		const geste = (nom: keyof typeof actionsInfos, corps: [string, string][]) => compter(async () => void (await (actionsInfos[nom] as any)({ locals, params, url, request: await requeteFormulaire(corps) }).catch(() => {})));
		for (const n of [await geste('nommer', [['personne', String(ids[0])]]), await geste('retirer', [['personne', String(ids[1])]]), await geste('renommer', [['nom', 'Tous']])]) expect(n).toBeLessThanOrEqual(BUDGET);
		// À deux : la fiche courte, et « Voir la fiche » pour le chef de centre.
		const { conversation: aDeux } = await envoyer(base, base.photos, locals.acteur, { personne: ids[0]! }, { texte: 'Bonjour' }, maintenantParis());
		const urlDeux = new URL(`http://localhost/echanges/messages/${aDeux}/infos`);
		const deux = await compter(async () => {
			await (racine as any)({ locals });
			await (echanges as any)({ locals, url: urlDeux });
			expect((await (infos as any)({ locals, params: { id: String(aDeux) }, url: urlDeux })).fiche).toBe(`/agents/${ids[0]}`);
		});
		expect(deux).toBeLessThanOrEqual(BUDGET);
		const ajout = new URL(`http://localhost/echanges/messages/nouveau/groupe?ajouter=${id}`);
		const selection = await compter(async () => {
			await (racine as any)({ locals });
			await (echanges as any)({ locals, url: ajout });
			await (nouveauGroupe as any)({ locals, url: ajout });
		});
		expect(selection).toBeLessThanOrEqual(BUDGET);
		const envoi = await compter(async () => {
			const request = await requeteFormulaire([['membres', String(ids[1])], ['membres', String(ids[60])]]);
			await expect((actionsGroupe.ajouter as any)({ locals, url: ajout, request })).rejects.toMatchObject({ status: 303 });
		});
		expect(envoi).toBeLessThanOrEqual(BUDGET);
	});
});
