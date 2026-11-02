import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { planningDe } from '../src/planning/annee.ts';
import { astreinteDe } from '../src/planning/astreinte.ts';
import { agendaDe, monLienAgenda } from '../src/planning/agenda.ts';
import { ajouterMesVacances, reglerEte } from '../src/planning/ete.ts';
import { ajusterPlage, eteAPreparer, proposer, proposerEte, publierEte, texteManque } from '../src/planning/repartition.ts';
import { bandesDe, disponible, lireContexte, valideurs } from '../src/remplacements/contexte.ts';
import { demanderRemplacement } from '../src/remplacements/demandes.ts';
import { attribution, responsabilite } from '../src/schema.ts';
import { avisEte, demandeRemplacement, plageEte } from '../src/schema.ts';
import type { Poste } from '../src/armement.ts';
import { jeuEte } from './jeu-ete.ts';
import { apercuPlanning, appliquerPlanning, donneesFichierPlanning } from '../src/planning/fichier.ts';

const reglage = centreExemple.astreinte;
const maintenant = '2027-03-01T10:00';
const FPT = { ca2: 1, ca1: 0, ce: 2, cod1: 1, agent: 2 };
// Les sept plages de la semaine du vendredi 25 juin 2027 (Équipe 2).
const VEN = '2027-06-25T18:00';
const LUN = '2027-06-28T18:00';
const MAR = '2027-06-29T18:00';

// Équipe 2 : Bruno (CA2), Cora (COD1), Denis et Eva (CE), Fred, Gina. Alice (équipe 1, CA2), Hugo (équipe 3, COD1), le chef (sans équipe).
// Été d'une semaine ; Gina en vacances toute la semaine, Bruno le lundi.
async function jeu() {
	const j = await jeuEte();
	const { nouvelle, apte, a, base, chef } = j;
	const p = {
		bruno: await nouvelle('Bruno', 2),
		cora: await nouvelle('Cora', 2),
		denis: await nouvelle('Denis', 2),
		eva: await nouvelle('Eva', 2),
		fred: await nouvelle('Fred', 2),
		gina: await nouvelle('Gina', 2),
		alice: await nouvelle('Alice', 1),
		hugo: await nouvelle('Hugo', 3)
	};
	await apte(p.bruno, 'CA2');
	await apte(p.alice, 'CA2');
	await apte(p.cora, 'COD1');
	await apte(p.hugo, 'COD1');
	await apte(p.denis, 'CE');
	await apte(p.eva, 'CE');
	await reglerEte(base, chef, 2027, { debut: '2027-06-25', fin: '2027-06-25', dateLimite: '2027-05-15' }, maintenant, reglage);
	await ajouterMesVacances(base, a(p.gina), 2027, { debut: '2027-06-25', fin: '2027-07-02' }, maintenant);
	await ajouterMesVacances(base, a(p.bruno), 2027, { debut: '2027-06-28', fin: '2027-06-28' }, maintenant);
	const chefId = chef.type === 'personne' ? chef.id : 0;
	return { ...j, p, chefId };
}

describe('la proposition (calcul)', () => {
	it('l’équipe de base moins les vacances ; un renfort seulement s’il comble une place ; les moins sollicités d’abord', () => {
		const tous = new Set<Poste>(['agent', 'ca2', 'ca1', 'ce', 'cod1']);
		const postes = (id: number) => (id === 1 ? tous : id === 2 ? new Set<Poste>(['agent', 'cod1']) : id <= 4 ? new Set<Poste>(['agent', 'ce']) : new Set<Poste>(['agent']));
		const plages = ['2027-06-28T18:00', '2027-06-29T18:00', '2027-06-30T18:00'].map((debut) => ({ debut, fin: `${debut.slice(0, 8)}${Number(debut.slice(8, 10)) + 1}T06:00`, semaine: '2027-06-25', equipeId: 1 }));
		const r = proposer({ plages, base: () => [1, 2, 3, 4, 5, 6], candidats: [7, 8, 9], enVacances: (id, p) => id === 6 || (id === 1 && p.debut.startsWith('2027-06-29')), postes, fpt: FPT });
		expect(r.ecarts.map((x) => [x.ajoutes, x.retires])).toEqual([
			[[7], [6]],
			[[8], [1, 6]],
			[[9], [6]]
		]);
		// Sans CA2 parmi les candidats : la plage du mardi reste impossible, mais l'agent manquant est comblé.
		expect(r.impossibles).toEqual([{ debut: '2027-06-29T18:00', fin: '2027-06-30T06:00', manque: ['ca2'] }]);
		expect(texteManque(r.impossibles[0]!, ['ca2'])).toBe('Nuit du mardi 29 juin : pas de CA tout engins disponible');
		expect(texteManque(r.impossibles[0]!, ['ca2', 'agent', 'agent'])).toBe('Nuit du mardi 29 juin : manque CA tout engins, 2 agents');
	});
});

describe('été : proposer, ajuster, publier', () => {
	it('réservé à qui gère le planning', async () => {
		const { base, p, a } = await jeu();
		await expect(eteAPreparer(base, a(p.alice), 2027, maintenant, reglage)).rejects.toThrow(RefusDroit);
		await expect(proposerEte(base, a(p.alice), 2027, maintenant, reglage)).rejects.toThrow(RefusDroit);
	});

	it('propose : toutes les plages armées, renforts répartis équitablement ; le tableau le montre', async () => {
		const { base, chef, p, chefId } = await jeu();
		expect((await eteAPreparer(base, chef, 2027, maintenant, reglage)).proposee).toBe(false);
		expect(await proposerEte(base, chef, 2027, maintenant, reglage)).toEqual({ impossibles: [] });
		const lignes = await base.select().from(plageEte).orderBy(plageEte.debut);
		expect(lignes.map((l) => [l.debut, JSON.parse(l.ajoutes), JSON.parse(l.retires)])).toEqual([
			[VEN, [p.alice], [p.gina]],
			['2027-06-26T06:00', [chefId], [p.gina]],
			['2027-06-27T06:00', [p.hugo], [p.gina]],
			[LUN, [p.alice, chefId], [p.bruno, p.gina]],
			[MAR, [p.hugo], [p.gina]],
			['2027-06-30T18:00', [p.alice], [p.gina]],
			['2027-07-01T18:00', [chefId], [p.gina]]
		]);
		const vue = await eteAPreparer(base, chef, 2027, maintenant, reglage, LUN);
		expect(vue.semaines).toHaveLength(1);
		expect(vue.semaines[0]!.plages.every((x) => x.arme)).toBe(true);
		expect(vue.semaines[0]!.plages[3]!.presents.map((x) => `${x.prenom}${x.renfort ? ' (renfort)' : ''}`)).toEqual(['Cora', 'Denis', 'Eva', 'Fred', 'Alice (renfort)', 'Chef (renfort)']);
		expect(vue.detail!.candidats.find((x) => x.id === p.gina)).toMatchObject({ vacances: true });
		expect(vue.detail!.candidats[0]).toMatchObject({ prenom: 'Hugo', postes: ['cod1'] });
		expect(vue.reponses.find((x) => x.id === p.gina)).toMatchObject({ reponse: 'vacances' });
	});

	it('le panneau d’une plage : chaque présent avec son poste ; FPT non armé, ceux qui ont l’aptitude manquante d’abord', async () => {
		const { base, chef, p } = await jeu();
		await proposerEte(base, chef, 2027, maintenant, reglage);
		const vue = await eteAPreparer(base, chef, 2027, maintenant, reglage, MAR);
		const postes = Object.fromEntries(vue.detail!.presents.map((x) => [x.prenom, x.poste]));
		expect(postes).toEqual({ Bruno: 'ca2', Cora: 'cod1', Denis: 'ce', Eva: 'ce', Fred: 'agent', Hugo: 'agent' });
		// Sans Denis, il manque un CE : Alice (CA2, donc CE) passe devant Hugo (conducteur).
		await ajusterPlage(base, chef, 2027, MAR, p.denis, false, maintenant, reglage);
		const sans = await eteAPreparer(base, chef, 2027, maintenant, reglage, MAR);
		expect(sans.detail!.manque).toEqual(['ce']);
		expect(sans.detail!.candidats[0]).toMatchObject({ prenom: 'Alice', utile: true });
		expect(sans.detail!.candidats.find((x) => x.id === p.denis)).toMatchObject({ utile: true });
		expect(sans.detail!.candidats.find((x) => x.prenom === 'Chef')).toMatchObject({ utile: false });
	});

	it('une plage impossible est signalée', async () => {
		const { base, chef, p, a } = await jeu();
		await ajouterMesVacances(base, a(p.alice), 2027, { debut: '2027-06-28', fin: '2027-06-28' }, maintenant);
		expect(await proposerEte(base, chef, 2027, maintenant, reglage)).toEqual({ impossibles: ['Nuit du lundi 28 juin : pas de CA tout engins disponible'] });
		expect((await eteAPreparer(base, chef, 2027, maintenant, reglage)).impossibles).toEqual(['Nuit du lundi 28 juin : pas de CA tout engins disponible']);
	});

	it('publier : les renforts sont prévenus ; le planning, l’Accueil, l’agenda et les remplacements suivent', async () => {
		const { base, chef, p, a, ids } = await jeu();
		await expect(publierEte(base, chef, 2027, maintenant, reglage)).rejects.toThrow('Proposez d’abord l’été');
		await proposerEte(base, chef, 2027, maintenant, reglage);
		await ajusterPlage(base, chef, 2027, MAR, p.fred, false, maintenant, reglage);
		expect(await base.select().from(avisEte)).toEqual([]);
		await publierEte(base, chef, 2027, maintenant, reglage);
		await expect(proposerEte(base, chef, 2027, maintenant, reglage)).rejects.toThrow('Été déjà publié');
		const avis = await base.select().from(avisEte);
		expect(avis.find((x) => x.personneId === p.alice)!.texte).toBe('Planning d’été : vous êtes en renfort de l’Équipe 2 la semaine du vendredi 25 juin.');
		expect(avis.find((x) => x.personneId === p.fred)!.texte).toBe('Planning d’été : vous n’êtes pas d’astreinte sur une partie de la semaine du vendredi 25 juin.');
		expect(avis.some((x) => x.personneId === p.gina)).toBe(false);

		// Planning : Alice tient trois nuits de la semaine de l'Équipe 2 ; Gina, en vacances, n'y est pas.
		const planAlice = await planningDe(base, a(p.alice), 2027, '2027-06-20T10:00', reglage);
		const semaine = planAlice.publiee ? planAlice.semaines.find((s) => s.debut === '2027-06-25')! : null;
		expect(semaine).toMatchObject({ mienne: true, equipeId: ids[1] });
		expect(semaine!.periodes).toEqual([
			{ debut: VEN, fin: '2027-06-26T06:00' },
			{ debut: LUN, fin: '2027-06-29T06:00' },
			{ debut: '2027-06-30T18:00', fin: '2027-07-01T06:00' }
		]);
		const planGina = await planningDe(base, a(p.gina), 2027, '2027-06-20T10:00', reglage);
		expect(planGina.publiee && planGina.semaines.find((s) => s.debut === '2027-06-25')!.mienne).toBe(false);
		expect((await astreinteDe(base, a(p.alice), '2027-06-25T10:00', reglage))).toMatchObject({ debut: VEN, mienne: true, equipe: { id: ids[1] } });
		expect((await astreinteDe(base, a(p.gina), '2027-06-25T10:00', reglage))!.debut).not.toBe(VEN);

		const lien = await monLienAgenda(base, a(p.alice), '2027-06-20T10:00');
		const ics = (await agendaDe(base, `${lien}.ics`.replace('.ics', ''), '2027-06-20T10:00', reglage))!;
		expect(ics).toContain('UID:astreinte-2027-06-25-1@gyro-caserne');
		expect(ics).toMatch(/DTSTART:20270628T160000Z\r\nDTEND:20270629T040000Z\r\nSUMMARY:Astreinte · Équipe 2/);

		const ctx = await lireContexte(base, '2027-06-20T10:00', reglage);
		const nuitLundi = { debut: LUN, fin: '2027-06-29T06:00' };
		expect(disponible(ctx, p.gina, [nuitLundi])).toBe(false);
		expect(disponible(ctx, p.bruno, [nuitLundi])).toBe(false);
		expect(disponible(ctx, p.fred, [{ debut: MAR, fin: '2027-06-30T06:00' }])).toBe(true);
		expect(bandesDe(ctx, p.alice).find((s) => s.semaine === '2027-06-25')).toMatchObject({ equipeId: ids[1] });
	});

	it('après publication : un ajustement prévient l’agent ; des vacances changées préviennent le chef ; un remplacement conclu contredit est signalé', async () => {
		const { base, chef, chefId, p, a } = await jeu();
		await proposerEte(base, chef, 2027, maintenant, reglage);
		await base.insert(demandeRemplacement).values({ genre: 'remplacement', demandeurId: p.fred, remplacantId: p.hugo, periodes: JSON.stringify([{ debut: MAR, fin: '2027-06-30T06:00' }]), debut: MAR, etat: 'conclue', creeLe: maintenant });
		await publierEte(base, chef, 2027, maintenant, reglage);
		await base.delete(avisEte);
		await ajusterPlage(base, chef, 2027, MAR, p.fred, false, maintenant, reglage);
		await expect(ajusterPlage(base, chef, 2027, '2027-06-29T19:00', p.fred, false, maintenant, reglage)).rejects.toThrow(DonneeInvalide);
		expect((await base.select().from(avisEte)).map((x) => [x.personneId, x.texte])).toEqual([[p.fred, 'Vous n’êtes plus d’astreinte : nuit du mardi 29 juin.']]);
		const vue = await eteAPreparer(base, chef, 2027, maintenant, reglage);
		expect(vue.conflits).toEqual(['nuit du mardi 29 juin : Fred Test est remplacé par Hugo Test, mais n’est plus d’astreinte']);
		await base.delete(avisEte);
		await ajouterMesVacances(base, a(p.eva), 2027, { debut: '2027-06-30', fin: '2027-06-30' }, maintenant);
		expect((await base.select().from(avisEte).where(eq(avisEte.personneId, chefId))).map((x) => [x.quoi, x.texte, x.url])).toEqual([['vacances_changees', 'Eva Test a changé ses vacances : à revoir.', '/planning/ete?annee=2027']]);
	});

	it('l’onglet Été du fichier : une colonne par plage, « X » si présent ; relu, il ajoute et retire', async () => {
		const { base, chef, p } = await jeu();
		expect((await donneesFichierPlanning(base, chef, 2027, maintenant, reglage)).feuilles.map((f) => f.nom)).not.toContain('Été');
		await proposerEte(base, chef, 2027, maintenant, reglage);
		const d = await donneesFichierPlanning(base, chef, 2027, maintenant, reglage);
		const feuille = d.feuilles.find((f) => f.nom === 'Été')!;
		expect(feuille.entetes).toEqual(['N°', 'Agent', 'Équipe', '25/06 nuit', '26/06 24 h', '27/06 24 h', '28/06 nuit', '29/06 nuit', '30/06 nuit', '01/07 nuit']);
		const ligne = (id: number) => feuille.lignes.find((l) => l[0] === String(id))!;
		expect(ligne(p.alice)).toEqual([String(p.alice), 'Alice Test', 'Équipe 1', 'X', '', '', 'X', '', 'X', '']);
		expect(ligne(p.gina).slice(3)).toEqual(['', '', '', '', '', '', '']);
		const lu = {
			feuilles: { Été: [{ numero: 2, cellules: [...ligne(p.alice).slice(0, 3), '', '', '', 'X', '', 'X', ''] }, { numero: 3, cellules: [...ligne(p.hugo).slice(0, 3), 'X', ...ligne(p.hugo).slice(4)] }] },
			entetes: { Été: feuille.entetes }
		};
		expect((await apercuPlanning(base, chef, 2027, lu, maintenant, reglage)).ete).toEqual({ ajouts: 1, retraits: 1 });
		await appliquerPlanning(base, chef, 2027, lu, maintenant, reglage);
		const [ven] = await base.select().from(plageEte).where(eq(plageEte.debut, VEN));
		expect(JSON.parse(ven!.ajoutes)).toEqual([p.hugo]);
		// Un agent parti depuis l'export : sa ligne est ignorée ; un N° qui n'en est pas un est une erreur.
		const fautif = { feuilles: { Été: [{ numero: 2, cellules: ['999', 'X', '', 'X'] }, { numero: 3, cellules: ['Alice', 'X', '', 'X'] }] }, entetes: { Été: ['N°', 'Agent', 'Équipe', '24/06 nuit'] } };
		expect((await apercuPlanning(base, chef, 2027, fautif, maintenant, reglage)).erreurs).toEqual([
			{ feuille: 'Été', ligne: 1, message: 'Colonne « 24/06 nuit » : pas une plage de l’été' },
			{ feuille: 'Été', ligne: 3, message: 'N° « Alice » : agent inconnu' }
		]);
	});

	it('changer la période efface la proposition ; publier exige une plage pour chaque semaine ; 16 semaines au plus', async () => {
		const { base, chef } = await jeu();
		await proposerEte(base, chef, 2027, maintenant, reglage);
		await reglerEte(base, chef, 2027, { debut: '2027-06-25', fin: '2027-07-02', dateLimite: '2027-05-15' }, maintenant, reglage);
		expect(await base.select().from(plageEte)).toEqual([]);
		await expect(publierEte(base, chef, 2027, maintenant, reglage)).rejects.toThrow('Proposez d’abord l’été');
		await proposerEte(base, chef, 2027, maintenant, reglage);
		// Même période, autre date limite : la proposition reste.
		await reglerEte(base, chef, 2027, { debut: '2027-06-25', fin: '2027-07-02', dateLimite: '2027-05-20' }, maintenant, reglage);
		expect(await base.select().from(plageEte)).toHaveLength(14);
		await expect(reglerEte(base, chef, 2027, { debut: '2027-01-01', fin: '2027-06-25', dateLimite: '2027-05-15' }, maintenant, reglage)).rejects.toThrow('Été trop long');
	});

	it('publier deux fois ne prévient qu’une fois ; remettre un agent de l’équipe : « de nouveau d’astreinte »', async () => {
		const { base, chef, p } = await jeu();
		await proposerEte(base, chef, 2027, maintenant, reglage);
		await ajusterPlage(base, chef, 2027, MAR, p.fred, false, maintenant, reglage);
		await publierEte(base, chef, 2027, maintenant, reglage);
		await publierEte(base, chef, 2027, '2027-03-01T10:05', reglage);
		expect((await base.select().from(avisEte).where(eq(avisEte.personneId, p.alice)))).toHaveLength(1);
		await base.delete(avisEte);
		await ajusterPlage(base, chef, 2027, MAR, p.fred, true, maintenant, reglage);
		expect((await base.select().from(avisEte)).map((x) => x.texte)).toEqual(['Vous êtes de nouveau d’astreinte : nuit du mardi 29 juin.']);
	});

	it('un agent en vacances présent sur une plage (vacances données après la proposition) est signalé ; ?plage= sans proposition ne détaille rien', async () => {
		const { base, chef, p, a } = await jeu();
		expect((await eteAPreparer(base, chef, 2027, maintenant, reglage, LUN)).detail).toBeNull();
		await proposerEte(base, chef, 2027, maintenant, reglage);
		await ajouterMesVacances(base, a(p.eva), 2027, { debut: '2027-06-29', fin: '2027-06-29' }, maintenant);
		expect((await eteAPreparer(base, chef, 2027, maintenant, reglage)).conflits).toEqual(['nuit du mardi 29 juin : Eva Test est en vacances, mais présent']);
	});

	it('été non publié : un agent en vacances n’est déjà plus disponible pour un remplacement', async () => {
		const { base, p } = await jeu();
		const ctx = await lireContexte(base, '2027-06-20T10:00', reglage);
		expect(disponible(ctx, p.gina, [{ debut: LUN, fin: '2027-06-29T06:00' }])).toBe(false);
		expect(disponible(ctx, p.hugo, [{ debut: LUN, fin: '2027-06-29T06:00' }])).toBe(true);
	});

	it('un renfort qui demande un remplacement : c’est le chef de garde de l’équipe de la semaine qui valide', async () => {
		const { base, chef, p, a, ids } = await jeu();
		const [role] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_equipe'));
		await base.insert(attribution).values({ personneId: p.denis, responsabiliteId: role!.id, perimetreType: 'equipe', perimetreId: ids[1]!, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		await proposerEte(base, chef, 2027, maintenant, reglage);
		await publierEte(base, chef, 2027, maintenant, reglage);
		const id = await demanderRemplacement(base, a(p.alice), { periodes: [{ debut: LUN, fin: '2027-06-29T06:00' }], cibleId: null }, '2027-06-20T10:00', reglage);
		const [d] = await base.select().from(demandeRemplacement).where(eq(demandeRemplacement.id, id));
		expect(d!.equipeId).toBe(ids[1]);
		const ctx = await lireContexte(base, '2027-06-20T10:00', reglage);
		expect(valideurs(ctx.chefs, d!.equipeId, p.alice)).toEqual([p.denis]);
	});
});
