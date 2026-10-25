import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { affectationEquipe, champCentre, equipe, grade, personne, profil, profilDroit, valeurChamp } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const agent = { email: 'a@exemple.fr', prenom: 'Anne', nom: 'Durand' };

describe('personnes', () => {
	it('applique les valeurs par défaut', async () => {
		const base = await baseDeTest();
		await base.insert(personne).values(agent);
		const [lu] = await base.select().from(personne);
		expect(lu).toMatchObject({ statut: 'operationnel', telephoneVisible: 0, anniversaireVisible: 1 });
		expect(lu?.creeLe).toMatch(/^\d{4}-\d{2}-\d{2}/);
	});

	it('refuse un statut inconnu', async () => {
		const base = await baseDeTest();
		await expect(base.insert(personne).values({ ...agent, statut: 'retraite' as never })).rejects.toThrow();
	});

	it('refuse une adresse non normalisée', async () => {
		const base = await baseDeTest();
		await expect(base.insert(personne).values({ ...agent, email: 'Dupont@X.fr' })).rejects.toThrow();
		await expect(base.insert(personne).values({ ...agent, email: ' a@x.fr' })).rejects.toThrow();
	});

	it('refuse une visibilité autre que 0 ou 1', async () => {
		const base = await baseDeTest();
		await expect(base.insert(personne).values({ ...agent, telephoneVisible: 2 })).rejects.toThrow();
	});

	it('relie une personne à un grade et à un profil', async () => {
		const base = await baseDeTest();
		const [g] = await base.insert(grade).values({ code: 'CPL', libelle: 'Caporal', ordre: 3 }).returning();
		const [p] = await base.insert(profil).values({ nom: 'Agent', typePersonne: 'agent' }).returning();
		await base.insert(personne).values({ ...agent, gradeId: g!.id, profilId: p!.id });
		const [lu] = await base.select().from(personne).where(eq(personne.email, agent.email));
		expect(lu).toMatchObject({ gradeId: g!.id, profilId: p!.id });
	});

	it('refuse un grade qui n’existe pas', async () => {
		const base = await baseDeTest();
		await expect(base.insert(personne).values({ ...agent, gradeId: 99 })).rejects.toThrow();
	});

	it('refuse deux grades avec le même code', async () => {
		const base = await baseDeTest();
		await base.insert(grade).values({ code: 'CPL', libelle: 'Caporal', ordre: 3 });
		await expect(base.insert(grade).values({ code: 'CPL', libelle: 'Autre', ordre: 4 })).rejects.toThrow();
	});
});

describe('profils', () => {
	it('refuse un type de personne inconnu', async () => {
		const base = await baseDeTest();
		await expect(base.insert(profil).values({ nom: 'X', typePersonne: 'robot' as never })).rejects.toThrow();
	});

	it('refuse un droit inconnu dans un profil', async () => {
		const base = await baseDeTest();
		const [p] = await base.insert(profil).values({ nom: 'Agent', typePersonne: 'agent' }).returning();
		await expect(
			base.insert(profilDroit).values({ profilId: p!.id, droit: 'TOUT_FAIRE' as never, perimetreType: 'centre' })
		).rejects.toThrow();
	});

	it('refuse un type de périmètre inconnu', async () => {
		const base = await baseDeTest();
		const [p] = await base.insert(profil).values({ nom: 'Agent', typePersonne: 'agent' }).returning();
		await expect(
			base.insert(profilDroit).values({ profilId: p!.id, droit: 'VOIR_PLANNING', perimetreType: 'lune' as never })
		).rejects.toThrow();
	});

	it('exige un périmètre précis hors centre, et aucun pour le centre', async () => {
		const base = await baseDeTest();
		const [p] = await base.insert(profil).values({ nom: 'Agent', typePersonne: 'agent' }).returning();
		const droit = { profilId: p!.id, droit: 'VOIR_PLANNING' } as const;
		await base.insert(profilDroit).values({ ...droit, perimetreType: 'centre' });
		await base.insert(profilDroit).values({ ...droit, perimetreType: 'equipe', perimetreId: 1 });
		await expect(base.insert(profilDroit).values({ ...droit, perimetreType: 'centre', perimetreId: 1 })).rejects.toThrow();
		await expect(base.insert(profilDroit).values({ ...droit, perimetreType: 'equipe' })).rejects.toThrow();
	});
});

describe('équipes et champs libres', () => {
	it('affecte une personne à une équipe', async () => {
		const base = await baseDeTest();
		const [e] = await base.insert(equipe).values({ nom: 'A', couleur: '#ff0000', ordreRotation: 1 }).returning();
		const [pers] = await base.insert(personne).values(agent).returning();
		await base.insert(affectationEquipe).values({ personneId: pers!.id, equipeId: e!.id, debut: '2026-01-01' });
		const [lu] = await base.select().from(affectationEquipe);
		expect(lu).toMatchObject({ equipeId: e!.id, fin: null });
		expect((await base.select().from(equipe))[0]?.active).toBe(1);
	});

	it('refuse une équipe active autrement que 0 ou 1', async () => {
		const base = await baseDeTest();
		await expect(base.insert(equipe).values({ nom: 'A', couleur: '#ff0000', ordreRotation: 1, active: 5 })).rejects.toThrow();
	});

	it('refuse une affectation à une équipe inconnue', async () => {
		const base = await baseDeTest();
		const [pers] = await base.insert(personne).values(agent).returning();
		await expect(
			base.insert(affectationEquipe).values({ personneId: pers!.id, equipeId: 99, debut: '2026-01-01' })
		).rejects.toThrow();
	});

	it('enregistre la valeur d’un champ libre', async () => {
		const base = await baseDeTest();
		const [pers] = await base.insert(personne).values(agent).returning();
		const [c] = await base.insert(champCentre).values({ nom: 'Groupe sanguin', visibilite: 'chefs' }).returning();
		await base.insert(valeurChamp).values({ personneId: pers!.id, champId: c!.id, valeur: 'O+' });
		const [lu] = await base.select().from(valeurChamp);
		expect(lu?.valeur).toBe('O+');
	});
});
