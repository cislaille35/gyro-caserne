import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { creerGroupe, envoyer, personne, profil } from '@gyro-caserne/socle';
import { locaux, preparer } from '../../de-test.ts';
import { GET } from './+server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (locals: unknown) => (GET as any)({ locals });

describe('pastille des messages', () => {
	it('demande la connexion', async () => {
		await expect(appeler({ acteur: null })).rejects.toMatchObject({
			status: 401
		});
	});

	it('compte les messages non lus, en JSON jamais mis en cache, en 2 requêtes au plus', async () => {
		const { base, chef, alice, bruno } = await preparer();
		const groupe = await creerGroupe(base, chef, { nom: 'Garde', membres: [alice.id, bruno.id] }, '2026-10-29T09:00');
		await envoyer(base, base.photos, chef, { conversation: groupe }, { texte: 'Un' }, '2026-10-29T09:01');
		await envoyer(base, base.photos, bruno, { personne: alice.id }, { texte: 'Deux' }, '2026-10-29T09:02');
		await envoyer(base, base.photos, bruno, { personne: alice.id }, { texte: 'Trois' }, '2026-10-29T09:03');
		const avant = base.requetes;
		const reponse: Response = await appeler(locaux(base, alice));
		expect(base.requetes - avant).toBeLessThanOrEqual(2);
		expect(await reponse.json()).toEqual({ nonLus: 3 });
		expect(reponse.headers.get('cache-control')).toBe('no-store');
	});

	it('0 pour le super administrateur', async () => {
		const { base } = await preparer();
		expect(await (await appeler(locaux(base, { type: 'super', email: 'a@b.fr' }))).json()).toEqual({ nonLus: 0 });
	});

	it('0 pour un extérieur', async () => {
		const { base } = await preparer();
		const [ext] = await base.select().from(profil).where(eq(profil.typePersonne, 'exterieur'));
		const [p] = await base.insert(personne).values({ email: 'ext@exemple.fr', prenom: 'Ext', nom: 'Rieur', profilId: ext!.id }).returning();
		expect(await (await appeler(locaux(base, { type: 'personne', id: p!.id }))).json()).toEqual({ nonLus: 0 });
	});
});
