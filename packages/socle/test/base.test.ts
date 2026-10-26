import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { personne } from '../src/schema.ts';
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
