import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import { disponibles, lireContexte } from '../src/remplacements/contexte.ts';
import { accepterDemande, demanderRemplacementCourt } from '../src/remplacements/demandes.ts';
import { effectifs, requeteConclues } from '../src/remplacements/effectifs.ts';
import { abonnementPush, affectationEquipe, aptitude, aptitudeAgent, attribution, avisRemplacement, demandeRemplacement, destinataireRemplacement, envoiPush, equipe, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const reglage = centreExemple.astreinte;
// Lundi 9 novembre, 19 h 10 : Alice (équipe 1) est d'astreinte depuis 18 h, jusqu'à demain 6 h.
const maintenant = '2026-11-09T19:10';

// Chef de centre ; équipe 1 : Alice (CA1), David, Élodie (chef de garde) ; Bruno (équipe 2) ; Chloé (équipe 3, CA1).
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
		await base.insert(abonnementPush).values({ personneId: p!.id, endpoint: `https://fcm.googleapis.com/${prenom}`, p256dh: 'a', auth: 'b', creeLe: maintenant });
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
	const [ca1] = await base.select().from(aptitude).where(eq(aptitude.nom, 'CA1'));
	for (const p of [alice, chloe]) await base.insert(aptitudeAgent).values({ personneId: p, aptitudeId: ca1!.id, obtenueLe: '2020-01-01' });
	const qui = { type: 'super', email: 'a@b.fr' } as const;
	await reglerRoulement(base, qui, 2026, ids, '2026-11-01T10:00');
	await publierAnnee(base, qui, 2026, '2026-11-01T10:00');
	const a = (id: number): Acteur => ({ type: 'personne', id });
	const avisDe = async (id: number) => (await base.select().from(avisRemplacement).where(eq(avisRemplacement.personneId, id))).map((x) => x.quoi);
	const demande = async (id: number) => (await base.select().from(demandeRemplacement).where(eq(demandeRemplacement.id, id)))[0]!;
	const destinataires = async (id: number) => (await base.select().from(destinataireRemplacement).where(eq(destinataireRemplacement.demandeId, id))).map((x) => x.personneId).sort();
	// Les envois au téléphone de la personne : leur étiquette et leur texte.
	const envoisDe = async (id: number) =>
		(await base.select({ donnees: envoiPush.donnees }).from(envoiPush).innerJoin(abonnementPush, eq(abonnementPush.id, envoiPush.abonnementId)).where(eq(abonnementPush.personneId, id))).map((e) => JSON.parse(e.donnees) as { tag: string; texte: string });
	return { base, alice: a(alice), david: a(david), elodie: a(elodie), bruno: a(bruno), chloe: a(chloe), chef: a(chef), n: { chef, alice, david, elodie, bruno, chloe }, avisDe, demande, destinataires, envoisDe };
}

describe('remplacement court : demander', () => {
	it('refuse une durée autre que 2 ou 3 h, un début hors du quart d’heure ou déjà passé', async () => {
		const { base, alice } = await jeu();
		await expect(demanderRemplacementCourt(base, alice, { debut: '2026-11-09T20:00', duree: 4 as 2 }, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Durée de 2 h ou 3 h'));
		await expect(demanderRemplacementCourt(base, alice, { debut: '2026-11-09T20:10', duree: 2 }, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Début au quart d’heure'));
		await expect(demanderRemplacementCourt(base, alice, { debut: 'demain', duree: 2 }, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Début au quart d’heure'));
		await expect(demanderRemplacementCourt(base, alice, { debut: '2026-11-09T19:00', duree: 2 }, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Début déjà passé'));
	});

	it('la plage tient entière dans une astreinte du jour du demandeur', async () => {
		const { base, alice, bruno } = await jeu();
		const horsAstreinte = new DonneeInvalide('La plage doit tenir dans votre astreinte du jour');
		// Dépasse la fin, 6 h.
		await expect(demanderRemplacementCourt(base, alice, { debut: '2026-11-10T04:00', duree: 3 }, maintenant, reglage)).rejects.toThrow(horsAstreinte);
		// La nuit de demain n'est pas du jour.
		await expect(demanderRemplacementCourt(base, alice, { debut: '2026-11-10T20:00', duree: 2 }, maintenant, reglage)).rejects.toThrow(horsAstreinte);
		// Bruno n'est pas d'astreinte.
		await expect(demanderRemplacementCourt(base, bruno, { debut: '2026-11-09T20:00', duree: 2 }, maintenant, reglage)).rejects.toThrow(horsAstreinte);
		// À cheval sur deux tranches : le dimanche, la garde de 24 h finit à 6 h, la nuit suivante n'est pas la même tranche.
		await expect(demanderRemplacementCourt(base, alice, { debut: '2026-11-09T05:00', duree: 2 }, '2026-11-09T04:10', reglage)).rejects.toThrow(horsAstreinte);
	});

	it('envoyée aux disponibles, comme une demande ouverte ; la même plage ne se demande pas deux fois', async () => {
		const { base, alice, n, avisDe, demande, destinataires } = await jeu();
		const plage = { debut: '2026-11-09T20:00', fin: '2026-11-09T22:00' };
		const ctx = await lireContexte(base, maintenant, reglage);
		const attendus = disponibles(ctx, n.alice, [plage]).map((a) => a.id);
		const id = await demanderRemplacementCourt(base, alice, { debut: plage.debut, duree: 2, mot: 'Spectacle de ma fille' }, maintenant, reglage);
		expect(await demande(id)).toMatchObject({ genre: 'remplacement', court: 1, cibleId: null, periodes: JSON.stringify([plage]), debut: plage.debut, etat: 'attente', mot: 'Spectacle de ma fille' });
		expect(await destinataires(id)).toEqual([...attendus].sort());
		expect(await destinataires(id)).toEqual([n.chef, n.bruno, n.chloe].sort());
		expect(await avisDe(n.bruno)).toEqual(['recue']);
		await expect(demanderRemplacementCourt(base, alice, { debut: '2026-11-09T21:00', duree: 3 }, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Période déjà dans une demande'));
		// Une autre plage, plus tard dans la nuit : possible.
		await demanderRemplacementCourt(base, alice, { debut: '2026-11-09T23:00', duree: 3 }, maintenant, reglage);
	});
});

describe('remplacement court : accepter', () => {
	it('conclue au premier qui accepte ; le planning montre le remplaçant sur la seule plage ; le chef de garde est informé', async () => {
		const { base, alice, chloe, bruno, n, demande, avisDe, envoisDe } = await jeu();
		const id = await demanderRemplacementCourt(base, alice, { debut: '2026-11-09T20:00', duree: 2 }, maintenant, reglage);
		expect(await accepterDemande(base, chloe, id, maintenant, reglage)).toBe('conclue');
		expect(await demande(id)).toMatchObject({ etat: 'conclue', remplacantId: n.chloe, manque: null });
		await expect(accepterDemande(base, bruno, id, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Déjà prise par un collègue'));
		expect(await avisDe(n.alice)).toEqual(['acceptee']);
		expect(await avisDe(n.elodie)).toEqual(['informe']);
		expect((await envoisDe(n.elodie)).map((e) => e.tag)).toEqual([`remplacement:${id}:informe`]);
		const effectif = effectifs(await requeteConclues(base, '2026-11-09', '2026-11-09'));
		expect(effectif).toMatchObject([{ debut: '2026-11-09T20:00', fin: '2026-11-09T22:00', titulaireId: n.alice, remplacantId: n.chloe }]);
	});

	it('une aptitude contrôlée manque : conclue quand même, le chef de garde reçoit une urgence qui la nomme', async () => {
		const { base, alice, bruno, n, demande, avisDe, envoisDe } = await jeu();
		const id = await demanderRemplacementCourt(base, alice, { debut: '2026-11-09T20:00', duree: 2 }, maintenant, reglage);
		expect(await accepterDemande(base, bruno, id, maintenant, reglage)).toBe('conclue');
		expect(await demande(id)).toMatchObject({ etat: 'conclue', remplacantId: n.bruno, manque: '["CA1"]' });
		expect(await avisDe(n.elodie)).toEqual(['informe']);
		const [urgence] = await envoisDe(n.elodie);
		expect(urgence!.tag).toBe(`urgence:remplacement:${id}:informe`);
		expect(urgence!.texte).toBe('Bruno Test remplace Alice Test lundi 9 novembre, de 20 h à 22 h · il lui manque CA1');
	});

	it('plus d’acceptation une fois la plage commencée', async () => {
		const { base, alice, chloe } = await jeu();
		const id = await demanderRemplacementCourt(base, alice, { debut: '2026-11-09T20:00', duree: 2 }, maintenant, reglage);
		await expect(accepterDemande(base, chloe, id, '2026-11-09T20:00', reglage)).rejects.toThrow(new DonneeInvalide('Période déjà commencée'));
	});
});
