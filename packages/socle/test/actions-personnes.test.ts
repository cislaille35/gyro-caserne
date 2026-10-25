import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { affecterEquipe, ajouterPersonne, changerStatut } from '../src/actions/personnes.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { affectationEquipe, attribution, equipe, journal, personne, profil, profilDroit, responsabilite, responsabiliteDroit, session, user } from '../src/schema.ts';
import type { Acteur } from '../src/droits.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-25';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

async function jeu() {
	const base = await baseDeTest();
	await base.insert(equipe).values([
		{ nom: 'A', couleur: 'rouge', ordreRotation: 1 },
		{ nom: 'B', couleur: 'bleu', ordreRotation: 2 }
	]);
	const [agent] = await base.insert(profil).values({ nom: 'Agent', typePersonne: 'agent' }).returning();
	const [ext] = await base.insert(profil).values({ nom: 'Extérieur', typePersonne: 'exterieur' }).returning();
	const [chefEquipe] = await base.insert(responsabilite).values({ nom: 'Chef d’équipe', nature: 'fonction', typePerimetre: 'equipe' }).returning();
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

describe('ajouterPersonne', () => {
	it('normalise l’adresse ajoutée', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: ' Dupont@Exemple.FR ', prenom: 'D', nom: 'U', profilId: agent.id }, aujourdhui);
		const [p] = await base.select().from(personne).where(eq(personne.id, id));
		expect(p!.email).toBe('dupont@exemple.fr');
	});

	it('un chef d’équipe ajoute un agent à son équipe', async () => {
		const { base, agent, chef } = await jeu();
		const id = await ajouterPersonne(base, chef, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui);
		const [aff] = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id));
		expect(aff).toMatchObject({ equipeId: 1, debut: aujourdhui, fin: null });
	});

	it('… mais pas à une autre équipe', async () => {
		const { base, agent, chef } = await jeu();
		await expect(ajouterPersonne(base, chef, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 2 }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('… ni une personne extérieure', async () => {
		const { base, ext, chef } = await jeu();
		await expect(ajouterPersonne(base, chef, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: ext.id, equipeId: 1 }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('refuse un profil plus large que les droits du chef d’équipe', async () => {
		const { base, chef } = await jeu();
		const [large] = await base.insert(profil).values({ nom: 'Large', typePersonne: 'agent' }).returning();
		await base.insert(profilDroit).values({ profilId: large!.id, droit: 'GERER_ACCES', perimetreType: 'centre' });
		await expect(ajouterPersonne(base, chef, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: large!.id, equipeId: 1 }, aujourdhui)).rejects.toMatchObject({ droit: 'GERER_ACCES', perimetre: { type: 'centre' } });
		const [etroit] = await base.insert(profil).values({ nom: 'Étroit', typePersonne: 'agent' }).returning();
		await base.insert(profilDroit).values({ profilId: etroit!.id, droit: 'GERER_ACCES', perimetreType: 'equipe', perimetreId: 1 });
		await expect(ajouterPersonne(base, chef, { email: 'b@exemple.fr', prenom: 'A', nom: 'B', profilId: etroit!.id, equipeId: 1 }, aujourdhui)).resolves.toBeTypeOf('number');
	});

	it('refuse un profil qui porte un droit sur une autre équipe', async () => {
		const { base, chef } = await jeu();
		const [autre] = await base.insert(profil).values({ nom: 'Autre équipe', typePersonne: 'agent' }).returning();
		await base.insert(profilDroit).values({ profilId: autre!.id, droit: 'GERER_ACCES', perimetreType: 'equipe', perimetreId: 2 });
		await expect(ajouterPersonne(base, chef, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: autre!.id, equipeId: 1 }, aujourdhui)).rejects.toMatchObject({ droit: 'GERER_ACCES', perimetre: { type: 'equipe', id: 2 } });
	});

	it('ne révèle pas une adresse existante à un acteur sans droit', async () => {
		const { base, agent, chef } = await jeu();
		await expect(ajouterPersonne(base, chef, { email: 'chef@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 2 }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('refuse une date invalide', async () => {
		const { base, agent } = await jeu();
		await expect(ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, '2026-13-45')).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('refuse un profil, une équipe ou une adresse invalides', async () => {
		const { base, agent } = await jeu();
		const donnees = { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id };
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, profilId: 99 }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, equipeId: 99 }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, email: '  ' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await ajouterPersonne(base, superAdmin, donnees, aujourdhui);
		await expect(ajouterPersonne(base, superAdmin, { ...donnees, email: 'A@exemple.fr' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('changerStatut', () => {
	it('le chef d’équipe change le statut d’un membre de son équipe, pas d’un autre', async () => {
		const { base, agent, chef } = await jeu();
		const dans = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui);
		const hors = await ajouterPersonne(base, superAdmin, { email: 'b@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 2 }, aujourdhui);
		await changerStatut(base, chef, dans, 'suspendu', aujourdhui);
		const [p] = await base.select().from(personne).where(eq(personne.id, dans));
		expect(p!.statut).toBe('suspendu');
		await expect(changerStatut(base, chef, hors, 'suspendu', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('le chef d’équipe ne peut pas suspendre le chef de centre affecté à son équipe', async () => {
		const { base, agent, chef } = await jeu();
		const [chefCentre] = await base.insert(responsabilite).values({ nom: 'Chef de centre', nature: 'fonction', typePerimetre: 'centre', systeme: 'chef_centre' }).returning();
		const haut = await ajouterPersonne(base, superAdmin, { email: 'haut@exemple.fr', prenom: 'H', nom: 'C', profilId: agent.id, equipeId: 1 }, aujourdhui);
		await base.insert(attribution).values({ personneId: haut, responsabiliteId: chefCentre!.id, perimetreType: 'centre', debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		await expect(changerStatut(base, chef, haut, 'suspendu', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		const simple = await ajouterPersonne(base, superAdmin, { email: 'simple@exemple.fr', prenom: 'S', nom: 'A', profilId: agent.id, equipeId: 1 }, aujourdhui);
		await expect(changerStatut(base, chef, simple, 'suspendu', aujourdhui)).resolves.toBeUndefined();
	});

	it('refuse si la cible a une attribution qui commence demain', async () => {
		const { base, agent, chef } = await jeu();
		const [resp] = await base.insert(responsabilite).values({ nom: 'Mission', nature: 'mission', typePerimetre: 'equipe' }).returning();
		const cible = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui);
		await base.insert(attribution).values({ personneId: cible, responsabiliteId: resp!.id, perimetreType: 'equipe', perimetreId: 1, debut: '2026-10-26', saisiePar: 'super:a@b.fr', saisieLe: aujourdhui });
		await expect(changerStatut(base, chef, cible, 'suspendu', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('refuse si le profil de la cible donne un droit que l’acteur n’a pas', async () => {
		const { base, chef } = await jeu();
		const [large] = await base.insert(profil).values({ nom: 'Large', typePersonne: 'agent' }).returning();
		await base.insert(profilDroit).values({ profilId: large!.id, droit: 'VOIR_PLANNING', perimetreType: 'centre' });
		const cible = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: large!.id, equipeId: 1 }, aujourdhui);
		await expect(changerStatut(base, chef, cible, 'suspendu', aujourdhui)).rejects.toMatchObject({ droit: 'VOIR_PLANNING' });
	});

	it('refuse un statut inconnu et une date invalide', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui);
		await expect(changerStatut(base, superAdmin, id, 'inconnu' as never, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(changerStatut(base, superAdmin, id, 'parti', 'hier')).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('refuse une personne inconnue', async () => {
		const { base } = await jeu();
		await expect(changerStatut(base, superAdmin, 99, 'parti', aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('suspendre un agent ferme ses sessions', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id }, aujourdhui);
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

		await changerStatut(base, superAdmin, id, 'stagiaire', aujourdhui);
		expect((await base.select().from(session)).map((s) => s.id)).toEqual(['s1', 's2']);

		await changerStatut(base, superAdmin, id, 'suspendu', aujourdhui);
		expect((await base.select().from(session)).map((s) => s.id)).toEqual(['s2']);
	});
});

describe('affecterEquipe', () => {
	it('clôt l’affectation en cours la veille du début', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01');
		await affecterEquipe(base, superAdmin, id, 2, '2026-03-01', aujourdhui);
		const lignes = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id));
		expect(lignes).toHaveLength(2);
		expect(lignes.find((l) => l.equipeId === 1)!.fin).toBe('2026-02-28');
		expect(lignes.find((l) => l.equipeId === 2)).toMatchObject({ debut: '2026-03-01', fin: null });
	});

	it('refuse le chef d’équipe : il faut le droit sur le centre', async () => {
		const { base, agent, chef } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01');
		await expect(affecterEquipe(base, chef, id, 2, '2026-03-01', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('un droit expiré hier ne permet pas d’affecter avec un début passé', async () => {
		const { base, agent } = await jeu();
		const [centreResp] = await base.insert(responsabilite).values({ nom: 'Gestionnaire', nature: 'mission', typePerimetre: 'centre' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: centreResp!.id, droit: 'GERER_ACCES' });
		const [gest] = await base.insert(personne).values({ email: 'g@exemple.fr', prenom: 'G', nom: 'G', profilId: agent.id }).returning();
		await base.insert(attribution).values({ personneId: gest!.id, responsabiliteId: centreResp!.id, perimetreType: 'centre', debut: '2026-01-01', fin: '2026-10-24', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01');
		await expect(affecterEquipe(base, { type: 'personne', id: gest!.id }, id, 2, '2026-10-20', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('refuse un début qui n’est pas après le début de l’affectation en cours', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-03-01');
		await expect(affecterEquipe(base, superAdmin, id, 2, '2026-03-01', aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('journal', () => {
	it('chaque action écrit une ligne de journal', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui);
		await changerStatut(base, superAdmin, id, 'stagiaire', aujourdhui);
		await affecterEquipe(base, superAdmin, id, 2, '2026-11-01', aujourdhui);
		const lignes = await base.select().from(journal);
		expect(lignes.map((l) => l.action)).toEqual(['ajouter_personne', 'changer_statut', 'affecter_equipe']);
		expect(lignes.every((l) => l.acteur === 'super:admin@exemple.fr' && l.cibleType === 'personne' && l.cibleId === id)).toBe(true);
	});
});

