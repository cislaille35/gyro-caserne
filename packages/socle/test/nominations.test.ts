import { count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { attribuer, attributionsDe, ceQueJePeuxAttribuer, terminerAttribution, titulairesDe } from '../src/actions/attributions.ts';
import { dissoudreComite } from '../src/actions/comites.ts';
import { archiverResponsabilite } from '../src/actions/responsabilites.ts';
import { aLeDroit, type Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { attribution, comite, equipe, journal, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-25';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const centre = { type: 'centre' as const };

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.typePersonne, 'agent'));
	const [bureau] = await base.insert(comite).values({ nom: 'Bureau', theme: 'direction' }).returning();
	const comites = await base.select().from(comite);
	const idComite = (nom: string) => comites.find((c) => c.nom === nom)!.id;
	const responsabilites = await base.select().from(responsabilite);
	const r = (nom: string) => responsabilites.find((x) => x.nom === nom)!.id;
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);

	const nouvelle = async (prenom: string) => (await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning())[0]!.id;
	const nommer = (personneId: number, nom: string, perimetre: Parameters<typeof attribuer>[2]['perimetre'], debut = '2026-01-01', fin?: string) =>
		attribuer(base, superAdmin, { personneId, responsabiliteId: r(nom), perimetre, debut, ...(fin ? { fin } : {}) }, aujourdhui);

	const chef = await nouvelle('Chef');
	await nommer(chef, 'Chef de centre', centre);
	const adjoint = await nouvelle('Adjoint');
	await nommer(adjoint, 'Chef de centre adjoint', centre);
	const rapporteur = await nouvelle('Rapporteur');
	const amicale = { type: 'comite' as const, id: idComite('Amicale') };
	await nommer(rapporteur, 'Rapporteur de comité', amicale);
	const simple = await nouvelle('Simple');

	const acteur = (id: number): Acteur => ({ type: 'personne', id });
	const ecritures = async () => [(await base.select({ n: count() }).from(attribution))[0]!.n, (await base.select({ n: count() }).from(journal))[0]!.n];
	return { base, r, idComite, equipes, bureau: { type: 'comite' as const, id: bureau!.id }, amicale, nouvelle, nommer, chef: acteur(chef), adjoint: acteur(adjoint), rapporteur: acteur(rapporteur), simple: acteur(simple), simpleId: simple, ecritures };
}

const noms = (liste: { nom: string }[]) => liste.map((l) => l.nom).sort();

describe('ceQueJePeuxAttribuer', () => {
	it('le super administrateur : tout, sur les équipes actives et les comités non dissous', async () => {
		const { base, r } = await jeu();
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.nom, 'Équipe 3'));
		await archiverResponsabilite(base, superAdmin, r('Référent pharmacie'), aujourdhui);
		await dissoudreComite(base, superAdmin, (await base.select().from(comite).where(eq(comite.nom, 'Bureau')))[0]!.id, aujourdhui);

		const liste = await ceQueJePeuxAttribuer(base, superAdmin, aujourdhui);
		expect(noms(liste)).toEqual(noms([{ nom: 'Chef de centre' }, { nom: 'Chef de centre adjoint' }, { nom: 'Chef d’équipe' }, { nom: 'Membre de comité' }, { nom: 'Rapporteur de comité' }, { nom: 'Référent engins' }, { nom: 'Référent technique' }]));
		const parNom = (nom: string) => liste.find((l) => l.nom === nom)!;
		expect(parNom('Chef de centre')).toMatchObject({ responsabiliteId: r('Chef de centre'), portee: 'centre', perimetres: [{ type: 'centre', id: null, nom: 'Centre' }] });
		expect(parNom('Chef d’équipe').perimetres.map((p) => p.nom)).toEqual(['Équipe 1', 'Équipe 2']);
		expect(parNom('Membre de comité').perimetres.map((p) => p.nom)).toEqual(['Amicale', 'Comité du centre']);
	});

	it('le chef de centre : tout sauf le chef de centre', async () => {
		const { base, chef } = await jeu();
		const liste = await ceQueJePeuxAttribuer(base, chef, aujourdhui);
		expect(noms(liste)).toEqual(noms([{ nom: 'Chef de centre adjoint' }, { nom: 'Chef d’équipe' }, { nom: 'Membre de comité' }, { nom: 'Rapporteur de comité' }, { nom: 'Référent engins' }, { nom: 'Référent pharmacie' }, { nom: 'Référent technique' }]));
	});

	it('l’adjoint : ni le chef de centre ni un adjoint', async () => {
		const { base, adjoint } = await jeu();
		const liste = noms(await ceQueJePeuxAttribuer(base, adjoint, aujourdhui));
		expect(liste).not.toContain('Chef de centre');
		expect(liste).not.toContain('Chef de centre adjoint');
		expect(liste).toContain('Référent engins');
	});

	it('le rapporteur de l’Amicale : les rôles du comité Amicale seulement', async () => {
		const { base, rapporteur, amicale } = await jeu();
		expect(await ceQueJePeuxAttribuer(base, rapporteur, aujourdhui)).toEqual([
			{ responsabiliteId: expect.any(Number), nom: 'Membre de comité', portee: 'comite', perimetres: [{ type: 'comite', id: amicale.id, nom: 'Amicale' }] },
			{ responsabiliteId: expect.any(Number), nom: 'Rapporteur de comité', portee: 'comite', perimetres: [{ type: 'comite', id: amicale.id, nom: 'Amicale' }] }
		]);
	});

	it('un agent ordinaire : rien', async () => {
		const { base, simple } = await jeu();
		expect(await ceQueJePeuxAttribuer(base, simple, aujourdhui)).toEqual([]);
	});
});

describe('attribuer : refus du rapporteur et doublons', () => {
	it('le rapporteur de l’Amicale ne nomme ni un référent engins, ni un membre d’un autre comité ; rien n’est écrit', async () => {
		const { base, r, rapporteur, simpleId, bureau, ecritures } = await jeu();
		const avant = await ecritures();
		await expect(attribuer(base, rapporteur, { personneId: simpleId, responsabiliteId: r('Référent engins'), perimetre: centre, debut: aujourdhui }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(attribuer(base, rapporteur, { personneId: simpleId, responsabiliteId: r('Membre de comité'), perimetre: bureau, debut: aujourdhui }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		expect(await ecritures()).toEqual(avant);
	});

	it('refuse la même personne, au même rôle, sur le même périmètre, pour des périodes qui se chevauchent', async () => {
		const { simpleId, nommer, amicale, bureau, ecritures } = await jeu();
		await nommer(simpleId, 'Référent engins', centre, '2026-01-01', '2026-06-30');
		await nommer(simpleId, 'Membre de comité', amicale, '2026-11-01');
		const avant = await ecritures();
		const message = 'Cette personne tient déjà ce rôle sur cette période';
		await expect(nommer(simpleId, 'Référent engins', centre, '2026-06-30')).rejects.toThrow(new DonneeInvalide(message));
		await expect(nommer(simpleId, 'Référent engins', centre, '2025-01-01', '2026-01-01')).rejects.toThrow(message);
		await expect(nommer(simpleId, 'Membre de comité', amicale, '2026-10-01', '2026-11-01')).rejects.toThrow(message);
		await expect(nommer(simpleId, 'Membre de comité', amicale, '2027-01-01')).rejects.toThrow(message);
		expect(await ecritures()).toEqual(avant);
		// Hors chevauchement ou sur un autre périmètre : accepté.
		await expect(nommer(simpleId, 'Référent engins', centre, '2026-07-01')).resolves.toBeTypeOf('number');
		await expect(nommer(simpleId, 'Membre de comité', amicale, '2026-10-01', '2026-10-31')).resolves.toBeTypeOf('number');
		await expect(nommer(simpleId, 'Membre de comité', bureau, '2026-11-01')).resolves.toBeTypeOf('number');
	});
});

describe('attributionsDe', () => {
	it('gestionnaires seulement', async () => {
		const { base, rapporteur, simpleId } = await jeu();
		await expect(attributionsDe(base, rapporteur, simpleId, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('classe en cours, à venir et passées, avec les noms des périmètres et de l’auteur', async () => {
		const { base, r, chef, simpleId, nommer, amicale, equipes } = await jeu();
		await nommer(simpleId, 'Référent engins', centre, '2025-01-01', '2025-12-31');
		await nommer(simpleId, 'Membre de comité', amicale, '2026-01-01', aujourdhui);
		await attribuer(base, chef, { personneId: simpleId, responsabiliteId: r('Chef d’équipe'), perimetre: { type: 'equipe', id: equipes[1]!.id }, debut: '2026-12-01' }, aujourdhui);

		const { enCours, aVenir, passees } = await attributionsDe(base, chef, simpleId, aujourdhui);
		expect(enCours).toEqual([
			{ id: expect.any(Number), responsabilite: { id: r('Membre de comité'), nom: 'Membre de comité' }, perimetre: { type: 'comite', id: amicale.id, nom: 'Amicale' }, debut: '2026-01-01', fin: aujourdhui, saisiePar: 'Super administrateur', peutTerminer: true }
		]);
		expect(aVenir).toEqual([
			{ id: expect.any(Number), responsabilite: { id: r('Chef d’équipe'), nom: 'Chef d’équipe' }, perimetre: { type: 'equipe', id: equipes[1]!.id, nom: 'Équipe 2' }, debut: '2026-12-01', fin: null, saisiePar: 'Chef Test', peutTerminer: true }
		]);
		expect(passees).toEqual([
			{ id: expect.any(Number), responsabilite: { id: r('Référent engins'), nom: 'Référent engins' }, perimetre: { type: 'centre', id: null, nom: null }, debut: '2025-01-01', fin: '2025-12-31', saisiePar: 'Super administrateur', peutTerminer: false }
		]);
	});

	it('peutTerminer est faux pour le rôle de chef de centre vu par l’adjoint', async () => {
		const { base, chef, adjoint } = await jeu();
		const vu = await attributionsDe(base, adjoint, chef.type === 'personne' ? chef.id : 0, aujourdhui);
		expect(vu.enCours.map((l) => [l.responsabilite.nom, l.peutTerminer])).toEqual([['Chef de centre', false]]);
		const parLeSuper = await attributionsDe(base, superAdmin, chef.type === 'personne' ? chef.id : 0, aujourdhui);
		expect(parLeSuper.enCours[0]!.peutTerminer).toBe(true);
	});

	it('n’affiche plus en cours un rôle dont le comité est dissous ou la responsabilité archivée', async () => {
		const { base, r, simpleId, nommer, bureau } = await jeu();
		await nommer(simpleId, 'Membre de comité', bureau);
		await nommer(simpleId, 'Référent pharmacie', centre);
		await dissoudreComite(base, superAdmin, bureau.id, aujourdhui);
		await archiverResponsabilite(base, superAdmin, r('Référent pharmacie'), aujourdhui);
		const { enCours, passees } = await attributionsDe(base, superAdmin, simpleId, aujourdhui);
		expect(enCours).toEqual([]);
		expect(passees.map((l) => l.responsabilite.nom).sort()).toEqual(['Membre de comité', 'Référent pharmacie']);
	});
});

describe('titulairesDe', () => {
	it('titulaires en cours et à venir, sur les périmètres que l’acteur peut attribuer', async () => {
		const { base, r, rapporteur, nouvelle, nommer, amicale, bureau } = await jeu();
		const enCours = await nouvelle('Encours');
		const aVenir = await nouvelle('Avenir');
		const passe = await nouvelle('Passe');
		const ailleurs = await nouvelle('Ailleurs');
		await nommer(enCours, 'Membre de comité', amicale);
		await nommer(aVenir, 'Membre de comité', amicale, '2026-12-01');
		await nommer(passe, 'Membre de comité', amicale, '2025-01-01', '2025-12-31');
		await nommer(ailleurs, 'Membre de comité', bureau);

		const vus = await titulairesDe(base, rapporteur, r('Membre de comité'), aujourdhui);
		expect(vus).toEqual([
			{ id: expect.any(Number), personne: { id: enCours, prenom: 'Encours', nom: 'Test' }, perimetre: { type: 'comite', id: amicale.id, nom: 'Amicale' }, debut: '2026-01-01', fin: null },
			{ id: expect.any(Number), personne: { id: aVenir, prenom: 'Avenir', nom: 'Test' }, perimetre: { type: 'comite', id: amicale.id, nom: 'Amicale' }, debut: '2026-12-01', fin: null }
		]);
		expect((await titulairesDe(base, superAdmin, r('Membre de comité'), aujourdhui)).map((t) => t.personne.prenom)).toEqual(['Ailleurs', 'Encours', 'Avenir']);
		expect(await titulairesDe(base, rapporteur, r('Référent engins'), aujourdhui)).toEqual([]);
		await expect(titulairesDe(base, rapporteur, 999, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('terminerAttribution', () => {
	it('une attribution à venir est annulée', async () => {
		const { base, simpleId, nommer } = await jeu();
		const id = await nommer(simpleId, 'Référent engins', centre, '2026-12-01');
		await terminerAttribution(base, superAdmin, id, aujourdhui);
		expect(await base.select().from(attribution).where(eq(attribution.id, id))).toEqual([]);
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'terminer_attribution'));
		expect(ligne).toMatchObject({ acteur: 'super:admin@exemple.fr', cibleType: 'attribution', cibleId: id });
	});

	it('une attribution commencée aujourd’hui est annulée', async () => {
		const { base, simpleId, nommer } = await jeu();
		const id = await nommer(simpleId, 'Référent engins', centre, aujourdhui);
		await terminerAttribution(base, superAdmin, id, aujourdhui);
		expect(await base.select().from(attribution).where(eq(attribution.id, id))).toEqual([]);
	});

	it('une attribution en cours finit la veille : plus aucun droit du rôle dès aujourd’hui', async () => {
		const { base, simpleId, simple, nommer } = await jeu();
		const id = await nommer(simpleId, 'Référent engins', centre);
		expect(await aLeDroit(base, simple, 'GERER_FICHES', centre, aujourdhui)).toBe(true);
		await terminerAttribution(base, superAdmin, id, aujourdhui);
		const [ligne] = await base.select().from(attribution).where(eq(attribution.id, id));
		expect(ligne!.fin).toBe('2026-10-24');
		expect(await aLeDroit(base, simple, 'GERER_FICHES', centre, aujourdhui)).toBe(false);
	});

	it('mêmes droits que finirAttribution ; rien n’est écrit en cas de refus', async () => {
		const { base, r, simpleId, rapporteur, adjoint, chef, nommer, ecritures } = await jeu();
		const id = await nommer(simpleId, 'Référent engins', centre);
		const [chefCentre] = await base.select().from(attribution).where(eq(attribution.responsabiliteId, r('Chef de centre')));
		const avant = await ecritures();
		await expect(terminerAttribution(base, rapporteur, id, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(terminerAttribution(base, adjoint, chefCentre!.id, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		expect(await ecritures()).toEqual(avant);
		await expect(terminerAttribution(base, chef, id, aujourdhui)).resolves.toBeUndefined();
	});

	it('refuse une attribution inconnue ou déjà terminée', async () => {
		const { base, simpleId, nommer } = await jeu();
		const id = await nommer(simpleId, 'Référent engins', centre, '2025-01-01', '2025-12-31');
		await expect(terminerAttribution(base, superAdmin, 999, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(terminerAttribution(base, superAdmin, id, aujourdhui)).rejects.toThrow('Attribution déjà terminée');
	});
});
