import { eq, sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { enregistrerEngin } from '../src/engins.ts';
import { lireFiche, modifierFicheEngin } from '../src/fiches.ts';
import { publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import {
	abandonnerPrise,
	appliquerGestePrise,
	commencerPrise,
	gestePrise,
	historiquePrises,
	lienPriseOuvert,
	lirePrise,
	lirePriseFaite,
	photoAnomalie,
	premierGestePrise,
	prisesDeLaReleve,
	prisesEnRetard,
	releveDe,
	SAISIE_VIDE,
	validerPrise
} from '../src/prises.ts';
import { accueilDe, casquettesDe } from '../src/casquettes.ts';
import { RefusDroit } from '../src/erreurs.ts';
import { anomalie, attribution, engin, equipe, ficheVersion, notification, personne, priseGarde } from '../src/schema.ts';
import { photo as octets } from '../src/schema-photos.ts';
import { jeuEngins } from './de-test-engins.ts';

const reglage = centreExemple.astreinte;
// Le réglage d'exemple : relève le vendredi. Le 30 octobre 2026 est un vendredi.
const RELEVE = `2026-10-30T${reglage.debut.heure}`;
const PENDANT = '2026-10-30T18:10';
const jpeg = () => ({ type: 'image/jpeg' as const, donnees: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) });

async function jeu() {
	const j = await jeuEngins();
	const vsav = await enregistrerEngin(j.base, j.referent, { nom: 'VSAV 1', immatriculation: '', typeId: j.types.VSAV, situation: 'centre', provenance: '' }, PENDANT);
	const fpt = await enregistrerEngin(j.base, j.referent, { nom: 'FPT', immatriculation: '', typeId: j.types.FPT, situation: 'centre', provenance: '' }, PENDANT);
	const fiche = await lireFiche(j.base, j.types.VSAV);
	const cabine = fiche.zones[0]!;
	const gilets = cabine.elements.find((e) => e.libelle.startsWith('Gilets'))!;
	const radio = cabine.elements.find((e) => e.libelle.startsWith('Radio'))!;
	const [bruno] = await j.base.select().from(personne).where(eq(personne.email, 'cdg@exemple.fr'));
	return { ...j, vsav, fpt, fiche, cabine, gilets, radio, chloe: bruno!.id };
}

// Toutes les zones vues, pour valider.
async function toutVoir(j: Awaited<ReturnType<typeof jeu>>, id: number, quand = PENDANT) {
	for (const z of j.fiche.zones) await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'zone', zone: z.ref, vue: true }, quand, reglage);
}

describe('relève', () => {
	it('la dernière commencée, avec deux heures d’avance', () => {
		expect(releveDe('2026-10-30T18:10', reglage)).toBe(RELEVE);
		expect(releveDe('2026-11-04T09:00', reglage)).toBe(RELEVE);
		// Deux heures avant, la relève qui vient est déjà la bonne.
		const avant = `2026-11-06T${String(Number(reglage.debut.heure.slice(0, 2)) - 2).padStart(2, '0')}${reglage.debut.heure.slice(2)}`;
		expect(releveDe(avant, reglage)).toBe(`2026-11-06T${reglage.debut.heure}`);
		expect(releveDe('2026-11-06T08:00', reglage)).toBe(RELEVE);
	});

	it('aux bornes : l’heure exacte, la minute avant l’avance, le passage d’année', () => {
		expect(releveDe('2026-10-30T18:00', reglage)).toBe(RELEVE);
		expect(releveDe('2026-11-06T15:59', reglage)).toBe(RELEVE);
		expect(releveDe('2026-11-06T16:00', reglage)).toBe('2026-11-06T18:00');
		// Le vendredi 1er janvier 2027 : la relève appartient à 2027.
		expect(releveDe('2027-01-01T08:00', reglage)).toBe('2026-12-25T18:00');
		expect(releveDe('2027-01-02T10:00', reglage)).toBe('2027-01-01T18:00');
	});
});

describe('lien de l’accueil vers la prise de garde', () => {
	// La carte d'une astreinte qui commence avec la relève du vendredi 6 novembre.
	it.each([
		['la veille', '2026-11-05T18:00', false],
		['2 h 01 avant', '2026-11-06T15:59', false],
		['2 h avant pile', '2026-11-06T16:00', true],
		['à la relève', '2026-11-06T18:00', true],
		['24 h après pile', '2026-11-07T18:00', true],
		['24 h après, les secondes ne comptent pas', '2026-11-07T18:00:59', true],
		['24 h 01 après', '2026-11-07T18:01', false],
		['le reste de la semaine', '2026-11-10T09:00', false]
	])('%s', (_cas, maintenant, attendu) => {
		expect(lienPriseOuvert('2026-11-06T18:00', maintenant, reglage)).toBe(attendu);
	});

	it('été : l’astreinte commence dimanche, le lien suit la relève du vendredi', () => {
		const plage = '2027-07-11T08:00';
		expect(releveDe('2027-07-09T18:30', reglage)).toBe('2027-07-09T18:00');
		expect(lienPriseOuvert(plage, '2027-07-09T15:59', reglage)).toBe(false);
		expect(lienPriseOuvert(plage, '2027-07-09T16:00', reglage)).toBe(true);
		expect(lienPriseOuvert(plage, '2027-07-10T18:00', reglage)).toBe(true);
		expect(lienPriseOuvert(plage, '2027-07-10T18:01', reglage)).toBe(false);
		// Le jour de sa plage, la relève est passée depuis plus de 24 h.
		expect(lienPriseOuvert(plage, '2027-07-11T08:00', reglage)).toBe(false);
	});

	it('l’astreinte d’une autre semaine : pas de lien', () => {
		// La semaine qui finit (l'équipe descendante, deux heures avant la relève).
		expect(lienPriseOuvert('2026-10-30T18:00', '2026-11-06T17:00', reglage)).toBe(false);
		// Une semaine à venir : la relève du jour n'est pas la sienne.
		expect(lienPriseOuvert('2026-11-13T18:00', '2026-11-06T18:30', reglage)).toBe(false);
		// Le dernier moment de la semaine reste dans la semaine.
		expect(lienPriseOuvert('2026-11-13T17:59', '2026-11-06T18:30', reglage)).toBe(true);
	});

	it('passe le changement d’année', () => {
		expect(lienPriseOuvert('2027-01-01T18:00', '2027-01-01T16:00', reglage)).toBe(true);
		expect(lienPriseOuvert('2027-01-01T18:00', '2027-01-02T18:00', reglage)).toBe(true);
	});
});

describe('gestes du brouillon (sans base)', () => {
	const zones = [{ ref: 1, nom: 'Cabine', elements: [{ ref: 5, libelle: 'Gilets', quantite: 3 }, { ref: 2, libelle: 'Radio', quantite: null }] }];
	const ctx = { zones, ouvertes: [{ id: 9, ref: 2 }], agents: [1, 2] };

	it('écart : genre, nombre manquant seulement pour un élément compté, note', () => {
		const s = appliquerGestePrise(SAISIE_VIDE, { quoi: 'ecart', element: 5, genre: 'manquant', manque: 1, note: ' sous le siège ' }, ctx);
		expect(s.ecarts['5']).toEqual({ genre: 'manquant', manque: 1, note: 'sous le siège', photo: null });
		expect(() => appliquerGestePrise(SAISIE_VIDE, { quoi: 'ecart', element: 5, genre: 'manquant', manque: 4, note: '' }, ctx)).toThrow('Nombre manquant invalide');
		expect(appliquerGestePrise(SAISIE_VIDE, { quoi: 'ecart', element: 5, genre: 'abime', manque: 2, note: '' }, ctx).ecarts['5']!.manque).toBeNull();
		expect(() => appliquerGestePrise(SAISIE_VIDE, { quoi: 'ecart', element: 77, genre: 'abime', manque: null, note: '' }, ctx)).toThrow('Élément inconnu');
		// Déjà signalé et encore ouvert : on dit s'il est retrouvé, on ne le signale pas deux fois.
		expect(() => appliquerGestePrise(SAISIE_VIDE, { quoi: 'ecart', element: 2, genre: 'abime', manque: null, note: '' }, ctx)).toThrow('Élément déjà signalé');
	});

	it('zone vue, retrouvé, participants connus seulement', () => {
		let s = appliquerGestePrise(SAISIE_VIDE, { quoi: 'zone', zone: 1, vue: true }, ctx);
		s = appliquerGestePrise(s, { quoi: 'retrouve', anomalie: 9, oui: true }, ctx);
		s = appliquerGestePrise(s, { quoi: 'participants', ids: [2] }, ctx);
		expect(s).toMatchObject({ zones: [1], retrouves: [9], participants: [2] });
		expect(appliquerGestePrise(s, { quoi: 'zone', zone: 1, vue: false }, ctx).zones).toEqual([]);
		expect(() => appliquerGestePrise(s, { quoi: 'retrouve', anomalie: 8, oui: true }, ctx)).toThrow('Anomalie inconnue');
		expect(() => appliquerGestePrise(s, { quoi: 'participants', ids: [3] }, ctx)).toThrow('Participant inconnu');
	});
});

describe('prise de garde', () => {
	it('commencer : une seule prise par engin et par relève, la version de fiche est marquée utilisée', async () => {
		const j = await jeu();
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		expect(await commencerPrise(j.base, j.base.photos, j.chefDeGarde, j.vsav, '2026-10-30T18:12', reglage)).toBe(id);
		const [v] = await j.base.select().from(ficheVersion).where(eq(ficheVersion.id, j.fiche.version.id));
		expect(v!.utilisee).toBe(1);
		const vue = await lirePrise(j.base, j.chefDeGarde, j.vsav, '2026-10-30T18:15', reglage);
		expect(vue.prise).toMatchObject({ id, etat: 'en_cours', commenceePar: 'Alice Fictif' });
		expect(vue.prise!.saisie.participants).toEqual([j.alice.type === 'personne' ? j.alice.id : 0]);
		expect(vue.zones.map((z) => z.nom)).toEqual(j.fiche.zones.map((z) => z.nom));
	});

	it('réservée à qui a FAIRE_PRISE_DE_GARDE ; un engin parti n’a pas de prise', async () => {
		const j = await jeu();
		await expect(commencerPrise(j.base, j.base.photos, j.sansProfil, j.vsav, PENDANT, reglage)).rejects.toThrow();
		await expect(commencerPrise(j.base, j.base.photos, j.superAdmin, j.vsav, PENDANT, reglage)).rejects.toThrow('Réservé aux agents');
		await enregistrerEngin(j.base, j.referent, { id: j.fpt, nom: 'FPT', immatriculation: '', typeId: j.types.FPT, situation: 'parti', provenance: '' }, PENDANT);
		await expect(commencerPrise(j.base, j.base.photos, j.alice, j.fpt, PENDANT, reglage)).rejects.toThrow('Engin parti');
	});

	it('passer la main : un collègue reprend le brouillon ; la fiche peut changer, la prise garde sa version', async () => {
		const j = await jeu();
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		await gestePrise(j.base, j.base.photos, j.chefDeGarde, id, { quoi: 'zone', zone: j.cabine.ref, vue: true }, '2026-10-30T18:20', reglage);
		await modifierFicheEngin(j.base, j.referent, j.types.VSAV, { quoi: 'retirer_zone', zone: j.cabine.ref }, '2026-10-30T18:21');
		const vue = await lirePrise(j.base, j.alice, j.vsav, '2026-10-30T18:22', reglage);
		expect(vue.prise).toMatchObject({ modifieePar: 'Chloé Fictif' });
		expect(vue.prise!.saisie.zones).toEqual([j.cabine.ref]);
		expect(vue.zones[0]!.nom).toBe('Cabine');
	});

	it('valider : toutes les zones vues ; les écarts deviennent des anomalies ; la prise est au nom des participants', async () => {
		const j = await jeu();
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'ecart', element: j.gilets.ref, genre: 'manquant', manque: 1, note: 'Un gilet', photo: jpeg() }, PENDANT, reglage);
		await expect(validerPrise(j.base, j.alice, id, '2026-10-30T18:30', reglage)).rejects.toThrow('Zones à voir');
		await toutVoir(j, id);
		await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'participants', ids: [j.chloe] }, PENDANT, reglage);
		await validerPrise(j.base, j.alice, id, '2026-10-30T18:40', reglage);
		const [a] = await j.base.select().from(anomalie);
		expect(a).toMatchObject({ enginId: j.vsav, ref: j.gilets.ref, zone: 'Cabine', genre: 'manquant', manque: 1, note: 'Un gilet', priseId: id, signaleeLe: '2026-10-30T18:40', closeLe: null });
		expect(a!.photoId).not.toBeNull();
		const faite = await lirePriseFaite(j.base, j.chefDeGarde, id);
		expect(faite.participants).toEqual(['Alice Fictif', 'Chloé Fictif']);
		expect(faite.signalees.map((x) => x.libelle)).toEqual([j.gilets.libelle]);
		// Validée : plus de geste.
		await expect(gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'zone', zone: j.cabine.ref, vue: false }, '2026-10-30T18:41', reglage)).rejects.toThrow('Prise déjà validée');
		expect((await historiquePrises(j.base, j.vsav)).map((h) => [h.id, h.signalees])).toEqual([[id, 1]]);
	});

	it('la relève suivante voit les écarts ouverts ; retrouvé, l’anomalie est close par la prise, jamais en silence', async () => {
		const j = await jeu();
		const premiere = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, premiere, { quoi: 'ecart', element: j.gilets.ref, genre: 'manquant', manque: 1, note: '' }, PENDANT, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, premiere, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: 'Grésille' }, PENDANT, reglage);
		await toutVoir(j, premiere);
		await validerPrise(j.base, j.alice, premiere, PENDANT, reglage);

		const suivante = '2026-11-06T18:10';
		const vue = await lirePrise(j.base, j.chefDeGarde, j.vsav, suivante, reglage);
		expect(vue.prise).toBeNull();
		expect(vue.ouvertes.map((o) => o.libelle)).toEqual([j.radio.libelle, j.gilets.libelle]);
		const id = await commencerPrise(j.base, j.base.photos, j.chefDeGarde, j.vsav, suivante, reglage);
		const gilets = vue.ouvertes.find((o) => o.ref === j.gilets.ref)!;
		await gestePrise(j.base, j.base.photos, j.chefDeGarde, id, { quoi: 'retrouve', anomalie: gilets.id, oui: true }, suivante, reglage);
		await toutVoir(j, id, suivante);
		await validerPrise(j.base, j.chefDeGarde, id, '2026-11-06T18:30', reglage);
		const lignes = await j.base.select().from(anomalie);
		expect(lignes.find((l) => l.id === gilets.id)).toMatchObject({ closeLe: '2026-11-06T18:30', closePriseId: id });
		// La radio, rien dit : toujours ouverte.
		expect(lignes.find((l) => l.ref === j.radio.ref)!.closeLe).toBeNull();
		expect(lignes).toHaveLength(2);
		expect((await lirePriseFaite(j.base, j.alice, id)).retrouvees.map((r) => r.libelle)).toEqual([j.gilets.libelle]);
	});

	it('une relève passée ne se reprend pas ; abandonner efface le brouillon et ses photos', async () => {
		const j = await jeu();
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		await expect(gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'zone', zone: j.cabine.ref, vue: true }, '2026-11-06T18:10', reglage)).rejects.toThrow('Relève passée');
		await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: '', photo: jpeg() }, PENDANT, reglage);
		expect(await j.base.photos.select().from(octets)).toHaveLength(1);
		await abandonnerPrise(j.base, j.base.photos, j.chefDeGarde, id, PENDANT);
		expect(await j.base.select().from(priseGarde)).toHaveLength(0);
		expect(await j.base.photos.select().from(octets)).toHaveLength(0);
	});

	it('photo d’un écart : changée ou retirée, l’ancienne est effacée ; servie à qui voit les engins', async () => {
		const j = await jeu();
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		const ecart = { quoi: 'ecart' as const, element: j.radio.ref, genre: 'abime' as const, manque: null, note: '' };
		await gestePrise(j.base, j.base.photos, j.alice, id, { ...ecart, photo: jpeg() }, PENDANT, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, id, { ...ecart, note: 'garde la photo' }, PENDANT, reglage);
		const [premiere] = await j.base.photos.select().from(octets);
		const vue = await lirePrise(j.base, j.alice, j.vsav, PENDANT, reglage);
		expect(vue.prise!.saisie.ecarts[String(j.radio.ref)]!.photo).toBe(premiere!.id);
		expect((await photoAnomalie(j.base, j.base.photos, j.alice, premiere!.id, '2026-10-30')).type).toBe('image/jpeg');
		await expect(photoAnomalie(j.base, j.base.photos, j.sansProfil, premiere!.id, '2026-10-30')).rejects.toThrow();
		await expect(photoAnomalie(j.base, j.base.photos, j.alice, 999, '2026-10-30')).rejects.toThrow('Photo inconnue');
		await gestePrise(j.base, j.base.photos, j.alice, id, { ...ecart, photo: null }, PENDANT, reglage);
		expect(await j.base.photos.select().from(octets)).toHaveLength(0);
		await gestePrise(j.base, j.base.photos, j.alice, id, { ...ecart, photo: jpeg() }, PENDANT, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'retirer_ecart', element: j.radio.ref }, PENDANT, reglage);
		expect(await j.base.photos.select().from(octets)).toHaveLength(0);
	});
});

describe('le premier geste commence la prise', () => {
	const idDe = (a: unknown) => (a as { id: number }).id;
	const complet = (zone: number) => ({ quoi: 'zone' as const, zone, vue: true });

	it('lire ne crée rien ; le premier « Tout est complet » crée le brouillon et marque la zone, en mon nom', async () => {
		const j = await jeu();
		const vue = await lirePrise(j.base, j.alice, j.vsav, PENDANT, reglage);
		expect(vue.prise).toBeNull();
		expect(vue.zones.length).toBeGreaterThan(0);
		expect(await j.base.select().from(priseGarde)).toHaveLength(0);
		await premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, complet(j.cabine.ref), PENDANT, reglage);
		const [p] = await j.base.select().from(priseGarde);
		expect(p).toMatchObject({ enginId: j.vsav, releve: RELEVE, etat: 'en_cours', commenceePar: idDe(j.alice), modifieePar: idDe(j.alice), compteur: 1 });
		const s = JSON.parse(p!.saisie);
		expect(s.zones).toEqual([j.cabine.ref]);
		expect(s.participants).toEqual([idDe(j.alice)]);
		const [v] = await j.base.select().from(ficheVersion).where(eq(ficheVersion.id, p!.versionId));
		expect(v!.utilisee).toBe(1);
	});

	it('un écart avec photo commence aussi la prise', async () => {
		const j = await jeu();
		await premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: '', photo: jpeg() }, PENDANT, reglage);
		const [p] = await j.base.select().from(priseGarde);
		const e = JSON.parse(p!.saisie).ecarts[String(j.radio.ref)];
		expect(e.photo).toEqual(expect.any(Number));
		expect(await j.base.photos.select().from(octets)).toHaveLength(1);
	});

	it('un signalement retrouvé commence aussi la prise', async () => {
		const j = await jeu();
		const avant = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, avant, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: '' }, PENDANT, reglage);
		await toutVoir(j, avant);
		await validerPrise(j.base, j.alice, avant, PENDANT, reglage);
		const [a] = await j.base.select().from(anomalie);
		const id = await premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, { quoi: 'retrouve', anomalie: a!.id, oui: true }, '2026-11-06T18:10', reglage);
		const [p] = await j.base.select().from(priseGarde).where(eq(priseGarde.id, id));
		expect(p!.releve).toBe('2026-11-06T18:00');
		expect(JSON.parse(p!.saisie).retrouves).toEqual([a!.id]);
	});

	it('premier écart refusé : aucun brouillon ; celui d’un collègue, ou déjà touché, reste', async () => {
		const j = await jeu();
		const refuse = { quoi: 'ecart' as const, element: 999999, genre: 'abime' as const, manque: null, note: '' };
		await expect(premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, refuse, PENDANT, reglage)).rejects.toThrow('Élément inconnu');
		expect(await j.base.select().from(priseGarde)).toHaveLength(0);
		// Le brouillon vide d'un collègue.
		await commencerPrise(j.base, j.base.photos, j.referent, j.vsav, PENDANT, reglage);
		await expect(premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, refuse, PENDANT, reglage)).rejects.toThrow('Élément inconnu');
		expect(await j.base.select().from(priseGarde)).toHaveLength(1);
		// Mon brouillon déjà touché.
		const fpt = (await lireFiche(j.base, j.types.FPT)).zones[0]!;
		await premierGestePrise(j.base, j.base.photos, j.alice, j.fpt, complet(fpt.ref), PENDANT, reglage);
		await expect(premierGestePrise(j.base, j.base.photos, j.alice, j.fpt, refuse, PENDANT, reglage)).rejects.toThrow('Élément inconnu');
		expect(await j.base.select().from(priseGarde)).toHaveLength(2);
	});

	it('annuler ou choisir les participants sans prise : refusé, aucun brouillon', async () => {
		const j = await jeu();
		for (const geste of [{ quoi: 'zone' as const, zone: j.cabine.ref, vue: false }, { quoi: 'retirer_ecart' as const, element: j.radio.ref }, { quoi: 'participants' as const, ids: [idDe(j.alice)] }]) {
			await expect(premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, geste, PENDANT, reglage)).rejects.toThrow('Prise inconnue');
		}
		expect(await j.base.select().from(priseGarde)).toHaveLength(0);
	});

	it('sans le droit, ou un engin parti : refusé, aucun brouillon', async () => {
		const j = await jeu();
		await expect(premierGestePrise(j.base, j.base.photos, j.sansProfil, j.vsav, complet(j.cabine.ref), PENDANT, reglage)).rejects.toThrow(RefusDroit);
		await j.base.update(engin).set({ situation: 'parti', partiLe: '2026-10-30' }).where(eq(engin.id, j.vsav));
		await expect(premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, complet(j.cabine.ref), PENDANT, reglage)).rejects.toThrow('Engin parti');
		expect(await j.base.select().from(priseGarde)).toHaveLength(0);
	});

	it('la fenêtre : 2 h 01 avant la relève, le geste vaut pour la relève en cours ; 2 h avant, pour celle qui vient', async () => {
		const j = await jeu();
		await premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, complet(j.cabine.ref), '2026-11-06T15:59', reglage);
		await premierGestePrise(j.base, j.base.photos, j.alice, j.fpt, complet((await lireFiche(j.base, j.types.FPT)).zones[0]!.ref), '2026-11-06T16:00', reglage);
		const lignes = await j.base.select().from(priseGarde).orderBy(priseGarde.id);
		expect(lignes.map((l) => l.releve)).toEqual([RELEVE, '2026-11-06T18:00']);
	});

	it('un collègue a commencé entre-temps : son brouillon est repris, il en reste l’auteur', async () => {
		const j = await jeu();
		const id = await commencerPrise(j.base, j.base.photos, j.referent, j.vsav, PENDANT, reglage);
		expect(await premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, complet(j.cabine.ref), '2026-10-30T18:20', reglage)).toBe(id);
		const lignes = await j.base.select().from(priseGarde);
		expect(lignes).toHaveLength(1);
		expect(lignes[0]).toMatchObject({ commenceePar: idDe(j.referent), modifieePar: idDe(j.alice), modifieeLe: '2026-10-30T18:20' });
	});

	it('une prise déjà validée par un collègue : refusé, elle ne change pas', async () => {
		const j = await jeu();
		const id = await commencerPrise(j.base, j.base.photos, j.referent, j.vsav, PENDANT, reglage);
		await toutVoir(j, id);
		await validerPrise(j.base, j.alice, id, PENDANT, reglage);
		const [avant] = await j.base.select().from(priseGarde);
		await expect(premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, complet(j.cabine.ref), PENDANT, reglage)).rejects.toThrow('Prise déjà validée');
		expect((await j.base.select().from(priseGarde))[0]).toEqual(avant);
	});

	it('deux collègues au même moment : un seul brouillon, les deux gestes gardés par le compteur', async () => {
		const j = await jeu();
		const [a, b] = j.fiche.zones;
		await Promise.all([premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, complet(a!.ref), PENDANT, reglage), premierGestePrise(j.base, j.base.photos, j.referent, j.vsav, complet(b!.ref), PENDANT, reglage)]);
		const lignes = await j.base.select().from(priseGarde);
		expect(lignes).toHaveLength(1);
		expect(JSON.parse(lignes[0]!.saisie).zones.sort()).toEqual([a!.ref, b!.ref].sort());
		expect(lignes[0]!.compteur).toBe(2);
	});

	it('le geste ne prévient personne : les notifications partent à la validation, comme avant', async () => {
		const j = await jeu();
		await premierGestePrise(j.base, j.base.photos, j.alice, j.vsav, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: '' }, PENDANT, reglage);
		expect(await j.base.select().from(notification)).toHaveLength(0);
		expect(await j.base.select().from(anomalie)).toHaveLength(0);
	});
});

describe('à plusieurs sur le même brouillon', () => {
	// Un collègue écrit entre la lecture et l'écriture : le compteur de la prise avance `fois` fois juste après la lecture.
	function collegue(j: Awaited<ReturnType<typeof jeu>>, id: number, fois: number) {
		const batch = j.base.batch.bind(j.base);
		const espion = vi.spyOn(j.base, 'batch');
		for (let i = 0; i < fois; i++)
			espion.mockImplementationOnce((async (q: Parameters<typeof batch>[0]) => {
				const r = await batch(q);
				await j.base.update(priseGarde).set({ compteur: sql`${priseGarde.compteur} + 1` }).where(eq(priseGarde.id, id));
				return r;
			}) as unknown as typeof batch);
		return espion;
	}

	it('un conflit : le geste est refait sur la saisie relue', async () => {
		const j = await jeu();
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		collegue(j, id, 1);
		await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'zone', zone: j.cabine.ref, vue: true }, PENDANT, reglage);
		expect((await lirePrise(j.base, j.alice, j.vsav, PENDANT, reglage)).prise!.saisie.zones).toEqual([j.cabine.ref]);
	});

	it('deux conflits : refusé, et la photo envoyée est effacée', async () => {
		const j = await jeu();
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		collegue(j, id, 2);
		await expect(gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: '', photo: jpeg() }, PENDANT, reglage)).rejects.toThrow('Prise changée entre-temps');
		expect(await j.base.photos.select().from(octets)).toHaveLength(0);
	});

	it('une validation croisée par un geste : rien n’est écrit', async () => {
		const j = await jeu();
		const avant = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, '2026-10-23T18:10', reglage);
		await gestePrise(j.base, j.base.photos, j.alice, avant, { quoi: 'ecart', element: j.gilets.ref, genre: 'manquant', manque: 1, note: '' }, '2026-10-23T18:10', reglage);
		await toutVoir(j, avant, '2026-10-23T18:10');
		await validerPrise(j.base, j.alice, avant, '2026-10-23T18:20', reglage);
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		const [ouverte] = await j.base.select().from(anomalie);
		await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'retrouve', anomalie: ouverte!.id, oui: true }, PENDANT, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: '' }, PENDANT, reglage);
		await toutVoir(j, id);
		collegue(j, id, 1);
		await expect(validerPrise(j.base, j.alice, id, PENDANT, reglage)).rejects.toThrow('Prise changée entre-temps');
		const lignes = await j.base.select().from(anomalie);
		expect(lignes).toHaveLength(1);
		expect(lignes[0]!.closeLe).toBeNull();
		expect((await j.base.select().from(priseGarde).where(eq(priseGarde.id, id)))[0]!.etat).toBe('en_cours');
		// Deux validations : la seconde le dit.
		vi.restoreAllMocks();
		await validerPrise(j.base, j.alice, id, PENDANT, reglage);
		await expect(validerPrise(j.base, j.chefDeGarde, id, PENDANT, reglage)).rejects.toThrow('Prise déjà validée');
	});
});

describe('garde-fous du brouillon', () => {
	it('un brouillon d’une relève passée est effacé à la prise suivante, ses photos aussi', async () => {
		const j = await jeu();
		const vieux = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, '2026-10-23T18:10', reglage);
		await gestePrise(j.base, j.base.photos, j.alice, vieux, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: '', photo: jpeg() }, '2026-10-23T18:10', reglage);
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		expect((await j.base.select().from(priseGarde)).map((p) => p.id)).toEqual([id]);
		expect(await j.base.photos.select().from(octets)).toHaveLength(0);
	});

	it('la prise d’un autre engin est refusée ; un engin parti entre-temps aussi', async () => {
		const j = await jeu();
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		const zone = { quoi: 'zone' as const, zone: j.cabine.ref, vue: true };
		await expect(gestePrise(j.base, j.base.photos, j.alice, id, zone, PENDANT, reglage, j.fpt)).rejects.toThrow('Prise inconnue');
		await expect(validerPrise(j.base, j.alice, id, PENDANT, reglage, j.fpt)).rejects.toThrow('Prise inconnue');
		await expect(abandonnerPrise(j.base, j.base.photos, j.alice, id, PENDANT, j.fpt)).rejects.toThrow('Prise inconnue');
		await gestePrise(j.base, j.base.photos, j.alice, id, zone, PENDANT, reglage, j.vsav);
		await enregistrerEngin(j.base, j.referent, { id: j.vsav, nom: 'VSAV 1', immatriculation: '', typeId: j.types.VSAV, situation: 'parti', provenance: '' }, PENDANT);
		await expect(gestePrise(j.base, j.base.photos, j.alice, id, zone, PENDANT, reglage)).rejects.toThrow('Engin parti');
	});

	it('retrouvé, un élément peut recevoir un nouvel écart : l’ancien est clos, le nouveau ouvert', async () => {
		const j = await jeu();
		const avant = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, '2026-10-23T18:10', reglage);
		await gestePrise(j.base, j.base.photos, j.alice, avant, { quoi: 'ecart', element: j.gilets.ref, genre: 'manquant', manque: 1, note: '' }, '2026-10-23T18:10', reglage);
		await toutVoir(j, avant, '2026-10-23T18:10');
		await validerPrise(j.base, j.alice, avant, '2026-10-23T18:20', reglage);
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		const [ancienne] = await j.base.select().from(anomalie);
		const nouvel = { quoi: 'ecart' as const, element: j.gilets.ref, genre: 'abime' as const, manque: null, note: 'Déchiré' };
		await expect(gestePrise(j.base, j.base.photos, j.alice, id, nouvel, PENDANT, reglage)).rejects.toThrow('Élément déjà signalé');
		await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'retrouve', anomalie: ancienne!.id, oui: true }, PENDANT, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, id, nouvel, PENDANT, reglage);
		await toutVoir(j, id);
		await validerPrise(j.base, j.alice, id, PENDANT, reglage);
		const lignes = await j.base.select().from(anomalie);
		expect(lignes.map((l) => [l.genre, l.closeLe !== null])).toEqual([
			['manquant', true],
			['abime', false]
		]);
	});
});

describe('la relève et le retard', () => {
	// Planning publié : l'équipe d'astreinte de la relève est connue.
	async function avecPlanning() {
		const j = await jeu();
		const equipes = await j.base.select().from(equipe);
		const admin = j.superAdmin;
		await reglerRoulement(j.base, admin, 2026, equipes.map((e) => e.id), '2026-01-01T10:00');
		await publierAnnee(j.base, admin, 2026, '2026-01-01T10:00');
		return { ...j, equipes };
	}

	it('chaque engin : prise faite (par quelle équipe, quand), en cours ou à faire ; écarts ouverts comptés', async () => {
		const j = await avecPlanning();
		const id = await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, PENDANT, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: '' }, PENDANT, reglage);
		await toutVoir(j, id);
		await validerPrise(j.base, j.alice, id, '2026-10-30T18:40', reglage);
		const r = await prisesDeLaReleve(j.base, j.alice, '2026-10-30T19:00', reglage);
		expect(r.releve.debut).toBe(RELEVE);
		expect(r.releve.equipe).not.toBeNull();
		expect(r.peutFaire).toBe(true);
		const vsav = r.engins.find((e) => e.engin.id === j.vsav)!;
		expect(vsav.prise).toMatchObject({ etat: 'validee', valideeLe: '2026-10-30T18:40', equipe: r.releve.equipe!.nom });
		expect(vsav.ouvertes).toBe(1);
		expect(vsav.engin).toMatchObject({ nom: 'VSAV 1', type: 'VSAV' });
		expect(r.engins.find((e) => e.engin.id === j.fpt)!.prise).toBeNull();
	});

	it('la relève du 1er janvier 2027 prend l’équipe du planning 2027', async () => {
		const j = await avecPlanning();
		expect((await prisesDeLaReleve(j.base, j.alice, '2027-01-01T19:00', reglage)).releve.equipe).toBeNull();
		await reglerRoulement(j.base, j.superAdmin, 2027, j.equipes.map((e) => e.id), '2026-10-01T10:00');
		await publierAnnee(j.base, j.superAdmin, 2027, '2026-10-01T10:00');
		expect((await prisesDeLaReleve(j.base, j.alice, '2027-01-01T19:00', reglage)).releve).toMatchObject({ debut: '2027-01-01T18:00', equipe: { nom: expect.stringMatching(/^Équipe/) } });
	});

	it('en retard trois heures après la relève : au chef de garde de l’équipe d’astreinte, jamais d’indisponibilité', async () => {
		const j = await avecPlanning();
		const r = await prisesDeLaReleve(j.base, j.alice, PENDANT, reglage);
		expect(await prisesEnRetard(j.base, PENDANT, reglage)).toBeNull();
		const tard = '2026-10-30T23:00';
		expect(await prisesEnRetard(j.base, tard, reglage)).toEqual({ equipeId: r.releve.equipe!.id, engins: ['VSAV 1', 'FPT'] });
		// Le chef de garde de l'équipe d'astreinte le voit à l'Accueil.
		const chef = j.chefDeGarde.type === 'personne' ? j.chefDeGarde.id : 0;
		await j.base.update(attribution).set({ perimetreId: r.releve.equipe!.id }).where(eq(attribution.personneId, chef));
		const casquettes = await casquettesDe(j.base, j.chefDeGarde, '2026-10-30', tard, reglage);
		expect(casquettes.find((c) => c.id === `equipe:${r.releve.equipe!.id}`)!.compte).toBe(1);
		const accueil = await accueilDe(j.base, j.chefDeGarde, `equipe:${r.releve.equipe!.id}`, '2026-10-30', tard, reglage);
		expect(accueil.contenu).toMatchObject({ aDecider: [{ texte: 'Prise de garde en retard : VSAV 1, FPT', lien: '/engins/prise' }] });
		expect((await j.base.select({ etat: engin.etat }).from(engin)).map((e) => e.etat)).toEqual(['disponible', 'disponible']);
		// Chef d'une autre équipe : rien pour lui ; « Le centre » le voit.
		const autre = j.equipes.find((x) => x.id !== r.releve.equipe!.id)!.id;
		await j.base.update(attribution).set({ perimetreId: autre }).where(eq(attribution.personneId, chef));
		expect((await casquettesDe(j.base, j.chefDeGarde, '2026-10-30', tard, reglage)).find((c) => c.id === `equipe:${autre}`)!.compte).toBe(0);
		const centre = await accueilDe(j.base, j.superAdmin, 'centre', '2026-10-30', tard, reglage);
		expect(centre.contenu).toMatchObject({ aDecider: expect.arrayContaining([{ texte: 'Prise de garde en retard : VSAV 1, FPT', lien: '/engins/prise' }]) });
	});
});
