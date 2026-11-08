import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { accueilDe } from '../src/casquettes.ts';
import type { Acteur } from '../src/droits.ts';
import { chargerHabillementFictif, demanderTenue, effacerVieillesDemandes, gesteHabillement, gestesHabillement, habillementADecider, lireDemande, mesDemandes, toutesLesDemandes, type EtatDemandeHabillement } from '../src/habillement.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { enTeteDe, filDeNotifications, marquerLue } from '../src/notifications.ts';
import { abonnementPush, attribution, avisHabillement, demandeHabillement, envoiPush, filHabillement, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const QUAND = '2026-11-08T10:00';
const PLUS_TARD = '2026-11-08T11:00';
const AUJOURDHUI = '2026-11-08';
const reglage = centreExemple.astreinte;

// Le jeu de départ, Alice et Bob (agents), Rémi (référent habillement), Claire (cheffe de centre), un extérieur et le super administrateur.
async function jeu({ referent = true } = {}) {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = Object.fromEntries((await base.select().from(profil)).map((p) => [p.nom, p.id]));
	const nouvelle = async (prenom: string, nomProfil = 'Agent') => (await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Fictif', profilId: profils[nomProfil]! }).returning())[0]!.id;
	const role = async (nom: string) => (await base.select().from(responsabilite).where(eq(responsabilite.nom, nom)))[0]!.id;
	const nommer = async (personneId: number, nom: string, fin: string | null = null) =>
		base.insert(attribution).values({ personneId, responsabiliteId: await role(nom), perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', fin, saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const qui = (id: number): Acteur => ({ type: 'personne', id });
	const alice = await nouvelle('Alice');
	const bob = await nouvelle('Bob');
	const remi = await nouvelle('Rémi');
	const claire = await nouvelle('Claire');
	const exterieur = await nouvelle('Estelle', 'Réserve citoyenne');
	if (referent) await nommer(remi, 'Référent habillement');
	await nommer(claire, 'Chef de centre');
	const avis = async (id: number) => base.select().from(avisHabillement).where(eq(avisHabillement.personneId, id)).orderBy(avisHabillement.id);
	const demande = async (id: number) => (await base.select().from(demandeHabillement).where(eq(demandeHabillement.id, id)))[0]!;
	const geste = (acteur: number, id: number, g: Parameters<typeof gesteHabillement>[3], quand = PLUS_TARD) => gesteHabillement(base, qui(acteur), id, g, quand);
	return { base, ids: { alice, bob, remi, claire, exterieur }, alice: qui(alice), bob: qui(bob), remi: qui(remi), claire: qui(claire), exterieur: qui(exterieur), superAdmin: { type: 'super', email: 'a@b.fr' } as Acteur, nouvelle, nommer, avis, demande, geste };
}

describe('demander une tenue', () => {
	it('un texte libre ; le référent est prévenu (cloche et téléphone), ni le chef ni l’auteur', async () => {
		const j = await jeu();
		await j.base.insert(abonnementPush).values({ personneId: j.ids.remi, endpoint: 'https://fcm.googleapis.com/x', p256dh: 'p', auth: 'a', appareil: 'Téléphone', creeLe: QUAND });
		const id = await demanderTenue(j.base, j.alice, '  Veste textile en L,   la mienne est déchirée ', QUAND);
		expect(await j.demande(id)).toMatchObject({ demandeurId: j.ids.alice, texte: 'Veste textile en L, la mienne est déchirée', etape: 'demandee', issue: null, prisePar: null, creeLe: QUAND, majLe: QUAND, finLe: null });
		expect(await j.avis(j.ids.remi)).toMatchObject([{ titre: 'Nouvelle demande d’habillement', texte: 'Alice Fictif : Veste textile en L, la mienne est déchirée', url: `/habillement/${id}`, lueLe: null }]);
		expect(await j.avis(j.ids.claire)).toEqual([]);
		expect(await j.avis(j.ids.alice)).toEqual([]);
		const [envoi] = await j.base.select().from(envoiPush);
		expect(JSON.parse(envoi!.donnees)).toMatchObject({ url: `/habillement/${id}`, lue: { genre: 'habillement' } });
	});

	it('sans référent nommé (ou le sien terminé), le chef de centre reçoit les nouvelles demandes', async () => {
		const j = await jeu({ referent: false });
		await j.nommer(j.ids.remi, 'Référent habillement', '2026-10-31');
		await demanderTenue(j.base, j.alice, 'Rangers 43', QUAND);
		expect(await j.avis(j.ids.claire)).toHaveLength(1);
		expect(await j.avis(j.ids.remi)).toEqual([]);
	});

	it('refusée : vide, trop longue, pour un extérieur ou le super administrateur', async () => {
		const j = await jeu();
		await expect(demanderTenue(j.base, j.alice, '   ', QUAND)).rejects.toThrow('Demande vide');
		await expect(demanderTenue(j.base, j.alice, 'x'.repeat(501), QUAND)).rejects.toThrow('Demande trop longue');
		await expect(demanderTenue(j.base, j.exterieur, 'Veste', QUAND)).rejects.toThrow('Réservé aux agents du centre');
		await expect(demanderTenue(j.base, j.superAdmin, 'Veste', QUAND)).rejects.toThrow('Réservé aux agents du centre');
		expect(await j.base.select().from(demandeHabillement)).toEqual([]);
	});

	it('plusieurs demandes en cours pour un même agent', async () => {
		const j = await jeu();
		await demanderTenue(j.base, j.alice, 'Veste', QUAND);
		await demanderTenue(j.base, j.alice, 'Gants', QUAND);
		expect((await mesDemandes(j.base, j.alice)).enCours.map((d) => d.texte).sort()).toEqual(['Gants', 'Veste']);
	});
});

describe('gestes permis (sans base)', () => {
	const d = (etape: EtatDemandeHabillement['etape'], prisePar: number | null = null): EtatDemandeHabillement => ({ etape, demandeur: 1, prisePar });
	const agent = { moi: 1, gere: false };
	const referent = { moi: 2, gere: true };
	const collegue = { moi: 3, gere: true };

	it('demandée : le référent la prend, pose une question ou la traite ; l’agent précise ou annule', () => {
		expect(gestesHabillement(d('demandee'), referent)).toEqual(['prendre', 'question', 'traiter']);
		expect(gestesHabillement(d('demandee'), agent)).toEqual(['repondre', 'annuler']);
		expect(gestesHabillement(d('demandee'), { moi: 4, gere: false })).toEqual([]);
	});

	it('prise : celui qui l’a prise questionne ou traite, un collègue la reprend ; traitée : livrer, plus d’annulation', () => {
		expect(gestesHabillement(d('prise', 2), referent)).toEqual(['question', 'traiter']);
		expect(gestesHabillement(d('prise', 2), collegue)).toEqual(['reprendre']);
		expect(gestesHabillement(d('question', 2), referent)).toEqual(['traiter']);
		expect(gestesHabillement(d('question', 2), agent)).toEqual(['repondre', 'annuler']);
		expect(gestesHabillement(d('traitee', 2), referent)).toEqual(['livrer']);
		expect(gestesHabillement(d('traitee', 2), collegue)).toEqual(['reprendre']);
		expect(gestesHabillement(d('traitee', 2), agent)).toEqual(['repondre']);
	});

	it('finie (livrée, refusée, annulée) : plus aucun geste', () => {
		for (const etape of ['livree', 'refusee', 'annulee'] as const) {
			expect(gestesHabillement(d(etape, 2), referent)).toEqual([]);
			expect(gestesHabillement(d(etape, 2), agent)).toEqual([]);
		}
	});
});

describe('le suivi', () => {
	it('prise, question, réponse, commandée, livrée : l’agent apprend chaque étape, le référent chaque réponse ; tout est dans le fil', async () => {
		const j = await jeu();
		const id = await demanderTenue(j.base, j.alice, 'Rangers', QUAND);
		await j.geste(j.ids.remi, id, { quoi: 'prendre' });
		expect(await j.demande(id)).toMatchObject({ etape: 'prise', prisePar: j.ids.remi, majLe: PLUS_TARD });
		await j.geste(j.ids.remi, id, { quoi: 'question', texte: 'Quelle taille ?' });
		expect((await j.demande(id)).etape).toBe('question');
		await j.geste(j.ids.alice, id, { quoi: 'repondre', texte: '43' });
		expect((await j.demande(id)).etape).toBe('prise');
		await j.geste(j.ids.alice, id, { quoi: 'repondre', texte: 'Plutôt montantes' });
		await j.geste(j.ids.remi, id, { quoi: 'traiter', issue: 'commande', texte: '' });
		expect(await j.demande(id)).toMatchObject({ etape: 'traitee', issue: 'commande', finLe: null });
		await j.geste(j.ids.remi, id, { quoi: 'livrer', texte: 'Dans votre casier' });
		expect(await j.demande(id)).toMatchObject({ etape: 'livree', livraison: 'Dans votre casier', finLe: PLUS_TARD });

		expect((await j.avis(j.ids.alice)).map((a) => [a.titre, a.texte])).toEqual([
			['Demande prise en compte', 'Rémi Fictif s’en occupe : Rangers'],
			['Question sur votre demande', 'Rémi Fictif : Quelle taille ?'],
			['Demande traitée', 'Commandée au SDIS : Rangers'],
			['Tenue livrée', 'Dans votre casier : Rangers']
		]);
		expect((await j.avis(j.ids.remi)).map((a) => a.titre)).toEqual(['Nouvelle demande d’habillement', 'Réponse à votre question', 'Précision sur une demande']);
		const vue = await lireDemande(j.base, j.alice, id, PLUS_TARD);
		expect(vue.fil.map((f) => [f.quoi, f.texte, f.deLAgent])).toEqual([
			['prise', null, false],
			['question', 'Quelle taille ?', false],
			['reponse', '43', true],
			['precision', 'Plutôt montantes', true],
			['commande', null, false],
			['livraison', 'Dans votre casier', false]
		]);
		expect(vue).toMatchObject({ etape: 'livree', prisePar: 'Rémi Fictif', demandeur: 'Alice Fictif', sienne: true, gestes: [] });
	});

	it('en stock d’emblée, depuis « demandée » : la demande est prise du même coup ; refus avec un mot obligatoire', async () => {
		const j = await jeu();
		const a = await demanderTenue(j.base, j.alice, 'Gants', QUAND);
		await j.geste(j.ids.remi, a, { quoi: 'traiter', issue: 'stock', texte: '' });
		expect(await j.demande(a)).toMatchObject({ etape: 'traitee', issue: 'stock', prisePar: j.ids.remi });
		const b = await demanderTenue(j.base, j.alice, 'Veste neuve', QUAND);
		await expect(j.geste(j.ids.remi, b, { quoi: 'traiter', issue: 'refus', texte: ' ' })).rejects.toThrow('Refus sans explication');
		await j.geste(j.ids.remi, b, { quoi: 'traiter', issue: 'refus', texte: 'La vôtre a moins d’un an.' });
		expect(await j.demande(b)).toMatchObject({ etape: 'refusee', finLe: PLUS_TARD });
		expect((await j.avis(j.ids.alice)).at(-1)).toMatchObject({ titre: 'Demande refusée', texte: 'Rémi Fictif : La vôtre a moins d’un an.' });
		await expect(j.geste(j.ids.alice, b, { quoi: 'repondre', texte: 'Dommage' })).rejects.toThrow('Geste impossible');
	});

	it('livrer exige l’info de récupération ; une question exige un texte', async () => {
		const j = await jeu();
		const id = await demanderTenue(j.base, j.alice, 'Gants', QUAND);
		await expect(j.geste(j.ids.remi, id, { quoi: 'question', texte: '' })).rejects.toThrow('Message vide');
		await j.geste(j.ids.remi, id, { quoi: 'traiter', issue: 'stock', texte: '' });
		await expect(j.geste(j.ids.remi, id, { quoi: 'livrer', texte: '' })).rejects.toThrow('Récupération à préciser');
	});

	it('l’agent annule tant que ce n’est ni commandé ni sorti du stock ; qui s’en occupe est prévenu', async () => {
		const j = await jeu();
		const id = await demanderTenue(j.base, j.alice, 'Veste', QUAND);
		await j.geste(j.ids.remi, id, { quoi: 'prendre' });
		await j.geste(j.ids.alice, id, { quoi: 'annuler' });
		expect(await j.demande(id)).toMatchObject({ etape: 'annulee', finLe: PLUS_TARD });
		expect((await j.avis(j.ids.remi)).at(-1)).toMatchObject({ titre: 'Demande annulée', texte: 'Alice Fictif : Veste' });
		const autre = await demanderTenue(j.base, j.alice, 'Gants', QUAND);
		await j.geste(j.ids.remi, autre, { quoi: 'traiter', issue: 'commande', texte: '' });
		await expect(j.geste(j.ids.alice, autre, { quoi: 'annuler' })).rejects.toThrow('Geste impossible');
	});

	it('une précision avant toute prise en compte va aux référents ; une annulation à personne', async () => {
		const j = await jeu();
		const id = await demanderTenue(j.base, j.alice, 'Veste', QUAND);
		await j.geste(j.ids.alice, id, { quoi: 'repondre', texte: 'Taille L' });
		expect((await j.avis(j.ids.remi)).map((a) => a.titre)).toEqual(['Nouvelle demande d’habillement', 'Précision sur une demande']);
		await j.geste(j.ids.alice, id, { quoi: 'annuler' });
		expect(await j.avis(j.ids.remi)).toHaveLength(2);
	});

	it('sans référent, le chef agit ; la réponse de l’agent va à lui seul s’il l’a prise', async () => {
		const j = await jeu({ referent: false });
		const id = await demanderTenue(j.base, j.alice, 'Veste', QUAND);
		await j.geste(j.ids.claire, id, { quoi: 'question', texte: 'Quelle taille ?' });
		expect((await j.demande(id)).prisePar).toBe(j.ids.claire);
		await j.geste(j.ids.alice, id, { quoi: 'repondre', texte: 'L' });
		expect((await j.avis(j.ids.claire)).map((a) => a.titre)).toEqual(['Nouvelle demande d’habillement', 'Réponse à votre question']);
	});

	it('un collègue (ou le chef) reprend une demande prise ; le changement est dans le fil, l’ancien ne peut plus la traiter', async () => {
		const j = await jeu();
		const id = await demanderTenue(j.base, j.alice, 'Veste', QUAND);
		await j.geste(j.ids.remi, id, { quoi: 'prendre' });
		await j.geste(j.ids.claire, id, { quoi: 'reprendre' });
		expect((await j.demande(id)).prisePar).toBe(j.ids.claire);
		await expect(j.geste(j.ids.remi, id, { quoi: 'traiter', issue: 'stock', texte: '' })).rejects.toThrow('Geste impossible');
		expect((await lireDemande(j.base, j.claire, id, PLUS_TARD)).fil.map((f) => [f.quoi, f.par])).toEqual([
			['prise', 'Rémi Fictif'],
			['reprise', 'Claire Fictif']
		]);
	});

	it('refusé sans le droit, et pour qui ne voit pas la demande ; deux référents à la fois : un seul la prend', async () => {
		const j = await jeu();
		const id = await demanderTenue(j.base, j.alice, 'Veste', QUAND);
		await expect(j.geste(j.ids.bob, id, { quoi: 'prendre' })).rejects.toThrow('Demande inconnue');
		const hugo = await j.nouvelle('Hugo');
		await j.nommer(hugo, 'Référent habillement');
		const lu = await Promise.allSettled([j.geste(j.ids.remi, id, { quoi: 'prendre' }), j.geste(hugo, id, { quoi: 'prendre' })]);
		expect(lu.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		expect(await j.base.select().from(filHabillement)).toHaveLength(1);
		await expect(j.geste(j.ids.remi, id, { quoi: 'prendre' })).rejects.toThrow('Geste impossible');
		await expect(j.geste(j.ids.remi, 999, { quoi: 'prendre' })).rejects.toThrow('Demande inconnue');
	});
});

describe('lire les demandes', () => {
	it('une demande : l’agent qui l’a faite, qui gère ; inconnue pour un autre agent ; l’ouvrir marque lus ses avis', async () => {
		const j = await jeu();
		const id = await demanderTenue(j.base, j.alice, 'Veste', QUAND);
		await j.geste(j.ids.remi, id, { quoi: 'prendre' });
		await expect(lireDemande(j.base, j.bob, id, PLUS_TARD)).rejects.toThrow('Demande inconnue');
		expect((await lireDemande(j.base, j.claire, id, PLUS_TARD)).gestes).toEqual(['reprendre']);
		expect((await lireDemande(j.base, j.remi, id, PLUS_TARD)).gestes).toEqual(['question', 'traiter']);
		expect((await lireDemande(j.base, j.superAdmin, id, PLUS_TARD)).gestes).toEqual([]);
		expect((await enTeteDe(j.base, j.alice, AUJOURDHUI)).nonLues).toBe(1);
		await lireDemande(j.base, j.alice, id, PLUS_TARD);
		expect((await enTeteDe(j.base, j.alice, AUJOURDHUI)).nonLues).toBe(0);
	});

	it('toutes les demandes, pour qui gère : en cours (les nouvelles d’abord) puis terminées ; refusé à un agent', async () => {
		const j = await jeu();
		const a = await demanderTenue(j.base, j.alice, 'Veste', QUAND);
		const b = await demanderTenue(j.base, j.bob, 'Gants', QUAND);
		const c = await demanderTenue(j.base, j.bob, 'Casque', QUAND);
		await j.geste(j.ids.remi, a, { quoi: 'prendre' });
		await j.geste(j.ids.bob, c, { quoi: 'annuler' });
		const toutes = await toutesLesDemandes(j.base, j.remi, AUJOURDHUI);
		expect(toutes.enCours.map((d) => d.id)).toEqual([b, a]);
		expect(toutes.terminees.map((d) => [d.id, d.etape])).toEqual([[c, 'annulee']]);
		await expect(toutesLesDemandes(j.base, j.alice, AUJOURDHUI)).rejects.toThrow();
		expect((await mesDemandes(j.base, j.bob)).terminees.map((d) => d.id)).toEqual([c]);
	});

	it('la cloche : une ligne « habillement », ouverte par /notifications/ouvrir', async () => {
		const j = await jeu();
		const id = await demanderTenue(j.base, j.alice, 'Veste', QUAND);
		const fil = await filDeNotifications(j.base, j.remi, PLUS_TARD);
		expect(fil.lignes).toMatchObject([{ type: 'habillement', titre: 'Nouvelle demande d’habillement', url: `/habillement/${id}`, lue: false }]);
		expect(fil.nonLues).toBe(1);
		await marquerLue(j.base, j.remi, 'habillement', fil.lignes[0]!.id, PLUS_TARD);
		expect((await enTeteDe(j.base, j.remi, AUJOURDHUI)).nonLues).toBe(0);
	});
});

describe('À décider', () => {
	const ligne = (id: number, etape: 'demandee' | 'prise', prisePar: number | null) => ({ id, texte: 'Veste textile en L', etape, prisePar, prenom: 'Alice', nom: 'Fictif' });

	it('les nouvelles (une : son lien ; plusieurs : la liste), puis les siennes prises en compte', () => {
		expect(habillementADecider([ligne(1, 'demandee', null)], 7, true)).toEqual([{ texte: 'Demande d’habillement de Alice Fictif à prendre en compte', lien: '/habillement/1' }]);
		expect(habillementADecider([ligne(1, 'demandee', null), ligne(2, 'demandee', null), ligne(3, 'prise', 7), ligne(4, 'prise', 8)], 7, true)).toEqual([
			{ texte: '2 demandes d’habillement à prendre en compte', lien: '/habillement/toutes' },
			{ texte: 'Habillement, à traiter : Veste textile en L (Alice Fictif)', lien: '/habillement/3' }
		]);
		expect(habillementADecider([ligne(1, 'demandee', null), ligne(3, 'prise', 7)], 7, false)).toEqual([{ texte: 'Habillement, à traiter : Veste textile en L (Alice Fictif)', lien: '/habillement/3' }]);
	});

	it('dans la casquette du référent habillement ; dans « Le centre » s’il n’y en a pas', async () => {
		const j = await jeu();
		const id = await demanderTenue(j.base, j.alice, 'Veste', QUAND);
		const [r] = await j.base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent habillement'));
		const duReferent = await accueilDe(j.base, j.remi, null, AUJOURDHUI, PLUS_TARD, reglage);
		expect(duReferent.choisie).toBe(`role:${r!.id}`);
		expect(duReferent.contenu).toMatchObject({ type: 'role', permet: ['Gérer les demandes d’habillement.'], aDecider: [{ lien: `/habillement/${id}` }] });
		const duChef = await accueilDe(j.base, j.claire, 'centre', AUJOURDHUI, PLUS_TARD, reglage);
		expect(duChef.contenu.type === 'centre' && duChef.contenu.aDecider.some((a) => a.lien.startsWith('/habillement'))).toBe(false);

		const sans = await jeu({ referent: false });
		const autre = await demanderTenue(sans.base, sans.alice, 'Veste', QUAND);
		const chef = await accueilDe(sans.base, sans.claire, 'centre', AUJOURDHUI, PLUS_TARD, reglage);
		expect(chef.contenu.type === 'centre' && chef.contenu.aDecider.filter((a) => a.lien.startsWith('/habillement'))).toEqual([{ texte: 'Demande d’habillement de Alice Fictif à prendre en compte', lien: `/habillement/${autre}` }]);
	});

	it('une demande reprise par le chef arrive dans « Le centre » une fois la réponse reçue', async () => {
		const j = await jeu();
		const id = await demanderTenue(j.base, j.alice, 'Veste', QUAND);
		await j.geste(j.ids.claire, id, { quoi: 'prendre' });
		const chef = await accueilDe(j.base, j.claire, 'centre', AUJOURDHUI, PLUS_TARD, reglage);
		expect(chef.contenu.type === 'centre' && chef.contenu.aDecider.filter((a) => a.lien.startsWith('/habillement'))).toEqual([{ texte: 'Habillement, à traiter : Veste (Alice Fictif)', lien: `/habillement/${id}` }]);
	});
});

describe('conservation et données fictives', () => {
	it('efface les demandes finies avant la date, avec leur fil ; garde les autres', async () => {
		const j = await jeu();
		const vieille = await demanderTenue(j.base, j.alice, 'Veste', '2026-01-02T10:00');
		await j.geste(j.ids.remi, vieille, { quoi: 'prendre' }, '2026-01-02T11:00');
		await j.geste(j.ids.alice, vieille, { quoi: 'annuler' }, '2026-01-03T11:00');
		const enCours = await demanderTenue(j.base, j.alice, 'Gants', '2026-01-02T10:00');
		const recente = await demanderTenue(j.base, j.alice, 'Casque', QUAND);
		await j.geste(j.ids.alice, recente, { quoi: 'annuler' });
		await effacerVieillesDemandes(j.base, '2026-06-01');
		expect((await j.base.select().from(demandeHabillement).orderBy(demandeHabillement.id)).map((d) => d.id)).toEqual([enCours, recente]);
		expect((await j.base.select().from(filHabillement)).map((f) => f.demandeId)).toEqual([recente]);
	});

	it('quatre demandes à différentes étapes, relançable sans doublon', async () => {
		const j = await jeu();
		await chargerHabillementFictif(j.base, QUAND, j.ids.remi, [j.ids.alice, j.ids.bob]);
		await chargerHabillementFictif(j.base, QUAND, j.ids.remi, [j.ids.alice, j.ids.bob]);
		expect((await j.base.select().from(demandeHabillement).orderBy(demandeHabillement.id)).map((d) => d.etape)).toEqual(['demandee', 'question', 'traitee', 'livree']);
		expect(await j.base.select().from(filHabillement)).toHaveLength(7);
		expect((await lireDemande(j.base, j.bob, 2, PLUS_TARD)).gestes).toEqual(['repondre', 'annuler']);
	});
});
