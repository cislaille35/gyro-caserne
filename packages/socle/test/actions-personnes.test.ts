import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { affecterEquipe, ajouterPersonne, changerStatut, modifierFiche, modifierMonProfil, monProfil, retirerEquipe } from '../src/actions/personnes.ts';
import { adresseAutorisee } from '../src/connexion.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { affectationEquipe, attribution, equipe, grade, journal, personne, profil, profilDroit, responsabilite, responsabiliteDroit, session, user, verification } from '../src/schema.ts';
import type { Acteur } from '../src/droits.ts';
import { vueEffectif } from '../src/effectif.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-25';
const midi = `${aujourdhui}T12:00`;
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

async function jeu() {
	const base = await baseDeTest();
	await base.insert(equipe).values([
		{ nom: 'A', couleur: 'rouge', ordreRotation: 1 },
		{ nom: 'B', couleur: 'bleu', ordreRotation: 2 }
	]);
	const [agent] = await base.insert(profil).values({ nom: 'Agent', typePersonne: 'agent' }).returning();
	const [ext] = await base.insert(profil).values({ nom: 'Extérieur', typePersonne: 'exterieur' }).returning();
	const [chefEquipe] = await base.insert(responsabilite).values({ nom: 'Chef de garde', nature: 'fonction', typePerimetre: 'equipe' }).returning();
	await base.insert(responsabiliteDroit).values({ responsabiliteId: chefEquipe!.id, droit: 'GERER_ACCES' });
	const [chef] = await base.insert(personne).values({ email: 'chef@exemple.fr', prenom: 'C', nom: 'E', profilId: agent!.id }).returning();
	await base.insert(attribution).values({
		personneId: chef!.id,
		responsabiliteId: chefEquipe!.id,
		perimetreType: 'equipe',
		perimetreId: 1,
		debut: '2026-01-01',
		saisiePar: 'super:a@b.fr',
		saisieLe: '2026-01-01'
	});
	return { base, agent: agent!, ext: ext!, chef: { type: 'personne', id: chef!.id } as Acteur };
}

// Un chef de centre et un adjoint, chacun avec GERER_ACCES sur le centre.
async function direction(base: Awaited<ReturnType<typeof jeu>>['base'], profilId: number) {
	const [cdc] = await base.insert(responsabilite).values({ nom: 'Chef de centre', nature: 'fonction', typePerimetre: 'centre', systeme: 'chef_centre' }).returning();
	const [adj] = await base.insert(responsabilite).values({ nom: 'Chef de centre adjoint', nature: 'fonction', typePerimetre: 'centre', systeme: 'chef_centre_adjoint' }).returning();
	await base.insert(responsabiliteDroit).values([
		{ responsabiliteId: cdc!.id, droit: 'GERER_ACCES' },
		{ responsabiliteId: adj!.id, droit: 'GERER_ACCES' }
	]);
	const nommer = async (email: string, responsabiliteId: number) => {
		const [p] = await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId }).returning();
		await base.insert(attribution).values({ personneId: p!.id, responsabiliteId, perimetreType: 'centre', debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		return p!.id;
	};
	const chefCentre = await nommer('cdc@exemple.fr', cdc!.id);
	const adjoint = await nommer('adj@exemple.fr', adj!.id);
	return { chefCentre, adjoint };
}

describe('ajouterPersonne', () => {
	it('normalise l’adresse ajoutée', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: ' Dupont@Exemple.FR ', prenom: 'D', nom: 'U', profilId: agent.id }, aujourdhui, []);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p!.email).toBe('dupont@exemple.fr');
	});

	it('un chef de garde ajoute un agent à son équipe', async () => {
		const { base, agent, chef } = await jeu();
		const id = await ajouterPersonne(base, chef, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui, []);
		const [aff] = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id));
		expect(aff).toMatchObject({ equipeId: 1, debut: aujourdhui, fin: null });
	});

	it('… mais pas à une autre équipe', async () => {
		const { base, agent, chef } = await jeu();
		await expect(ajouterPersonne(base, chef, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 2 }, aujourdhui, [])).rejects.toBeInstanceOf(RefusDroit);
	});

	it('… ni une personne extérieure', async () => {
		const { base, ext, chef } = await jeu();
		await expect(ajouterPersonne(base, chef, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: ext.id, equipeId: 1 }, aujourdhui, [])).rejects.toBeInstanceOf(RefusDroit);
	});

	it('refuse un profil plus large que les droits du chef de garde', async () => {
		const { base, chef } = await jeu();
		const [large] = await base.insert(profil).values({ nom: 'Large', typePersonne: 'agent' }).returning();
		await base.insert(profilDroit).values({ profilId: large!.id, droit: 'GERER_ACCES', perimetreType: 'centre' });
		await expect(ajouterPersonne(base, chef, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: large!.id, equipeId: 1 }, aujourdhui, [])).rejects.toMatchObject({ droit: 'GERER_ACCES', perimetre: { type: 'centre' } });
		const [etroit] = await base.insert(profil).values({ nom: 'Étroit', typePersonne: 'agent' }).returning();
		await base.insert(profilDroit).values({ profilId: etroit!.id, droit: 'GERER_ACCES', perimetreType: 'equipe', perimetreId: 1 });
		await expect(ajouterPersonne(base, chef, { email: 'b@exemple.fr', prenom: 'A', nom: 'B', profilId: etroit!.id, equipeId: 1 }, aujourdhui, [])).resolves.toBeTypeOf('number');
	});

	it('refuse un profil qui porte un droit sur une autre équipe', async () => {
		const { base, chef } = await jeu();
		const [autre] = await base.insert(profil).values({ nom: 'Autre équipe', typePersonne: 'agent' }).returning();
		await base.insert(profilDroit).values({ profilId: autre!.id, droit: 'GERER_ACCES', perimetreType: 'equipe', perimetreId: 2 });
		await expect(ajouterPersonne(base, chef, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: autre!.id, equipeId: 1 }, aujourdhui, [])).rejects.toMatchObject({ droit: 'GERER_ACCES', perimetre: { type: 'equipe', id: 2 } });
	});

	it('ne révèle pas une adresse existante à un acteur sans droit', async () => {
		const { base, agent, chef } = await jeu();
		await expect(ajouterPersonne(base, chef, { email: 'chef@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 2 }, aujourdhui, [])).rejects.toBeInstanceOf(RefusDroit);
	});

	it('refuse une date invalide', async () => {
		const { base, agent } = await jeu();
		await expect(ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, '2026-13-45', [])).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('refuse un profil, une équipe ou une adresse invalides', async () => {
		const { base, agent } = await jeu();
		const donnees = { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id };
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, profilId: 99 }, aujourdhui, [])).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, equipeId: 99 }, aujourdhui, [])).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, email: '  ' }, aujourdhui, [])).rejects.toBeInstanceOf(DonneeInvalide);
		await ajouterPersonne(base, superAdmin, donnees, aujourdhui, []);
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, email: 'A@exemple.fr' }, aujourdhui, [])).rejects.toBeInstanceOf(DonneeInvalide);
	});
	it('écrit grade, dates et téléphone dans la même insertion', async () => {
		const { base, agent } = await jeu();
		const [sap] = await base.insert(grade).values({ code: 'SAP', libelle: 'Sapeur', ordre: 1 }).returning();
		const id = await ajouterPersonne(
			base,
			superAdmin,
			{ email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, gradeId: sap!.id, dateGrade: '2025-06-01', telephone: '0600000000', naissance: '1990-05-12', entreeCentre: '2020-01-01', engagementSpv: '2019-09-01' },
			aujourdhui,
			[]
		);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p).toMatchObject({ gradeId: sap!.id, dateGrade: '2025-06-01', telephone: '0600000000', naissance: '1990-05-12', entreeCentre: '2020-01-01', engagementSpv: '2019-09-01' });
	});

	it('refuse une date de naissance ou un grade invalides', async () => {
		const { base, agent } = await jeu();
		const donnees = { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id };
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, naissance: '1990-13-01' }, aujourdhui, [])).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, gradeId: 99 }, aujourdhui, [])).rejects.toThrow('Grade inconnu');
		expect(await base.select().from(personne).where(eq(personne.email, 'a@exemple.fr'))).toHaveLength(0);
	});
});

describe('changerStatut', () => {
	it('le chef de garde change le statut d’un membre de son équipe, pas d’un autre', async () => {
		const { base, agent, chef } = await jeu();
		const dans = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui, []);
		const hors = await ajouterPersonne(base, superAdmin, { email: 'b@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 2 }, aujourdhui, []);
		await changerStatut(base, base.photos, chef, dans, 'suspendu', midi);
		const [p] = await base.select().from(personne).where(eq(personne.id, dans));
		expect(p!.statut).toBe('suspendu');
		await expect(changerStatut(base, base.photos, chef, hors, 'suspendu', midi)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('le chef de garde ne peut pas suspendre le chef de centre affecté à son équipe', async () => {
		const { base, agent, chef } = await jeu();
		const [chefCentre] = await base.insert(responsabilite).values({ nom: 'Chef de centre', nature: 'fonction', typePerimetre: 'centre', systeme: 'chef_centre' }).returning();
		const haut = await ajouterPersonne(base, superAdmin, { email: 'haut@exemple.fr', prenom: 'H', nom: 'C', profilId: agent.id, equipeId: 1 }, aujourdhui, []);
		await base.insert(attribution).values({ personneId: haut, responsabiliteId: chefCentre!.id, perimetreType: 'centre', debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		await expect(changerStatut(base, base.photos, chef, haut, 'suspendu', midi)).rejects.toBeInstanceOf(RefusDroit);
		const simple = await ajouterPersonne(base, superAdmin, { email: 'simple@exemple.fr', prenom: 'S', nom: 'A', profilId: agent.id, equipeId: 1 }, aujourdhui, []);
		await expect(changerStatut(base, base.photos, chef, simple, 'suspendu', midi)).resolves.toBeUndefined();
	});

	it('refuse si la cible a une attribution qui commence demain', async () => {
		const { base, agent, chef } = await jeu();
		const [resp] = await base.insert(responsabilite).values({ nom: 'Mission', nature: 'mission', typePerimetre: 'equipe' }).returning();
		const cible = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui, []);
		await base.insert(attribution).values({ personneId: cible, responsabiliteId: resp!.id, perimetreType: 'equipe', perimetreId: 1, debut: '2026-10-26', saisiePar: 'super:a@b.fr', saisieLe: aujourdhui });
		await expect(changerStatut(base, base.photos, chef, cible, 'suspendu', midi)).rejects.toThrow('Le statut d’une personne qui a une responsabilité en cours ou à venir relève du centre');
	});

	it('refuse si le profil de la cible donne un droit que l’acteur n’a pas', async () => {
		const { base, chef } = await jeu();
		const [large] = await base.insert(profil).values({ nom: 'Large', typePersonne: 'agent' }).returning();
		await base.insert(profilDroit).values({ profilId: large!.id, droit: 'VOIR_PLANNING', perimetreType: 'centre' });
		const cible = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: large!.id, equipeId: 1 }, aujourdhui, []);
		await expect(changerStatut(base, base.photos, chef, cible, 'suspendu', midi)).rejects.toMatchObject({ droit: 'VOIR_PLANNING' });
	});

	it('refuse un statut inconnu et une date invalide', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		await expect(changerStatut(base, base.photos, superAdmin, id, 'inconnu' as never, midi)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(changerStatut(base, base.photos, superAdmin, id, 'parti', 'hier')).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('refuse une personne inconnue', async () => {
		const { base } = await jeu();
		await expect(changerStatut(base, base.photos, superAdmin, 99, 'parti', midi)).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('suspendre un agent ferme ses sessions', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		const maintenant = new Date();
		const demain = new Date(maintenant.getTime() + 86_400_000);
		await base.insert(user).values([
			{ id: 'u1', name: '', email: 'a@exemple.fr', emailVerified: true, createdAt: maintenant, updatedAt: maintenant },
			{ id: 'u2', name: '', email: 'chef@exemple.fr', emailVerified: true, createdAt: maintenant, updatedAt: maintenant }
		]);
		await base.insert(session).values([
			{ id: 's1', token: 't1', userId: 'u1', expiresAt: demain, createdAt: maintenant, updatedAt: maintenant },
			{ id: 's2', token: 't2', userId: 'u2', expiresAt: demain, createdAt: maintenant, updatedAt: maintenant }
		]);

		await changerStatut(base, base.photos, superAdmin, id, 'stagiaire', midi);
		expect((await base.select().from(session)).map((s) => s.id)).toEqual(['s1', 's2']);

		await changerStatut(base, base.photos, superAdmin, id, 'suspendu', midi);
		expect((await base.select().from(session)).map((s) => s.id)).toEqual(['s2']);
	});

	it('lever une suspension exige GERER_ACCES sur le centre : pas le chef de garde, mais le chef de centre', async () => {
		const { base, agent, chef } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui, []);
		await changerStatut(base, base.photos, chef, id, 'suspendu', midi);
		await expect(changerStatut(base, base.photos, chef, id, 'operationnel', midi)).rejects.toBeInstanceOf(RefusDroit);
		await expect(changerStatut(base, base.photos, chef, id, 'parti', midi)).rejects.toBeInstanceOf(RefusDroit);

		const [chefCentre] = await base.insert(responsabilite).values({ nom: 'Chef de centre', nature: 'fonction', typePerimetre: 'centre', systeme: 'chef_centre' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: chefCentre!.id, droit: 'GERER_ACCES' });
		const [cdc] = await base.insert(personne).values({ email: 'cdc@exemple.fr', prenom: 'C', nom: 'C', profilId: agent.id }).returning();
		await base.insert(attribution).values({ personneId: cdc!.id, responsabiliteId: chefCentre!.id, perimetreType: 'centre', debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		await changerStatut(base, base.photos, { type: 'personne', id: cdc!.id }, id, 'operationnel', midi);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p!.statut).toBe('operationnel');
	});

	it('seul un super administrateur change le statut du chef de centre', async () => {
		const { base, agent } = await jeu();
		const { chefCentre, adjoint } = await direction(base, agent.id);
		await expect(changerStatut(base, base.photos, { type: 'personne', id: adjoint }, chefCentre, 'suspendu', midi)).rejects.toBeInstanceOf(RefusDroit);
		await expect(changerStatut(base, base.photos, { type: 'personne', id: chefCentre }, chefCentre, 'inapte_temporaire', midi)).rejects.toBeInstanceOf(RefusDroit);
		await expect(changerStatut(base, base.photos, { type: 'personne', id: chefCentre }, adjoint, 'inapte_temporaire', midi)).resolves.toBeUndefined();
		await changerStatut(base, base.photos, superAdmin, chefCentre, 'suspendu', midi);
		const [p] = await base.select().from(personne).where(eq(personne.id, chefCentre));
		expect(p!.statut).toBe('suspendu');
	});

	it('le refus sur le chef de centre dit pourquoi', async () => {
		const { base, agent } = await jeu();
		const { chefCentre, adjoint } = await direction(base, agent.id);
		await expect(changerStatut(base, base.photos, { type: 'personne', id: adjoint }, chefCentre, 'suspendu', midi)).rejects.toThrow('Seul un super administrateur change le statut du chef de centre');
	});

	it('seuls le chef de centre ou un super administrateur changent le statut d’un adjoint', async () => {
		const { base, agent } = await jeu();
		const { chefCentre, adjoint } = await direction(base, agent.id);
		const [adj] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre_adjoint'));
		const [p] = await base.insert(personne).values({ email: 'adj2@exemple.fr', prenom: 'P', nom: 'N', profilId: agent.id }).returning();
		await base.insert(attribution).values({ personneId: p!.id, responsabiliteId: adj!.id, perimetreType: 'centre', debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const second = p!.id;
		await expect(changerStatut(base, base.photos, { type: 'personne', id: adjoint }, second, 'suspendu', midi)).rejects.toThrow('Seuls le chef de centre ou un super administrateur changent le statut d’un adjoint');
		await expect(changerStatut(base, base.photos, { type: 'personne', id: adjoint }, adjoint, 'inapte_temporaire', midi)).rejects.toBeInstanceOf(RefusDroit);
		await changerStatut(base, base.photos, { type: 'personne', id: chefCentre }, second, 'suspendu', midi);
		await changerStatut(base, base.photos, superAdmin, adjoint, 'suspendu', midi);
		const statuts = await base.select({ id: personne.id, statut: personne.statut }).from(personne);
		expect(statuts.find((s) => s.id === second)!.statut).toBe('suspendu');
		expect(statuts.find((s) => s.id === adjoint)!.statut).toBe('suspendu');
	});

	it('faire revenir un « parti » exige GERER_ACCES sur le centre : pas le chef de garde, mais le chef de centre et l’adjoint', async () => {
		const { base, agent, chef } = await jeu();
		const { chefCentre, adjoint } = await direction(base, agent.id);
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui, []);
		await changerStatut(base, base.photos, chef, id, 'parti', midi);
		await expect(changerStatut(base, base.photos, chef, id, 'operationnel', midi)).rejects.toBeInstanceOf(RefusDroit);
		await expect(changerStatut(base, base.photos, chef, id, 'suspendu', midi)).rejects.toBeInstanceOf(RefusDroit);
		await changerStatut(base, base.photos, { type: 'personne', id: chefCentre }, id, 'operationnel', midi);
		// Le départ a retiré l'agent de son équipe : le chef de garde n'a plus de prise tant qu'on ne l'a pas réaffecté.
		await expect(changerStatut(base, base.photos, chef, id, 'parti', midi)).rejects.toBeInstanceOf(RefusDroit);
		await affecterEquipe(base, superAdmin, id, 1, aujourdhui, aujourdhui);
		await changerStatut(base, base.photos, chef, id, 'parti', midi);
		await changerStatut(base, base.photos, { type: 'personne', id: adjoint }, id, 'stagiaire', midi);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p!.statut).toBe('stagiaire');
	});

	it('suspendre un agent efface ses liens de connexion en attente', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		const dans5min = new Date(Date.now() + 300_000);
		const lien = (identifier: string, email: string) => ({ id: identifier, identifier, value: JSON.stringify({ type: 'magic-link', email }), expiresAt: dans5min });
		await base.insert(verification).values([lien('magic-link:1', 'a@exemple.fr'), lien('magic-link:2', 'chef@exemple.fr')]);

		await changerStatut(base, base.photos, superAdmin, id, 'stagiaire', midi);
		expect(await base.select().from(verification)).toHaveLength(2);

		await changerStatut(base, base.photos, superAdmin, id, 'suspendu', midi);
		expect((await base.select().from(verification)).map((v) => v.identifier)).toEqual(['magic-link:2']);
	});

	it('retirer l’accès ne casse pas sur une ligne de vérification qui n’est pas du JSON', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		await base.insert(verification).values({ id: 'brut', identifier: 'autre', value: 'texte brut', expiresAt: new Date(Date.now() + 300_000) });

		await changerStatut(base, base.photos, superAdmin, id, 'suspendu', midi);
		expect(await base.select().from(verification)).toHaveLength(1);
	});
	it('déclarer « parti » efface naissance et contact d’urgence, qui restent vides au retour', async () => {
		const { base, agent } = await jeu();
		const { chefCentre } = await direction(base, agent.id);
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, naissance: '1990-05-12' }, aujourdhui, []);
		await base.update(personne).set({ contactUrgence: 'Conjoint 0600000000' }).where(eq(personne.id, id));

		await changerStatut(base, base.photos, superAdmin, id, 'suspendu', midi);
		const [suspendu] = await base.select().from(personne).where(eq(personne.id, id));
		expect(suspendu).toMatchObject({ naissance: '1990-05-12', contactUrgence: 'Conjoint 0600000000' });

		await changerStatut(base, base.photos, superAdmin, id, 'parti', midi);
		const [parti] = await base.select().from(personne).where(eq(personne.id, id));
		expect(parti).toMatchObject({ statut: 'parti', naissance: null, contactUrgence: null });

		await changerStatut(base, base.photos, { type: 'personne', id: chefCentre }, id, 'operationnel', midi);
		const [revenu] = await base.select().from(personne).where(eq(personne.id, id));
		expect(revenu).toMatchObject({ statut: 'operationnel', naissance: null, contactUrgence: null });
	});
});

describe('changerStatut vers parti : équipe', () => {
	const equipes = (base: Awaited<ReturnType<typeof jeu>>['base'], id: number) => base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id));

	it('retire l’agent de son équipe dès aujourd’hui, la vue ne le liste plus', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'Aline', nom: 'Zed', profilId: agent.id, equipeId: 1 }, '2026-01-01', []);
		await changerStatut(base, base.photos, superAdmin, id, 'parti', midi);
		expect(await equipes(base, id)).toEqual([{ personneId: id, equipeId: 1, debut: '2026-01-01', fin: '2026-10-24' }]);
		const groupes = await vueEffectif(base, aujourdhui);
		expect(groupes.find((g) => g.titre === 'Équipe 1')?.personnes ?? []).toEqual([]);
		expect(groupes.flatMap((g) => g.personnes.map((p) => p.nom))).not.toContain('Zed');
		expect(await base.select().from(journal).where(eq(journal.action, 'retirer_equipe'))).toHaveLength(1);
	});

	it('supprime l’affectation commencée aujourd’hui et celles à venir', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui, []);
		await affecterEquipe(base, superAdmin, id, 2, '2026-11-01', aujourdhui);
		await changerStatut(base, base.photos, superAdmin, id, 'parti', midi);
		expect(await equipes(base, id)).toEqual([]);
	});

	it('sans équipe, le départ réussit sans ligne de retrait', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		await changerStatut(base, base.photos, superAdmin, id, 'parti', midi);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p!.statut).toBe('parti');
		expect(await base.select().from(journal).where(eq(journal.action, 'retirer_equipe'))).toHaveLength(0);
	});

	it('au retour, la personne reste sans équipe', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01', []);
		await changerStatut(base, base.photos, superAdmin, id, 'parti', midi);
		await changerStatut(base, base.photos, superAdmin, id, 'operationnel', midi);
		expect((await equipes(base, id)).filter((a) => a.fin === null)).toEqual([]);
	});
});

describe('affecterEquipe', () => {
	it('clôt l’affectation en cours la veille du début', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01', []);
		await affecterEquipe(base, superAdmin, id, 2, '2026-03-01', aujourdhui);
		const lignes = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id));
		expect(lignes).toHaveLength(2);
		expect(lignes.find((l) => l.equipeId === 1)!.fin).toBe('2026-02-28');
		expect(lignes.find((l) => l.equipeId === 2)).toMatchObject({ debut: '2026-03-01', fin: null });
	});

	it('refuse le chef de garde : il faut le droit sur le centre', async () => {
		const { base, agent, chef } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01', []);
		await expect(affecterEquipe(base, chef, id, 2, '2026-03-01', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('un droit expiré hier ne permet pas d’affecter avec un début passé', async () => {
		const { base, agent } = await jeu();
		const [centreResp] = await base.insert(responsabilite).values({ nom: 'Gestionnaire', nature: 'mission', typePerimetre: 'centre' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: centreResp!.id, droit: 'GERER_ACCES' });
		const [gest] = await base.insert(personne).values({ email: 'g@exemple.fr', prenom: 'G', nom: 'G', profilId: agent.id }).returning();
		await base.insert(attribution).values({ personneId: gest!.id, responsabiliteId: centreResp!.id, perimetreType: 'centre', debut: '2026-01-01', fin: '2026-10-24', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01', []);
		await expect(affecterEquipe(base, { type: 'personne', id: gest!.id }, id, 2, '2026-10-20', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('refuse un début antérieur au début de l’affectation en cours', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-03-01', []);
		await expect(affecterEquipe(base, superAdmin, id, 2, '2026-02-01', aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('refuse une équipe inactive, à l’affectation comme à l’ajout', async () => {
		const { base, agent } = await jeu();
		const [ancienne] = await base.insert(equipe).values({ nom: 'Ancienne', couleur: 'gris', ordreRotation: 3, active: 0 }).returning();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		await expect(affecterEquipe(base, superAdmin, id, ancienne!.id, aujourdhui, aujourdhui)).rejects.toThrow(new DonneeInvalide('Équipe inactive'));
		await expect(ajouterPersonne(base, superAdmin, { email: 'b@exemple.fr', prenom: 'B', nom: 'C', profilId: agent.id, equipeId: ancienne!.id }, aujourdhui, [])).rejects.toThrow(
			new DonneeInvalide('Équipe inactive')
		);
		expect(await base.select().from(affectationEquipe)).toEqual([]);
		expect(await base.select().from(personne).where(eq(personne.email, 'b@exemple.fr'))).toEqual([]);
	});

	it('le même jour, corrige l’équipe de l’affectation au lieu d’en ouvrir une autre', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui, []);
		await affecterEquipe(base, superAdmin, id, 2, aujourdhui, aujourdhui);
		expect(await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id))).toEqual([{ personneId: id, equipeId: 2, debut: aujourdhui, fin: null }]);
		expect(await base.select().from(journal).where(eq(journal.action, 'affecter_equipe'))).toHaveLength(1);
	});

	it('n’écrit rien si l’équipe ne change pas', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01', []);
		await affecterEquipe(base, superAdmin, id, 1, aujourdhui, aujourdhui);
		expect(await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id))).toEqual([{ personneId: id, equipeId: 1, debut: '2026-01-01', fin: null }]);
		expect(await base.select().from(journal).where(eq(journal.action, 'affecter_equipe'))).toHaveLength(0);
	});

	it('protège l’équipe du chef de centre et des adjoints', async () => {
		const { base, agent } = await jeu();
		const { chefCentre, adjoint } = await direction(base, agent.id);
		const [autreAdjoint] = await base.insert(personne).values({ email: 'adj2@exemple.fr', prenom: 'P', nom: 'N', profilId: agent.id }).returning();
		const [resp] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre_adjoint'));
		await base.insert(attribution).values({ personneId: autreAdjoint!.id, responsabiliteId: resp!.id, perimetreType: 'centre', debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const parAdjoint: Acteur = { type: 'personne', id: adjoint };

		await expect(affecterEquipe(base, parAdjoint, chefCentre, 1, aujourdhui, aujourdhui)).rejects.toThrow('Seul un super administrateur change l’équipe du chef de centre');
		await expect(affecterEquipe(base, parAdjoint, autreAdjoint!.id, 1, aujourdhui, aujourdhui)).rejects.toThrow('Seuls le chef de centre ou un super administrateur changent l’équipe d’un adjoint');
		await expect(affecterEquipe(base, { type: 'personne', id: chefCentre }, chefCentre, 1, aujourdhui, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		expect(await base.select().from(affectationEquipe)).toEqual([]);

		await affecterEquipe(base, { type: 'personne', id: chefCentre }, adjoint, 1, aujourdhui, aujourdhui);
		await affecterEquipe(base, superAdmin, chefCentre, 2, aujourdhui, aujourdhui);
		expect(await base.select().from(affectationEquipe)).toHaveLength(2);
	});
});

describe('modifierFiche', () => {
	async function avecAgent() {
		const j = await jeu();
		const id = await ajouterPersonne(j.base, superAdmin, { email: 'bruno@exemple.fr', prenom: 'Bruno', nom: 'Petit', profilId: j.agent.id }, aujourdhui, []);
		return { ...j, id };
	}

	it('refuse un agent ordinaire et un chef de garde, sans rien écrire', async () => {
		const { base, agent, chef, id } = await avecAgent();
		const ordinaire = await ajouterPersonne(base, superAdmin, { email: 'o@exemple.fr', prenom: 'O', nom: 'O', profilId: agent.id }, aujourdhui, []);
		await expect(modifierFiche(base, { type: 'personne', id: ordinaire }, id, { nom: 'Grand' }, aujourdhui, [])).rejects.toBeInstanceOf(RefusDroit);
		await expect(modifierFiche(base, chef, id, { nom: 'Grand' }, aujourdhui, [])).rejects.toBeInstanceOf(RefusDroit);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p!.nom).toBe('Petit');
	});

	it('un adjoint ne modifie pas la fiche du chef de centre, rien n’est écrit', async () => {
		const { base, agent } = await jeu();
		const { chefCentre, adjoint } = await direction(base, agent.id);
		await expect(modifierFiche(base, { type: 'personne', id: adjoint }, chefCentre, { email: 'pirate@exemple.fr' }, aujourdhui, [])).rejects.toThrow(
			'Seul un super administrateur modifie la fiche du chef de centre'
		);
		await expect(modifierFiche(base, { type: 'personne', id: adjoint }, chefCentre, { email: 'pirate@exemple.fr' }, aujourdhui, [])).rejects.toBeInstanceOf(RefusDroit);
		const [p] = await base.select().from(personne).where(eq(personne.id, chefCentre));
		expect(p!.email).toBe('cdc@exemple.fr');
		expect(await base.select().from(journal).where(eq(journal.action, 'modifier_fiche'))).toHaveLength(0);
	});

	it('un adjoint ne modifie pas la fiche d’un autre adjoint', async () => {
		const { base, agent } = await jeu();
		const { adjoint } = await direction(base, agent.id);
		const [adj] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre_adjoint'));
		const [second] = await base.insert(personne).values({ email: 'adj2@exemple.fr', prenom: 'P', nom: 'N', profilId: agent.id }).returning();
		await base.insert(attribution).values({ personneId: second!.id, responsabiliteId: adj!.id, perimetreType: 'centre', debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		await expect(modifierFiche(base, { type: 'personne', id: adjoint }, second!.id, { email: 'pirate@exemple.fr' }, aujourdhui, [])).rejects.toThrow(
			'Seuls le chef de centre ou un super administrateur modifient la fiche d’un adjoint'
		);
		const [p] = await base.select().from(personne).where(eq(personne.id, second!.id));
		expect(p!.email).toBe('adj2@exemple.fr');
	});

	it('le chef de centre modifie un adjoint, le super administrateur modifie le chef de centre', async () => {
		const { base, agent } = await jeu();
		const { chefCentre, adjoint } = await direction(base, agent.id);
		await modifierFiche(base, { type: 'personne', id: chefCentre }, adjoint, { nom: 'Martin' }, aujourdhui, []);
		await modifierFiche(base, superAdmin, chefCentre, { nom: 'Durand' }, aujourdhui, []);
		const noms = await base.select({ id: personne.id, nom: personne.nom }).from(personne);
		expect(noms.find((n) => n.id === adjoint)!.nom).toBe('Martin');
		expect(noms.find((n) => n.id === chefCentre)!.nom).toBe('Durand');
	});

	it('un adjoint modifie un agent ordinaire', async () => {
		const { base, agent, id } = await avecAgent();
		const { adjoint } = await direction(base, agent.id);
		await modifierFiche(base, { type: 'personne', id: adjoint }, id, { telephone: '0611111111' }, aujourdhui, []);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p!.telephone).toBe('0611111111');
	});

	it('journalise les seuls champs changés', async () => {
		const { base, id } = await avecAgent();
		await modifierFiche(base, superAdmin, id, { prenom: 'Bruno', nom: 'Grand', naissance: '1990-05-12' }, aujourdhui, []);
		const lignes = await base.select().from(journal).where(eq(journal.action, 'modifier_fiche'));
		expect(lignes).toHaveLength(1);
		expect(lignes[0]).toMatchObject({ acteur: 'super:admin@exemple.fr', cibleType: 'personne', cibleId: id });
		// Les noms des champs seulement : une valeur effacée au départ ne doit pas survivre au journal.
		expect(JSON.parse(lignes[0]!.details!)).toEqual({ champs: ['nom', 'naissance'] });
	});

	it('journalise l’ancienne et la nouvelle adresse, les autres champs par leur seul nom', async () => {
		const { base, id } = await avecAgent();
		await modifierFiche(base, superAdmin, id, { email: 'Nouveau@Exemple.fr', nom: 'Grand' }, aujourdhui, []);
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'modifier_fiche'));
		expect(JSON.parse(ligne!.details!)).toEqual({ champs: ['email', 'nom'], email: { avant: 'bruno@exemple.fr', apres: 'nouveau@exemple.fr' } });
	});

	it('n’écrit que les champs de la fiche', async () => {
		const { base, id } = await avecAgent();
		await changerStatut(base, base.photos, superAdmin, id, 'suspendu', midi);
		await modifierFiche(base, superAdmin, id, { nom: 'Grand', statut: 'operationnel', contactUrgence: 'X' } as never, aujourdhui, []);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p).toMatchObject({ nom: 'Grand', statut: 'suspendu', contactUrgence: null });
	});

	it('normalise l’adresse', async () => {
		const { base, id } = await avecAgent();
		await modifierFiche(base, superAdmin, id, { email: ' Bruno.PETIT@exemple.fr ' }, aujourdhui, []);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p!.email).toBe('bruno.petit@exemple.fr');
	});

	it('refuse une adresse déjà prise par une autre personne, même écrite autrement', async () => {
		const { base, id } = await avecAgent();
		await expect(modifierFiche(base, superAdmin, id, { email: ' CHEF@exemple.fr' }, aujourdhui, [])).rejects.toThrow('Adresse déjà utilisée');
		await expect(modifierFiche(base, superAdmin, id, { email: '  ' }, aujourdhui, [])).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(modifierFiche(base, superAdmin, id, { email: 'BRUNO@exemple.fr' }, aujourdhui, [])).resolves.toBeUndefined();
	});

	it('changer l’adresse ferme les sessions et liens de l’ancienne ; la nouvelle se connecte, l’ancienne non', async () => {
		const { base, id } = await avecAgent();
		const maintenant = new Date();
		const demain = new Date(maintenant.getTime() + 86_400_000);
		await base.insert(user).values([
			{ id: 'u1', name: '', email: 'bruno@exemple.fr', emailVerified: true, createdAt: maintenant, updatedAt: maintenant },
			{ id: 'u2', name: '', email: 'chef@exemple.fr', emailVerified: true, createdAt: maintenant, updatedAt: maintenant }
		]);
		await base.insert(session).values([
			{ id: 's1', token: 't1', userId: 'u1', expiresAt: demain, createdAt: maintenant, updatedAt: maintenant },
			{ id: 's2', token: 't2', userId: 'u2', expiresAt: demain, createdAt: maintenant, updatedAt: maintenant }
		]);
		const lien = (identifier: string, email: string) => ({ id: identifier, identifier, value: JSON.stringify({ type: 'magic-link', email }), expiresAt: demain });
		await base.insert(verification).values([lien('magic-link:1', 'bruno@exemple.fr'), lien('magic-link:2', 'chef@exemple.fr')]);

		await modifierFiche(base, superAdmin, id, { nom: 'Grand' }, aujourdhui, []);
		expect(await base.select().from(session)).toHaveLength(2);

		await modifierFiche(base, superAdmin, id, { email: 'bruno.petit@exemple.fr' }, aujourdhui, []);
		expect((await base.select().from(session)).map((s) => s.id)).toEqual(['s2']);
		expect((await base.select().from(verification)).map((v) => v.identifier)).toEqual(['magic-link:2']);
		expect(await adresseAutorisee(base, 'bruno.petit@exemple.fr', [])).toBe(true);
		expect(await adresseAutorisee(base, 'bruno@exemple.fr', [])).toBe(false);
	});

	it('vérifie les dates, accepte de les vider', async () => {
		const { base, id } = await avecAgent();
		await expect(modifierFiche(base, superAdmin, id, { naissance: '1990-13-01' }, aujourdhui, [])).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(modifierFiche(base, superAdmin, id, { dateGrade: 'hier' }, aujourdhui, [])).rejects.toBeInstanceOf(DonneeInvalide);
		await modifierFiche(base, superAdmin, id, { naissance: '1990-05-12' }, aujourdhui, []);
		await modifierFiche(base, superAdmin, id, { naissance: null }, aujourdhui, []);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p!.naissance).toBeNull();
	});

	it('refuse une adresse, un prénom ou un nom absents ou qui ne sont pas du texte', async () => {
		const { base, id } = await avecAgent();
		await expect(modifierFiche(base, superAdmin, id, { email: null } as never, aujourdhui, [])).rejects.toThrow('Adresse invalide');
		await expect(modifierFiche(base, superAdmin, id, { prenom: null } as never, aujourdhui, [])).rejects.toThrow('Prénom invalide');
		await expect(modifierFiche(base, superAdmin, id, { nom: 42 } as never, aujourdhui, [])).rejects.toThrow('Nom invalide');
	});

	it('refuse un grade, un profil, une personne inconnus ou un nom vide', async () => {
		const { base, id } = await avecAgent();
		await expect(modifierFiche(base, superAdmin, id, { gradeId: 99 }, aujourdhui, [])).rejects.toThrow('Grade inconnu');
		await expect(modifierFiche(base, superAdmin, id, { profilId: 99 }, aujourdhui, [])).rejects.toThrow('Profil inconnu');
		await expect(modifierFiche(base, superAdmin, 99, { nom: 'X' }, aujourdhui, [])).rejects.toThrow('Personne inconnue');
		await expect(modifierFiche(base, superAdmin, id, { nom: '  ' }, aujourdhui, [])).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('retirerEquipe', () => {
	it('termine l’affectation en cours la veille et journalise', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01', []);
		await retirerEquipe(base, superAdmin, id, aujourdhui);
		const lignes = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id));
		expect(lignes).toEqual([{ personneId: id, equipeId: 1, debut: '2026-01-01', fin: '2026-10-24' }]);
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'retirer_equipe'));
		expect(ligne).toMatchObject({ cibleType: 'personne', cibleId: id });
	});

	it('refuse sans équipe en cours', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		await expect(retirerEquipe(base, superAdmin, id, aujourdhui)).rejects.toThrow('Aucune équipe en cours');
	});

	it('efface aussi le changement d’équipe prévu', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01', []);
		await affecterEquipe(base, superAdmin, id, 2, '2026-11-01', aujourdhui);
		await retirerEquipe(base, superAdmin, id, aujourdhui);
		const lignes = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id));
		expect(lignes).toEqual([{ personneId: id, equipeId: 1, debut: '2026-01-01', fin: '2026-10-24' }]);
	});

	it('une affectation commencée aujourd’hui est supprimée, sans fin avant le début', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui, []);
		await retirerEquipe(base, superAdmin, id, aujourdhui);
		expect(await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id))).toEqual([]);
	});

	it('sans équipe en cours, efface l’affectation à venir', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		await affecterEquipe(base, superAdmin, id, 2, '2026-11-01', aujourdhui);
		await retirerEquipe(base, superAdmin, id, aujourdhui);
		expect(await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id))).toEqual([]);
	});

	it('refuse si l’affectation est terminée, sans rien d’autre à venir', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01', []);
		await retirerEquipe(base, superAdmin, id, '2026-06-01');
		await expect(retirerEquipe(base, superAdmin, id, aujourdhui)).rejects.toThrow('Aucune équipe en cours');
	});

	it('refuse le chef de garde : il faut le droit sur le centre', async () => {
		const { base, agent, chef } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01', []);
		await expect(retirerEquipe(base, chef, id, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('protège l’équipe du chef de centre et des adjoints', async () => {
		const { base, agent } = await jeu();
		const { chefCentre, adjoint } = await direction(base, agent.id);
		const [autreAdjoint] = await base.insert(personne).values({ email: 'adj2@exemple.fr', prenom: 'P', nom: 'N', profilId: agent.id }).returning();
		const [resp] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre_adjoint'));
		await base.insert(attribution).values({ personneId: autreAdjoint!.id, responsabiliteId: resp!.id, perimetreType: 'centre', debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		for (const id of [chefCentre, adjoint, autreAdjoint!.id]) await base.insert(affectationEquipe).values({ personneId: id, equipeId: 1, debut: '2026-01-01' });
		const parAdjoint: Acteur = { type: 'personne', id: adjoint };

		await expect(retirerEquipe(base, parAdjoint, chefCentre, aujourdhui)).rejects.toThrow('Seul un super administrateur change l’équipe du chef de centre');
		await expect(retirerEquipe(base, parAdjoint, autreAdjoint!.id, aujourdhui)).rejects.toThrow('Seuls le chef de centre ou un super administrateur changent l’équipe d’un adjoint');
		expect((await base.select().from(affectationEquipe)).every((a) => a.fin === null)).toBe(true);

		await retirerEquipe(base, { type: 'personne', id: chefCentre }, adjoint, aujourdhui);
		await retirerEquipe(base, superAdmin, chefCentre, aujourdhui);
		expect((await base.select().from(affectationEquipe)).filter((a) => a.fin !== null)).toHaveLength(2);
	});
});

describe('journal', () => {
	it('chaque action écrit une ligne de journal', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui, []);
		await changerStatut(base, base.photos, superAdmin, id, 'stagiaire', midi);
		await affecterEquipe(base, superAdmin, id, 2, '2026-11-01', aujourdhui);
		const lignes = await base.select().from(journal);
		expect(lignes.map((l) => l.action)).toEqual(['ajouter_personne', 'changer_statut', 'affecter_equipe']);
		expect(lignes.every((l) => l.acteur === 'super:admin@exemple.fr' && l.cibleType === 'personne' && l.cibleId === id)).toBe(true);
	});
});


describe('mon profil', () => {
	async function avecAgent() {
		const j = await jeu();
		const id = await ajouterPersonne(j.base, superAdmin, { email: 'bruno@exemple.fr', prenom: 'Bruno', nom: 'Petit', profilId: j.agent.id }, aujourdhui, []);
		return { ...j, id, moi: { type: 'personne', id } as Acteur };
	}

	it('lit et écrit ses propres champs', async () => {
		const { base, id, moi } = await avecAgent();
		expect(await monProfil(base, moi)).toEqual({ surnom: null, telephone: null, telephoneVisible: false, contactUrgence: null, naissance: null, anniversaireVisible: true, cochesLecture: true });
		await modifierMonProfil(base, moi, { surnom: 'Bru', telephone: '0600000000', telephoneVisible: true, contactUrgence: 'Alice 0611111111', anniversaireVisible: false, cochesLecture: false }, aujourdhui);
		expect(await monProfil(base, moi)).toEqual({ surnom: 'Bru', telephone: '0600000000', telephoneVisible: true, contactUrgence: 'Alice 0611111111', naissance: null, anniversaireVisible: false, cochesLecture: false });
		const [fiche] = await base.select().from(personne).where(eq(personne.id, id));
		expect(fiche).toMatchObject({ telephoneVisible: 1, anniversaireVisible: 0, cochesLecture: 0 });
	});

	it('refuse un champ hors liste, sans rien écrire', async () => {
		const { base, id, moi } = await avecAgent();
		// @ts-expect-error `nom` n'est pas modifiable ici
		await expect(modifierMonProfil(base, moi, { surnom: 'Bru', nom: 'Pirate' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		const [fiche] = await base.select().from(personne).where(eq(personne.id, id));
		expect(fiche).toMatchObject({ nom: 'Petit', surnom: null });
	});

	it('refuse un type invalide', async () => {
		const { base, moi } = await avecAgent();
		await expect(modifierMonProfil(base, moi, { surnom: 5 as unknown as string }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(modifierMonProfil(base, moi, { telephoneVisible: 'oui' as unknown as boolean }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(modifierMonProfil(base, moi, { cochesLecture: 0 as unknown as boolean }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('sa date de naissance : une date plausible, vidable', async () => {
		const { base, id, moi } = await avecAgent();
		await modifierMonProfil(base, moi, { naissance: '1990-05-17' }, aujourdhui);
		expect(await monProfil(base, moi)).toMatchObject({ naissance: '1990-05-17' });
		for (const naissance of ['1990-02-30', '1990-13-45', '17/05/1990', '1899-12-31', '2099-01-01'])
			await expect(modifierMonProfil(base, moi, { naissance }, aujourdhui)).rejects.toThrow('Date de naissance invalide');
		await expect(modifierMonProfil(base, moi, { naissance: 5 as unknown as string }, aujourdhui)).rejects.toThrow('Date de naissance invalide');
		await modifierMonProfil(base, moi, { naissance: '' }, aujourdhui);
		const [fiche] = await base.select().from(personne).where(eq(personne.id, id));
		expect(fiche!.naissance).toBeNull();
		// Le journal ne garde que le nom du champ.
		const lignes = await base.select().from(journal).where(eq(journal.action, 'modifier_mon_profil'));
		expect(lignes.map((l) => JSON.parse(l.details!))).toEqual([{ champs: ['naissance'] }, { champs: ['naissance'] }]);
		expect(JSON.stringify(lignes)).not.toContain('1990');
	});

	it('refuse le super administrateur', async () => {
		const { base } = await avecAgent();
		await expect(monProfil(base, superAdmin)).resolves.toBeNull();
		await expect(modifierMonProfil(base, superAdmin, { surnom: 'X' }, aujourdhui)).rejects.toThrow('Pas de fiche pour le super administrateur');
	});

	it('enregistre les chaînes vides comme null', async () => {
		const { base, moi } = await avecAgent();
		await modifierMonProfil(base, moi, { surnom: 'Bru', telephone: '06', contactUrgence: 'Alice' }, aujourdhui);
		await modifierMonProfil(base, moi, { surnom: '  ', telephone: '', contactUrgence: '' }, aujourdhui);
		expect(await monProfil(base, moi)).toMatchObject({ surnom: null, telephone: null, contactUrgence: null });
	});

	it('journalise les noms des champs changés, jamais les valeurs', async () => {
		const { base, id, moi } = await avecAgent();
		await modifierMonProfil(base, moi, { surnom: 'Bru', telephone: '0600000000', anniversaireVisible: true }, aujourdhui);
		const lignes = await base.select().from(journal).where(eq(journal.action, 'modifier_mon_profil'));
		expect(lignes).toHaveLength(1);
		expect(lignes[0]).toMatchObject({ acteur: `personne:${id}`, cibleType: 'personne', cibleId: id });
		expect(JSON.parse(lignes[0]!.details!)).toEqual({ champs: ['surnom', 'telephone'] });
		expect(JSON.stringify(lignes[0])).not.toContain('0600000000');
		await modifierMonProfil(base, moi, { surnom: 'Bru' }, aujourdhui);
		expect(await base.select().from(journal).where(eq(journal.action, 'modifier_mon_profil'))).toHaveLength(1);
	});
});

describe('statut à la création', () => {
	it('enregistre le statut demandé, « opérationnel » par défaut', async () => {
		const { base, agent } = await jeu();
		const defaut = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		const stagiaire = await ajouterPersonne(base, superAdmin, { email: 'b@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, statut: 'stagiaire' }, aujourdhui, []);
		const statut = async (id: number) => (await base.select().from(personne).where(eq(personne.id, id)))[0]!.statut;
		expect(await statut(defaut)).toBe('operationnel');
		expect(await statut(stagiaire)).toBe('stagiaire');
	});

	it('refuse « parti » et un statut inconnu', async () => {
		const { base, agent } = await jeu();
		const donnees = { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id };
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, statut: 'parti' }, aujourdhui, [])).rejects.toThrow(new DonneeInvalide('Statut impossible à la création'));
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, statut: 'inconnu' as any }, aujourdhui, [])).rejects.toThrow(new DonneeInvalide('Statut inconnu'));
		expect(await base.select().from(personne).where(eq(personne.email, 'a@exemple.fr'))).toHaveLength(0);
	});
});

describe('adresse prise entre la vérification et l’écriture', () => {
	// Une base dont le batch insère d'abord l'adresse : le contrôle préalable est déjà passé.
	function concurrente(base: Awaited<ReturnType<typeof jeu>>['base'], email: string, profilId: number) {
		return new Proxy(base, {
			get(cible, cle, recepteur) {
				if (cle !== 'batch') return Reflect.get(cible, cle, recepteur);
				return async (requetes: never) => {
					await cible.insert(personne).values({ email, prenom: 'Z', nom: 'Z', profilId });
					return cible.batch(requetes);
				};
			}
		});
	}

	it('est traduite à l’ajout', async () => {
		const { base, agent } = await jeu();
		await expect(ajouterPersonne(concurrente(base, 'a@exemple.fr', agent.id), superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, [])).rejects.toThrow(
			new DonneeInvalide('Adresse déjà utilisée')
		);
	});

	it('est traduite à la modification de la fiche', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		await expect(modifierFiche(concurrente(base, 'b@exemple.fr', agent.id), superAdmin, id, { email: 'b@exemple.fr' }, aujourdhui, [])).rejects.toThrow(new DonneeInvalide('Adresse déjà utilisée'));
	});

	it('laisse passer toute autre erreur', async () => {
		const { base, agent } = await jeu();
		const casse = new Proxy(base, { get: (cible, cle, r) => (cle === 'batch' ? async () => Promise.reject(new Error('disque plein')) : Reflect.get(cible, cle, r)) });
		await expect(ajouterPersonne(casse, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, [])).rejects.toThrow('disque plein');
	});
});

describe('longueurs maximales', () => {
	const trop = (n: number) => 'x'.repeat(n + 1);
	const exact = (n: number) => 'x'.repeat(n);

	it('refuse à l’ajout un champ trop long, accepte la limite', async () => {
		const { base, agent } = await jeu();
		const donnees = { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id };
		const ajout = (plus: object) => ajouterPersonne(base, superAdmin, { ...donnees, ...plus }, aujourdhui, []);
		await expect(ajout({ prenom: trop(60) })).rejects.toThrow(new DonneeInvalide('Prénom trop long'));
		await expect(ajout({ nom: trop(60) })).rejects.toThrow(new DonneeInvalide('Nom trop long'));
		await expect(ajout({ telephone: trop(20) })).rejects.toThrow(new DonneeInvalide('Téléphone trop long'));
		await expect(ajout({ email: `${exact(250)}@e.fr` })).rejects.toThrow(new DonneeInvalide('Adresse trop longue'));
		await expect(ajout({ prenom: exact(60), nom: exact(60), telephone: exact(20) })).resolves.toBeTypeOf('number');
	});

	it('refuse à la modification de la fiche', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		const modif = (champs: object) => modifierFiche(base, superAdmin, id, champs, aujourdhui, []);
		await expect(modif({ prenom: trop(60) })).rejects.toThrow(new DonneeInvalide('Prénom trop long'));
		await expect(modif({ nom: trop(60) })).rejects.toThrow(new DonneeInvalide('Nom trop long'));
		await expect(modif({ telephone: trop(20) })).rejects.toThrow(new DonneeInvalide('Téléphone trop long'));
		await expect(modif({ email: `${exact(250)}@e.fr` })).rejects.toThrow(new DonneeInvalide('Adresse trop longue'));
		await expect(modif({ prenom: exact(60) })).resolves.toBeUndefined();
	});

	it('refuse dans « Mon profil »', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, []);
		const moi: Acteur = { type: 'personne', id };
		const modif = (champs: object) => modifierMonProfil(base, moi, champs, aujourdhui);
		await expect(modif({ surnom: trop(60) })).rejects.toThrow(new DonneeInvalide('Surnom trop long'));
		await expect(modif({ telephone: trop(20) })).rejects.toThrow(new DonneeInvalide('Téléphone trop long'));
		await expect(modif({ contactUrgence: trop(200) })).rejects.toThrow(new DonneeInvalide('Contact d’urgence trop long'));
		await expect(modif({ surnom: exact(60), telephone: exact(20), contactUrgence: exact(200) })).resolves.toBeUndefined();
	});
});

describe('adresse réservée au super administrateur', () => {
	const reservees = ['admin@exemple.fr'];
	const refus = new DonneeInvalide('Adresse réservée au super administrateur');

	it('refuse à l’ajout, quelle que soit la casse, sans rien écrire', async () => {
		const { base, agent } = await jeu();
		const avant = await base.select().from(personne);
		await expect(ajouterPersonne(base, superAdmin, { email: 'Admin@Exemple.fr ', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, reservees)).rejects.toThrow(refus);
		expect(await base.select().from(personne)).toEqual(avant);
	});

	it('sans droit sur la cible : RefusDroit d’abord, l’adresse réservée ne se devine pas', async () => {
		const { base, agent, chef } = await jeu();
		await expect(ajouterPersonne(base, chef, { email: 'admin@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 2 }, aujourdhui, reservees)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('compare aussi la liste normalisée', async () => {
		const { base, agent } = await jeu();
		await expect(ajouterPersonne(base, superAdmin, { email: 'admin@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, [' ADMIN@exemple.fr'])).rejects.toThrow(refus);
	});

	it('accepte une adresse libre à l’ajout', async () => {
		const { base, agent } = await jeu();
		await expect(ajouterPersonne(base, superAdmin, { email: 'libre@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, reservees)).resolves.toBeTypeOf('number');
	});

	it('refuse à la modification de la fiche, sans rien écrire', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, reservees);
		await expect(modifierFiche(base, superAdmin, id, { email: 'Admin@Exemple.fr ' }, aujourdhui, reservees)).rejects.toThrow(refus);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p!.email).toBe('a@exemple.fr');
	});

	it('accepte une adresse libre à la modification de la fiche', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui, reservees);
		await expect(modifierFiche(base, superAdmin, id, { email: 'libre@exemple.fr' }, aujourdhui, reservees)).resolves.toBeUndefined();
	});
});
