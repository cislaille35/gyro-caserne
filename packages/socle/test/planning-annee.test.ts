import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { chargerPlanningFictif } from '../src/planning/fictif.ts';
import { planningDuMatin } from '../src/planning/manoeuvres.ts';
import { repondreEvenement } from '../src/index.ts';
import { ajouterVacances, changerSemaines, enregistrerManoeuvre, noterFete, planningDe, preparerAnnee, publierAnnee, reglerRoulement, retirerVacances, supprimerManoeuvre } from '../src/planning/annee.ts';
import { affectationEquipe, attribution, equipe, journal, manoeuvre, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const reglage = centreExemple.astreinte;
const maintenant = '2026-11-01T10:00';

// Chef de centre (sans équipe), Alice (équipe 1, puis équipe 2 au 1er décembre), Bruno (équipe 2). Quatre équipes.
async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);
	const ids = equipes.map((e) => e.id);
	const nouvelle = async (prenom: string) => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning();
		return p!.id;
	};
	const chef = await nouvelle('Chef');
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: chef, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const alice = await nouvelle('Alice');
	await base.insert(affectationEquipe).values([
		{ personneId: alice, equipeId: ids[0]!, debut: '2026-01-01', fin: '2026-11-30' },
		{ personneId: alice, equipeId: ids[1]!, debut: '2026-12-01' }
	]);
	const bruno = await nouvelle('Bruno');
	await base.insert(affectationEquipe).values({ personneId: bruno, equipeId: ids[1]!, debut: '2026-01-01' });
	const a = (id: number): Acteur => ({ type: 'personne', id });
	return { base, ids, chef: a(chef), alice: a(alice), bruno: a(bruno) };
}

describe('préparer l’année', () => {
	it('réservé à qui gère le planning', async () => {
		const { base, alice } = await jeu();
		await expect(preparerAnnee(base, alice, 2026, maintenant, reglage)).rejects.toThrow(RefusDroit);
		await expect(reglerRoulement(base, alice, 2026, [1, 2], maintenant)).rejects.toThrow(RefusDroit);
	});

	it('propose un ordre tiré de la référence du centre, puis remplit les semaines selon le roulement', async () => {
		const { base, chef, ids } = await jeu();
		const vide = await preparerAnnee(base, chef, 2026, maintenant, reglage);
		expect(vide.ordre).toEqual([]);
		expect(vide.semaines).toEqual([]);
		// Le vendredi 2 janvier 2026, c'est l'équipe 1
		expect(vide.ordrePropose).toEqual(ids);
		expect((await preparerAnnee(base, chef, 2027, maintenant, reglage)).ordrePropose).toEqual([ids[0], ids[1], ids[2], ids[3]]);

		await reglerRoulement(base, chef, 2026, [ids[2]!, ids[0]!, ids[1]!, ids[3]!], maintenant);
		const p = await preparerAnnee(base, chef, 2026, maintenant, reglage);
		expect(p.semaines.slice(0, 5).map((s) => s.equipeId)).toEqual([ids[2], ids[0], ids[1], ids[3], ids[2]]);
		expect(p.feries).toHaveLength(11);
		expect(await base.select().from(journal).where(eq(journal.action, 'regler_roulement'))).toHaveLength(1);
	});

	it('refuse un roulement incomplet ou une équipe inconnue', async () => {
		const { base, chef, ids } = await jeu();
		await expect(reglerRoulement(base, chef, 2026, [ids[0]!], maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(reglerRoulement(base, chef, 2026, [ids[0]!, ids[0]!], maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(reglerRoulement(base, chef, 2026, [ids[0]!, 999], maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(reglerRoulement(base, chef, 1999, [ids[0]!, ids[1]!], maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('change l’équipe d’une semaine ; revenir au roulement efface le changement', async () => {
		const { base, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2026, ids, maintenant);
		await changerSemaines(base, chef, 2026, { '2026-12-18': ids[0]!, '2026-12-25': ids[3]! }, maintenant, reglage);
		let p = await preparerAnnee(base, chef, 2026, maintenant, reglage);
		const s = (d: string) => p.semaines.find((x) => x.debut === d)!;
		expect(s('2026-12-18')).toMatchObject({ equipeId: ids[0], changee: true });
		// Semaine 51 de l'index : 51 % 4 = 3, c'était déjà l'équipe 4
		expect(s('2026-12-25')).toMatchObject({ equipeId: ids[3], changee: false });
		expect(p.fetes.noel).toBe(ids[0]);
		await changerSemaines(base, chef, 2026, { '2026-12-18': ids[2]! }, maintenant, reglage);
		p = await preparerAnnee(base, chef, 2026, maintenant, reglage);
		expect(s('2026-12-18')).toMatchObject({ equipeId: ids[2], changee: false });
		await expect(changerSemaines(base, chef, 2026, { '2026-12-19': ids[0]! }, maintenant, reglage)).rejects.toThrow(DonneeInvalide);
	});

	it('un formulaire forgé avec 120 semaines : refus clair, pas de panne', async () => {
		const { base, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2026, ids, maintenant);
		const choix = Object.fromEntries(Array.from({ length: 120 }, (_, i) => [new Date(Date.UTC(2030, 0, 1 + i)).toISOString().slice(0, 10), 1000 + i]));
		await expect(changerSemaines(base, chef, 2026, choix, maintenant, reglage)).rejects.toThrow(DonneeInvalide);
		expect(base.parametresMax).toBeLessThanOrEqual(100);
	});

	it('l’historique automatique ne compte que les années publiées', async () => {
		const { base, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2025, ids, maintenant);
		expect((await preparerAnnee(base, chef, 2026, maintenant, reglage)).fetes.historique).toEqual([]);
		await publierAnnee(base, chef, 2025, maintenant);
		expect((await preparerAnnee(base, chef, 2026, maintenant, reglage)).fetes.historique).toHaveLength(2);
	});

	it('Noël et Nouvel An : historique saisi, équipe attendue', async () => {
		const { base, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2026, ids, maintenant);
		await noterFete(base, chef, 2025, 'noel', ids[3]!, maintenant);
		await noterFete(base, chef, 2024, 'noel', ids[0]!, maintenant);
		await noterFete(base, chef, 2024, 'nouvel_an', ids[0]!, maintenant);
		await noterFete(base, chef, 2024, 'nouvel_an', null, maintenant);
		const p = await preparerAnnee(base, chef, 2026, maintenant, reglage);
		expect(p.fetes.noel).toBe(ids[2]);
		expect(p.fetes.attendues.noel).toEqual([ids[1], ids[2]]);
		expect(p.fetes.historique).toEqual([
			{ annee: 2025, fete: 'noel', equipeId: ids[3] },
			{ annee: 2024, fete: 'noel', equipeId: ids[0] }
		]);
	});

	it('vacances scolaires : ajout, contrôle des dates, retrait', async () => {
		const { base, chef } = await jeu();
		const id = await ajouterVacances(base, chef, { nom: 'Noël', debut: '2026-12-19', fin: '2027-01-04' }, maintenant);
		await expect(ajouterVacances(base, chef, { nom: 'Hiver', debut: '2027-02-20', fin: '2027-02-10' }, maintenant)).rejects.toThrow(DonneeInvalide);
		expect((await preparerAnnee(base, chef, 2027, maintenant, reglage)).vacances).toEqual([{ id, nom: 'Noël', debut: '2026-12-19', fin: '2027-01-04' }]);
		await retirerVacances(base, chef, id, maintenant);
		expect((await preparerAnnee(base, chef, 2026, maintenant, reglage)).vacances).toEqual([]);
	});

	it('manœuvres : enregistrer, modifier, supprimer ; contrôles', async () => {
		const { base, chef, ids } = await jeu();
		const id = await enregistrerManoeuvre(base, chef, { debut: '2026-12-06T08:30', theme: 'Feux de forêt', lieu: 'Caserne', convoques: [ids[0]!, ids[1]!], petitDejeuner: true }, maintenant);
		await enregistrerManoeuvre(base, chef, { id, debut: '2026-12-06T09:00', theme: 'Feux de forêt', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, maintenant);
		const [m] = (await preparerAnnee(base, chef, 2026, maintenant, reglage)).manoeuvres;
		expect(m).toMatchObject({ id, debut: '2026-12-06T09:00', convoques: 'tous', petitDejeuner: false, annulee: false, publiee: false });
		const mauvaise = { debut: '2026-12-06T09:00', theme: 'X', lieu: 'Caserne', convoques: [999], petitDejeuner: false };
		await expect(enregistrerManoeuvre(base, chef, mauvaise, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(enregistrerManoeuvre(base, chef, { ...mauvaise, convoques: 'tous', debut: '2026-10-01T09:00' }, maintenant)).rejects.toThrow(DonneeInvalide);
		await expect(enregistrerManoeuvre(base, chef, { ...mauvaise, convoques: 'tous', theme: ' ' }, maintenant)).rejects.toThrow(DonneeInvalide);
		await supprimerManoeuvre(base, chef, id, maintenant);
		expect(await base.select().from(manoeuvre)).toHaveLength(0);
	});
});

describe('le planning vu par l’agent', () => {
	async function publiee() {
		const j = await jeu();
		const { base, chef, ids } = j;
		await reglerRoulement(base, chef, 2026, ids, maintenant);
		await enregistrerManoeuvre(base, chef, { debut: '2026-11-15T08:30', theme: 'Sport + SAP', lieu: 'Caserne', convoques: [ids[0]!], petitDejeuner: true }, maintenant);
		await enregistrerManoeuvre(base, chef, { debut: '2026-12-13T08:30', theme: 'Sainte Barbe', lieu: 'Caserne', convoques: 'tous', petitDejeuner: false }, maintenant);
		return j;
	}

	it('rien avant publication ; un agent sans VOIR_PLANNING est refusé', async () => {
		const { base, alice, chef } = await publiee();
		expect(await planningDe(base, alice, 2026, maintenant, reglage)).toEqual({ publiee: false, annee: 2026, peutPreparer: false });
		expect(await planningDe(base, chef, 2026, maintenant, reglage)).toMatchObject({ publiee: false, peutPreparer: true });
		await expect(publierAnnee(base, alice, 2026, maintenant)).rejects.toThrow(RefusDroit);
		const [ext] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		const [x] = await base.insert(personne).values({ email: 'x@exemple.fr', prenom: 'X', nom: 'Y', profilId: ext!.id }).returning();
		await expect(planningDe(base, { type: 'personne', id: x!.id }, 2026, maintenant, reglage)).rejects.toThrow(RefusDroit);
	});

	it('refuse de publier une année sans roulement', async () => {
		const { base, chef } = await jeu();
		await expect(publierAnnee(base, chef, 2026, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('fin décembre : la prochaine astreinte est dans l’année suivante publiée', async () => {
		const { base, chef, alice, ids } = await publiee();
		await publierAnnee(base, chef, 2026, maintenant);
		await reglerRoulement(base, chef, 2027, ids, maintenant);
		await publierAnnee(base, chef, 2027, maintenant);
		const p = await planningDe(base, alice, 2026, '2026-12-30T10:00', reglage);
		if (!p.publiee) throw new Error('attendu publié');
		// Alice : équipe 2 depuis le 1er décembre ; 2027 commence par l'équipe 1, puis l'équipe 2 le 8 janvier.
		expect(p.prochaine.astreinte).toMatchObject({ debut: '2027-01-08T18:00' });
	});

	it('garde de fête : celle que son équipe tient vraiment, même l’année suivante (31 décembre 2027, un vendredi)', async () => {
		const { base, chef, bruno, ids } = await publiee();
		await publierAnnee(base, chef, 2026, maintenant);
		// 2027 : semaine 52 (index 52 % 4 = 0) → équipe 2, celle de Bruno ; Noël 2027 (index 51) → équipe 1.
		await reglerRoulement(base, chef, 2027, [ids[1]!, ids[2]!, ids[3]!, ids[0]!], maintenant);
		await publierAnnee(base, chef, 2027, maintenant);
		const p = await planningDe(base, bruno, 2026, maintenant, reglage);
		if (!p.publiee) throw new Error('attendu publié');
		expect(p.prochaine.fete).toEqual({ fete: 'nouvel_an', date: '2027-12-31' });
	});

	it('début janvier : la semaine en cours commencée fin décembre reste la prochaine astreinte', async () => {
		const { base, chef, alice, ids } = await publiee();
		await changerSemaines(base, chef, 2026, { '2026-12-25': ids[1]! }, maintenant, reglage);
		await publierAnnee(base, chef, 2026, maintenant);
		await reglerRoulement(base, chef, 2027, ids, maintenant);
		await publierAnnee(base, chef, 2027, maintenant);
		const p = await planningDe(base, alice, 2027, '2027-01-01T10:00', reglage);
		if (!p.publiee) throw new Error('attendu publié');
		expect(p.prochaine.astreinte).toMatchObject({ debut: '2026-12-25T18:00', enCours: true });
		expect(p.semaines[0]!.debut).toBe('2027-01-01');
	});

	it('après publication : ses semaines suivent son équipe à la date ; prochaine astreinte et manœuvre', async () => {
		const { base, chef, alice, ids } = await publiee();
		await publierAnnee(base, chef, 2026, maintenant);
		const p = await planningDe(base, alice, 2026, maintenant, reglage);
		if (!p.publiee) throw new Error('attendu publié');
		const miennes = p.semaines.filter((s) => s.mienne).map((s) => s.debut);
		// Équipe 1 jusqu'au 30 novembre (index 0, 4, 8…), puis équipe 2 (index 1, 5…)
		expect(miennes).toContain('2026-11-06');
		expect(miennes).not.toContain('2026-12-04');
		expect(miennes).toContain('2026-12-11');
		expect(p.monEquipe).toBe(ids[0]);
		expect(p.prochaine.astreinte).toMatchObject({ debut: '2026-11-06T18:00', fin: '2026-11-13T06:00', equipeId: ids[0], enCours: false });
		expect(p.prochaine.astreinte!.periodes[0]).toEqual({ debut: '2026-11-06T18:00', fin: '2026-11-09T06:00' });
		expect(p.prochaine.manoeuvre).toMatchObject({ theme: 'Sport + SAP', debut: '2026-11-15T08:30', publicationId: null, reponse: null });
		// Noël 2026 : semaine du 18 décembre, index 50 → équipe 3 ; Nouvel An : équipe 4. Alice (équipe 2) n'en tient aucune.
		expect(p.prochaine.fete).toBeNull();
		expect(p.manoeuvres).toHaveLength(2);
		expect(p.feries).toHaveLength(11);
	});

	it('la prochaine manœuvre annoncée porte sa publication et ma réponse', async () => {
		const { base, chef, alice } = await publiee();
		await publierAnnee(base, chef, 2026, maintenant);
		await planningDuMatin(base, '2026-11-02T08:00');
		const avant = await planningDe(base, alice, 2026, '2026-11-02T09:00', reglage);
		if (!avant.publiee) throw new Error('attendu publié');
		const id = avant.prochaine.manoeuvre!.publicationId!;
		expect(id).toBeGreaterThan(0);
		await repondreEvenement(base, alice, id, 'absent', '2026-11-02T09:00');
		const apres = await planningDe(base, alice, 2026, '2026-11-02T09:00', reglage);
		if (!apres.publiee) throw new Error('attendu publié');
		expect(apres.prochaine.manoeuvre).toMatchObject({ publicationId: id, reponse: 'absent' });
	});

	it('une astreinte en cours est la prochaine ; la garde de fête de son équipe est annoncée', async () => {
		const { base, chef, bruno, ids } = await publiee();
		await changerSemaines(base, chef, 2026, { '2026-12-18': ids[1]! }, maintenant, reglage);
		await publierAnnee(base, chef, 2026, maintenant);
		const p = await planningDe(base, bruno, 2026, '2026-11-14T10:00', reglage);
		if (!p.publiee) throw new Error('attendu publié');
		expect(p.prochaine.astreinte).toMatchObject({ debut: '2026-11-13T18:00', enCours: true });
		expect(p.prochaine.fete).toEqual({ fete: 'noel', date: '2026-12-25' });
		// Bruno (équipe 2) n'est pas convoqué au « Sport + SAP » (équipe 1)
		expect(p.prochaine.manoeuvre).toMatchObject({ theme: 'Sainte Barbe' });
	});

	it('un agent sans équipe : pas de prochaine astreinte, les manœuvres de tout le centre', async () => {
		const { base, chef } = await publiee();
		await publierAnnee(base, chef, 2026, maintenant);
		const p = await planningDe(base, chef, 2026, maintenant, reglage);
		if (!p.publiee) throw new Error('attendu publié');
		expect(p.monEquipe).toBeNull();
		expect(p.prochaine.astreinte).toBeNull();
		expect(p.prochaine.manoeuvre).toMatchObject({ theme: 'Sainte Barbe' });
		expect(p.semaines.some((s) => s.mienne)).toBe(false);
	});
});

describe('planning fictif (développement et préprod)', () => {
	it('publie l’année en cours, quelques manœuvres et des vacances ; une seule fois', async () => {
		const { base, alice } = await jeu();
		await chargerPlanningFictif(base, centreExemple, '2026-11-01T10:00');
		await chargerPlanningFictif(base, centreExemple, '2026-11-01T10:00');
		const p = await planningDe(base, alice, 2026, maintenant, reglage);
		if (!p.publiee) throw new Error('attendu publié');
		expect(p.manoeuvres.length).toBeGreaterThanOrEqual(1);
		expect(await base.select().from(manoeuvre)).toHaveLength(4);
		expect(p.vacances.length).toBeGreaterThanOrEqual(1);
		expect((await planningDe(base, alice, 2027, maintenant, reglage)).publiee).toBe(true);
	});
});
