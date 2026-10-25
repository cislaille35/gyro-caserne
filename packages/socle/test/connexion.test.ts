import { describe, expect, it } from 'vitest';
import { acteurDe, adresseAutorisee, normaliserAdresse } from '../src/connexion.ts';
import { personne } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

async function jeu() {
	const base = await baseDeTest();
	const ajouter = (email: string, statut: 'operationnel' | 'suspendu' | 'parti' | 'stagiaire') =>
		base.insert(personne).values({ email, prenom: 'P', nom: 'N', statut }).returning();
	const [dupont] = await ajouter('dupont@exemple.fr', 'operationnel');
	await ajouter('suspendu@exemple.fr', 'suspendu');
	await ajouter('parti@exemple.fr', 'parti');
	await ajouter('admin@exemple.fr', 'operationnel');
	return { base, dupontId: dupont!.id };
}

describe('normaliserAdresse', () => {
	it('retire les espaces et passe en minuscules', () => {
		expect(normaliserAdresse(' Dupont@Exemple.FR ')).toBe('dupont@exemple.fr');
	});
});

describe('adresseAutorisee', () => {
	it('accepte une personne connue, adresse normalisée', async () => {
		const { base } = await jeu();
		expect(await adresseAutorisee(base, ' Dupont@Exemple.FR ', [])).toBe(true);
	});

	it('refuse une adresse inconnue', async () => {
		const { base } = await jeu();
		expect(await adresseAutorisee(base, 'inconnu@exemple.fr', [])).toBe(false);
	});

	it('refuse une personne suspendue ou partie', async () => {
		const { base } = await jeu();
		expect(await adresseAutorisee(base, 'suspendu@exemple.fr', [])).toBe(false);
		expect(await adresseAutorisee(base, 'parti@exemple.fr', [])).toBe(false);
	});

	it('accepte un super administrateur absent de la base', async () => {
		const { base } = await jeu();
		expect(await adresseAutorisee(base, 'root@exemple.fr', ['root@exemple.fr'])).toBe(true);
	});

	it('normalise aussi la liste des super administrateurs', async () => {
		const { base } = await jeu();
		expect(await adresseAutorisee(base, 'root@exemple.fr', ['  Root@Exemple.FR '])).toBe(true);
	});

	it('ignore les entrées vides de la liste', async () => {
		const { base } = await jeu();
		expect(await adresseAutorisee(base, '', [''])).toBe(false);
		expect(await adresseAutorisee(base, '   ', ['  '])).toBe(false);
	});
});

describe('acteurDe', () => {
	it('renvoie super pour un super administrateur absent de la base', async () => {
		const { base } = await jeu();
		expect(await acteurDe(base, ' Root@Exemple.FR', ['root@exemple.fr'])).toEqual({ type: 'super', email: 'root@exemple.fr' });
	});

	it('reste super même si le super administrateur est aussi en base', async () => {
		const { base } = await jeu();
		expect(await acteurDe(base, 'admin@exemple.fr', ['ADMIN@exemple.fr'])).toEqual({ type: 'super', email: 'admin@exemple.fr' });
	});

	it('renvoie la personne connue', async () => {
		const { base, dupontId } = await jeu();
		expect(await acteurDe(base, 'DUPONT@exemple.fr', [])).toEqual({ type: 'personne', id: dupontId });
	});

	it('renvoie null pour un statut sans accès', async () => {
		const { base } = await jeu();
		expect(await acteurDe(base, 'suspendu@exemple.fr', [])).toBeNull();
		expect(await acteurDe(base, 'parti@exemple.fr', [])).toBeNull();
	});

	it('renvoie null pour une adresse inconnue ou vide, sans créer de super', async () => {
		const { base } = await jeu();
		expect(await acteurDe(base, 'inconnu@exemple.fr', ['root@exemple.fr'])).toBeNull();
		expect(await acteurDe(base, '', [''])).toBeNull();
	});
});
