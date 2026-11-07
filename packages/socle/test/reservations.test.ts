import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { changerStatut } from '../src/actions/personnes.ts';
import type { Base } from '../src/base.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import {
	accepter,
	acceptees,
	aValider,
	ajouterRessource,
	annuler,
	calendrier,
	effacerVieillesReservations,
	mesReservations,
	modifierRessource,
	nombreAValider,
	refuser,
	reserver,
	ressourcesAGerer,
	ressourcesDe,
	retirerRessource
} from '../src/reservations.ts';
import { couper, effacerVieillesNotifications, enTeteDe, filDeNotifications, toutMarquerLu } from '../src/notifications.ts';
import { chevauche, periodeCourte } from '../src/reservations-calcul.ts';
const chevaucheCreneau = (a: { debut: string; fin: string }, b: { debut: string; fin: string }) => chevauche(a, b, 'creneau');
import { abonnementPush, attribution, avisReservation, comite, envoiPush, personne, profil, profilDroit, reservation, ressource, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-11-01T10:00';
const aujourdhui = '2026-11-01';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

// Alice, agent ; Romain, membre de l'Amicale ; Rémi, référent engins ; Estelle, compte partagé de la réserve citoyenne.
async function preparer() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const idProfil = (nom: string) => profils.find((p) => p.nom === nom)!.id;
	const nouvelle = async (prenom: string, nomProfil = 'Agent') => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: idProfil(nomProfil) }).returning();
		return { type: 'personne', id: p!.id } as const;
	};
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
	const [membre] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Membre de comité'));
	const [engins] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent engins'));
	const alice = await nouvelle('Alice');
	const romain = await nouvelle('Romain');
	const remi = await nouvelle('Remi');
	const estelle = await nouvelle('Estelle', 'Réserve citoyenne');
	const saisie = { debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' };
	await base.insert(attribution).values({ personneId: romain.id, responsabiliteId: membre!.id, perimetreType: 'comite', perimetreId: amicale!.id, ...saisie });
	const [aRemi] = await base.insert(attribution).values({ personneId: remi.id, responsabiliteId: engins!.id, perimetreType: 'centre', perimetreId: null, ...saisie }).returning();
	const bancs = await ajouterRessource(base, romain, { nom: 'Bancs', stock: 12, icone: 'groupe', comiteId: amicale!.id }, maintenant);
	const [vl] = await base.select().from(ressource).where(eq(ressource.forme, 'creneau'));
	return { base, alice, romain, remi, estelle, bancs, vl: vl!.id, amicale: amicale!.id, aRemi: aRemi!.id };
}

const etat = async (base: Awaited<ReturnType<typeof preparer>>['base'], id: number) => (await base.select().from(reservation).where(eq(reservation.id, id)))[0]!;

describe('jeu de départ des réservations', () => {
	it('la VL, par créneau, ouverte à la réserve citoyenne, gérée par le référent engins ; RESERVER pour les deux profils', async () => {
		const { base, alice, estelle } = await preparer();
		const { ressources, peutReserver } = await ressourcesDe(base, alice, aujourdhui);
		expect(peutReserver).toBe(true);
		expect(ressources.map((r) => [r.nom, r.forme, r.stock, r.ouverteReserve, r.gestionnaire.nom])).toEqual([
			['VL', 'creneau', null, true, 'Référent engins'],
			['Bancs', 'jours', 12, false, 'Amicale']
		]);
		const vue = await ressourcesDe(base, estelle, aujourdhui);
		expect(vue.reserveCitoyenne).toBe(true);
		expect(vue.ressources.map((r) => r.nom)).toEqual(['VL']);
		const droits = await base.select().from(profilDroit).where(eq(profilDroit.droit, 'RESERVER'));
		expect(droits).toHaveLength(2);
	});
});

describe('réserver', () => {
	it('VL : libre, acceptée d’office ; qui chevauche une acceptée ou une attente, en attente ; bout à bout, libre', async () => {
		const { base, alice, romain, remi, vl } = await preparer();
		expect(await reserver(base, alice, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant)).toMatchObject({ etat: 'acceptee' });
		expect(await reserver(base, romain, vl, { debut: '2026-11-07T11:00', fin: '2026-11-07T13:00' }, maintenant)).toMatchObject({ etat: 'attente' });
		expect(await reserver(base, remi, vl, { debut: '2026-11-07T12:30', fin: '2026-11-07T14:00' }, maintenant)).toMatchObject({ etat: 'attente' });
		expect(await reserver(base, remi, vl, { debut: '2026-11-07T14:00', fin: '2026-11-07T15:00' }, maintenant)).toMatchObject({ etat: 'acceptee' });
	});

	it('matériel : toujours en attente ; au-delà du stock, refusé avec ce qui reste le jour le plus pris', async () => {
		const { base, alice, remi, bancs } = await preparer();
		expect(await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-14', quantite: 5 }, maintenant)).toMatchObject({ etat: 'attente' });
		await reserver(base, remi, bancs, { debut: '2026-11-13', fin: '2026-11-13', quantite: 4 }, maintenant);
		await expect(reserver(base, alice, bancs, { debut: '2026-11-11', fin: '2026-11-14', quantite: 4 }, maintenant)).rejects.toThrow(new DonneeInvalide('Bancs : il en reste 3 le 13 nov.'));
		await expect(reserver(base, alice, bancs, { debut: '2026-11-13', fin: '2026-11-13', quantite: 13 }, maintenant)).rejects.toThrow('Bancs : il en reste 3 le 13 nov.');
		await reserver(base, alice, bancs, { debut: '2026-11-13', fin: '2026-11-13', quantite: 3 }, maintenant);
		await expect(reserver(base, alice, bancs, { debut: '2026-11-13', fin: '2026-11-13', quantite: 1 }, maintenant)).rejects.toThrow('Bancs : il n’en reste plus le 13 nov.');
	});

	it('période invalide, trop longue, passée ou trop lointaine ; quantité ; textes trop longs', async () => {
		const { base, alice, bancs, vl } = await preparer();
		const refus = (id: number, d: Parameters<typeof reserver>[3], message: string) => expect(reserver(base, alice, id, d, maintenant)).rejects.toThrow(new DonneeInvalide(message));
		await refus(bancs, { debut: '2026-11-14', fin: '2026-11-12', quantite: 1 }, 'La fin précède le début');
		await refus(vl, { debut: '2026-11-07T12:00', fin: '2026-11-07T12:00' }, 'La fin précède le début');
		await refus(bancs, { debut: '2026-11-01', fin: '2026-11-15', quantite: 1 }, '14 jours au plus');
		await refus(vl, { debut: '2026-11-07T12:00', fin: '2026-11-22T12:00' }, '14 jours au plus');
		await refus(bancs, { debut: '2026-10-31', fin: '2026-11-02', quantite: 1 }, 'Début déjà passé');
		await refus(vl, { debut: '2026-11-01T09:00', fin: '2026-11-01T12:00' }, 'Début déjà passé');
		await refus(bancs, { debut: '2027-11-01', fin: '2027-11-02', quantite: 1 }, 'Réservation à moins d’un an');
		await refus(bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 0 }, 'Quantité invalide');
		await refus(bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 1, mot: 'x'.repeat(201) }, 'Mot trop long');
		await refus(bancs, { debut: '2026-11-1', fin: '2026-11-12', quantite: 1 }, 'Date invalide : 2026-11-1');
		// Aujourd'hui même : permis.
		await reserver(base, alice, bancs, { debut: '2026-11-01', fin: '2026-11-01', quantite: 1 }, maintenant);
		await reserver(base, alice, vl, { debut: '2026-11-01T10:30', fin: '2026-11-01T11:00' }, maintenant);
	});

	it('droits : sans RESERVER, refus ; la réserve citoyenne réserve la VL avec un nom, pas le matériel', async () => {
		const { base, alice, estelle, bancs, vl } = await preparer();
		await expect(reserver(base, estelle, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 1 }, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await expect(reserver(base, estelle, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant)).rejects.toThrow(new DonneeInvalide('Nom du demandeur obligatoire'));
		await expect(reserver(base, estelle, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00', nomDemandeur: 'x'.repeat(61) }, maintenant)).rejects.toThrow('Nom du demandeur trop long');
		const { id } = await reserver(base, estelle, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00', nomDemandeur: ' Mme Durand ', telephone: '06 00 00 00 00', mot: 'Collecte de sang' }, maintenant);
		expect(await etat(base, id)).toMatchObject({ nomDemandeur: 'Mme Durand', telephone: '06 00 00 00 00', mot: 'Collecte de sang', etat: 'acceptee' });
		await base.delete(profilDroit).where(eq(profilDroit.droit, 'RESERVER'));
		await expect(reserver(base, alice, vl, { debut: '2026-11-08T09:00', fin: '2026-11-08T12:00' }, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		expect((await ressourcesDe(base, alice, aujourdhui)).ressources).toEqual([]);
	});

	it('un agent ne saisit ni nom ni téléphone : ils sont ignorés', async () => {
		const { base, alice, vl } = await preparer();
		const { id } = await reserver(base, alice, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00', nomDemandeur: 'Autre', telephone: '01' }, maintenant);
		expect(await etat(base, id)).toMatchObject({ nomDemandeur: null, telephone: null });
	});
});

describe('trancher', () => {
	it('seul qui gère accepte ou refuse : Romain les bancs, Rémi la VL, le super administrateur tout', async () => {
		const { base, alice, romain, remi, bancs, vl } = await preparer();
		const { id: b1 } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 2 }, maintenant);
		const { id: b2 } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 2 }, maintenant);
		await expect(accepter(base, remi, b1, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await expect(accepter(base, alice, b1, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await accepter(base, romain, b1, maintenant);
		expect(await etat(base, b1)).toMatchObject({ etat: 'acceptee', trancheePar: `personne:${romain.id}`, trancheeLe: maintenant });
		await refuser(base, superAdmin, b2, ' Plus de place dans le camion ', maintenant);
		expect(await etat(base, b2)).toMatchObject({ etat: 'refusee', motif: 'Plus de place dans le camion' });
		await expect(accepter(base, romain, b2, maintenant)).rejects.toThrow(new DonneeInvalide('Cette demande a déjà été traitée'));
		await reserver(base, alice, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant);
		const { id: v2 } = await reserver(base, romain, vl, { debut: '2026-11-07T10:00', fin: '2026-11-07T11:00' }, maintenant);
		await expect(refuser(base, romain, v2, null, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await refuser(base, remi, v2, null, maintenant);
		expect(await etat(base, v2)).toMatchObject({ etat: 'refusee', motif: null });
	});

	it('VL : accepter une demande en conflit annule la réservation acceptée qui chevauche', async () => {
		const { base, alice, romain, remi, vl } = await preparer();
		const { id: v1 } = await reserver(base, alice, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant);
		const { id: v2 } = await reserver(base, romain, vl, { debut: '2026-11-07T10:00', fin: '2026-11-07T11:00' }, maintenant);
		const [demande] = await aValider(base, remi, aujourdhui);
		expect(demande!.demande.id).toBe(v2);
		expect(demande!.conflits.map((c) => c.id)).toEqual([v1]);
		await accepter(base, remi, v2, maintenant);
		expect(await etat(base, v2)).toMatchObject({ etat: 'acceptee' });
		expect(await etat(base, v1)).toMatchObject({ etat: 'annulee', motif: 'Créneau donné à une autre demande', trancheePar: `personne:${remi.id}` });
	});

	it('matériel : le stock baissé sous ce qui est promis empêche d’accepter', async () => {
		const { base, alice, romain, bancs } = await preparer();
		const { id: b1 } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 8 }, maintenant);
		const { id: b2 } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 4 }, maintenant);
		await accepter(base, romain, b1, maintenant);
		await modifierRessource(base, romain, bancs, { nom: 'Bancs', stock: 10, icone: 'groupe' }, maintenant);
		await expect(accepter(base, romain, b2, maintenant)).rejects.toThrow(new DonneeInvalide('Bancs : il n’en reste que 2 le 12 nov.'));
		expect(await etat(base, b1)).toMatchObject({ etat: 'acceptee' });
	});

	it('les réservations acceptées à venir des ressources que l’on gère (pour pouvoir les annuler)', async () => {
		const { base, alice, romain, remi, bancs, vl } = await preparer();
		const { id: b } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 2 }, maintenant);
		await reserver(base, alice, bancs, { debut: '2026-11-13', fin: '2026-11-13', quantite: 2 }, maintenant);
		await accepter(base, romain, b, maintenant);
		const { id: v } = await reserver(base, alice, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant);
		expect((await acceptees(base, romain, aujourdhui)).map((r) => r.id)).toEqual([b]);
		expect((await acceptees(base, remi, aujourdhui)).map((r) => r.id)).toEqual([v]);
		expect((await acceptees(base, superAdmin, aujourdhui)).map((r) => r.id)).toEqual([v, b]);
		expect(await acceptees(base, alice, aujourdhui)).toEqual([]);
		expect(await acceptees(base, romain, '2026-11-13')).toEqual([]);
	});

	it('perdre son rôle, c’est perdre la gestion', async () => {
		const { base, alice, romain, remi, bancs, vl, aRemi } = await preparer();
		await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 1 }, maintenant);
		await reserver(base, alice, bancs, { debut: '2026-11-13', fin: '2026-11-13', quantite: 1 }, maintenant);
		await reserver(base, alice, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant);
		await reserver(base, romain, vl, { debut: '2026-11-07T10:00', fin: '2026-11-07T11:00' }, maintenant);
		expect(await nombreAValider(base, romain, aujourdhui)).toBe(2);
		expect(await nombreAValider(base, remi, aujourdhui)).toBe(1);
		expect(await nombreAValider(base, alice, aujourdhui)).toBe(0);
		expect(await nombreAValider(base, superAdmin, aujourdhui)).toBe(3);
		await base.update(attribution).set({ fin: '2026-10-31' }).where(eq(attribution.id, aRemi));
		expect(await nombreAValider(base, remi, aujourdhui)).toBe(0);
		expect(await aValider(base, remi, aujourdhui)).toEqual([]);
		await base.update(comite).set({ dissousLe: '2026-10-31' });
		expect(await nombreAValider(base, romain, aujourdhui)).toBe(0);
		// Une demande dont la période est passée ne compte plus.
		expect(await nombreAValider(base, superAdmin, '2026-11-14')).toBe(0);
	});
});

describe('annuler', () => {
	it('le demandeur, tant que la période n’a pas commencé ; un autre agent, jamais', async () => {
		const { base, alice, remi, bancs, vl } = await preparer();
		const { id } = await reserver(base, alice, bancs, { debut: '2026-11-03', fin: '2026-11-04', quantite: 1 }, maintenant);
		await expect(annuler(base, remi, id, null, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await expect(annuler(base, alice, id, null, '2026-11-03T08:00')).rejects.toThrow(new DonneeInvalide('Déjà commencée : demandez à qui gère la ressource'));
		await annuler(base, alice, id, null, '2026-11-02T23:00');
		expect(await etat(base, id)).toMatchObject({ etat: 'annulee', trancheePar: `personne:${alice.id}` });
		await expect(annuler(base, alice, id, null, maintenant)).rejects.toThrow(new DonneeInvalide('Cette réservation est déjà terminée ou annulée'));
		const { id: v } = await reserver(base, alice, vl, { debut: '2026-11-01T11:00', fin: '2026-11-01T12:00' }, maintenant);
		await expect(annuler(base, alice, v, null, '2026-11-01T11:00')).rejects.toThrow('Déjà commencée');
	});

	it('qui gère annule une réservation acceptée, même commencée, avec un mot', async () => {
		const { base, alice, romain, bancs } = await preparer();
		const { id } = await reserver(base, alice, bancs, { debut: '2026-11-03', fin: '2026-11-04', quantite: 1 }, maintenant);
		await accepter(base, romain, id, maintenant);
		await annuler(base, romain, id, 'Bancs prêtés à la mairie', '2026-11-03T08:00');
		expect(await etat(base, id)).toMatchObject({ etat: 'annulee', motif: 'Bancs prêtés à la mairie', trancheePar: `personne:${romain.id}` });
	});

	it('compte partagé : toute session du compte annule ses réservations', async () => {
		const { base, estelle, vl } = await preparer();
		const { id } = await reserver(base, estelle, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00', nomDemandeur: 'M. Roux' }, maintenant);
		await annuler(base, { type: 'personne', id: estelle.id }, id, null, maintenant);
		expect(await etat(base, id)).toMatchObject({ etat: 'annulee' });
	});
});

describe('lectures', () => {
	it('calendrier : ce qui est pris dans la période, par qui ; le téléphone pour qui gère et pour le demandeur seulement', async () => {
		const { base, alice, remi, estelle, vl } = await preparer();
		await reserver(base, estelle, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00', nomDemandeur: 'Mme Durand', telephone: '0600' }, maintenant);
		const { id: refusee } = await reserver(base, alice, vl, { debut: '2026-11-07T10:00', fin: '2026-11-07T11:00' }, maintenant);
		await refuser(base, remi, refusee, null, maintenant);
		await reserver(base, alice, vl, { debut: '2026-11-20T10:00', fin: '2026-11-20T11:00' }, maintenant);
		const vue = await calendrier(base, alice, vl, '2026-11-02', '2026-11-08', aujourdhui);
		expect(vue.ressource.nom).toBe('VL');
		expect(vue.reservations).toMatchObject([{ demandeur: 'Mme Durand', telephone: null, etat: 'acceptee', mienne: false, debut: '2026-11-07T09:00' }]);
		expect((await calendrier(base, remi, vl, '2026-11-02', '2026-11-08', aujourdhui)).reservations[0]).toMatchObject({ telephone: '0600' });
		expect((await calendrier(base, estelle, vl, '2026-11-02', '2026-11-08', aujourdhui)).reservations[0]).toMatchObject({ telephone: '0600', mienne: true, annulable: true });
		expect(await calendrier(base, estelle, vl, '2026-11-02', '2026-11-08', aujourdhui)).toMatchObject({ peutReserver: true, reserveCitoyenne: true });
		expect(await calendrier(base, alice, vl, '2026-11-02', '2026-11-08', aujourdhui)).toMatchObject({ peutReserver: true, reserveCitoyenne: false });
	});

	it('calendrier : ressource invisible ou retirée, refus', async () => {
		const { base, estelle, romain, bancs } = await preparer();
		await expect(calendrier(base, estelle, bancs, '2026-11-02', '2026-11-08', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await retirerRessource(base, romain, bancs, maintenant);
		await expect(calendrier(base, romain, bancs, '2026-11-02', '2026-11-08', aujourdhui)).rejects.toThrow(new DonneeInvalide('Ressource introuvable'));
	});

	it('mes réservations : à venir (par date) et passées, avec la ressource ; le compte partagé voit toutes les siennes', async () => {
		const { base, alice, estelle, bancs, vl } = await preparer();
		await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 2 }, maintenant);
		await reserver(base, alice, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant);
		const { aVenir, passees } = await mesReservations(base, alice, maintenant);
		expect(aVenir.map((r) => [r.ressource, r.debut, r.etat, r.annulable])).toEqual([
			['VL', '2026-11-07T09:00', 'acceptee', true],
			['Bancs', '2026-11-12', 'attente', true]
		]);
		expect(passees).toEqual([]);
		expect((await mesReservations(base, alice, '2026-11-08T00:00')).passees.map((r) => r.ressource)).toEqual(['VL']);
		await reserver(base, estelle, vl, { debut: '2026-11-09T09:00', fin: '2026-11-09T12:00', nomDemandeur: 'Mme Durand' }, maintenant);
		await reserver(base, estelle, vl, { debut: '2026-11-10T09:00', fin: '2026-11-10T12:00', nomDemandeur: 'M. Roux' }, maintenant);
		expect((await mesReservations(base, estelle, maintenant)).aVenir.map((r) => [r.demandeur, r.nomDemandeur])).toEqual([
			['Mme Durand', 'Mme Durand'],
			['M. Roux', 'M. Roux']
		]);
		expect((await mesReservations(base, alice, maintenant)).aVenir[0]!.nomDemandeur).toBeNull();
	});

	it('ressourcesDe : ce qui attend chez qui gère, et qui peut gérer le matériel', async () => {
		const { base, alice, romain, bancs } = await preparer();
		await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 2 }, maintenant);
		expect(await ressourcesDe(base, romain, aujourdhui)).toMatchObject({ aValider: 1, peutGererMateriel: true });
		expect(await ressourcesDe(base, alice, aujourdhui)).toMatchObject({ aValider: 0, peutGererMateriel: false });
		expect((await ressourcesDe(base, alice, aujourdhui)).mesAVenir).toBe(1);
		expect((await ressourcesDe(base, romain, aujourdhui)).mesAVenir).toBe(0);
	});
});

describe('gérer le matériel', () => {
	it('un membre de comité ajoute pour l’un de ses comités ; modifie et retire ce qu’il gère', async () => {
		const { base, alice, romain, amicale, bancs } = await preparer();
		expect(await ressourcesAGerer(base, romain, aujourdhui)).toMatchObject({ comites: [{ id: amicale, nom: 'Amicale' }], ressources: [{ nom: 'Bancs' }] });
		expect(await ressourcesAGerer(base, alice, aujourdhui)).toEqual({ comites: [], ressources: [] });
		await expect(ajouterRessource(base, alice, { nom: 'Tables', stock: 6, icone: 'outil', comiteId: amicale }, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		const [centre] = await base.select().from(comite).where(eq(comite.nom, 'Comité du centre'));
		await expect(ajouterRessource(base, romain, { nom: 'Tables', stock: 6, icone: 'outil', comiteId: centre!.id }, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await expect(ajouterRessource(base, romain, { nom: ' bancs ', stock: 6, icone: 'outil', comiteId: amicale }, maintenant)).rejects.toThrow(new DonneeInvalide('Nom déjà utilisé'));
		await expect(ajouterRessource(base, romain, { nom: 'Tables', stock: 0, icone: 'outil', comiteId: amicale }, maintenant)).rejects.toThrow(new DonneeInvalide('Stock invalide'));
		await expect(ajouterRessource(base, romain, { nom: 'Tables', stock: 6, icone: 'fusee', comiteId: amicale }, maintenant)).rejects.toThrow(new DonneeInvalide('Icône inconnue'));
		await expect(ajouterRessource(base, romain, { nom: '', stock: 6, icone: 'outil', comiteId: amicale }, maintenant)).rejects.toThrow(new DonneeInvalide('Nom vide'));
		const tables = await ajouterRessource(base, romain, { nom: 'Tables', stock: 6, icone: 'outil', comiteId: amicale }, maintenant);
		await modifierRessource(base, romain, tables, { nom: 'Tables pliantes', stock: 8, icone: 'livre' }, maintenant);
		const [t] = await base.select().from(ressource).where(eq(ressource.id, tables));
		expect(t).toMatchObject({ nom: 'Tables pliantes', stock: 8, icone: 'livre', forme: 'jours', ouverteReserve: 0, gereeParComiteId: amicale });
		await expect(modifierRessource(base, alice, bancs, { nom: 'X', stock: 1, icone: 'outil' }, maintenant)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('la VL se renomme par le référent engins, ne se retire pas', async () => {
		const { base, romain, remi, vl } = await preparer();
		await expect(modifierRessource(base, romain, vl, { nom: 'VL 1', icone: 'camion' }, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await modifierRessource(base, remi, vl, { nom: 'VL 1', icone: 'camion' }, maintenant);
		expect((await base.select().from(ressource).where(eq(ressource.id, vl)))[0]).toMatchObject({ nom: 'VL 1', stock: null });
		await expect(retirerRessource(base, remi, vl, maintenant)).rejects.toThrow(new DonneeInvalide('Cette ressource ne se retire pas'));
	});

	it('retirer : plus de demande ; les réservations à venir annulées, les passées gardées', async () => {
		const { base, alice, romain, bancs } = await preparer();
		const { id: venir } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 2 }, maintenant);
		const [passee] = await base.insert(reservation).values({ ressourceId: bancs, personneId: alice.id, debut: '2026-10-12', fin: '2026-10-12', quantite: 1, etat: 'acceptee', creeLe: '2026-10-01T10:00' }).returning();
		await retirerRessource(base, romain, bancs, maintenant);
		expect(await etat(base, venir)).toMatchObject({ etat: 'annulee', motif: 'Ressource retirée' });
		expect(await etat(base, passee!.id)).toMatchObject({ etat: 'acceptee' });
		await expect(reserver(base, alice, bancs, { debut: '2026-11-13', fin: '2026-11-13', quantite: 1 }, maintenant)).rejects.toThrow(new DonneeInvalide('Ressource introuvable'));
		expect((await ressourcesDe(base, alice, aujourdhui)).ressources.map((r) => r.nom)).toEqual(['VL']);
	});
});

describe('ménage', () => {
	it('les réservations finies avant la limite sont effacées', async () => {
		const { base, alice, bancs } = await preparer();
		await base.insert(reservation).values([
			{ ressourceId: bancs, personneId: alice.id, debut: '2025-10-12', fin: '2025-10-30', quantite: 1, etat: 'acceptee', creeLe: 'x' },
			{ ressourceId: bancs, personneId: alice.id, debut: '2025-10-30T09:00', fin: '2025-11-02T09:00', quantite: 1, etat: 'acceptee', creeLe: 'x' }
		]);
		await effacerVieillesReservations(base, '2025-11-01');
		expect((await base.select().from(reservation).where(and(eq(reservation.ressourceId, bancs)))).map((r) => r.fin)).toEqual(['2025-11-02T09:00']);
	});
});

// Chacun a un téléphone abonné ; les envois en file, par personne.
async function avecTelephones() {
	const p = await preparer();
	const personnes = await p.base.select({ id: personne.id }).from(personne);
	await p.base.insert(abonnementPush).values(personnes.map((x) => ({ personneId: x.id, endpoint: `https://fcm.googleapis.com/${x.id}`, p256dh: 'a', auth: 'b', creeLe: maintenant })));
	const envois = async () =>
		(await p.base.select({ personneId: abonnementPush.personneId, donnees: envoiPush.donnees }).from(envoiPush).innerJoin(abonnementPush, eq(abonnementPush.id, envoiPush.abonnementId))).map((e) => ({ personneId: e.personneId, ...JSON.parse(e.donnees) }));
	const vider = () => p.base.delete(envoiPush);
	return { ...p, envois, vider };
}

describe('notifications des réservations', () => {
	it('une demande de matériel sonne chez qui la gère, une fois, jamais chez le demandeur', async () => {
		const { base, alice, romain, bancs, envois } = await avecTelephones();
		await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-14', quantite: 4 }, maintenant);
		expect(await envois()).toEqual([{ personneId: romain.id, titre: 'Demande de réservation · Bancs', texte: 'Alice Test, 4, du 12 au 14 nov.', url: '/reservations/a-valider', tag: 'reservations-a-valider' }]);
	});

	it('VL : acceptée d’office, rien ; en attente, le référent engins', async () => {
		const { base, alice, romain, remi, vl, envois } = await avecTelephones();
		await reserver(base, alice, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant);
		expect(await envois()).toEqual([]);
		await reserver(base, romain, vl, { debut: '2026-11-07T11:00', fin: '2026-11-07T13:30' }, maintenant);
		expect(await envois()).toMatchObject([{ personneId: remi.id, titre: 'Demande de réservation · VL', texte: 'Romain Test, 7 nov., 11 h – 13 h 30' }]);
	});

	it('accord, refus et annulation par qui gère : un avis et un envoi au demandeur ; annulation par le demandeur : rien', async () => {
		const { base, alice, romain, bancs, envois, vider } = await avecTelephones();
		const { id: a } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 2 }, maintenant);
		const { id: b } = await reserver(base, alice, bancs, { debut: '2026-11-13', fin: '2026-11-13', quantite: 2 }, maintenant);
		const { id: c } = await reserver(base, alice, bancs, { debut: '2026-11-14', fin: '2026-11-14', quantite: 2 }, maintenant);
		await vider();
		await accepter(base, romain, a, maintenant);
		await refuser(base, romain, b, 'Déjà prêtés', maintenant);
		await annuler(base, romain, a, 'Bancs cassés', maintenant);
		await annuler(base, alice, c, null, maintenant);
		const [avis1, avis2, avis3] = (await base.select().from(avisReservation)).map((x) => x.id);
		// Chaque envoi porte l'avis de la cloche qu'il annonce : touché au téléphone, il le marque lu.
		expect(await envois()).toEqual([
			{ personneId: alice.id, titre: 'Bancs : demande acceptée', texte: '12 nov.', url: '/reservations/miennes', tag: `reservation:${a}`, lue: { genre: 'reservation', id: avis1 } },
			{ personneId: alice.id, titre: 'Bancs : demande refusée', texte: '13 nov. · Déjà prêtés', url: '/reservations/miennes', tag: `reservation:${b}`, lue: { genre: 'reservation', id: avis2 } },
			{ personneId: alice.id, titre: 'Bancs : réservation annulée', texte: '12 nov. · Bancs cassés', url: '/reservations/miennes', tag: `reservation:${a}`, lue: { genre: 'reservation', id: avis3 } }
		]);
		expect((await base.select().from(avisReservation)).map((x) => [x.personneId, x.reservationId, x.quoi])).toEqual([
			[alice.id, a, 'acceptee'],
			[alice.id, b, 'refusee'],
			[alice.id, a, 'annulee']
		]);
	});

	it('VL : la réservation écartée par un conflit et celles d’une ressource retirée préviennent leur demandeur', async () => {
		const { base, alice, romain, remi, vl, bancs, envois, vider } = await avecTelephones();
		const { id: v1 } = await reserver(base, alice, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant);
		const { id: v2 } = await reserver(base, romain, vl, { debut: '2026-11-07T10:00', fin: '2026-11-07T11:00' }, maintenant);
		const { id: b } = await reserver(base, remi, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 2 }, maintenant);
		await vider();
		await accepter(base, remi, v2, maintenant);
		await retirerRessource(base, romain, bancs, maintenant);
		expect((await envois()).map((e) => [e.personneId, e.titre, e.texte])).toEqual([
			[romain.id, 'VL : demande acceptée', '7 nov., 10 h – 11 h'],
			[alice.id, 'VL : réservation annulée', '7 nov., 9 h – 12 h · Créneau donné à une autre demande'],
			[remi.id, 'Bancs : réservation annulée', '12 nov. · Ressource retirée']
		]);
		expect((await base.select().from(avisReservation)).map((x) => x.reservationId)).toEqual([v2, v1, b]);
	});

	it('« tout » coupé : l’avis est dans la cloche, rien au téléphone ; qui tranche sa propre demande n’est pas prévenu', async () => {
		const { base, alice, romain, bancs, envois, vider } = await avecTelephones();
		await couper(base, alice, 'tout', true, maintenant);
		const { id } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 2 }, maintenant);
		await refuser(base, romain, id, null, maintenant);
		expect((await envois()).filter((e) => e.personneId === alice.id)).toEqual([]);
		expect(await base.select().from(avisReservation)).toHaveLength(1);
		const { id: sienne } = await reserver(base, romain, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 2 }, maintenant);
		await vider();
		await accepter(base, romain, sienne, maintenant);
		expect(await envois()).toEqual([]);
		expect(await base.select().from(avisReservation)).toHaveLength(1);
	});

	it('la cloche : l’avis est dans le fil et compté ; « Mes réservations » et « Tout marquer comme lu » le marquent lu ; le ménage l’efface après 30 jours', async () => {
		const { base, alice, romain, bancs } = await avecTelephones();
		const { id } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-13', quantite: 2 }, maintenant);
		await refuser(base, romain, id, 'Déjà prêtés', maintenant);
		const fil = await filDeNotifications(base, alice, maintenant);
		expect(fil.nonLues).toBe(1);
		expect(fil.lignes).toEqual([{ id: expect.any(Number), type: 'reservation', reservationId: id, quoi: 'refusee', ressource: 'Bancs', periode: 'du 12 au 13 nov.', motif: 'Déjà prêtés', creeLe: maintenant, lue: false }]);
		expect((await enTeteDe(base, alice, aujourdhui)).nonLues).toBe(1);
		await mesReservations(base, alice, maintenant);
		expect((await enTeteDe(base, alice, aujourdhui)).nonLues).toBe(0);
		await base.update(avisReservation).set({ lueLe: null });
		await toutMarquerLu(base, alice, maintenant);
		expect((await filDeNotifications(base, alice, maintenant)).lignes[0]).toMatchObject({ lue: true });
		await effacerVieillesNotifications(base, '2026-12-01');
		expect(await base.select().from(avisReservation)).toEqual([]);
	});
});

describe('période en bref', () => {
	it('jours et créneaux', () => {
		expect(periodeCourte('jours', '2026-11-12', '2026-11-12')).toBe('12 nov.');
		expect(periodeCourte('jours', '2026-11-12', '2026-11-14')).toBe('du 12 au 14 nov.');
		expect(periodeCourte('jours', '2026-10-30', '2026-11-02')).toBe('du 30 oct. au 2 nov.');
		expect(periodeCourte('creneau', '2026-11-07T09:00', '2026-11-07T12:30')).toBe('7 nov., 9 h – 12 h 30');
		expect(periodeCourte('creneau', '2026-11-07T18:00', '2026-11-08T09:05')).toBe('du 7 nov., 18 h au 8 nov., 9 h 05');
	});
});

// Une écriture d'un autre agent glissée juste avant le batch de l'action : deux requêtes qui se croisent.
function avecCourse<B extends Base>(base: B, avant: () => Promise<unknown>): B {
	let fait = false;
	return new Proxy(base, {
		get(cible, cle) {
			if (cle !== 'batch') return Reflect.get(cible, cle);
			return async (requetes: never) => {
				if (!fait) {
					fait = true;
					await avant();
				}
				return cible.batch(requetes);
			};
		}
	});
}

describe('après la revue', () => {
	it('VL : deux demandes simultanées sur un créneau libre, la seconde passe en attente et sonne chez le référent', async () => {
		const { base, alice, romain, remi, vl } = await avecTelephones();
		const course = avecCourse(base, () => base.insert(reservation).values({ ressourceId: vl, personneId: romain.id, debut: '2026-11-07T09:00', fin: '2026-11-07T12:00', etat: 'acceptee', creeLe: maintenant }));
		const { id, etat: lEtat } = await reserver(course, alice, vl, { debut: '2026-11-07T10:00', fin: '2026-11-07T11:00' }, maintenant);
		expect(lEtat).toBe('attente');
		expect(await etat(base, id)).toMatchObject({ etat: 'attente' });
		const envois = await base.select({ personneId: abonnementPush.personneId }).from(envoiPush).innerJoin(abonnementPush, eq(abonnementPush.id, envoiPush.abonnementId));
		expect(envois).toEqual([{ personneId: remi.id }]);
	});

	it('une demande tranchée entre-temps par un autre gestionnaire : ni avis ni envoi contradictoire', async () => {
		const { base, alice, romain, bancs, envois, vider } = await avecTelephones();
		const { id } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 2 }, maintenant);
		await vider();
		const course = avecCourse(base, () => refuser(base, superAdmin, id, null, maintenant));
		await accepter(course, romain, id, maintenant);
		expect(await etat(base, id)).toMatchObject({ etat: 'refusee' });
		expect((await base.select().from(avisReservation)).map((a) => a.quoi)).toEqual(['refusee']);
		expect((await envois()).map((e) => e.titre)).toEqual(['Bancs : demande refusée']);
	});

	it('stock épuisé par une baisse : « il n’en reste plus » ; baisser sous ce qui est déjà accepté est refusé', async () => {
		const { base, alice, romain, bancs } = await preparer();
		const { id: a } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 8 }, maintenant);
		const { id: b } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 4 }, maintenant);
		await accepter(base, romain, a, maintenant);
		await modifierRessource(base, romain, bancs, { nom: 'Bancs', stock: 8, icone: 'groupe' }, maintenant);
		await expect(accepter(base, romain, b, maintenant)).rejects.toThrow(new DonneeInvalide('Bancs : il n’en reste plus le 12 nov.'));
		await expect(modifierRessource(base, romain, bancs, { nom: 'Bancs', stock: 7, icone: 'groupe' }, maintenant)).rejects.toThrow(new DonneeInvalide('Déjà 8 promis le 12 nov. : annulez d’abord des réservations'));
		// Une réservation passée ne compte pas.
		await base.update(reservation).set({ debut: '2026-10-12', fin: '2026-10-12' }).where(eq(reservation.id, a));
		await modifierRessource(base, romain, bancs, { nom: 'Bancs', stock: 2, icone: 'groupe' }, maintenant);
	});

	it('perdre la gestion : rôle archivé, gestionnaire parti', async () => {
		const { base, alice, remi, romain, vl, bancs } = await preparer();
		await reserver(base, alice, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant);
		await reserver(base, romain, vl, { debut: '2026-11-07T10:00', fin: '2026-11-07T11:00' }, maintenant);
		await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 1 }, maintenant);
		expect(await nombreAValider(base, remi, aujourdhui)).toBe(1);
		await base.update(responsabilite).set({ archiveeLe: '2026-10-31' }).where(eq(responsabilite.nom, 'Référent engins'));
		expect(await nombreAValider(base, remi, aujourdhui)).toBe(0);
		expect(await nombreAValider(base, romain, aujourdhui)).toBe(1);
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, romain.id));
		expect(await nombreAValider(base, romain, aujourdhui)).toBe(0);
	});

	it('au départ d’un agent, ses réservations à venir sont annulées ; les passées restent', async () => {
		const { base, alice, bancs, vl } = await preparer();
		const { id: v } = await reserver(base, alice, vl, { debut: '2026-11-07T09:00', fin: '2026-11-07T12:00' }, maintenant);
		const { id: b } = await reserver(base, alice, bancs, { debut: '2026-11-12', fin: '2026-11-12', quantite: 1 }, maintenant);
		const [passee] = await base.insert(reservation).values({ ressourceId: bancs, personneId: alice.id, debut: '2026-10-12', fin: '2026-10-12', quantite: 1, etat: 'acceptee', creeLe: 'x' }).returning();
		await changerStatut(base, base.photos, superAdmin, alice.id, 'parti', maintenant);
		expect(await etat(base, v)).toMatchObject({ etat: 'annulee', motif: 'Départ du demandeur' });
		expect(await etat(base, b)).toMatchObject({ etat: 'annulee' });
		expect(await etat(base, passee!.id)).toMatchObject({ etat: 'acceptee' });
	});

	it('un créneau qui passe minuit chevauche le lendemain matin', () => {
		const nuit = { debut: '2026-11-07T22:00', fin: '2026-11-08T06:00' };
		expect(chevaucheCreneau(nuit, { debut: '2026-11-08T05:00', fin: '2026-11-08T07:00' })).toBe(true);
		expect(chevaucheCreneau(nuit, { debut: '2026-11-08T06:00', fin: '2026-11-08T07:00' })).toBe(false);
	});
});
