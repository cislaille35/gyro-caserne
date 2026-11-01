import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { enregistrerManoeuvre, planningDe, publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import { planningDuMatin } from '../src/planning/manoeuvres.ts';
import { agendaDe, monLienAgenda } from '../src/planning/agenda.ts';
import { enTeteDe, filDeNotifications, toutMarquerLu } from '../src/notifications.ts';
import { aNePasManquer } from '../src/a-ne-pas-manquer.ts';
import { accueilDe } from '../src/casquettes.ts';
import { changerStatut } from '../src/actions/personnes.ts';
import { remplacementsDuMoment } from '../src/remplacements/moment.ts';
import { chargerAptitudesFictives } from '../src/remplacements/fictif.ts';
import { repondreEvenement } from '../src/actions/interactions.ts';
import { bandesDe, lireContexte, disponibles, mesTranches } from '../src/remplacements/contexte.ts';
import { demandeVue, nombreRemplacementsAValider, pourDemander, remplacementsDe } from '../src/remplacements/lectures.ts';
import { accepterDemande, annulerDemande, demanderRemplacement, desister, echangerPlace, manoeuvresEchangeables, ouvrirATous, proposerEchange, proposerEchangeManoeuvre, refuserDemande, refuserValidation, valider } from '../src/remplacements/demandes.ts';
import { affectationEquipe, aptitude, aptitudeAgent, attribution, avisRemplacement, demandeRemplacement, destinataireRemplacement, envoiPush, abonnementPush, equipe, manoeuvre, personne, profil, publication, reponseEvenement, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const reglage = centreExemple.astreinte;
const maintenant = '2026-11-01T10:00';
// Semaine du vendredi 6 novembre : équipe 1 ; du 13 : équipe 2.
const nuitLundi9 = { debut: '2026-11-09T18:00', fin: '2026-11-10T06:00' };
const nuitMardi10 = { debut: '2026-11-10T18:00', fin: '2026-11-11T06:00' };
const nuitLundi16 = { debut: '2026-11-16T18:00', fin: '2026-11-17T06:00' };

// Chef de centre (sans équipe) ; équipe 1 : Alice (CA1), David, Élodie (chef d'équipe) ; Bruno (équipe 2) ; Chloé (équipe 3, CA1).
async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const ids = (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
	const roles = await base.select().from(responsabilite);
	const role = (systeme: string) => roles.find((r) => r.systeme === systeme)!.id;
	const nouvelle = async (prenom: string, equipeNo: number | null) => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning();
		if (equipeNo) await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId: ids[equipeNo - 1]!, debut: '2026-01-01' });
		return p!.id;
	};
	const nommer = (personneId: number, systeme: string, equipeId: number | null) =>
		base.insert(attribution).values({ personneId, responsabiliteId: role(systeme), perimetreType: equipeId === null ? 'centre' : 'equipe', perimetreId: equipeId, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const chef = await nouvelle('Chef', null);
	await nommer(chef, 'chef_centre', null);
	const alice = await nouvelle('Alice', 1);
	const david = await nouvelle('David', 1);
	const elodie = await nouvelle('Elodie', 1);
	await nommer(elodie, 'chef_equipe', ids[0]!);
	const bruno = await nouvelle('Bruno', 2);
	const chloe = await nouvelle('Chloe', 3);
	const apt = async (nom: string) => (await base.select().from(aptitude).where(eq(aptitude.nom, nom)))[0]!.id;
	for (const p of [alice, chloe]) await base.insert(aptitudeAgent).values({ personneId: p, aptitudeId: await apt('CA1'), obtenueLe: '2020-01-01' });
	const qui = { type: 'super', email: 'a@b.fr' } as const;
	await reglerRoulement(base, qui, 2026, ids, maintenant);
	await publierAnnee(base, qui, 2026, maintenant);
	const a = (id: number): Acteur => ({ type: 'personne', id });
	const avisDe = async (id: number) => (await base.select().from(avisRemplacement).where(eq(avisRemplacement.personneId, id))).map((x) => x.quoi);
	const demande = async (id: number) => (await base.select().from(demandeRemplacement).where(eq(demandeRemplacement.id, id)))[0]!;
	const destinataires = async (id: number) => (await base.select().from(destinataireRemplacement).where(eq(destinataireRemplacement.demandeId, id))).map((x) => x.personneId).sort();
	return { base, ids, apt, chef: a(chef), alice: a(alice), david: a(david), elodie: a(elodie), bruno: a(bruno), chloe: a(chloe), n: { chef, alice, david, elodie, bruno, chloe }, avisDe, demande, destinataires, nommer };
}

describe('demande ouverte', () => {
	it('ses tranches à venir ; les disponibles la reçoivent, ceux qui ont ses aptitudes en tête', async () => {
		const { base, n, alice, avisDe, destinataires } = await jeu();
		const ctx = await lireContexte(base, maintenant, reglage);
		const tranches = mesTranches(ctx, n.alice);
		expect(tranches[0]).toMatchObject({ semaine: '2026-11-06' });
		expect(tranches[0]!.tranches.slice(3, 5).map(({ debut, fin }) => ({ debut, fin }))).toEqual([nuitLundi9, nuitMardi10]);
		expect(disponibles(ctx, n.alice, [nuitLundi9]).map((x) => [x.prenom, x.aptitudes])).toEqual([
			['Chloe', true],
			['Bruno', false],
			['Chef', false]
		]);
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null, mot: 'Mariage' }, maintenant, reglage);
		expect(await destinataires(id)).toEqual([n.chef, n.bruno, n.chloe].sort());
		expect(await avisDe(n.bruno)).toEqual(['recue']);
		expect(await avisDe(n.david)).toEqual([]);
		// Déjà demandée : plus proposée.
		await expect(demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Période déjà dans une demande'));
	});

	it('refuse une période qui n’est pas de son astreinte, ou déjà commencée', async () => {
		const { base, alice, bruno } = await jeu();
		await expect(demanderRemplacement(base, bruno, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage)).rejects.toThrow(DonneeInvalide);
		await expect(demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, '2026-11-09T19:00', reglage)).rejects.toThrow(new DonneeInvalide('Période inconnue ou déjà commencée'));
		await expect(demanderRemplacement(base, { type: 'super', email: 'a@b.fr' }, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage)).rejects.toThrow(DonneeInvalide);
	});

	it('deux acceptations en même temps : une seule l’emporte', async () => {
		const { base, alice, bruno, chloe, n, demande, avisDe } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		const resultats = await Promise.allSettled([accepterDemande(base, bruno, id, maintenant, reglage), accepterDemande(base, chloe, id, maintenant, reglage)]);
		expect(resultats.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		expect(resultats.find((r) => r.status === 'rejected')).toMatchObject({ reason: new DonneeInvalide('Déjà prise par un collègue') });
		const d = await demande(id);
		expect([n.bruno, n.chloe]).toContain(d.remplacantId);
		expect(await avisDe(n.alice)).toEqual(['acceptee']);
	});

	it('remplaçant qui a les aptitudes : conclue, le chef d’équipe est informé', async () => {
		const { base, alice, chloe, n, demande, avisDe } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		expect(await accepterDemande(base, chloe, id, maintenant, reglage)).toBe('conclue');
		expect(await demande(id)).toMatchObject({ etat: 'conclue', remplacantId: n.chloe, manque: null });
		expect(await avisDe(n.elodie)).toEqual(['informe']);
		// Plus disponible : elle remplace déjà cette nuit-là.
		const ctx = await lireContexte(base, maintenant, reglage);
		expect(disponibles(ctx, n.david, [nuitLundi9]).map((x) => x.id)).not.toContain(n.chloe);
	});

	it('aptitude contrôlée manquante : à valider par le chef d’équipe ; refusé, la demande repart sans ce remplaçant', async () => {
		const { base, alice, bruno, chloe, elodie, david, n, demande, avisDe } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		expect(await accepterDemande(base, bruno, id, maintenant, reglage)).toBe('a_valider');
		expect(await demande(id)).toMatchObject({ etat: 'a_valider', manque: '["CA1"]' });
		expect(await avisDe(n.elodie)).toEqual(['a_valider']);
		await expect(valider(base, david, id, maintenant, reglage)).rejects.toThrow(RefusDroit);
		await refuserValidation(base, elodie, id, 'Pas de CA1 cette nuit-là', maintenant, reglage);
		expect(await demande(id)).toMatchObject({ etat: 'attente', remplacantId: null, motif: 'Pas de CA1 cette nuit-là' });
		expect(await avisDe(n.bruno)).toEqual(['recue', 'refus_chef']);
		await expect(accepterDemande(base, bruno, id, maintenant, reglage)).rejects.toThrow(RefusDroit);
		expect(await accepterDemande(base, chloe, id, maintenant, reglage)).toBe('conclue');
	});

	it('validée par le chef : conclue, les deux prévenus', async () => {
		const { base, alice, bruno, elodie, n, demande, avisDe } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, bruno, id, maintenant, reglage);
		await valider(base, elodie, id, maintenant, reglage);
		expect((await demande(id)).etat).toBe('conclue');
		expect(await avisDe(n.alice)).toEqual(['acceptee', 'validee']);
		expect(await avisDe(n.bruno)).toEqual(['recue', 'validee']);
		// Commencée : plus validable.
		const autre = await demanderRemplacement(base, alice, { periodes: [nuitMardi10], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, bruno, autre, maintenant, reglage);
		await expect(valider(base, elodie, autre, '2026-11-10T18:30', reglage)).rejects.toThrow(new DonneeInvalide('Période déjà commencée'));
	});

	it('demandeur chef de son équipe : le chef de centre valide', async () => {
		const { base, elodie, bruno, chef, apt, n, avisDe } = await jeu();
		await base.insert(aptitudeAgent).values({ personneId: n.elodie, aptitudeId: await apt('CA2'), obtenueLe: '2020-01-01' });
		const id = await demanderRemplacement(base, elodie, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, bruno, id, maintenant, reglage);
		expect(await avisDe(n.chef)).toEqual(['recue', 'a_valider']);
		expect((await enTeteDe(base, chef, '2026-11-01', maintenant)).remplacementsAValider).toBe(1);
		expect((await enTeteDe(base, elodie, '2026-11-01', maintenant)).remplacementsAValider).toBe(0);
		await valider(base, chef, id, maintenant, reglage);
		expect((await enTeteDe(base, chef, '2026-11-01', maintenant)).remplacementsAValider).toBe(0);
	});

	it('désistement : le titulaire redevient responsable, prévenu, la demande repart', async () => {
		const { base, alice, chloe, n, demande, avisDe, destinataires } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, chloe, id, maintenant, reglage);
		await expect(annulerDemande(base, alice, id, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Déjà acceptée : demandez au remplaçant de se désister'));
		await desister(base, chloe, id, maintenant, reglage);
		expect(await demande(id)).toMatchObject({ etat: 'attente', remplacantId: null, motif: 'Désistement' });
		expect(await avisDe(n.alice)).toEqual(['acceptee', 'desistement']);
		expect(await destinataires(id)).toContain(n.chloe);
		await annulerDemande(base, alice, id, maintenant, reglage);
		expect((await demande(id)).etat).toBe('annulee');
	});
});

describe('demande ciblée', () => {
	it('seul le collègue la reçoit ; refusée, le demandeur l’ouvre à tous', async () => {
		const { base, alice, bruno, chloe, n, demande, avisDe, destinataires } = await jeu();
		await expect(demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: n.david }, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Collègue indisponible sur ces périodes'));
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: n.bruno }, maintenant, reglage);
		expect(await destinataires(id)).toEqual([n.bruno]);
		await expect(accepterDemande(base, chloe, id, maintenant, reglage)).rejects.toThrow(RefusDroit);
		await refuserDemande(base, bruno, id, maintenant, reglage);
		expect((await demande(id)).etat).toBe('refusee');
		expect(await avisDe(n.alice)).toEqual(['refusee']);
		await ouvrirATous(base, alice, id, maintenant, reglage);
		expect(await demande(id)).toMatchObject({ etat: 'attente', cibleId: null });
		expect(await destinataires(id)).toEqual([n.chef, n.bruno, n.chloe].sort());
		expect(await avisDe(n.chloe)).toEqual(['recue']);
		// Bruno a déjà refusé : il ne la revoit pas.
		await expect(accepterDemande(base, bruno, id, maintenant, reglage)).rejects.toThrow(RefusDroit);
		expect(await accepterDemande(base, chloe, id, maintenant, reglage)).toBe('conclue');
	});

	it('un envoi au téléphone pour chaque avis, si la personne a un appareil', async () => {
		const { base, alice, n } = await jeu();
		await base.insert(abonnementPush).values({ personneId: n.bruno, endpoint: 'https://fcm.googleapis.com/x', p256dh: 'a', auth: 'b', appareil: 'Tél', creeLe: maintenant });
		await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: n.bruno }, maintenant, reglage);
		const [envoi] = await base.select().from(envoiPush);
		expect(JSON.parse(envoi!.donnees)).toMatchObject({ titre: 'Demande de remplacement', texte: 'Alice Test · nuit du lundi 9 novembre', url: '/remplacements?onglet=pour-moi' });
	});
});

describe('échange de périodes', () => {
	it('chacun prend la période de l’autre ; aptitude manquante dans un sens : à valider', async () => {
		const { base, alice, bruno, n, demande, avisDe } = await jeu();
		const id = await proposerEchange(base, alice, { periodes: [nuitLundi9], cibleId: n.bruno, periodesCible: [nuitLundi16] }, maintenant, reglage);
		expect(await avisDe(n.bruno)).toEqual(['recue']);
		expect(await accepterDemande(base, bruno, id, maintenant, reglage)).toBe('a_valider');
		expect(await demande(id)).toMatchObject({ genre: 'echange', remplacantId: n.bruno, manque: '["CA1"]', debut: nuitLundi9.debut });
		// Engagés : ni l'un ni l'autre n'est plus disponible sur ces nuits.
		const ctx = await lireContexte(base, maintenant, reglage);
		expect(disponibles(ctx, n.chloe, [nuitLundi16]).map((x) => x.id)).not.toContain(n.alice);
	});

	it('refuse des périodes qui ne sont pas de l’astreinte du collègue', async () => {
		const { base, alice, n } = await jeu();
		await expect(proposerEchange(base, alice, { periodes: [nuitLundi9], cibleId: n.bruno, periodesCible: [nuitMardi10] }, maintenant, reglage)).rejects.toThrow(DonneeInvalide);
	});
});

describe('valideurs', () => {
	it('équipe sans chef : le chef de centre est informé, pas le chef d’une autre équipe', async () => {
		const { base, bruno, chloe, n, avisDe } = await jeu();
		const id = await demanderRemplacement(base, bruno, { periodes: [nuitLundi16], cibleId: null }, maintenant, reglage);
		expect(await accepterDemande(base, chloe, id, maintenant, reglage)).toBe('conclue');
		expect(await avisDe(n.chef)).toEqual(['recue', 'informe']);
		expect((await base.select().from(avisRemplacement).where(and(eq(avisRemplacement.personneId, n.elodie), eq(avisRemplacement.demandeId, id)))).map((x) => x.quoi)).toEqual(['recue']);
	});
});

describe('lectures', () => {
	it('Pour moi, Mes demandes, À valider, historique ; le détail montre les disponibles au demandeur', async () => {
		const { base, alice, bruno, chloe, elodie, david, n } = await jeu();
		const ouverte = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		const annulee = await demanderRemplacement(base, alice, { periodes: [nuitMardi10], cibleId: null }, maintenant, reglage);
		await annulerDemande(base, alice, annulee, maintenant, reglage);
		const pourBruno = await remplacementsDe(base, bruno, maintenant, reglage);
		expect(pourBruno.pourMoi.map((v) => [v.id, v.texte, v.manquePourMoi, v.gestes.accepter])).toEqual([[ouverte, 'nuit du lundi 9 novembre', ['CA1'], true]]);
		expect((await remplacementsDe(base, chloe, maintenant, reglage)).pourMoi[0]!.manquePourMoi).toEqual([]);
		expect((await remplacementsDe(base, david, maintenant, reglage)).pourMoi).toEqual([]);
		const pourAlice = await remplacementsDe(base, alice, maintenant, reglage);
		expect(pourAlice.miennes.map((v) => [v.id, v.etat, v.gestes.annuler])).toEqual([[ouverte, 'attente', true]]);
		expect(pourAlice.historique.map((v) => [v.id, v.etat])).toEqual([[annulee, 'annulee']]);
		const detail = await demandeVue(base, alice, ouverte, maintenant, reglage);
		expect(detail.disponibles.map((x) => x.prenom)).toEqual(['Chloe', 'Bruno', 'Chef']);
		expect(detail.recue).toBe(3);
		expect(detail.valideurs.map((x) => x.prenom)).toEqual(['Elodie']);
		await expect(demandeVue(base, david, ouverte, maintenant, reglage)).rejects.toThrow(RefusDroit);

		await accepterDemande(base, bruno, ouverte, maintenant, reglage);
		const pourElodie = await remplacementsDe(base, elodie, maintenant, reglage);
		expect(pourElodie.aValider.map((v) => [v.id, v.manque, v.gestes.valider])).toEqual([[ouverte, ['CA1'], true]]);
		expect(await nombreRemplacementsAValider(base, elodie, maintenant)).toBe(1);
		expect(await nombreRemplacementsAValider(base, bruno, maintenant)).toBe(0);
		// La cloche compte en SQL, avec la même règle.
		expect((await enTeteDe(base, elodie, '2026-11-01', maintenant)).remplacementsAValider).toBe(1);
		expect((await enTeteDe(base, bruno, '2026-11-01', maintenant)).remplacementsAValider).toBe(0);
		expect((await filDeNotifications(base, elodie, maintenant)).remplacementsAValider).toBe(1);
		expect((await remplacementsDe(base, bruno, maintenant, reglage)).miennes.map((v) => [v.moi, v.gestes.desister])).toEqual([['remplacant', true]]);
		void n;
	});
});

describe('échange de manœuvre', () => {
	async function avecManoeuvres() {
		const j = await jeu();
		const qui = { type: 'super', email: 'a@b.fr' } as const;
		const m1 = await enregistrerManoeuvre(j.base, qui, { debut: '2026-11-08T08:30', theme: 'Secourisme', lieu: 'Caserne', convoques: [j.ids[0]!], petitDejeuner: false }, maintenant);
		const m2 = await enregistrerManoeuvre(j.base, qui, { debut: '2026-11-15T08:30', theme: 'Incendie', lieu: 'Caserne', convoques: [j.ids[1]!], petitDejeuner: false }, maintenant);
		const tous = await enregistrerManoeuvre(j.base, qui, { debut: '2026-11-22T08:30', theme: 'Sainte Barbe', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, maintenant);
		// La première est déjà annoncée sur « Le centre », Alice a répondu absente.
		await planningDuMatin(j.base, '2026-11-01T08:00');
		const [pub] = await j.base.select().from(manoeuvre).where(eq(manoeuvre.id, m1));
		await repondreEvenement(j.base, j.alice, pub!.publicationId!, 'absent', maintenant);
		return { ...j, qui, m1, m2, tous, pub1: pub!.publicationId! };
	}

	it('accepté : chacun convoqué à la place de l’autre, publication et réponses suivent, le chef est informé', async () => {
		const { base, alice, bruno, n, m1, m2, pub1, avisDe, demande } = await avecManoeuvres();
		const choix = await manoeuvresEchangeables(base, alice, maintenant, reglage);
		expect(choix.miennes.map((m) => m.id)).toEqual([m1]);
		expect(choix.collegues.find((c) => c.id === n.bruno)?.manoeuvres.map((m) => m.id)).toEqual([m2]);
		const id = await proposerEchangeManoeuvre(base, alice, { manoeuvreId: m1, cibleId: n.bruno, manoeuvreCibleId: m2 }, maintenant, reglage);
		expect(await accepterDemande(base, bruno, id, maintenant, reglage)).toBe('conclue');
		expect(await demande(id)).toMatchObject({ etat: 'conclue', remplacantId: n.bruno });
		const [p] = await base.select().from(publication).where(eq(publication.id, pub1));
		expect(JSON.parse(p!.convoques!)).toEqual({ equipes: [expect.any(Number)], ajoutes: [n.bruno], retires: [n.alice] });
		expect((await base.select().from(reponseEvenement).where(eq(reponseEvenement.publicationId, pub1))).map((r) => [r.personneId, r.reponse])).toEqual([[n.bruno, 'present']]);
		expect(await avisDe(n.elodie)).toEqual(['informe']);
		const planning = await planningDe(base, alice, 2026, maintenant, reglage);
		expect(planning.publiee && planning.prochaine.manoeuvre?.id).toBe(m2);
		const deBruno = await planningDe(base, bruno, 2026, maintenant, reglage);
		expect(deBruno.publiee && deBruno.prochaine.manoeuvre?.id).toBe(m1);
		await expect(annulerDemande(base, { type: 'personne', id: n.elodie }, id, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Un échange de manœuvre conclu ne s’annule pas'));
	});

	it('modifiée par le chef, la manœuvre garde l’échange ; passée à « tout le centre », il tombe', async () => {
		const { base, alice, bruno, n, m1, m2, qui } = await avecManoeuvres();
		const id = await proposerEchangeManoeuvre(base, alice, { manoeuvreId: m1, cibleId: n.bruno, manoeuvreCibleId: m2 }, maintenant, reglage);
		await accepterDemande(base, bruno, id, maintenant, reglage);
		const [e1, e3] = [(await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id)[0]!, (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id)[2]!];
		await enregistrerManoeuvre(base, qui, { id: m1, debut: '2026-11-08T08:30', theme: 'Secourisme', lieu: 'Caserne', convoques: [e1, e3], petitDejeuner: false }, maintenant);
		expect(JSON.parse((await base.select().from(manoeuvre).where(eq(manoeuvre.id, m1)))[0]!.convoques)).toEqual({ equipes: [e1, e3], ajoutes: [n.bruno], retires: [n.alice] });
		await enregistrerManoeuvre(base, qui, { id: m1, debut: '2026-11-08T08:30', theme: 'Secourisme', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, maintenant);
		expect(JSON.parse((await base.select().from(manoeuvre).where(eq(manoeuvre.id, m1)))[0]!.convoques)).toBe('tous');
	});

	it('refusé si une manœuvre convoque tout le centre, ou si l’un n’est pas convoqué', async () => {
		const { base, alice, n, m1, m2, tous } = await avecManoeuvres();
		await expect(proposerEchangeManoeuvre(base, alice, { manoeuvreId: m1, cibleId: n.bruno, manoeuvreCibleId: tous }, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Une manœuvre de tout le centre ne s’échange pas'));
		await expect(proposerEchangeManoeuvre(base, alice, { manoeuvreId: m2, cibleId: n.bruno, manoeuvreCibleId: m1 }, maintenant, reglage)).rejects.toThrow(DonneeInvalide);
		await expect(proposerEchangeManoeuvre(base, alice, { manoeuvreId: m1, cibleId: n.david, manoeuvreCibleId: m2 }, maintenant, reglage)).rejects.toThrow(DonneeInvalide);
	});

	it('départ du demandeur : un échange de manœuvre conclu reste tel quel, sans avis', async () => {
		const { base, alice, bruno, chef, n, m1, m2, demande, avisDe } = await avecManoeuvres();
		const id = await proposerEchangeManoeuvre(base, alice, { manoeuvreId: m1, cibleId: n.bruno, manoeuvreCibleId: m2 }, maintenant, reglage);
		await accepterDemande(base, bruno, id, maintenant, reglage);
		await changerStatut(base, base.photos, chef, n.alice, 'parti', maintenant);
		expect((await demande(id)).etat).toBe('conclue');
		expect(await avisDe(n.bruno)).toEqual(['recue']);
	});

	it('echangerPlace : un retour en arrière efface les exceptions', () => {
		const une = echangerPlace([1], 10, 20);
		expect(une).toEqual({ equipes: [1], ajoutes: [20], retires: [10] });
		expect(echangerPlace(une, 20, 10)).toEqual({ equipes: [1], ajoutes: [], retires: [] });
	});
});

describe('effets d’un remplacement conclu', () => {
	it('planning : « X remplace Y » sur la période ; agenda : la nuit passe du titulaire au remplaçant', async () => {
		const { base, alice, chloe, bruno } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, chloe, id, maintenant, reglage);
		const vu = (p: Awaited<ReturnType<typeof planningDe>>) => (p.publiee ? p.remplacements : []);
		expect(vu(await planningDe(base, alice, 2026, maintenant, reglage))).toEqual([{ ...nuitLundi9, titulaire: 'Alice Test', remplacant: 'Chloe Test', moi: 'cede' }]);
		expect(vu(await planningDe(base, chloe, 2026, maintenant, reglage))[0]!.moi).toBe('prend');
		expect(vu(await planningDe(base, bruno, 2026, maintenant, reglage))[0]!.moi).toBeNull();

		const agenda = async (qui: Acteur) => (await agendaDe(base, await monLienAgenda(base, qui, maintenant), maintenant, reglage))!;
		const deAlice = await agenda(alice);
		expect(deAlice).toContain('DTSTART:20261110T170000Z');
		expect(deAlice).toContain('DTEND:20261109T050000Z');
		expect(deAlice).not.toContain('DTSTART:20261109T170000Z');
		const deChloe = await agenda(chloe);
		expect(deChloe).toContain('SUMMARY:Remplacement de Alice Test');
		expect(deChloe).toContain('DTSTART:20261109T170000Z');
	});
});

describe('cloche, accueil, tâche planifiée, départ', () => {
	it('la cloche dit l’avis ; le chef compte la demande à valider jusqu’à sa décision ; À décider de sa casquette', async () => {
		const { base, alice, bruno, elodie, n } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		const fil = await filDeNotifications(base, bruno, maintenant);
		expect(fil.nonLues).toBe(1);
		expect(fil.lignes[0]).toMatchObject({ type: 'remplacement', demandeId: id, quoi: 'recue', titre: 'Demande de remplacement', texte: 'Alice Test · nuit du lundi 9 novembre', lue: false });
		expect((await aNePasManquer(base, bruno, '2026-11-01', maintenant)).remplacements).toEqual([{ id, titre: 'Alice Test cherche un remplaçant', sous: 'nuit du lundi 9 novembre', debut: nuitLundi9.debut }]);
		await accepterDemande(base, bruno, id, maintenant, reglage);
		expect((await aNePasManquer(base, bruno, '2026-11-01', maintenant)).remplacements).toEqual([]);
		const accueil = await accueilDe(base, elodie, null, '2026-11-01', maintenant);
		expect(accueil.choisie).toBe(`equipe:${(await base.select().from(equipe).orderBy(equipe.ordreRotation))[0]!.id}`);
		expect(accueil.contenu).toEqual({ type: 'equipe', aDecider: [{ texte: 'Remplacement à valider · Alice Test · nuit du lundi 9 novembre', lien: `/remplacements/${id}` }] });
		await valider(base, elodie, id, maintenant, reglage);
		expect((await accueilDe(base, elodie, null, '2026-11-01', maintenant)).contenu).toEqual({ type: 'equipe', aDecider: [] });
		await toutMarquerLu(base, bruno, maintenant);
		expect((await filDeNotifications(base, bruno, maintenant)).nonLues).toBe(0);
		void n;
	});

	it('expire au début de la période, prévenue une fois ; relancée une fois la veille', async () => {
		const { base, alice, n, demande, avisDe } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		expect(await remplacementsDuMoment(base, '2026-11-08T07:50')).toEqual({ expirees: 0, relances: 0 });
		expect(await remplacementsDuMoment(base, '2026-11-08T08:00')).toEqual({ expirees: 0, relances: 1 });
		expect(await remplacementsDuMoment(base, '2026-11-08T08:10')).toEqual({ expirees: 0, relances: 0 });
		expect(await avisDe(n.alice)).toEqual(['relance']);
		expect(await avisDe(n.elodie)).toEqual(['relance']);
		expect(await remplacementsDuMoment(base, '2026-11-09T18:00')).toEqual({ expirees: 1, relances: 0 });
		expect(await remplacementsDuMoment(base, '2026-11-09T18:10')).toEqual({ expirees: 0, relances: 0 });
		expect((await demande(id)).etat).toBe('expiree');
		expect(await avisDe(n.alice)).toEqual(['relance', 'expiree']);
	});

	it('départ : ses demandes sont annulées ; celles où il remplaçait repartent', async () => {
		const { base, alice, chloe, n, demande, chef } = await jeu();
		const ouverte = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, chloe, ouverte, maintenant, reglage);
		const sienne = await demanderRemplacement(base, chloe, { periodes: [{ debut: '2026-11-23T18:00', fin: '2026-11-24T06:00' }], cibleId: null }, maintenant, reglage);
		await changerStatut(base, base.photos, chef, n.chloe, 'parti', maintenant);
		expect(await demande(ouverte)).toMatchObject({ etat: 'attente', remplacantId: null });
		expect((await demande(sienne)).etat).toBe('annulee');
	});
});

describe('données fictives', () => {
	it('des aptitudes par prénom ; relançable sans doublon', async () => {
		const { base, n } = await jeu();
		await chargerAptitudesFictives(base, maintenant);
		await chargerAptitudesFictives(base, maintenant);
		const siennes = await base.select().from(aptitudeAgent).where(eq(aptitudeAgent.personneId, n.alice));
		expect(siennes).toHaveLength(3);
	});
});

describe('retours de revue', () => {
	it('un échange ne peut pas reprendre une période déjà cédée', async () => {
		const { base, alice, bruno, chloe, n } = await jeu();
		const echange = await proposerEchange(base, alice, { periodes: [nuitLundi9], cibleId: n.bruno, periodesCible: [nuitLundi16] }, maintenant, reglage);
		const cession = await demanderRemplacement(base, bruno, { periodes: [nuitLundi16], cibleId: n.chloe }, maintenant, reglage);
		await accepterDemande(base, chloe, cession, maintenant, reglage);
		await expect(accepterDemande(base, bruno, echange, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Échange impossible : l’un de vous n’est plus libre'));
	});

	it('un chef ne valide pas le remplacement qu’il tient lui-même', async () => {
		const { base, alice, chef, n, avisDe, nommer, ids } = await jeu();
		// Le chef de centre (sans équipe) remplace Alice ; l'équipe 1 perd son chef : c'est l'adjoint qui valide.
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await base.delete(attribution).where(eq(attribution.personneId, n.elodie));
		const [adjoint] = await base.insert(personne).values({ email: 'adjoint@exemple.fr', prenom: 'Adjoint', nom: 'Test' }).returning();
		await nommer(adjoint!.id, 'chef_centre_adjoint', null);
		expect(await accepterDemande(base, chef, id, maintenant, reglage)).toBe('a_valider');
		await expect(valider(base, chef, id, maintenant, reglage)).rejects.toThrow(RefusDroit);
		expect((await enTeteDe(base, chef, '2026-11-01', maintenant)).remplacementsAValider).toBe(0);
		expect((await enTeteDe(base, { type: 'personne', id: adjoint!.id }, '2026-11-01', maintenant)).remplacementsAValider).toBe(1);
		expect(await avisDe(adjoint!.id)).toEqual(['a_valider']);
		void ids;
	});

	it('désistement : la demande ouverte est renvoyée aux destinataires encore disponibles', async () => {
		const { base, alice, chloe, n, avisDe } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, chloe, id, maintenant, reglage);
		await desister(base, chloe, id, maintenant, reglage);
		expect(await avisDe(n.bruno)).toEqual(['recue', 'recue']);
		expect(await avisDe(n.chloe)).toEqual(['recue']);
	});

	it('après acceptation, un destinataire qui ne l’a pas prise ne voit plus la demande', async () => {
		const { base, alice, bruno, chloe } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await demandeVue(base, bruno, id, maintenant, reglage);
		await accepterDemande(base, chloe, id, maintenant, reglage);
		await expect(demandeVue(base, bruno, id, maintenant, reglage)).rejects.toThrow(RefusDroit);
	});

	it('annulée par le demandeur, la cible est prévenue ; annulée par le chef, le remplaçant et le demandeur le sont', async () => {
		const { base, alice, chloe, elodie, n, avisDe } = await jeu();
		const ciblee = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: n.bruno }, maintenant, reglage);
		await annulerDemande(base, alice, ciblee, maintenant, reglage);
		expect(await avisDe(n.bruno)).toEqual(['recue', 'annulee']);
		const ouverte = await demanderRemplacement(base, alice, { periodes: [nuitMardi10], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, chloe, ouverte, maintenant, reglage);
		await annulerDemande(base, elodie, ouverte, maintenant, reglage);
		expect(await avisDe(n.chloe)).toContain('annulee');
		expect(await avisDe(n.alice)).toContain('annulee');
	});

	it('refus du chef après le début : refusé ; expiration d’une demande à valider : remplaçant et chef prévenus', async () => {
		const { base, alice, bruno, elodie, n, avisDe } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, bruno, id, maintenant, reglage);
		await expect(refuserValidation(base, elodie, id, null, '2026-11-09T18:30', reglage)).rejects.toThrow(new DonneeInvalide('Période déjà commencée'));
		await remplacementsDuMoment(base, '2026-11-09T18:00');
		expect(await avisDe(n.bruno)).toContain('expiree');
		expect(await avisDe(n.elodie)).toEqual(['a_valider', 'expiree']);
	});

	it('pas de relance pour un échange', async () => {
		const { base, alice, n } = await jeu();
		await proposerEchange(base, alice, { periodes: [nuitLundi9], cibleId: n.bruno, periodesCible: [nuitLundi16] }, maintenant, reglage);
		expect(await remplacementsDuMoment(base, '2026-11-08T08:00')).toEqual({ expirees: 0, relances: 0 });
	});

	it('départ du remplaçant : le titulaire est prévenu ; départ du demandeur : le remplaçant l’est', async () => {
		const { base, alice, bruno, chloe, chef, n, avisDe } = await jeu();
		const a = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, chloe, a, maintenant, reglage);
		const b = await demanderRemplacement(base, bruno, { periodes: [nuitLundi16], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, chloe, b, maintenant, reglage);
		await changerStatut(base, base.photos, chef, n.chloe, 'parti', maintenant);
		expect(await avisDe(n.alice)).toEqual(['acceptee', 'recue', 'desistement']);
		const c = await demanderRemplacement(base, bruno, { periodes: [{ debut: '2026-11-17T18:00', fin: '2026-11-18T06:00' }], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, alice, c, maintenant, reglage);
		await changerStatut(base, base.photos, chef, n.bruno, 'parti', maintenant);
		expect(await avisDe(n.alice)).toContain('annulee');
	});
});

describe('retours de revue, second passage', () => {
	it('refus du chef : la demande ouverte est renvoyée aux autres disponibles', async () => {
		const { base, alice, bruno, elodie, n, avisDe } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, bruno, id, maintenant, reglage);
		await refuserValidation(base, elodie, id, null, maintenant, reglage);
		expect(await avisDe(n.chloe)).toEqual(['recue', 'recue']);
		expect(await avisDe(n.bruno)).toEqual(['recue', 'refus_chef']);
	});

	it('accepter demande le droit de demander un remplacement', async () => {
		const { base, alice, n } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: n.bruno }, maintenant, reglage);
		await base.update(personne).set({ profilId: null }).where(eq(personne.id, n.bruno));
		await expect(accepterDemande(base, { type: 'personne', id: n.bruno }, id, maintenant, reglage)).rejects.toThrow(RefusDroit);
	});

	it('départ du demandeur : la cible d’une demande en attente est prévenue', async () => {
		const { base, alice, chef, n, avisDe, demande } = await jeu();
		const id = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: n.bruno }, maintenant, reglage);
		await changerStatut(base, base.photos, chef, n.alice, 'parti', maintenant);
		expect((await demande(id)).etat).toBe('annulee');
		expect(await avisDe(n.bruno)).toEqual(['recue', 'annulee']);
	});
});

describe('parcours guidé', () => {
	it('la semaine entière, même les nuits passées ou déjà demandées, avec leur état', async () => {
		const { base, alice, n } = await jeu();
		await demanderRemplacement(base, alice, { periodes: [nuitMardi10], cibleId: null }, maintenant, reglage);
		const ctx = await lireContexte(base, '2026-11-09T20:00', reglage);
		const [semaine] = bandesDe(ctx, n.alice);
		expect(semaine!.semaine).toBe('2026-11-06');
		expect(semaine!.tranches.map((t) => [t.debut.slice(0, 10), t.etat])).toEqual([
			['2026-11-06', 'passee'],
			['2026-11-07', 'passee'],
			['2026-11-08', 'passee'],
			['2026-11-09', 'passee'],
			['2026-11-10', 'prise'],
			['2026-11-11', 'libre'],
			['2026-11-12', 'libre']
		]);
	});

	it('les collègues libres sur les périodes choisies : équipe, aptitudes, ce qui manque ; seulement des périodes à soi', async () => {
		const { base, alice, ids } = await jeu();
		const lu = await pourDemander(base, alice, maintenant, reglage, { periodes: [nuitLundi9, { debut: '2026-11-20T18:00', fin: '2026-11-21T06:00' }] });
		expect(lu.choisies).toEqual([nuitLundi9]);
		expect(lu.candidats.map((c) => [c.prenom, c.equipe?.id ?? null, c.aptitudes, c.manque])).toEqual([
			['Chloe', ids[2], ['CA1'], []],
			['Bruno', ids[1], [], ['CA1']],
			['Chef', null, [], ['CA1']]
		]);
		expect((await pourDemander(base, alice, maintenant, reglage)).candidats).toEqual([]);
	});

	it('échange : les collègues qui ont une période à donner, et ses périodes vues par moi', async () => {
		const { base, alice, n } = await jeu();
		const lu = await pourDemander(base, alice, maintenant, reglage, { periodes: [nuitLundi9], avec: n.bruno });
		expect(lu.echangeables.map((c) => c.prenom)).toEqual(['Chloe', 'Bruno']);
		expect(lu.avec?.prenom).toBe('Bruno');
		expect(lu.semainesAvec[0]!.semaine).toBe('2026-11-13');
		expect(lu.semainesAvec[0]!.tranches.every((t) => t.etat === 'libre')).toBe(true);
	});
});
