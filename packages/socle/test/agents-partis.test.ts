import { and, eq, isNotNull, like, ne } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { changerStatut, modifierFiche } from '../src/actions/personnes.ts';
import { lirePublication } from '../src/actions/publications.ts';
import { lireAnomalie, listerAnomalies, REGLAGE_ANOMALIES } from '../src/anomalies.ts';
import { acteurDe } from '../src/connexion.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { ficheAgent, listeGestion } from '../src/effectif.ts';
import { donneesFichier } from '../src/fichier-effectif.ts';
import { lireDemande, toutesLesDemandes } from '../src/habillement.ts';
import { effacerAgent, effacerAgentsPartis, PARTIS_PAR_NUIT } from '../src/partis.ts';
import { historiquePrises, lirePriseFaite } from '../src/prises.ts';
import { demandeVue } from '../src/remplacements/lectures.ts';
import {
	abonnementPush,
	account,
	affectationEquipe,
	anomalie,
	aptitude,
	aptitudeAgent,
	attribution,
	champCentre,
	cleAgenda,
	demandeHabillement,
	demandeRemplacement,
	engin,
	envoiLien,
	envoiPush,
	equipe,
	ficheVersion,
	journal,
	personne,
	priseGarde,
	profil,
	publication,
	responsabilite,
	responsabiliteDroit,
	session,
	user,
	valeurChamp,
	verification,
	visiteMur
} from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';
import { jeuGrossi } from './jeu-grossi.ts';

const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

async function jeu() {
	const base = await baseDeTest();
	const [agent] = await base.insert(profil).values({ nom: 'Agent', typePersonne: 'agent' }).returning();
	const [eq1] = await base.insert(equipe).values({ nom: 'Équipe 1', couleur: '#c00', ordreRotation: 1 }).returning();
	const ajouter = async (email: string, prenom = 'Paul', nom = 'Durand') => {
		const [p] = await base.insert(personne).values({ email, prenom, nom, profilId: agent!.id, telephone: '0600000000', naissance: '1990-05-01', contactUrgence: 'Sa sœur', surnom: 'Polo', entreeCentre: '2015-01-01', engagementSpv: '2015-01-01', dateGrade: '2020-01-01' }).returning();
		await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId: eq1!.id, debut: '2015-01-01' });
		return p!.id;
	};
	const partir = (id: number, quand: string) => changerStatut(base, base.photos, superAdmin, id, 'parti', `${quand}T10:00`);
	const revenir = (id: number, quand: string) => changerStatut(base, base.photos, superAdmin, id, 'operationnel', `${quand}T10:00`);
	const lire = async (id: number) => (await base.select().from(personne).where(eq(personne.id, id)))[0]!;
	return { base, ajouter, partir, revenir, lire, equipeId: eq1!.id };
}

describe('date de départ', () => {
	it('posée au départ, vidée au retour, reposée au départ suivant', async () => {
		const j = await jeu();
		const id = await j.ajouter('paul@exemple.fr');
		await j.partir(id, '2025-01-10');
		expect((await j.lire(id)).partiLe).toBe('2025-01-10');
		await j.revenir(id, '2025-03-01');
		expect((await j.lire(id)).partiLe).toBeNull();
		await j.partir(id, '2025-12-01');
		expect((await j.lire(id)).partiLe).toBe('2025-12-01');
	});
});

describe('effacerAgentsPartis (nuit)', () => {
	it('efface 12 mois après le départ, pas 11 mois et 29 jours', async () => {
		const j = await jeu();
		const douze = await j.ajouter('douze@exemple.fr');
		const presque = await j.ajouter('presque@exemple.fr');
		await j.partir(douze, '2025-11-11');
		await j.partir(presque, '2025-11-12');
		// La nuit du 11/11/2026 : limite à 12 mois, le 11/11/2025.
		expect(await effacerAgentsPartis(j.base, '2025-11-11', '2026-11-11')).toBe(1);
		expect(await j.lire(douze)).toMatchObject({ prenom: 'Ancien', nom: 'agent', effaceLe: '2026-11-11' });
		expect(await j.lire(presque)).toMatchObject({ prenom: 'Paul', effaceLe: null });
		// Le lendemain, son tour ; un effacé n'est jamais repris.
		expect(await effacerAgentsPartis(j.base, '2025-11-12', '2026-11-12')).toBe(1);
		expect(await effacerAgentsPartis(j.base, '2025-11-13', '2026-11-13')).toBe(0);
		expect((await j.lire(douze)).effaceLe).toBe('2026-11-11');
	});

	it('un agent revenu n’est jamais effacé ; reparti, le délai part du dernier départ', async () => {
		const j = await jeu();
		const revenu = await j.ajouter('revenu@exemple.fr');
		const reparti = await j.ajouter('reparti@exemple.fr');
		await j.partir(revenu, '2024-01-10');
		await j.revenir(revenu, '2024-06-01');
		await j.partir(reparti, '2024-01-10');
		await j.revenir(reparti, '2024-06-01');
		await j.partir(reparti, '2026-01-10');
		expect(await effacerAgentsPartis(j.base, '2026-01-09', '2027-01-09')).toBe(0);
		expect((await j.lire(revenu)).effaceLe).toBeNull();
		expect((await j.lire(reparti)).effaceLe).toBeNull();
		expect(await effacerAgentsPartis(j.base, '2026-01-10', '2027-01-10')).toBe(1);
		expect((await j.lire(reparti)).effaceLe).toBe('2027-01-10');
		expect((await j.lire(revenu)).effaceLe).toBeNull();
	});

	it('un parti sans date de départ (avant cette version) n’est pas effacé la nuit', async () => {
		const j = await jeu();
		const id = await j.ajouter('ancien@exemple.fr');
		await j.base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, id));
		expect(await effacerAgentsPartis(j.base, '2030-01-01', '2031-01-01')).toBe(0);
	});

	it(`borne : ${PARTIS_PAR_NUIT} agents par nuit, le reste la nuit suivante, peu de requêtes`, async () => {
		const j = await jeu();
		for (let i = 0; i < PARTIS_PAR_NUIT + 2; i++) await j.partir(await j.ajouter(`a${i}@exemple.fr`), '2025-01-01');
		const avant = j.base.requetes;
		expect(await effacerAgentsPartis(j.base, '2026-01-01', '2027-01-01')).toBe(PARTIS_PAR_NUIT);
		expect(j.base.requetes - avant).toBeLessThanOrEqual(2 + PARTIS_PAR_NUIT);
		expect(j.base.parametresMax).toBeLessThanOrEqual(100);
		expect(await effacerAgentsPartis(j.base, '2026-01-02', '2027-01-02')).toBe(2);
	});

	it('rien à effacer : une seule requête', async () => {
		const j = await jeu();
		const avant = j.base.requetes;
		expect(await effacerAgentsPartis(j.base, '2026-01-01', '2027-01-01')).toBe(0);
		expect(j.base.requetes - avant).toBe(1);
	});
});

describe('ce qui est effacé, ce qui est gardé', () => {
	it('fiche vidée, connexion, appareils, aptitudes, champs, journal ; équipes et rôles passés gardés', async () => {
		const j = await jeu();
		const { base } = j;
		const id = await j.ajouter('paul@exemple.fr');
		const autre = await j.ajouter('autre@exemple.fr', 'Anne', 'Autre');
		// Compte de connexion, session, lien en attente, dernier envoi de lien.
		await base.insert(user).values({ id: 'u1', name: 'Paul Durand', email: 'paul@exemple.fr' });
		await base.insert(session).values({ id: 's1', token: 't1', userId: 'u1', expiresAt: new Date('2030-01-01'), updatedAt: new Date() });
		await base.insert(account).values({ id: 'c1', accountId: 'u1', providerId: 'magic-link', userId: 'u1', updatedAt: new Date() });
		await base.insert(verification).values({ id: 'v1', identifier: 'jeton', value: JSON.stringify({ email: 'paul@exemple.fr' }), expiresAt: new Date('2030-01-01') });
		await base.insert(envoiLien).values({ adresse: 'paul@exemple.fr', envoyeLe: new Date() });
		// Ce qui reste après le départ : champ du centre, aptitude, visite de mur ; un appareil et un envoi en file remis à la main.
		const [champ] = await base.insert(champCentre).values({ nom: 'Taille', visibilite: 'gestion' }).returning();
		await base.insert(valeurChamp).values({ personneId: id, champId: champ!.id, valeur: 'XL' });
		const [apt] = await base.insert(aptitude).values({ nom: 'SAP', ordre: 1 }).returning();
		await base.insert(aptitudeAgent).values({ personneId: id, aptitudeId: apt!.id, obtenueLe: '2020-01-01' });
		await base.insert(visiteMur).values({ personneId: id, mur: 'centre', vueLe: '2025-01-01' });
		// Un rôle passé, saisi par lui pour un autre.
		const [r] = await base.insert(responsabilite).values({ nom: 'Référent', nature: 'fonction', typePerimetre: 'centre' }).returning();
		await base.insert(attribution).values({ personneId: autre, responsabiliteId: r!.id, perimetreType: 'centre', debut: '2020-01-01', fin: '2021-01-01', saisiePar: `personne:${id}`, saisieLe: '2020-01-01' });
		await modifierFiche(base, superAdmin, id, { email: 'paul.d@exemple.fr' }, '2024-06-01', []);
		// Un second compte sous la nouvelle adresse ; l'ancien reste (Better Auth ne le suit pas).
		await base.insert(user).values({ id: 'u2', name: 'Paul Durand', email: 'paul.d@exemple.fr' });
		await j.partir(id, '2025-01-01');
		await base.insert(cleAgenda).values({ personneId: id, cle: 'k', creeLe: '2025-01-01' });
		const [abo] = await base.insert(abonnementPush).values({ personneId: id, endpoint: 'https://push/1', p256dh: 'p', auth: 'a', creeLe: '2025-01-01' }).returning();
		await base.insert(envoiPush).values({ abonnementId: abo!.id, donnees: '{}', creeLe: '2025-01-01' });

		await effacerAgentsPartis(base, '2026-01-01', '2027-01-01');

		const p = await j.lire(id);
		expect(p).toMatchObject({ prenom: 'Ancien', nom: 'agent', email: `efface-${id}@efface.invalid`, surnom: null, photo: null, telephone: null, telephoneVisible: 0, naissance: null, anniversaireVisible: 0, contactUrgence: null, entreeCentre: null, engagementSpv: null, gradeId: null, dateGrade: null, statut: 'parti', partiLe: '2025-01-01', effaceLe: '2027-01-01' });
		expect(p.profilId).not.toBeNull();
		for (const table of [user, session, account, verification, envoiLien, valeurChamp, aptitudeAgent, visiteMur, cleAgenda, abonnementPush, envoiPush]) expect(await base.select().from(table)).toEqual([]);
		// Plus aucune trace de ses adresses dans le journal ; ses lignes restent.
		const lignes = await base.select().from(journal);
		expect(JSON.stringify(lignes)).not.toMatch(/paul/);
		expect(lignes.some((l) => l.action === 'modifier_fiche' && l.cibleId === id)).toBe(true);
		expect(lignes.at(-1)).toMatchObject({ acteur: 'nuit', action: 'effacer_agent', cibleType: 'personne', cibleId: id, details: '{}' });
		// Gardés : ses équipes passées, le rôle qu'il a saisi, l'autre agent intact.
		expect(await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id))).toHaveLength(1);
		expect((await base.select().from(attribution))[0]!.saisiePar).toBe(`personne:${id}`);
		expect(await j.lire(autre)).toMatchObject({ prenom: 'Anne', email: 'autre@exemple.fr', telephone: '0600000000' });
		// Il ne peut plus se connecter.
		expect(await acteurDe(base, 'paul.d@exemple.fr', [])).toBeNull();
		expect(await acteurDe(base, p.email, [])).toBeNull();
	});

	it('une ancienne adresse reprise par un autre agent : son compte à lui reste', async () => {
		const j = await jeu();
		const id = await j.ajouter('paul@exemple.fr');
		await modifierFiche(j.base, superAdmin, id, { email: 'paul.d@exemple.fr' }, '2024-06-01', []);
		await j.ajouter('paul@exemple.fr', 'Pauline', 'Autre');
		await j.base.insert(user).values([
			{ id: 'u1', name: 'Pauline', email: 'paul@exemple.fr' },
			{ id: 'u2', name: 'Paul', email: 'paul.d@exemple.fr' }
		]);
		await j.partir(id, '2025-01-01');
		await effacerAgentsPartis(j.base, '2026-01-01', '2027-01-01');
		expect((await j.base.select().from(user)).map((u) => u.id)).toEqual(['u1']);
	});

	it('un agent effacé ne revient pas et sa fiche ne se modifie plus ; il sort de la liste et du fichier', async () => {
		const j = await jeu();
		const id = await j.ajouter('paul@exemple.fr');
		await j.partir(id, '2025-01-01');
		await effacerAgentsPartis(j.base, '2026-01-01', '2027-01-01');
		await expect(j.revenir(id, '2027-01-02')).rejects.toThrow(new DonneeInvalide('Agent effacé'));
		await expect(modifierFiche(j.base, superAdmin, id, { prenom: 'Paul' }, '2027-01-02', [])).rejects.toThrow(new DonneeInvalide('Agent effacé'));
		const liste = await listeGestion(j.base, superAdmin, {}, '2027-01-02');
		expect(liste.groupes.flatMap((g) => g.personnes.map((p) => p.id))).not.toContain(id);
		expect(liste.comptes.partis).toBe(0);
		const fichier = await donneesFichier(j.base, superAdmin, '2027-01-02', false);
		expect(JSON.stringify(fichier.lignes)).not.toContain('efface');
		// Sa fiche s'ouvre toujours : aucun lien cassé.
		expect(await ficheAgent(j.base, superAdmin, id, '2027-01-02')).toMatchObject({ prenom: 'Ancien', nom: 'agent', effaceLe: '2027-01-01' });
	});
});

describe('effacerAgent (sur demande)', () => {
	async function avecChef() {
		const j = await jeu();
		const [cdc] = await j.base.insert(responsabilite).values({ nom: 'Chef de centre', nature: 'fonction', typePerimetre: 'centre', systeme: 'chef_centre' }).returning();
		await j.base.insert(responsabiliteDroit).values({ responsabiliteId: cdc!.id, droit: 'GERER_ACCES' });
		const [ceq] = await j.base.insert(responsabilite).values({ nom: 'Chef de garde', nature: 'fonction', typePerimetre: 'equipe' }).returning();
		await j.base.insert(responsabiliteDroit).values({ responsabiliteId: ceq!.id, droit: 'GERER_ACCES' });
		const chefId = await j.ajouter('chef@exemple.fr', 'Claire', 'Chef');
		const gardeId = await j.ajouter('garde@exemple.fr', 'Gaston', 'Garde');
		await j.base.insert(attribution).values([
			{ personneId: chefId, responsabiliteId: cdc!.id, perimetreType: 'centre', debut: '2020-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2020-01-01' },
			{ personneId: gardeId, responsabiliteId: ceq!.id, perimetreType: 'equipe', perimetreId: j.equipeId, debut: '2020-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2020-01-01' }
		]);
		const parti = await j.ajouter('parti@exemple.fr');
		await j.partir(parti, '2026-10-01');
		return { ...j, chef: { type: 'personne', id: chefId } as Acteur, chefId, garde: { type: 'personne', id: gardeId } as Acteur, parti };
	}

	it('le chef (GERER_ACCES sur le centre) efface un agent parti sans attendre 12 mois', async () => {
		const j = await avecChef();
		await effacerAgent(j.base, j.chef, j.parti, '2026-11-11T09:00', []);
		expect(await j.lire(j.parti)).toMatchObject({ prenom: 'Ancien', nom: 'agent', effaceLe: '2026-11-11' });
		expect((await j.base.select().from(journal)).at(-1)).toMatchObject({ acteur: `personne:${j.chefId}`, action: 'effacer_agent', cibleId: j.parti });
		await expect(effacerAgent(j.base, j.chef, j.parti, '2026-11-11T09:00', [])).rejects.toThrow(new DonneeInvalide('Agent déjà effacé'));
	});

	it('le super administrateur aussi', async () => {
		const j = await avecChef();
		await effacerAgent(j.base, superAdmin, j.parti, '2026-11-11T09:00', []);
		expect((await j.lire(j.parti)).effaceLe).toBe('2026-11-11');
	});

	it('refusé : sans GERER_ACCES sur le centre (chef de garde), sur un agent pas parti, sur soi-même, sur un super administrateur', async () => {
		const j = await avecChef();
		await expect(effacerAgent(j.base, j.garde, j.parti, '2026-11-11T09:00', [])).rejects.toThrow(RefusDroit);
		const present = await j.ajouter('present@exemple.fr');
		await expect(effacerAgent(j.base, j.chef, present, '2026-11-11T09:00', [])).rejects.toThrow(new DonneeInvalide('Déclarez d’abord son départ'));
		await expect(effacerAgent(j.base, j.chef, j.chefId, '2026-11-11T09:00', [])).rejects.toThrow(new DonneeInvalide('Vous ne pouvez pas effacer vos propres données'));
		// Une fiche à l'adresse d'un super administrateur (ajoutée à SUPER_ADMINS après coup) : jamais effacée.
		await expect(effacerAgent(j.base, j.chef, j.parti, '2026-11-11T09:00', ['PARTI@exemple.fr'])).rejects.toThrow(new DonneeInvalide('Adresse réservée au super administrateur'));
		await expect(effacerAgent(j.base, j.chef, 9999, '2026-11-11T09:00', [])).rejects.toThrow(new DonneeInvalide('Personne inconnue'));
		expect((await j.lire(j.parti)).effaceLe).toBeNull();
		expect((await j.lire(present)).effaceLe).toBeNull();
	});
});

describe('l’historique sous « Ancien agent »', () => {
	it('publications, demandes de remplacement et d’habillement en cours, prises de garde et anomalies : rien ne casse', { timeout: 60_000 }, async () => {
		const { base, m, reglage, acteurs } = await jeuGrossi();
		const nomDe = async (id: number) => {
			const [p] = await base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.id, id));
			return `${p!.prenom} ${p!.nom}`;
		};
		const chefId = (acteurs.chef as { id: number }).id;
		// Une publication d'un agent, une anomalie, une demande de remplacement acceptée, une demande d'habillement en cours.
		const [pub] = await base.select().from(publication).where(and(like(publication.auteur, 'personne:%'), ne(publication.auteur, `personne:${chefId}`)));
		const auteurPub = Number(pub!.auteur.slice(9));
		const [ano] = await base.select().from(anomalie).where(ne(anomalie.signaleePar, chefId));
		const [dem] = await base.select().from(demandeRemplacement).where(and(isNotNull(demandeRemplacement.remplacantId), ne(demandeRemplacement.demandeurId, chefId)));
		const [hab] = await base.select().from(demandeHabillement).where(and(eq(demandeHabillement.etape, 'demandee'), ne(demandeHabillement.demandeurId, chefId)));
		// Une prise de garde validée, faite par l'auteur de l'anomalie.
		const [unEngin] = await base.select().from(engin);
		const [version] = await base.select().from(ficheVersion).where(eq(ficheVersion.typeId, unEngin!.typeId));
		const [prise] = await base
			.insert(priseGarde)
			.values({ enginId: unEngin!.id, releve: '2026-11-01T19:00', versionId: version!.id, etat: 'validee', commenceePar: ano!.signaleePar, commenceeLe: '2026-11-01T19:05', modifieePar: ano!.signaleePar, modifieeLe: '2026-11-01T19:30', valideeLe: '2026-11-01T19:30', saisie: JSON.stringify({ participants: [ano!.signaleePar] }) })
			.returning();
		const effaces = [...new Set([auteurPub, ano!.signaleePar, dem!.demandeurId, hab!.demandeurId])];
		const anciens = await Promise.all(effaces.map(nomDe));
		for (const id of effaces) {
			await changerStatut(base, base.photos, superAdmin, id, 'parti', m);
			await effacerAgent(base, superAdmin, id, m, []);
		}
		const sansAnciens = (vue: unknown) => {
			const texte = JSON.stringify(vue);
			for (const nom of anciens) expect(texte).not.toContain(nom);
			expect(texte).toContain('Ancien');
		};
		sansAnciens(await lirePublication(base, superAdmin, pub!.id, m));
		sansAnciens(await lireAnomalie(base, superAdmin, ano!.id, m, REGLAGE_ANOMALIES));
		await listerAnomalies(base, superAdmin, m.slice(0, 10), null);
		sansAnciens(await lirePriseFaite(base, superAdmin, prise!.id));
		sansAnciens(await historiquePrises(base, unEngin!.id));
		// La demande de remplacement, vue par le remplaçant.
		const remplacant: Acteur = { type: 'personne', id: dem!.remplacantId! };
		if (!effaces.includes(dem!.remplacantId!)) sansAnciens(await demandeVue(base, remplacant, dem!.id, m, reglage));
		// L'habillement : la demande en cours reste dans la liste du référent et s'ouvre.
		const toutes = await toutesLesDemandes(base, superAdmin, m.slice(0, 10));
		expect(toutes.enCours.some((d) => d.id === hab!.id)).toBe(true);
		sansAnciens(await lireDemande(base, superAdmin, hab!.id, m));
	});
});
