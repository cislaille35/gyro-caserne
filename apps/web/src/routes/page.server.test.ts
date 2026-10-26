import { describe, expect, it } from 'vitest';
import { personne } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (locals: unknown) => (load as any)({ locals });

describe('load de /', () => {
	it('renvoie vers la connexion si personne n\'est connecté', async () => {
		const base = await baseDeTest();
		await expect(appeler({ acteur: null, base })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('donne le prénom de l\'agent connecté', async () => {
		const base = await baseDeTest();
		const [fiche] = await base.insert(personne).values({ email: 'alice@exemple.fr', prenom: 'Alice', nom: 'N' }).returning();
		expect(await appeler({ acteur: { type: 'personne', id: fiche!.id }, base })).toEqual({ prenom: 'Alice' });
	});

	it('ne donne pas de prénom au super administrateur', async () => {
		const base = await baseDeTest();
		expect(await appeler({ acteur: { type: 'super', email: 'admin@exemple.fr' }, base })).toEqual({ prenom: null });
	});
});
