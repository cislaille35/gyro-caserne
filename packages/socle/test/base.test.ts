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
});
