import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { affecterEquipe, ajouterPersonne, changerStatut } from '../src/actions/personnes.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { affectationEquipe, attribution, equipe, journal, personne, profil, responsabilite, responsabiliteDroit } from '../src/schema.ts';
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

	it('refuse une personne inconnue', async () => {
		const { base } = await jeu();
		await expect(changerStatut(base, superAdmin, 99, 'parti', aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('affecterEquipe', () => {
	it('clôt l’affectation en cours la veille du début', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01');
		await affecterEquipe(base, superAdmin, id, 2, '2026-03-01');
		const lignes = await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, id));
		expect(lignes).toHaveLength(2);
		expect(lignes.find((l) => l.equipeId === 1)!.fin).toBe('2026-02-28');
		expect(lignes.find((l) => l.equipeId === 2)).toMatchObject({ debut: '2026-03-01', fin: null });
	});

	it('refuse le chef d’équipe : il faut le droit sur le centre', async () => {
		const { base, agent, chef } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-01-01');
		await expect(affecterEquipe(base, chef, id, 2, '2026-03-01')).rejects.toBeInstanceOf(RefusDroit);
	});

	it('refuse un début qui n’est pas après le début de l’affectation en cours', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, '2026-03-01');
		await expect(affecterEquipe(base, superAdmin, id, 2, '2026-03-01')).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('journal', () => {
	it('chaque action écrit une ligne de journal', async () => {
		const { base, agent } = await jeu();
		const id = await ajouterPersonne(base, superAdmin, { email: 'a@exemple.fr', prenom: 'A', nom: 'B', profilId: agent.id, equipeId: 1 }, aujourdhui);
		await changerStatut(base, superAdmin, id, 'stagiaire', aujourdhui);
		await affecterEquipe(base, superAdmin, id, 2, '2026-11-01');
		const lignes = await base.select().from(journal);
		expect(lignes.map((l) => l.action)).toEqual(['ajouter_personne', 'changer_statut', 'affecter_equipe']);
		expect(lignes.every((l) => l.acteur === 'super:admin@exemple.fr' && l.cibleType === 'personne' && l.cibleId === id)).toBe(true);
	});
});

