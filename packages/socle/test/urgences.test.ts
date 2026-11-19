import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { gesteAnomalie, REGLAGE_ANOMALIES, signalerAnomalie } from '../src/anomalies.ts';
import { enregistrerEngin } from '../src/engins.ts';
import { couper } from '../src/notifications.ts';
import { publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import { abonnementPush, attribution, avisAnomalie, envoiPush, equipe, journal, personne, profil, responsabilite } from '../src/schema.ts';
import { suiviDuCentre } from '../src/suivi.ts';
import { equipeSansChefDemain } from '../src/urgences.ts';
import { jeuEngins } from './de-test-engins.ts';

const reglage = centreExemple.astreinte;
const QUAND = '2026-10-30T18:10';

// Le jeu des engins (Alice, Chloé cheffe de garde de la première équipe, Rémi référent engins), plus Claire cheffe de centre
// et Paul adjoint ; chacun un téléphone abonné.
async function jeu() {
	const j = await jeuEngins();
	const [agent] = await j.base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const nommer = async (prenom: string, systeme: 'chef_centre' | 'chef_centre_adjoint') => {
		const [p] = await j.base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Fictif', profilId: agent!.id }).returning();
		const [r] = await j.base.select().from(responsabilite).where(eq(responsabilite.systeme, systeme));
		await j.base.insert(attribution).values({ personneId: p!.id, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		return { type: 'personne' as const, id: p!.id };
	};
	const claire = await nommer('Claire', 'chef_centre');
	const paul = await nommer('Paul', 'chef_centre_adjoint');
	const tous = await j.base.select({ id: personne.id }).from(personne);
	for (const p of tous) await j.base.insert(abonnementPush).values({ personneId: p.id, endpoint: `https://fcm.googleapis.com/${p.id}`, p256dh: 'a', auth: 'b', creeLe: QUAND });
	const vtu = await enregistrerEngin(j.base, j.referent, { nom: 'VTU', immatriculation: '', typeId: j.types.VTU, situation: 'centre', provenance: '' }, QUAND);
	const idDe = (a: unknown) => (a as { id: number }).id;
	const envois = async (qui: unknown) =>
		(await j.base.select({ donnees: envoiPush.donnees }).from(envoiPush).innerJoin(abonnementPush, eq(abonnementPush.id, envoiPush.abonnementId)).where(eq(abonnementPush.personneId, idDe(qui)))).map((e) => JSON.parse(e.donnees) as { titre: string; texte: string; url: string });
	const cloche = async (qui: unknown) => (await j.base.select().from(avisAnomalie).where(eq(avisAnomalie.personneId, idDe(qui)))).map((a) => a.titre);
	const signaler = () => signalerAnomalie(j.base, j.base.photos, j.alice, { enginId: vtu, libelle: 'Treuil HS', genre: 'abime', note: '' }, QUAND, reglage);
	return { ...j, claire, paul, vtu, envois, cloche, signaler, idDe };
}

describe('urgence : un engin indisponible', () => {
	it('le chef et l’adjoint sont prévenus au téléphone et dans la cloche, avec le lien vers l’engin', async () => {
		const j = await jeu();
		const id = await j.signaler();
		await j.base.delete(envoiPush);
		await gesteAnomalie(j.base, j.referent, id, { quoi: 'indisponible' }, QUAND, REGLAGE_ANOMALIES);
		for (const chef of [j.claire, j.paul]) {
			expect(await j.envois(chef)).toEqual([expect.objectContaining({ titre: 'VTU indisponible', texte: 'Treuil HS · décidé par Rémi Fictif', url: `/engins/${j.vtu}` })]);
			expect(await j.cloche(chef)).toEqual(['VTU indisponible']);
		}
		// Le déclarant garde son avis habituel.
		expect((await j.envois(j.alice)).map((e) => e.titre)).toEqual(['VTU · Treuil HS']);
	});

	it('le chef qui rend l’engin indisponible n’est pas prévenu de son propre geste ; l’adjoint l’est', async () => {
		const j = await jeu();
		const id = await j.signaler();
		await j.base.delete(envoiPush);
		await gesteAnomalie(j.base, j.claire, id, { quoi: 'indisponible' }, QUAND, REGLAGE_ANOMALIES);
		expect(await j.envois(j.claire)).toEqual([]);
		expect(await j.cloche(j.claire)).toEqual([]);
		expect((await j.envois(j.paul)).map((e) => e.titre)).toEqual(['VTU indisponible']);
	});

	it('« urgences » ou « tout » coupés : rien au téléphone, la ligne de la cloche reste', async () => {
		const j = await jeu();
		await couper(j.base, j.claire, 'urgences', true, QUAND);
		await couper(j.base, j.paul, 'tout', true, QUAND);
		const id = await j.signaler();
		await j.base.delete(envoiPush);
		await gesteAnomalie(j.base, j.referent, id, { quoi: 'indisponible' }, QUAND, REGLAGE_ANOMALIES);
		expect(await j.envois(j.claire)).toEqual([]);
		expect(await j.envois(j.paul)).toEqual([]);
		expect(await j.cloche(j.claire)).toEqual(['VTU indisponible']);
	});
});

describe('urgence : une équipe sans chef de garde la veille de sa relève', () => {
	// La relève est le vendredi à 18 h ; le jeudi 5 novembre 2026, à 8 h, on regarde celle du lendemain.
	const VEILLE = '2026-11-05T08:00';
	async function avecPlanning() {
		const j = await jeu();
		const equipes = await j.base.select().from(equipe).orderBy(equipe.ordreRotation);
		await reglerRoulement(j.base, j.superAdmin, 2026, equipes.map((e) => e.id), '2026-01-01T10:00');
		await publierAnnee(j.base, j.superAdmin, 2026, '2026-01-01T10:00');
		return { ...j, equipes };
	}

	it('hors de la veille à 8 h : rien, sans lire la base', async () => {
		const j = await avecPlanning();
		for (const quand of ['2026-11-05T07:50', '2026-11-05T09:00', '2026-11-04T08:00', '2026-11-06T08:00']) {
			const avant = j.base.requetes;
			expect(await equipeSansChefDemain(j.base, quand, reglage), quand).toBe(0);
			expect(j.base.requetes - avant, quand).toBe(0);
		}
	});

	it('l’équipe de la relève sans chef de garde en fonction : le chef et l’adjoint sont prévenus une fois ; la ligne est dans leur suivi', async () => {
		const j = await avecPlanning();
		// L'équipe d'astreinte de cette relève n'a pas de chef de garde (celui de la première équipe ne compte pas pour une autre).
		await j.base.delete(attribution).where(eq(attribution.personneId, j.idDe(j.chefDeGarde)));
		expect(await equipeSansChefDemain(j.base, VEILLE, reglage)).toBe(1);
		const [envoi] = await j.envois(j.claire);
		expect(envoi).toMatchObject({ titre: expect.stringMatching(/ sans chef de garde demain$/), url: '/nominations' });
		expect((await j.envois(j.paul)).length).toBe(1);
		expect(await j.envois(j.alice)).toEqual([]);
		// Une seule fois par relève, même au passage de 8 h 10.
		expect(await equipeSansChefDemain(j.base, '2026-11-05T08:10', reglage)).toBe(0);
		expect((await j.envois(j.claire)).length).toBe(1);
		const { lignes } = await suiviDuCentre(j.base, j.claire, '2026-11-05');
		expect(lignes[0]).toMatchObject({ qui: 'Planning', phrase: expect.stringMatching(/^signale l’équipe .+ sans chef de garde pour la relève de demain$/), lien: '/nominations' });
	});

	it('un chef de garde en fonction sur l’équipe de la relève : rien', async () => {
		const j = await avecPlanning();
		const { equipeAstreinte } = await import('../src/prises.ts');
		const id = await equipeAstreinte(j.base, '2026-11-06T18:00', reglage);
		await j.base.update(attribution).set({ perimetreId: id }).where(eq(attribution.personneId, j.idDe(j.chefDeGarde)));
		expect(await equipeSansChefDemain(j.base, VEILLE, reglage)).toBe(0);
		expect(await j.base.select().from(journal).where(eq(journal.action, 'alerter_sans_chef'))).toEqual([]);
	});

	it('sans planning publié : rien', async () => {
		const j = await jeu();
		expect(await equipeSansChefDemain(j.base, VEILLE, reglage)).toBe(0);
	});
});
