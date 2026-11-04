import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { repondreEvenement, voter } from '../src/actions/interactions.ts';
import { aNePasManquer } from '../src/a-ne-pas-manquer.ts';
import { lireMur, supprimerPublication } from '../src/actions/publications.ts';
import { apercusDesMurs } from '../src/apercus.ts';
import { DonneeInvalide } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { filDeNotifications } from '../src/notifications.ts';
import { enregistrerManoeuvre, publierAnnee, reglerRoulement, supprimerManoeuvre } from '../src/planning/annee.ts';
import { clotureSondage, manoeuvreChangee, mercrediDeRelance, planningDuMatin } from '../src/planning/manoeuvres.ts';
import { abonnementPush, affectationEquipe, attribution, envoiPush, equipe, manoeuvre, notification, personne, profil, publication, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const saisie = '2026-11-01T10:00';

// Chef (sans équipe), Alice (équipe 1), Bruno (équipe 2), chacun un téléphone abonné ; 2026 publiée.
async function jeu({ publiee = true } = {}) {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const ids = (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
	const nouvelle = async (prenom: string, equipeId?: number) => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'T', profilId: agent!.id }).returning();
		if (equipeId) await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId, debut: '2026-01-01' });
		await base.insert(abonnementPush).values({ personneId: p!.id, endpoint: `https://fcm.googleapis.com/${prenom}`, p256dh: 'a', auth: 'b', creeLe: saisie });
		return { type: 'personne' as const, id: p!.id };
	};
	const chef = await nouvelle('Chef');
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: chef.id, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const alice = await nouvelle('Alice', ids[0]);
	const bruno = await nouvelle('Bruno', ids[1]);
	await reglerRoulement(base, chef, 2026, ids, saisie);
	if (publiee) await publierAnnee(base, chef, 2026, saisie);
	// Dimanche 29 novembre 2026, 8 h 30, équipe 1, avec petit-déjeuner.
	const id = await enregistrerManoeuvre(base, chef, { debut: '2026-11-29T08:30', theme: 'Feux de forêt', lieu: 'Caserne', convoques: [ids[0]!], petitDejeuner: true }, saisie);
	const destinataires = async () => (await base.select({ p: notification.personneId }).from(notification)).map((x) => x.p).sort();
	return { base, ids, chef, alice, bruno, id, destinataires };
}

describe('règles de date', () => {
	it('relance : le mercredi qui précède d’au moins 2 jours', () => {
		expect(mercrediDeRelance('2026-11-29')).toBe('2026-11-25');
		expect(mercrediDeRelance('2026-11-27')).toBe('2026-11-25');
		expect(mercrediDeRelance('2026-11-26')).toBe('2026-11-18');
		expect(mercrediDeRelance('2026-11-25')).toBe('2026-11-18');
	});

	it('sondage : jusqu’au vendredi précédent à 18 h, sinon jusqu’au début', () => {
		expect(clotureSondage('2026-11-29T08:30', '2026-11-15T08:00')).toBe('2026-11-27T18:00');
		expect(clotureSondage('2026-11-27T08:30', '2026-11-15T08:00')).toBe('2026-11-20T18:00');
		expect(clotureSondage('2026-11-29T08:30', '2026-11-27T19:00')).toBe('2026-11-29T08:30');
	});
});

describe('annonce à deux semaines', () => {
	it('rien à J-15 ; à J-14, un événement sur « Le centre » signé « Planning du centre », avec le sondage', async () => {
		const { base, id, alice, destinataires } = await jeu();
		expect(await planningDuMatin(base, '2026-11-14T08:00')).toEqual({ publiees: 0, relances: 0 });
		expect(await planningDuMatin(base, '2026-11-15T08:00')).toEqual({ publiees: 1, relances: 0 });
		const [p] = await base.select().from(publication);
		expect(p).toMatchObject({ mur: 'centre', auteur: 'planning', type: 'evenement', debut: '2026-11-29T08:30', lieu: 'Caserne', sondageQuestion: 'Petit-déjeuner ?', sondageCloture: '2026-11-27T18:00' });
		expect(JSON.parse(p!.sondageReponses!)).toEqual(['Oui', 'Non']);
		expect((await base.select().from(manoeuvre).where(eq(manoeuvre.id, id)))[0]!.publicationId).toBe(p!.id);
		// Seulement les convoqués : Alice (équipe 1).
		expect(await destinataires()).toEqual([alice.id]);
		// Le jour est écrit en toutes lettres.
		expect((await base.select().from(notification))[0]!.texte).toContain('dimanche 29 novembre, 8 h 30 · Caserne');
		expect(await base.select().from(envoiPush)).toHaveLength(1);
		const vue = (await lireMur(base, alice, 'centre', {}, '2026-11-15T09:00')).publications[0]!;
		expect(vue.auteur).toMatchObject({ prenom: 'Planning', nom: 'du centre', ecrireA: null });
		expect(vue.evenement).toMatchObject({ convoque: true });
		expect((await filDeNotifications(base, alice, '2026-11-15T09:00')).lignes[0]).toMatchObject({ auteur: { prenom: 'Planning', nom: 'du centre' } });
		expect((await apercusDesMurs(base, alice, '2026-11-15')).find((a) => a.cle === 'centre')!.derniere!.auteur).toBe('Planning du centre');
		// Une seule fois.
		expect(await planningDuMatin(base, '2026-11-16T08:00')).toEqual({ publiees: 0, relances: 0 });
	});

	it('année non publiée, manœuvre annulée ou passée : rien', async () => {
		const { base } = await jeu({ publiee: false });
		expect(await planningDuMatin(base, '2026-11-20T08:00')).toEqual({ publiees: 0, relances: 0 });
		expect(await planningDuMatin(base, '2026-11-30T08:00')).toEqual({ publiees: 0, relances: 0 });
	});
});

describe('relance du mercredi', () => {
	it('aux convoqués sans réponse, une fois, le mercredi d’avant', async () => {
		const { base, alice, chef, ids } = await jeu();
		// Tout le centre : la deuxième manœuvre, pour voir qui a répondu.
		await enregistrerManoeuvre(base, chef, { debut: '2026-11-29T10:00', theme: 'Tous', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, saisie);
		await planningDuMatin(base, '2026-11-15T08:00');
		const [, tous] = await base.select().from(publication).orderBy(publication.id);
		await repondreEvenement(base, alice, tous!.id, 'present', '2026-11-16T10:00');
		await base.delete(notification);
		expect(await planningDuMatin(base, '2026-11-24T08:00')).toEqual({ publiees: 0, relances: 0 });
		expect(await planningDuMatin(base, '2026-11-25T08:00')).toEqual({ publiees: 0, relances: 2 });
		const lignes = await base.select({ p: notification.personneId, pub: notification.publicationId }).from(notification);
		// Feux de forêt (équipe 1) : Alice ; Tous : tout le monde sauf Alice qui a répondu.
		expect(lignes.filter((l) => l.pub === tous!.id).map((l) => l.p).sort()).not.toContain(alice.id);
		expect(lignes.filter((l) => l.pub !== tous!.id).map((l) => l.p)).toEqual([alice.id]);
		expect(await planningDuMatin(base, '2026-11-26T08:00')).toEqual({ publiees: 0, relances: 0 });
		expect(ids.length).toBe(4);
	});

	it('pas de relance le jour même de l’annonce', async () => {
		const { base, chef } = await jeu();
		await enregistrerManoeuvre(base, chef, { debut: '2026-12-06T08:30', theme: 'Tard', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, saisie);
		// Annoncée le mercredi 25 novembre (J-11) : sa relance tombe le 2 décembre.
		expect(await planningDuMatin(base, '2026-11-25T08:00')).toMatchObject({ publiees: 2 });
		expect(await planningDuMatin(base, '2026-11-25T08:03')).toEqual({ publiees: 0, relances: 0 });
	});
});

describe('changement ou annulation après annonce', () => {
	it('la publication suit la manœuvre, les convoqués sont prévenus', async () => {
		const { base, chef, alice, bruno, ids, id, destinataires } = await jeu();
		await planningDuMatin(base, '2026-11-15T08:00');
		await base.delete(notification);
		await enregistrerManoeuvre(base, chef, { id, debut: '2026-11-29T09:00', theme: 'Feux de forêt', lieu: 'Forêt de Paimpont', convoques: [ids[0]!, ids[1]!], petitDejeuner: false }, '2026-11-16T10:00');
		await manoeuvreChangee(base, id, '2026-11-16T10:00');
		const [p] = await base.select().from(publication);
		expect(p).toMatchObject({ debut: '2026-11-29T09:00', lieu: 'Forêt de Paimpont', convoques: JSON.stringify([ids[0], ids[1]]), sondageQuestion: null, modifieeLe: '2026-11-16T10:00' });
		expect(await destinataires()).toEqual([alice.id, bruno.id].sort());
	});

	it('annuler : la publication reste, marquée annulée ; plus de réponse ; la nuit ne republie pas', async () => {
		const { base, chef, alice, id, destinataires } = await jeu();
		await planningDuMatin(base, '2026-11-15T08:00');
		await base.delete(notification);
		await supprimerManoeuvre(base, chef, id, '2026-11-16T10:00');
		await manoeuvreChangee(base, id, '2026-11-16T10:00');
		const [p] = await base.select().from(publication);
		expect(p!.annuleeLe).toBe('2026-11-16T10:00');
		expect((await base.select().from(manoeuvre))[0]!.annuleeLe).toBe('2026-11-16T10:00');
		expect(await destinataires()).toEqual([alice.id]);
		expect((await lireMur(base, alice, 'centre', {}, '2026-11-16T11:00')).publications[0]!.annulee).toBe(true);
		await expect(repondreEvenement(base, alice, p!.id, 'present', '2026-11-16T11:00')).rejects.toThrow(DonneeInvalide);
		expect(await aNePasManquer(base, alice, '2026-11-16', '2026-11-16T11:00')).toMatchObject({ evenements: [], sondages: [] });
		expect(await planningDuMatin(base, '2026-11-25T08:00')).toEqual({ publiees: 0, relances: 0 });
		await expect(enregistrerManoeuvre(base, chef, { id, debut: '2026-11-29T09:00', theme: 'X', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, '2026-11-16T12:00')).rejects.toThrow(DonneeInvalide);
	});

	it('une manœuvre pas encore annoncée : rien à prévenir', async () => {
		const { base, id, destinataires } = await jeu();
		await manoeuvreChangee(base, id, '2026-11-02T10:00');
		expect(await destinataires()).toEqual([]);
	});
});

describe('après la revue', () => {
	it('publication supprimée par un modérateur : la manœuvre n’est pas annoncée une seconde fois', async () => {
		const { base, chef } = await jeu();
		await planningDuMatin(base, '2026-11-15T08:00');
		const [p] = await base.select().from(publication);
		await supprimerPublication(base, base.photos, chef, p!.id, '2026-11-15T09:00');
		expect(await planningDuMatin(base, '2026-11-16T08:00')).toEqual({ publiees: 0, relances: 0 });
		expect(await base.select().from(publication)).toHaveLength(0);
	});

	it('annulée : le sondage petit-déjeuner n’accepte plus de vote', async () => {
		const { base, chef, alice, id } = await jeu();
		await planningDuMatin(base, '2026-11-15T08:00');
		await supprimerManoeuvre(base, chef, id, '2026-11-16T10:00');
		const [p] = await base.select().from(publication);
		await expect(voter(base, alice, p!.id, 0, '2026-11-16T11:00')).rejects.toThrow(DonneeInvalide);
	});

	it('modifier le lieu après le vendredi 18 h ne rouvre pas le sondage ; changer la date le recalcule et rend la relance', async () => {
		const { base, chef, ids, id } = await jeu();
		await planningDuMatin(base, '2026-11-15T08:00');
		await planningDuMatin(base, '2026-11-25T08:00');
		const donnees = { id, debut: '2026-11-29T08:30', theme: 'Feux de forêt', lieu: 'Bois', convoques: [ids[0]!], petitDejeuner: true };
		await enregistrerManoeuvre(base, chef, donnees, '2026-11-28T10:00');
		expect((await base.select().from(publication))[0]!.sondageCloture).toBe('2026-11-27T18:00');
		await enregistrerManoeuvre(base, chef, { ...donnees, debut: '2026-12-06T08:30' }, '2026-11-28T11:00');
		expect((await base.select().from(publication))[0]!.sondageCloture).toBe('2026-12-04T18:00');
		expect((await base.select().from(manoeuvre))[0]!.relanceLe).toBeNull();
		expect(await planningDuMatin(base, '2026-12-02T08:00')).toEqual({ publiees: 0, relances: 1 });
	});

	it('une manœuvre passée ne s’annule plus', async () => {
		const { base, chef, id } = await jeu();
		await expect(supprimerManoeuvre(base, chef, id, '2026-11-30T10:00')).rejects.toThrow(DonneeInvalide);
	});
});

