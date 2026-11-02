import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { anomaliesADecider, bloquanteClose, gesteAnomalie, gestesPermis, lireAnomalie, listerAnomalies, REGLAGE_ANOMALIES, signalerAnomalie, traiteLesAnomalies, type EtatAnomalie } from '../src/anomalies.ts';
import { accueilDe } from '../src/casquettes.ts';
import { enregistrerEngin } from '../src/engins.ts';
import { lireFiche } from '../src/fiches.ts';
import { filDeNotifications } from '../src/notifications.ts';
import { publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import { commencerPrise, gestePrise, prisesDeLaReleve, validerPrise } from '../src/prises.ts';
import { anomalie, anomalieSuivi, attribution, avisAnomalie, engin, equipe, responsabilite } from '../src/schema.ts';
import { jeuEngins } from './de-test-engins.ts';

const reglage = centreExemple.astreinte;
const QUAND = '2026-10-30T18:10';
const PLUS_TARD = '2026-10-31T09:00';
const jpeg = () => ({ type: 'image/jpeg' as const, donnees: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) });
const idDe = (a: { type: string; id?: number }) => (a as { id: number }).id;

async function jeu() {
	const j = await jeuEngins();
	const vtu = await enregistrerEngin(j.base, j.referent, { nom: 'VTU', immatriculation: '', typeId: j.types.VTU, situation: 'centre', provenance: '' }, QUAND);
	const vsav = await enregistrerEngin(j.base, j.referent, { nom: 'VSAV 1', immatriculation: '', typeId: j.types.VSAV, situation: 'centre', provenance: '' }, QUAND);
	const avis = async (qui: { type: string }) => j.base.select().from(avisAnomalie).where(eq(avisAnomalie.personneId, idDe(qui)));
	const etatEngin = async (id: number) => (await j.base.select({ etat: engin.etat }).from(engin).where(eq(engin.id, id)))[0]!.etat;
	const signaler = (qui = j.alice, libelle = 'Treuil HS') => signalerAnomalie(j.base, j.base.photos, qui, { enginId: vtu, libelle, genre: 'abime', note: 'ne se déroule plus' }, QUAND, reglage);
	return { ...j, vtu, vsav, avis, etatEngin, signaler };
}

describe('qui traite les anomalies', () => {
	it('le référent engins et le chef de garde ; pas un agent', async () => {
		const j = await jeu();
		expect(await traiteLesAnomalies(j.base, j.referent, '2026-10-30')).toBe(true);
		expect(await traiteLesAnomalies(j.base, j.chefDeGarde, '2026-10-30')).toBe(true);
		expect(await traiteLesAnomalies(j.base, j.alice, '2026-10-30')).toBe(false);
	});
});

describe('signalement direct', () => {
	it('l’engin reste disponible ; ceux qui traitent sont prévenus, pas le déclarant', async () => {
		const j = await jeu();
		const id = await j.signaler();
		const [a] = await j.base.select().from(anomalie).where(eq(anomalie.id, id));
		expect(a).toMatchObject({ etape: 'signalee', libelle: 'Treuil HS', zone: '', ref: null, genre: 'abime', note: 'ne se déroule plus', bloquante: 0, closeLe: null });
		expect(await j.etatEngin(j.vtu)).toBe('disponible');
		expect(await j.avis(j.referent)).toMatchObject([{ titre: 'Anomalie signalée · VTU', texte: 'Treuil HS, abîmé (Alice Fictif)', url: `/engins/anomalies/${id}` }]);
		expect(await j.avis(j.alice)).toEqual([]);
		// Sans planning publié, l'équipe d'astreinte n'est pas connue : son chef de garde n'est pas prévenu.
		expect(await j.avis(j.chefDeGarde)).toEqual([]);
	});

	it('le chef de garde de l’équipe d’astreinte est prévenu', async () => {
		const j = await jeu();
		const equipes = await j.base.select().from(equipe);
		await reglerRoulement(j.base, j.superAdmin, 2026, equipes.map((e) => e.id), '2026-01-01T10:00');
		await publierAnnee(j.base, j.superAdmin, 2026, '2026-01-01T10:00');
		const astreinte = (await prisesDeLaReleve(j.base, j.alice, QUAND, reglage)).releve.equipe!.id;
		await j.base.update(attribution).set({ perimetreId: astreinte }).where(eq(attribution.personneId, idDe(j.chefDeGarde)));
		await j.signaler();
		expect(await j.avis(j.chefDeGarde)).toHaveLength(1);
	});

	it('avec une photo ; refusé sans droit, sans problème décrit, sur un engin parti', async () => {
		const j = await jeu();
		const id = await signalerAnomalie(j.base, j.base.photos, j.alice, { enginId: j.vtu, libelle: 'Rétroviseur', genre: 'a_remplacer', note: '', photo: jpeg() }, QUAND, reglage);
		expect((await j.base.select().from(anomalie).where(eq(anomalie.id, id)))[0]!.photoId).not.toBeNull();
		await expect(signalerAnomalie(j.base, j.base.photos, j.sansProfil, { enginId: j.vtu, libelle: 'x', genre: 'abime', note: '' }, QUAND, reglage)).rejects.toThrow();
		await expect(signalerAnomalie(j.base, j.base.photos, j.alice, { enginId: j.vtu, libelle: '  ', genre: 'abime', note: '' }, QUAND, reglage)).rejects.toThrow('Problème vide');
		await enregistrerEngin(j.base, j.referent, { id: j.vtu, nom: 'VTU', immatriculation: '', typeId: j.types.VTU, situation: 'parti', provenance: '' }, QUAND);
		await expect(j.signaler()).rejects.toThrow('Engin parti');
	});
});

describe('gestes permis (sans base)', () => {
	const etat: EtatAnomalie = { etape: 'signalee', close: false, preneur: null, reparateur: null, bloquante: false, enginIndisponible: false, enginParti: false };
	const agent = { moi: 1, traite: false, prend: true };
	const chef = { moi: 2, traite: true, prend: true };
	const r = REGLAGE_ANOMALIES;

	it('signalée : un agent la prend, la met en attente ou la répare ; seul qui traite clôt ou rend l’engin indisponible', () => {
		expect(gestesPermis(etat, agent, r)).toEqual(['prendre', 'attente', 'reparee']);
		expect(gestesPermis(etat, chef, r)).toEqual(['prendre', 'attente', 'reparee', 'clore', 'indisponible']);
		expect(gestesPermis(etat, { moi: null, traite: true, prend: true }, r)).toEqual([]);
	});

	it('prise en charge par un autre : l’agent ne l’avance plus ; « en attente » seulement si le centre la suit', () => {
		const prise = { ...etat, etape: 'prise_en_charge' as const, preneur: 3 };
		expect(gestesPermis(prise, agent, r)).toEqual([]);
		expect(gestesPermis({ ...prise, preneur: 1 }, agent, r)).toEqual(['attente', 'reparee']);
		expect(gestesPermis({ ...prise, preneur: 1 }, agent, { ...r, enAttente: false })).toEqual(['reparee']);
	});

	it('réparée (vérification suivie) : vérifiée par un autre que le réparateur', () => {
		const reparee = { ...etat, etape: 'reparee' as const, preneur: 1, reparateur: 1 };
		expect(gestesPermis(reparee, agent, { ...r, verifiee: true })).toEqual([]);
		expect(gestesPermis(reparee, chef, { ...r, verifiee: true })).toEqual(['verifiee', 'clore', 'indisponible']);
	});

	it('close : remettre en service, seulement pour qui traite, si elle a rendu l’engin indisponible', () => {
		const close = { ...etat, close: true, bloquante: true, enginIndisponible: true };
		expect(gestesPermis(close, chef, r)).toEqual(['remettre']);
		expect(gestesPermis(close, agent, r)).toEqual([]);
		expect(gestesPermis({ ...close, enginIndisponible: false }, chef, r)).toEqual([]);
		expect(gestesPermis({ ...etat, bloquante: true, enginIndisponible: true }, chef, r)).not.toContain('remettre');
	});
});

describe('le suivi', () => {
	it('prise en charge, en attente au garage, réparée : close ; le déclarant est prévenu à chaque étape ; l’historique suit', async () => {
		const j = await jeu();
		const id = await j.signaler(j.chefDeGarde);
		await gesteAnomalie(j.base, j.alice, id, { quoi: 'prendre' }, QUAND, REGLAGE_ANOMALIES);
		await gesteAnomalie(j.base, j.alice, id, { quoi: 'attente', motif: 'garage', texte: 'départ lundi' }, QUAND, REGLAGE_ANOMALIES);
		await gesteAnomalie(j.base, j.alice, id, { quoi: 'reparee', texte: 'câble changé' }, PLUS_TARD, REGLAGE_ANOMALIES);
		const [a] = await j.base.select().from(anomalie).where(eq(anomalie.id, id));
		expect(a).toMatchObject({ etape: 'reparee', motifAttente: 'garage', priseEnChargePar: idDe(j.alice), closePar: idDe(j.alice), closeLe: PLUS_TARD });
		expect((await j.avis(j.chefDeGarde)).map((x) => x.texte)).toEqual(['Prise en charge par Alice Fictif', 'En attente (au garage), par Alice Fictif : départ lundi', 'Réparée par Alice Fictif : câble changé']);
		expect(await j.avis(j.alice)).toEqual([]);
		const vue = await lireAnomalie(j.base, j.chefDeGarde, id, PLUS_TARD, REGLAGE_ANOMALIES);
		expect(vue.historique.map((h) => [h.quoi, h.par, h.texte])).toEqual([
			['signalee', 'Chloé Fictif', 'ne se déroule plus'],
			['prise_en_charge', 'Alice Fictif', null],
			['en_attente', 'Alice Fictif', 'départ lundi'],
			['reparee', 'Alice Fictif', 'câble changé']
		]);
		expect(vue.close).toEqual({ le: PLUS_TARD, par: 'Alice Fictif', aLaPrise: false });
		// Ouvrir l'anomalie marque lue sa cloche.
		expect((await j.avis(j.chefDeGarde)).every((x) => x.lueLe !== null)).toBe(true);
		expect(await j.etatEngin(j.vtu)).toBe('disponible');
	});

	it('vérification suivie par le centre : réparée reste ouverte, vérifiée par un autre la clôt', async () => {
		const j = await jeu();
		const r = { ...REGLAGE_ANOMALIES, verifiee: true };
		const id = await j.signaler();
		await gesteAnomalie(j.base, j.alice, id, { quoi: 'reparee', texte: '' }, QUAND, r);
		expect((await j.base.select().from(anomalie).where(eq(anomalie.id, id)))[0]).toMatchObject({ etape: 'reparee', closeLe: null, priseEnChargePar: idDe(j.alice) });
		await expect(gesteAnomalie(j.base, j.alice, id, { quoi: 'verifiee' }, QUAND, r)).rejects.toThrow('Geste impossible');
		await gesteAnomalie(j.base, j.referent, id, { quoi: 'verifiee' }, QUAND, r);
		expect((await j.base.select().from(anomalie).where(eq(anomalie.id, id)))[0]).toMatchObject({ etape: 'verifiee', closePar: idDe(j.referent) });
	});

	it('indisponible : décidé par qui traite, jamais par l’agent ; remise en service une fois close, décision à part', async () => {
		const j = await jeu();
		const id = await j.signaler();
		await expect(gesteAnomalie(j.base, j.alice, id, { quoi: 'indisponible' }, QUAND, REGLAGE_ANOMALIES)).rejects.toThrow();
		await gesteAnomalie(j.base, j.referent, id, { quoi: 'indisponible' }, QUAND, REGLAGE_ANOMALIES);
		expect(await j.etatEngin(j.vtu)).toBe('indisponible');
		expect((await j.avis(j.alice)).at(-1)!.texte).toBe('Engin rendu indisponible par Rémi Fictif');
		// Ouverte, on ne la remet pas en service ; réparée, l'engin reste indisponible jusqu'à la décision.
		await expect(gesteAnomalie(j.base, j.referent, id, { quoi: 'remettre' }, QUAND, REGLAGE_ANOMALIES)).rejects.toThrow('Geste impossible');
		await gesteAnomalie(j.base, j.alice, id, { quoi: 'reparee', texte: '' }, QUAND, REGLAGE_ANOMALIES);
		expect(await j.etatEngin(j.vtu)).toBe('indisponible');
		expect((await lireAnomalie(j.base, j.referent, id, QUAND, REGLAGE_ANOMALIES)).gestes).toEqual(['remettre']);
		await expect(gesteAnomalie(j.base, j.alice, id, { quoi: 'remettre' }, QUAND, REGLAGE_ANOMALIES)).rejects.toThrow();
		await gesteAnomalie(j.base, j.chefDeGarde, id, { quoi: 'remettre' }, PLUS_TARD, REGLAGE_ANOMALIES);
		expect(await j.etatEngin(j.vtu)).toBe('disponible');
		const vue = await lireAnomalie(j.base, j.referent, id, PLUS_TARD, REGLAGE_ANOMALIES);
		expect(vue.bloquante).toBe(false);
		expect(vue.historique.map((h) => h.quoi)).toEqual(['signalee', 'indisponible', 'reparee', 'remise_en_service']);
	});

	it('deux gestes croisés : le second est refusé, rien n’est écrit deux fois', async () => {
		const j = await jeu();
		const id = await j.signaler();
		await gesteAnomalie(j.base, j.alice, id, { quoi: 'prendre' }, QUAND, REGLAGE_ANOMALIES);
		await expect(gesteAnomalie(j.base, j.chefDeGarde, id, { quoi: 'prendre' }, QUAND, REGLAGE_ANOMALIES)).rejects.toThrow('Geste impossible');
		expect((await lireAnomalie(j.base, j.referent, id, QUAND, REGLAGE_ANOMALIES)).historique).toHaveLength(2);
	});

	it('un collègue agit entre la relecture et l’écriture : rien n’est écrit, ni historique, ni cloche', async () => {
		const j = await jeu();
		const id = await j.signaler(j.chefDeGarde);
		const batch = j.base.batch.bind(j.base);
		let appel = 0;
		// Le deuxième batch du geste (après la relecture) : le référent le prend en charge juste avant.
		const espion = vi.spyOn(j.base, 'batch').mockImplementation(async (requetes) => {
			if (appel++ === 1) {
				await j.base.insert(anomalieSuivi).values({ anomalieId: id, quoi: 'prise_en_charge', par: idDe(j.referent), le: QUAND, jeton: 'autre' });
				await j.base.update(anomalie).set({ etape: 'prise_en_charge', priseEnChargePar: idDe(j.referent) }).where(eq(anomalie.id, id));
			}
			return batch(requetes);
		});
		await expect(gesteAnomalie(j.base, j.alice, id, { quoi: 'prendre' }, QUAND, REGLAGE_ANOMALIES)).rejects.toThrow('Anomalie changée entre-temps');
		espion.mockRestore();
		expect(await j.base.select().from(anomalieSuivi)).toHaveLength(1);
		expect((await j.base.select().from(anomalie).where(eq(anomalie.id, id)))[0]!.priseEnChargePar).toBe(idDe(j.referent));
		expect(await j.avis(j.chefDeGarde)).toEqual([]);
	});

	it('le même geste envoyé deux fois (double appui) : écrit une fois, prévenu une fois', async () => {
		const j = await jeu();
		const id = await j.signaler(j.chefDeGarde);
		const batch = j.base.batch.bind(j.base);
		let appel = 0;
		// Les deux envois relisent avant toute écriture : le second passe juste après le premier.
		const espion = vi.spyOn(j.base, 'batch').mockImplementation(async (requetes) => {
			if (appel++ === 1) {
				espion.mockImplementation(batch);
				await gesteAnomalie(j.base, j.alice, id, { quoi: 'prendre' }, QUAND, REGLAGE_ANOMALIES);
			}
			return batch(requetes);
		});
		await expect(gesteAnomalie(j.base, j.alice, id, { quoi: 'prendre' }, QUAND, REGLAGE_ANOMALIES)).rejects.toThrow('Anomalie changée entre-temps');
		espion.mockRestore();
		expect(await j.base.select().from(anomalieSuivi)).toHaveLength(1);
		expect(await j.avis(j.chefDeGarde)).toHaveLength(1);
	});

	it('remettre en service relu avant un nouveau blocage d’un collègue : refusé, son blocage reste', async () => {
		const j = await jeu();
		const premiere = await j.signaler();
		const seconde = await j.signaler(j.alice, 'Phare');
		await gesteAnomalie(j.base, j.referent, premiere, { quoi: 'indisponible' }, QUAND, REGLAGE_ANOMALIES);
		await gesteAnomalie(j.base, j.referent, premiere, { quoi: 'clore', texte: '' }, QUAND, REGLAGE_ANOMALIES);
		expect(await bloquanteClose(j.base, j.vtu)).toBe(premiere);
		const batch = j.base.batch.bind(j.base);
		let appel = 0;
		const espion = vi.spyOn(j.base, 'batch').mockImplementation(async (requetes) => {
			if (appel++ === 1) await j.base.update(anomalie).set({ bloquante: 1 }).where(eq(anomalie.id, seconde));
			return batch(requetes);
		});
		await expect(gesteAnomalie(j.base, j.chefDeGarde, premiere, { quoi: 'remettre' }, QUAND, REGLAGE_ANOMALIES)).rejects.toThrow('Anomalie changée entre-temps');
		espion.mockRestore();
		expect(await j.etatEngin(j.vtu)).toBe('indisponible');
		expect((await j.base.select().from(anomalie).where(eq(anomalie.id, seconde)))[0]!.bloquante).toBe(1);
	});

	it('clore sans réparation (qui traite), avec un motif ; motif d’attente inconnu refusé', async () => {
		const j = await jeu();
		const id = await j.signaler();
		await expect(gesteAnomalie(j.base, j.alice, id, { quoi: 'attente', motif: 'lune' as 'garage', texte: '' }, QUAND, REGLAGE_ANOMALIES)).rejects.toThrow('Motif inconnu');
		await expect(gesteAnomalie(j.base, j.alice, id, { quoi: 'clore', texte: '' }, QUAND, REGLAGE_ANOMALIES)).rejects.toThrow();
		await gesteAnomalie(j.base, j.referent, id, { quoi: 'clore', texte: 'Signalé deux fois' }, QUAND, REGLAGE_ANOMALIES);
		expect((await j.avis(j.alice)).at(-1)!.texte).toBe('Close par Rémi Fictif : Signalé deux fois');
	});
});

describe('la liste et « À décider »', () => {
	it('ouvertes d’abord, par engin ; puis les closes ; filtre par engin', async () => {
		const j = await jeu();
		const treuil = await j.signaler();
		const autre = await signalerAnomalie(j.base, j.base.photos, j.alice, { enginId: j.vsav, libelle: 'Brancard', genre: 'abime', note: '' }, QUAND, reglage);
		const close = await j.signaler(j.alice, 'Phare');
		await gesteAnomalie(j.base, j.referent, close, { quoi: 'clore', texte: '' }, QUAND, REGLAGE_ANOMALIES);
		const l = await listerAnomalies(j.base, j.alice, '2026-10-30', null);
		// Le VSAV passe avant le VTU (ordre des types).
		expect(l.ouvertes.map((a) => a.id)).toEqual([autre, treuil]);
		expect(l.closes.map((a) => a.id)).toEqual([close]);
		expect(l.peutSignaler).toBe(true);
		expect((await listerAnomalies(j.base, j.alice, '2026-10-30', j.vtu)).ouvertes.map((a) => a.id)).toEqual([treuil]);
	});

	it('au chef de garde de l’équipe d’astreinte et à « Le centre » ; pas au chef d’une autre équipe', async () => {
		const j = await jeu();
		const equipes = await j.base.select().from(equipe);
		await reglerRoulement(j.base, j.superAdmin, 2026, equipes.map((e) => e.id), '2026-01-01T10:00');
		await publierAnnee(j.base, j.superAdmin, 2026, '2026-01-01T10:00');
		const astreinte = (await prisesDeLaReleve(j.base, j.alice, QUAND, reglage)).releve.equipe!.id;
		await j.signaler();
		const item = { texte: '1 anomalie signalée à prendre en charge : VTU', lien: '/engins/anomalies' };
		await j.base.update(attribution).set({ perimetreId: astreinte }).where(eq(attribution.personneId, idDe(j.chefDeGarde)));
		expect((await accueilDe(j.base, j.chefDeGarde, `equipe:${astreinte}`, '2026-10-30', QUAND, reglage)).contenu).toMatchObject({ aDecider: expect.arrayContaining([item]) });
		const autre = equipes.find((e) => e.id !== astreinte)!.id;
		await j.base.update(attribution).set({ perimetreId: autre }).where(eq(attribution.personneId, idDe(j.chefDeGarde)));
		expect((await accueilDe(j.base, j.chefDeGarde, `equipe:${autre}`, '2026-10-30', QUAND, reglage)).contenu).toMatchObject({ aDecider: [] });
		expect((await accueilDe(j.base, j.superAdmin, 'centre', '2026-10-30', QUAND, reglage)).contenu).toMatchObject({ aDecider: expect.arrayContaining([item]) });
	});

	it('au référent engins : les signalées à prendre en charge, et l’engin à remettre en service', async () => {
		const j = await jeu();
		const id = await j.signaler();
		const [ref] = await j.base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent engins'));
		const cle = `role:${ref!.id}`;
		const accueil = await accueilDe(j.base, j.referent, cle, '2026-10-30', QUAND, reglage);
		expect(accueil.contenu).toMatchObject({ aDecider: [{ texte: '1 anomalie signalée à prendre en charge : VTU', lien: '/engins/anomalies' }] });
		await gesteAnomalie(j.base, j.referent, id, { quoi: 'indisponible' }, QUAND, REGLAGE_ANOMALIES);
		await gesteAnomalie(j.base, j.referent, id, { quoi: 'reparee', texte: '' }, QUAND, REGLAGE_ANOMALIES);
		expect((await anomaliesADecider(j.base, QUAND, reglage, [])).items).toEqual([{ texte: 'VTU indisponible, anomalie close : remettre en service ?', lien: `/engins/anomalies/${id}` }]);
		// L'agent n'a rien à décider.
		expect((await accueilDe(j.base, j.alice, null, '2026-10-30', QUAND, reglage)).casquettes.every((c) => c.compte === 0)).toBe(true);
	});
});

describe('la prise de garde', () => {
	it('valider : les nouvelles anomalies à ceux qui traitent ; un élément retrouvé, au déclarant', async () => {
		const j = await jeu();
		const fiche = await lireFiche(j.base, j.types.VSAV);
		const radio = fiche.zones[0]!.elements.find((e) => e.libelle.startsWith('Radio'))!;
		const toutVoir = async (id: number, quand: string) => {
			for (const z of fiche.zones) await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'zone', zone: z.ref, vue: true }, quand, reglage);
		};
		const p1 = await commencerPrise(j.base, j.base.photos, j.chefDeGarde, j.vsav, QUAND, reglage);
		await gestePrise(j.base, j.base.photos, j.chefDeGarde, p1, { quoi: 'ecart', element: radio.ref, genre: 'abime', manque: null, note: '' }, QUAND, reglage);
		await toutVoir(p1, QUAND);
		await validerPrise(j.base, j.chefDeGarde, p1, QUAND, reglage);
		expect(await j.avis(j.referent)).toMatchObject([{ titre: 'Prise de garde · VSAV 1', texte: '1 anomalie signalée par Chloé Fictif : Radio : essai', url: `/engins/anomalies?engin=${j.vsav}` }]);
		const [a] = await j.base.select().from(anomalie).where(eq(anomalie.enginId, j.vsav));
		// La relève suivante la retrouve.
		const suivante = '2026-11-06T18:10';
		const p2 = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, suivante, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, p2, { quoi: 'retrouve', anomalie: a!.id, oui: true }, suivante, reglage);
		await toutVoir(p2, suivante);
		await validerPrise(j.base, j.alice, p2, suivante, reglage);
		expect((await j.avis(j.chefDeGarde)).at(-1)).toMatchObject({ texte: 'Retrouvée à la prise de garde par Alice Fictif', url: `/engins/anomalies/${a!.id}` });
		expect((await lireAnomalie(j.base, j.alice, a!.id, suivante, REGLAGE_ANOMALIES)).historique.map((h) => h.quoi)).toEqual(['signalee', 'retrouvee']);
		// Une anomalie close par un collègue avant la validation : pas de « Retrouvée » envoyé à tort.
		await signalerAnomalie(j.base, j.base.photos, j.chefDeGarde, { enginId: j.vsav, libelle: 'Brancard', genre: 'abime', note: '' }, suivante, reglage);
		const [brancard] = await j.base.select().from(anomalie).where(eq(anomalie.libelle, 'Brancard'));
		const p3 = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, '2026-11-13T18:10', reglage);
		await gestePrise(j.base, j.base.photos, j.alice, p3, { quoi: 'retrouve', anomalie: brancard!.id, oui: true }, '2026-11-13T18:10', reglage);
		for (const z of fiche.zones) await gestePrise(j.base, j.base.photos, j.alice, p3, { quoi: 'zone', zone: z.ref, vue: true }, '2026-11-13T18:10', reglage);
		await gesteAnomalie(j.base, j.referent, brancard!.id, { quoi: 'clore', texte: '' }, '2026-11-13T18:10', REGLAGE_ANOMALIES);
		const avant = (await j.avis(j.chefDeGarde)).length;
		await validerPrise(j.base, j.alice, p3, '2026-11-13T18:20', reglage);
		expect((await j.avis(j.chefDeGarde)).length).toBe(avant);
		// La cloche les montre.
		const fil = await filDeNotifications(j.base, j.chefDeGarde, '2026-11-13T18:20');
		expect(fil.lignes).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'anomalie', titre: 'VSAV 1 · Radio : essai', lue: false })]));
		expect(fil.nonLues).toBeGreaterThan(0);
	});
});

describe('données fictives', () => {
	it('le treuil du VTU au garage, une seule fois ; l’engin reste disponible', async () => {
		const j = await jeu();
		const { chargerAnomaliesFictives } = await import('../src/anomalies.ts');
		await chargerAnomaliesFictives(j.base, QUAND);
		await chargerAnomaliesFictives(j.base, QUAND);
		const lignes = await j.base.select().from(anomalie);
		expect(lignes).toMatchObject([{ libelle: 'Treuil hors service', etape: 'en_attente', motifAttente: 'garage', enginId: j.vtu }]);
		expect(await j.etatEngin(j.vtu)).toBe('disponible');
	});
});
