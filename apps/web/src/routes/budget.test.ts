import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import centre from '$centre';
import { affectationEquipe, ajouterRessource, pourDemander, attribution, chargerJeuDeDepart, semaineChangee, comite, periodeParDefaut, plageEte, reglerEte, enregistrerManoeuvre, equipe, preparerAnnee, publierAnnee, reglerRoulement, reserver, ressource, commentaire, creerGroupe, envoyer, message, personne, prendreConnaissance, profil, publication, publier, responsabilite, signaler } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { aujourdhuiParis, maintenantParis, septJoursPlusTard } from '#lib/aujourdhui.ts';
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
import { load as reservations } from './reservations/+page.server';
import { load as ressourcePage } from './reservations/[id]/+page.server';
import { actions as actionsReserver, load as pageReserver } from './reservations/[id]/reserver/+page.server';
import { actions as actionsMiennes, load as miennes } from './reservations/miennes/+page.server';
import { actions as actionsAValider, load as pageAValider } from './reservations/a-valider/+page.server';
import { load as pageMateriel } from './reservations/materiel/+page.server';
import { load as planning } from './planning/+page.server';
import { actions as actionsPreparer, load as preparer } from './planning/preparer/+page.server';
import { load as pageManoeuvre } from './planning/preparer/manoeuvre/+page.server';
import { actions as actionsRemplacements, load as remplacements } from './remplacements/+page.server';
import { load as demandeRemplacementPage } from './remplacements/[id]/+page.server';
import { actions as actionsDemander, load as pageDemander } from './remplacements/demander/+page.server';
import { load as pageEchangeManoeuvre } from './remplacements/manoeuvre/+page.server';
import { load as reglagesAptitudes } from './reglages/aptitudes/+page.server';
import { actions as actionsEte, load as pageEte } from './planning/ete/+page.server';
import { load as mesVacancesPage } from './moi/vacances/+page.server';
import { load as reglagesArmement } from './reglages/armement/+page.server';
import { GET as donneesPlanning } from './planning/preparer/fichier/donnees/+server';
import { POST as apercuPlanning } from './planning/preparer/fichier/apercu/+server';
import { POST as appliquerPlanning } from './planning/preparer/fichier/appliquer/+server';

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
	// Ce qui part en arrière-plan (les notifications) compte dans la même requête du Worker.
	const taches: Promise<unknown>[] = [];
	const locals = { base, basePhotos: base.photos, acteur: { type: 'personne' as const, id: chef!.id }, superAdmins: [], affichage: {}, enArrierePlan: (p: Promise<unknown>) => taches.push(p) };
	const compter = async (etapes: () => Promise<unknown>) => {
		const avant = base.requetes;
		await etapes();
		await Promise.all(taches.splice(0));
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

	it('/planning/ete : tout un été proposé pour 150 agents ; proposer, ajuster, publier ; Mes vacances, armement', async () => {
		const { base, locals, agent, compter } = await centreDe150();
		const ids = (await base.select().from(equipe)).map((e) => e.id);
		const annee = Number(maintenantParis().slice(0, 4)) + 1;
		const m = maintenantParis();
		await reglerRoulement(base, locals.acteur, annee, ids, m);
		await reglerEte(base, locals.acteur, annee, periodeParDefaut(annee, centre.astreinte), m, centre.astreinte);
		const url = new URL(`http://localhost/planning/ete?annee=${annee}`);
		for (const nom of ['proposer', 'publier'] as const) {
			const n = await compter(async () => {
				expect(await (actionsEte as any)[nom]({ locals, url, request: await requeteFormulaire([]) })).toMatchObject({ succes: expect.any(String) });
				await (racine as any)({ locals });
				await (pageEte as any)({ locals, url });
			});
			expect(n, nom).toBeLessThanOrEqual(BUDGET);
			// Proposé, pas encore publié : l'accueil du chef compte les plages à revoir.
			if (nom === 'proposer') {
				const accueilChef = await compter(async () => {
					await (racine as any)({ locals });
					const data = await (accueil as any)({ locals, url: new URL('http://localhost/?casquette=centre') });
					expect(data.contenu.aDecider[0].texte).toMatch(new RegExp(`^Été ${annee} : \\d+ plages à revoir$`));
				});
				expect(accueilChef, 'accueil, été à revoir').toBeLessThanOrEqual(BUDGET);
			}
		}
		// Le fichier du planning, onglet Été compris : exporter, prévisualiser, appliquer.
		const corps = async () => {
			const d = await (await (donneesPlanning as any)({ locals, url: new URL(`http://localhost/planning/preparer/fichier/donnees?annee=${annee}`) })).json();
			const feuilles = Object.fromEntries(d.feuilles.map((f: { nom: string; lignes: string[][] }) => [f.nom, f.lignes.map((cellules, i) => ({ numero: i + 2, cellules }))]));
			const entetes = Object.fromEntries(d.feuilles.map((f: { nom: string; entetes: string[] }) => [f.nom, f.entetes]));
			return JSON.stringify({ annee, lu: { feuilles, entetes } });
		};
		const poster = (route: unknown, texte: string) => (route as any)({ locals: { ...locals, enArrierePlan: () => {} }, request: new Request('http://x', { method: 'POST', body: texte, headers: { 'content-type': 'application/json' } }) });
		let texte = '';
		expect(await compter(async () => { texte = await corps(); }), 'exporter').toBeLessThanOrEqual(BUDGET);
		expect(await compter(async () => { expect((await poster(apercuPlanning, texte)).status).toBe(200); }), 'aperçu').toBeLessThanOrEqual(BUDGET);
		expect(await compter(async () => { expect((await poster(appliquerPlanning, texte)).status).toBe(200); }), 'appliquer').toBeLessThanOrEqual(BUDGET);
		const [premiere] = await base.select().from(plageEte).orderBy(plageEte.debut);
		const ouverte = new URL(`${url}&plage=${premiere!.debut}`);
		const n = await compter(async () => {
			expect(await (actionsEte as any).ajuster({ locals, url: ouverte, request: await requeteFormulaire([['debut', premiere!.debut], ['personne', String(agent.id)], ['present', 'oui']]) })).toMatchObject({ succes: expect.any(String) });
			await (racine as any)({ locals });
			expect((await (pageEte as any)({ locals, url: ouverte })).ete.detail).not.toBeNull();
		});
		expect(n, 'ajuster').toBeLessThanOrEqual(BUDGET);
		const deLAgent = { ...locals, acteur: { type: 'personne' as const, id: agent.id } };
		expect(await compter(async () => { await (racine as any)({ locals: deLAgent }); await (mesVacancesPage as any)({ locals: deLAgent }); })).toBeLessThanOrEqual(BUDGET);
		expect(await compter(async () => { await (racine as any)({ locals }); await (reglagesArmement as any)({ locals, url: new URL('http://localhost/reglages/armement?engin=FPT') }); })).toBeLessThanOrEqual(BUDGET);
		expect(base.parametresMax).toBeLessThanOrEqual(100);
	});

	it('/planning et /planning/preparer : une année publiée, 20 manœuvres, 30 semaines changées ; chaque action', async () => {
		const { base, locals, agent, compter } = await centreDe150();
		const equipes = await base.select().from(equipe);
		const ids = equipes.map((e) => e.id);
		const annee = Number(maintenantParis().slice(0, 4));
		const m = maintenantParis();
		for (const a of [annee, annee + 1]) await reglerRoulement(base, locals.acteur, a, ids, m);
		await publierAnnee(base, locals.acteur, annee, m);
		const semaines = (await preparerAnnee(base, locals.acteur, annee, m, centre.astreinte)).semaines;
		// Écrites telles quelles : une année publiée refuse de changer ses semaines passées.
		await base.insert(semaineChangee).values(semaines.slice(0, 30).map((s) => ({ debut: s.debut, equipeId: ids[0]! })));
		for (let i = 0; i < 20; i++) await enregistrerManoeuvre(base, locals.acteur, { debut: `${annee + 1}-0${(i % 9) + 1}-1${i % 9}T08:30`, theme: `M${i}`, lieu: 'Caserne', convoques: 'tous', petitDejeuner: true }, m);
		await base.insert(affectationEquipe).values({ personneId: agent.id, equipeId: ids[1]!, debut: '2020-01-01' });
		const deLAgent = { ...locals, acteur: { type: 'personne' as const, id: agent.id } };
		for (const l of [locals, deLAgent]) {
			const n = await compter(async () => {
				await (racine as any)({ locals: l });
				expect((await (planning as any)({ locals: l, url: new URL('http://localhost/planning') })).planning.publiee).toBe(true);
			});
			expect(n).toBeLessThanOrEqual(BUDGET);
		}
		// L'accueil avec la carte astreinte : l'agent et le chef de centre.
		for (const l of [locals, deLAgent]) {
			const n = await compter(async () => {
				await (racine as any)({ locals: l });
				expect((await (accueil as any)({ locals: l, url: new URL('http://localhost/') })).astreinte).not.toBeNull();
			});
			expect(n, 'accueil').toBeLessThanOrEqual(BUDGET);
		}
		const url = new URL(`http://localhost/planning/preparer?annee=${annee}`);
		const page = () => (preparer as any)({ locals, url });
		expect(await compter(async () => { await (racine as any)({ locals }); await page(); })).toBeLessThanOrEqual(BUDGET);
		expect(await compter(async () => { await (racine as any)({ locals }); await (pageManoeuvre as any)({ locals, url: new URL('http://localhost/planning/preparer/manoeuvre?id=1') }); })).toBeLessThanOrEqual(BUDGET);
		// Les semaines à venir (les commencées ne changent plus) : chacune prévient deux équipes.
		const semainesForm = semaines.filter((s) => s.debut > m.slice(0, 10)).map((s): [string, string] => [`semaine-${s.debut}`, String(ids[2])]);
		for (const [nom, corps] of [['semaines', semainesForm], ['roulement', ids.map((id): [string, string] => ['ordre', String(id)])]] as const) {
			const n = await compter(async () => {
				expect(await (actionsPreparer as any)[nom]({ locals, url, request: await requeteFormulaire(corps as [string, string][]) })).toMatchObject({ succes: expect.any(String) });
				await (racine as any)({ locals });
				await page();
			});
			expect(n, nom).toBeLessThanOrEqual(BUDGET);
		}
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

	it('réservations : la liste, le calendrier, réserver puis Mes réservations, annuler ; 40 réservations déjà prises', async () => {
		const { base, locals, agent, compter } = await centreDe150();
		const [vl] = await base.select().from(ressource);
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		const bancs = await ajouterRessource(base, { type: 'super', email: 'a@b.fr' }, { nom: 'Bancs', stock: 999, icone: 'groupe', comiteId: amicale!.id }, maintenantParis());
		const jour = (n: number) => aujourdhuiParis(new Date(Date.now() + n * 864e5));
		for (let i = 0; i < 20; i++) {
			await reserver(base, { type: 'personne', id: agent.id }, vl!.id, { debut: `${jour(2 + i)}T09:00`, fin: `${jour(2 + i)}T12:00` }, maintenantParis());
			await reserver(base, { type: 'personne', id: agent.id }, bancs, { debut: jour(2 + i), fin: jour(3 + i), quantite: 2 }, maintenantParis());
		}
		const pages: [string, () => Promise<unknown>][] = [
			['/reservations', () => (reservations as any)({ locals })],
			['/reservations/[id]', () => (ressourcePage as any)({ locals, params: { id: String(bancs) }, url: new URL('http://localhost/reservations/1') })],
			['/reservations/[id]/reserver', () => (pageReserver as any)({ locals, params: { id: String(vl!.id) }, url: new URL('http://localhost/reservations/1/reserver') })],
			['/reservations/miennes', () => (miennes as any)({ locals, url: new URL('http://localhost/reservations/miennes') })]
		];
		for (const [nom, page] of pages) {
			const n = await compter(async () => {
				await (racine as any)({ locals });
				await page();
			});
			expect(n, nom).toBeLessThanOrEqual(BUDGET);
		}
		// Réserver (une demande de bancs qui sonne chez l'amicale), puis la redirection vers Mes réservations.
		const n = await compter(async () => {
			const envoi = (actionsReserver.default as any)({ locals, params: { id: String(bancs) }, request: await requeteFormulaire([['debut', jour(30)], ['fin', jour(31)], ['quantite', '3']]) });
			await expect(envoi).rejects.toMatchObject({ status: 303 });
			await (racine as any)({ locals });
			await (miennes as any)({ locals, url: new URL('http://localhost/reservations/miennes') });
		});
		expect(n, 'réserver').toBeLessThanOrEqual(BUDGET);
		const { aVenir } = await (miennes as any)({ locals, url: new URL('http://localhost/reservations/miennes') });
		const m = await compter(async () => {
			expect(await (actionsMiennes.annuler as any)({ locals, request: await requeteFormulaire([['id', String(aVenir[0].id)]]) })).toMatchObject({ succes: expect.any(String) });
			await (racine as any)({ locals });
			await (miennes as any)({ locals, url: new URL('http://localhost/reservations/miennes') });
		});
		expect(m, 'annuler').toBeLessThanOrEqual(BUDGET);

		// Le super administrateur gère tout : À valider (20 demandes de bancs), Gérer le matériel, l'accueil ; accepter une demande.
		const gestion = { ...locals, acteur: { type: 'super' as const, email: 'a@b.fr' } };
		const pagesGestion: [string, () => Promise<unknown>][] = [
			['/reservations/a-valider', () => (pageAValider as any)({ locals: gestion })],
			['/reservations/materiel', () => (pageMateriel as any)({ locals: gestion, url: new URL('http://localhost/reservations/materiel') })],
			['/', () => (accueil as any)({ locals: gestion, url: new URL('http://localhost/') })]
		];
		for (const [nom, page] of pagesGestion) {
			const k = await compter(async () => {
				await (racine as any)({ locals: gestion });
				await page();
			});
			expect(k, nom).toBeLessThanOrEqual(BUDGET);
		}
		const { demandes } = await (pageAValider as any)({ locals: gestion });
		expect(demandes.length).toBeGreaterThanOrEqual(20);
		const a = await compter(async () => {
			expect(await (actionsAValider.accepter as any)({ locals: gestion, request: await requeteFormulaire([['id', String(demandes[0].demande.id)]]) })).toMatchObject({ succes: expect.any(String) });
			await (racine as any)({ locals: gestion });
			await (pageAValider as any)({ locals: gestion });
		});
		expect(a, 'accepter').toBeLessThanOrEqual(BUDGET);
	});

	it('/remplacements : demander (150 disponibles), accepter, chaque page ; réglages des aptitudes', async () => {
		const { base, locals, agent, compter } = await centreDe150();
		const ids = (await base.select().from(equipe)).map((e) => e.id);
		const annee = Number(maintenantParis().slice(0, 4));
		for (const a of [annee, annee + 1]) {
			await reglerRoulement(base, locals.acteur, a, ids, maintenantParis());
			await publierAnnee(base, locals.acteur, a, maintenantParis());
		}
		await base.insert(affectationEquipe).values({ personneId: agent.id, equipeId: ids[0]!, debut: '2020-01-01' });
		const deLAgent = { ...locals, acteur: { type: 'personne' as const, id: agent.id } };
		const nuit = (await pourDemander(base, deLAgent.acteur, maintenantParis(), centre.astreinte)).semaines.flatMap((s) => s.tranches).find((t) => t.etat === 'libre')!;
		const demander = await compter(async () => {
			await expect((actionsDemander as any).default({ locals: deLAgent, request: new Request('http://x', { method: 'POST', body: new URLSearchParams([['periode', `${nuit.debut}|${nuit.fin}`], ['pour', 'tous']]) }) })).rejects.toMatchObject({ status: 303 });
		});
		expect(demander, 'demander').toBeLessThanOrEqual(BUDGET);
		for (const [nom, page, l, url] of [
			['demander', pageDemander, deLAgent, '/remplacements/demander'],
			['demander, à qui ?', pageDemander, deLAgent, `/remplacements/demander?p=${encodeURIComponent(`${nuit.debut}|${nuit.fin}`)}&etape=qui`],
			['manoeuvre', pageEchangeManoeuvre, deLAgent, '/remplacements/manoeuvre'],
			['liste', remplacements, locals, '/remplacements'],
			['aptitudes', reglagesAptitudes, locals, '/reglages/aptitudes']
		] as const) {
			const n = await compter(async () => {
				await (racine as any)({ locals: l });
				await (page as any)({ locals: l, url: new URL(`http://localhost${url}`) });
			});
			expect(n, nom).toBeLessThanOrEqual(BUDGET);
		}
		const { pourMoi } = await (remplacements as any)({ locals, url: new URL('http://localhost/remplacements') });
		const id = String(pourMoi[0].id);
		const accepter = await compter(async () => {
			expect(await (actionsRemplacements as any).accepter({ locals, request: new Request('http://x', { method: 'POST', body: new URLSearchParams([['id', id]]) }) })).toMatchObject({ succes: expect.any(String) });
			await (racine as any)({ locals });
			await (remplacements as any)({ locals, url: new URL('http://localhost/remplacements') });
		});
		expect(accepter, 'accepter').toBeLessThanOrEqual(BUDGET);
		const detail = await compter(async () => {
			await (racine as any)({ locals: deLAgent });
			await (demandeRemplacementPage as any)({ locals: deLAgent, params: { id }, url: new URL(`http://localhost/remplacements/${id}?envoyee`) });
		});
		expect(detail, 'détail').toBeLessThanOrEqual(BUDGET);
	});
});
