import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { personne } from '../src/schema.ts';
import { creerBaseD1 } from '../src/base.ts';
import { mettreEnFile } from '../src/notifications.ts';
import { baseDeTest } from './base-de-test.ts';

describe('base de test', () => {
	it('enregistre et relit une personne', async () => {
		const base = await baseDeTest();
		await base.insert(personne).values({ email: 'a@exemple.fr', prenom: 'Anne', nom: 'Durand' });
		const [lu] = await base.select().from(personne).where(eq(personne.email, 'a@exemple.fr'));
		expect(lu?.prenom).toBe('Anne');
	});

	it('refuse deux personnes avec la même adresse', async () => {
		const base = await baseDeTest();
		const valeurs = { email: 'a@exemple.fr', prenom: 'Anne', nom: 'Durand' };
		await base.insert(personne).values(valeurs);
		await expect(base.insert(personne).values(valeurs)).rejects.toThrow();
	});

	it('n’écrit rien d’un batch dont la dernière requête échoue, comme D1', async () => {
		const base = await baseDeTest();
		const valeurs = { email: 'a@exemple.fr', prenom: 'Anne', nom: 'Durand' };
		await expect(base.batch([base.insert(personne).values(valeurs), base.insert(personne).values(valeurs)])).rejects.toThrow();
		expect(await base.select().from(personne)).toHaveLength(0);
	});
});

describe('base D1', () => {
	// Une fausse liaison D1 qui note les requêtes et ne rend rien.
	const fausseD1 = () => {
		const requetes: string[] = [];
		const instruction = { bind: () => instruction, all: async () => ({ results: [] }), raw: async () => [], run: async () => ({ results: [] }) };
		return { requetes, d1: { prepare: (sql: string) => (requetes.push(sql), instruction), batch: async () => [] } as unknown as D1Database };
	};
	const donnees = { titre: 'T', texte: 'x', url: '/', tag: 't' };

	it('prévient quand une requête met des envois au téléphone en file (pour les faire partir tout de suite), pas pour le reste', async () => {
		const { d1, requetes } = fausseD1();
		let enFile = 0;
		const base = creerBaseD1(d1, () => enFile++);
		await base.select().from(personne);
		await base.insert(personne).values({ email: 'a@exemple.fr', prenom: 'Anne', nom: 'Durand' });
		expect(enFile).toBe(0);
		await mettreEnFile(base, [1], 'tout', donnees, '2026-11-06T10:00');
		expect(requetes.at(-1)).toMatch(/^insert into "envoi_push"/);
		expect(enFile).toBe(1);
		// Sans rien à prévenir : comme avant.
		await mettreEnFile(creerBaseD1(fausseD1().d1), [1], 'tout', donnees, '2026-11-06T10:00');
	});
});
