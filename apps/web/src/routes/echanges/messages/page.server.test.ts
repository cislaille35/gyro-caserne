import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { creerGroupe, envoyer, personne, profil } from '@gyro-caserne/socle';
import { locaux, preparer } from '../de-test.ts';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, url = 'http://x/echanges/messages') => (load as any)({ locals, url: new URL(url), depends: () => {} });

describe('liste des messages', () => {
	it('demande la connexion', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({
			status: 303,
			location: '/connexion'
		});
	});

	it('de la plus récente à la plus ancienne, avec les non-lus et les aperçus « Vous : … »', async () => {
		const { base, chef, alice, bruno } = await preparer();
		const { conversation: aBruno } = await envoyer(base, base.photos, alice, { personne: bruno.id }, { texte: 'Tu prends ma garde ?' }, '2026-10-29T08:00');
		const groupe = await creerGroupe(
			base,
			chef,
			{
				nom: 'Départ de Thomas',
				icone: 'coeur',
				membres: [alice.id, bruno.id]
			},
			'2026-10-29T09:00'
		);
		await envoyer(base, base.photos, chef, { conversation: groupe }, { texte: 'J’ai trouvé le cadeau !' }, '2026-10-29T09:05');
		await envoyer(base, base.photos, chef, { conversation: groupe }, { texte: 'Et la carte.' }, '2026-10-29T09:06');

		const { conversations, q } = await charger(locaux(base, alice));
		expect(q).toBe('');
		expect(conversations.map((c: { id: number }) => c.id)).toEqual([groupe, aBruno]);
		expect(conversations[0]).toMatchObject({
			type: 'groupe',
			nom: 'Départ de Thomas',
			icone: 'coeur',
			apercu: 'Chef : Et la carte.',
			nonLus: 2
		});
		expect(conversations[1]).toMatchObject({
			type: 'deux',
			nom: 'Bruno Test',
			apercu: 'Vous : Tu prends ma garde ?',
			nonLus: 0
		});
		expect(conversations[1].personne).toMatchObject({
			prenom: 'Bruno',
			nom: 'Test'
		});
	});

	it('rend la recherche reçue sans JavaScript', async () => {
		const { base, alice } = await preparer();
		expect((await charger(locaux(base, alice), 'http://x/echanges/messages?q=%20bru%20')).q).toBe('bru');
	});

	it('un extérieur ou le super administrateur repart vers Échanges, avec la raison', async () => {
		const { base } = await preparer();
		const [ext] = await base.select().from(profil).where(eq(profil.typePersonne, 'exterieur'));
		const [p] = await base
			.insert(personne)
			.values({
				email: 'ext@exemple.fr',
				prenom: 'Ext',
				nom: 'Rieur',
				profilId: ext!.id
			})
			.returning();
		for (const acteur of [
			{ type: 'personne', id: p!.id },
			{ type: 'super', email: 'a@b.fr' }
		]) {
			await expect(charger(locaux(base, acteur))).rejects.toMatchObject({
				status: 303,
				location: '/echanges?refus=messagerie'
			});
		}
	});
});
