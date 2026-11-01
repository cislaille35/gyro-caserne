import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import { lireContexte, disponibles, mesTranches } from '../src/remplacements/contexte.ts';
import { demandeVue, nombreRemplacementsAValider, remplacementsDe } from '../src/remplacements/lectures.ts';
import { accepterDemande, annulerDemande, demanderRemplacement, desister, ouvrirATous, proposerEchange, refuserDemande, refuserValidation, valider } from '../src/remplacements/demandes.ts';
import { affectationEquipe, aptitude, aptitudeAgent, attribution, avisRemplacement, demandeRemplacement, destinataireRemplacement, envoiPush, abonnementPush, equipe, personne, profil, responsabilite } from '../src/schema.ts';
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
		await valider(base, chef, id, maintenant, reglage);
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
		expect((await remplacementsDe(base, bruno, maintenant, reglage)).miennes.map((v) => [v.moi, v.gestes.desister])).toEqual([['remplacant', true]]);
		void n;
	});
});
