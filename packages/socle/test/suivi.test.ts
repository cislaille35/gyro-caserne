import { desc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { attribuer } from '../src/actions/attributions.ts';
import type { Acteur } from '../src/droits.ts';
import { RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { enTeteDe, filDeNotifications } from '../src/notifications.ts';
import { enregistrerManoeuvre } from '../src/planning/annee.ts';
import { journal, personne, profil, responsabilite } from '../src/schema.ts';
import { ACTIONS_SUIVI, suiviDuCentre } from '../src/suivi.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-11-18';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

// Claire Martin, cheffe de centre ; Rémi Leroy, adjoint ; Alice Agent.
async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.typePersonne, 'agent'));
	const nouvelle = async (prenom: string, nom: string) => ({ type: 'personne' as const, id: (await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom, profilId: agent!.id }).returning())[0]!.id });
	const roles = await base.select().from(responsabilite);
	const nommer = (qui: { id: number }, systeme: string) => attribuer(base, superAdmin, { personneId: qui.id, responsabiliteId: roles.find((r) => r.systeme === systeme)!.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, '2026-01-01');
	const claire = await nouvelle('Claire', 'Martin');
	const remi = await nouvelle('Rémi', 'Leroy');
	const alice = await nouvelle('Alice', 'Agent');
	await nommer(claire, 'chef_centre');
	await nommer(remi, 'chef_centre_adjoint');
	await base.delete(journal);
	return { base, claire, remi, alice };
}

describe('la liste des actions suivies', () => {
	it('planning, nominations, réglages, fiches des agents, décisions sur les demandes, remplacements validés ; rien de privé', () => {
		for (const a of ['modifier_manoeuvre', 'annuler_manoeuvre', 'publier_annee', 'attribuer', 'terminer_attribution', 'creer_responsabilite', 'creer_comite', 'modifier_droits_profil', 'modifier_engin', 'modifier_ressource', 'regler_armement', 'deposer_ecusson', 'ajouter_personne', 'modifier_fiche', 'changer_statut', 'affecter_equipe', 'effacer_agent', 'prendre_habillement', 'refuser_habillement', 'livrer_habillement', 'signaler_anomalie', 'rendre_indisponible', 'remettre_en_service', 'clore_anomalie', 'accepter_reservation', 'refuser_reservation', 'valider_remplacement', 'refuser_validation'])
			expect(ACTIONS_SUIVI, a).toContain(a);
		for (const a of ['creer_conversation', 'modifier_mon_profil', 'publier', 'reserver', 'supprimer_commentaire', 'annuler_reservation', 'demander_remplacement', 'signaler_message', 'annoncer_manoeuvre']) expect(ACTIONS_SUIVI, a).not.toContain(a);
	});
});

describe('suiviDuCentre', () => {
	it('réservé au chef de centre, à l’adjoint et au super administrateur', async () => {
		const { base, claire, remi, alice } = await jeu();
		await expect(suiviDuCentre(base, alice, aujourdhui)).rejects.toThrow(RefusDroit);
		await expect(suiviDuCentre(base, claire, aujourdhui)).resolves.toMatchObject({ lignes: [] });
		await expect(suiviDuCentre(base, remi, aujourdhui)).resolves.toMatchObject({ lignes: [] });
		await expect(suiviDuCentre(base, superAdmin, aujourdhui)).resolves.toMatchObject({ lignes: [] });
	});

	it('du plus récent au plus ancien, une phrase par action avec son auteur et le lien ; les actions privées n’y sont pas', async () => {
		const { base, claire, remi, alice } = await jeu();
		const id = await enregistrerManoeuvre(base, claire, { debut: '2026-12-06T08:30', theme: 'Feux de forêt', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, '2026-11-18T09:00');
		await base.insert(journal).values([
			{ quand: '2026-11-18T09:30', acteur: `personne:${alice.id}`, action: 'creer_conversation', cibleType: 'conversation', cibleId: 1 },
			{ quand: '2026-11-18T10:00', acteur: `personne:${remi.id}`, action: 'modifier_manoeuvre', cibleType: 'planning', cibleId: id },
			{ quand: '2026-11-18T11:00', acteur: `personne:${remi.id}`, action: 'changer_statut', cibleType: 'personne', cibleId: alice.id }
		]);
		const { lignes, suite } = await suiviDuCentre(base, claire, aujourdhui);
		expect(lignes.map((l) => [l.qui, l.phrase, l.lien])).toEqual([
			['Rémi Leroy', 'a changé le statut d’Alice Agent', `/agents/${alice.id}`],
			['Rémi Leroy', 'a modifié la manœuvre Feux de forêt', `/planning/preparer/manoeuvre?id=${id}`],
			['Claire Martin', 'a ajouté la manœuvre Feux de forêt', `/planning/preparer/manoeuvre?id=${id}`]
		]);
		expect(lignes[0]!.quand).toBe('2026-11-18T11:00');
		expect(suite).toBeNull();
	});

	it('un agent effacé ou une fiche disparue : « Ancien agent », sans erreur', async () => {
		const { base, claire, alice } = await jeu();
		await base.update(personne).set({ prenom: 'Ancien', nom: 'agent', effaceLe: aujourdhui }).where(eq(personne.id, alice.id));
		await base.insert(journal).values([
			{ quand: '2026-11-18T10:00', acteur: `personne:${alice.id}`, action: 'prendre_habillement', cibleType: 'demande_habillement', cibleId: 999 },
			{ quand: '2026-11-18T10:01', acteur: 'personne:9999', action: 'modifier_fiche', cibleType: 'personne', cibleId: 9999 }
		]);
		const { lignes } = await suiviDuCentre(base, claire, aujourdhui);
		expect(lignes.map((l) => [l.qui, l.phrase])).toEqual([
			['Ancien agent', 'a modifié la fiche d’un ancien agent'],
			['Ancien agent', 'a pris en compte une demande d’habillement']
		]);
	});

	it('25 lignes par page, et la suite', async () => {
		const { base, claire, alice } = await jeu();
		await base.insert(journal).values(Array.from({ length: 30 }, (_, i) => ({ quand: `2026-11-18T10:${String(i).padStart(2, '0')}`, acteur: `personne:${claire.id}`, action: 'changer_statut', cibleType: 'personne', cibleId: alice.id })));
		base.parametresMax = 0;
		const page = await suiviDuCentre(base, claire, aujourdhui);
		expect(page.lignes).toHaveLength(25);
		expect(page.suite).toBe(page.lignes.at(-1)!.id);
		const suite = await suiviDuCentre(base, claire, aujourdhui, { avant: page.suite! });
		expect(suite.lignes).toHaveLength(5);
		expect(suite.suite).toBeNull();
		expect(base.parametresMax).toBeLessThan(100);
	});
});

describe('les nouveautés du suivi dans l’en-tête', () => {
	it('les lignes depuis la dernière visite, hors les siennes ; rien pour qui n’est pas chef ; en une seule requête ; remis à zéro par la visite', async () => {
		const { base, claire, remi, alice } = await jeu();
		const ligne = (qui: { id: number }, action = 'changer_statut') => ({ quand: '2026-11-18T10:00', acteur: `personne:${qui.id}`, action, cibleType: 'personne', cibleId: alice.id });
		await base.insert(journal).values([ligne(remi), ligne(remi), ligne(claire), ligne(alice, 'creer_conversation')]);
		const avant = base.requetes;
		expect((await enTeteDe(base, claire, aujourdhui)).suivi).toBe(2);
		expect(base.requetes - avant).toBe(1);
		expect((await enTeteDe(base, remi, aujourdhui)).suivi).toBe(1);
		expect((await enTeteDe(base, alice, aujourdhui)).suivi).toBeNull();
		expect((await filDeNotifications(base, claire, '2026-11-18T12:00')).suivi).toBe(2);
		await suiviDuCentre(base, claire, aujourdhui);
		expect((await enTeteDe(base, claire, aujourdhui)).suivi).toBe(0);
		await base.insert(journal).values([ligne(remi)]);
		expect((await enTeteDe(base, claire, aujourdhui)).suivi).toBe(1);
		// La page suivante ne compte pas pour une visite.
		await suiviDuCentre(base, remi, aujourdhui, { avant: 1 });
		expect((await enTeteDe(base, remi, aujourdhui)).suivi).toBe(1);
	});
	it('lecture bornée : jamais visité, ou visité il y a longtemps, seules les 1 000 dernières lignes du journal comptent', async () => {
		const { base, claire, remi, alice } = await jeu();
		const ligne = (qui: { id: number }) => ({ quand: '2026-11-18T10:00', acteur: `personne:${qui.id}`, action: 'changer_statut', cibleType: 'personne', cibleId: alice.id });
		await base.insert(journal).values([ligne(remi)]);
		const [premiere] = await base.select().from(journal);
		for (let i = 0; i < 20; i++) await base.insert(journal).values(Array.from({ length: 50 }, () => ligne(claire)));
		// 1 001 lignes : celle de Rémi est hors de la fenêtre.
		expect((await enTeteDe(base, claire, aujourdhui)).suivi).toBe(0);
		await base.update(personne).set({ suiviVu: premiere!.id - 1 }).where(eq(personne.id, claire.id));
		expect((await enTeteDe(base, claire, aujourdhui)).suivi).toBe(0);
		// Dans la fenêtre, la dernière visite fait foi.
		await base.insert(journal).values([ligne(remi), ligne(remi)]);
		expect((await enTeteDe(base, claire, aujourdhui)).suivi).toBe(2);
		const [derniere] = await base.select({ id: journal.id }).from(journal).orderBy(desc(journal.id)).limit(1);
		await base.update(personne).set({ suiviVu: derniere!.id - 1 }).where(eq(personne.id, claire.id));
		expect((await enTeteDe(base, claire, aujourdhui)).suivi).toBe(1);
	});
});

describe('les liens du suivi', () => {
	it('une manœuvre retirée (elle n’existe plus) mène au planning à préparer', async () => {
		const { base, claire } = await jeu();
		await base.insert(journal).values([{ quand: '2026-11-18T10:00', acteur: `personne:${claire.id}`, action: 'supprimer_manoeuvre', cibleType: 'planning', cibleId: 42 }]);
		expect((await suiviDuCentre(base, claire, aujourdhui)).lignes[0]!.lien).toBe('/planning/preparer');
	});
});

describe('le suivi : l’appli comme auteur', () => {
	it('le ménage de nuit et le planning ne sont pas un « Ancien agent »', async () => {
		const { base, claire } = await jeu();
		await base.insert(journal).values([
			{ quand: '2026-11-18T03:30', acteur: 'nuit', action: 'effacer_agent', cibleType: 'personne', cibleId: 9999 },
			{ quand: '2026-11-18T08:00', acteur: 'planning', action: 'alerter_sans_chef', cibleType: 'equipe', cibleId: 9999 }
		]);
		expect((await suiviDuCentre(base, claire, aujourdhui)).lignes.map((l) => l.qui)).toEqual(['Planning', 'Ménage de nuit']);
	});
});
