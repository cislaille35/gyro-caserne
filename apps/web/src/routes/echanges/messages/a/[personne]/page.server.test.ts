import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { conversation, envoyer, personne } from '@gyro-caserne/socle';
import { locaux, preparer, requeteFormulaire } from '../../../de-test.ts';
import { actions, load } from './+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const charger = (locals: unknown, p: number | string) => (load as any)({ locals, params: { personne: String(p) } });
const ecrire = async (locals: unknown, p: number, corps: [string, string][]) => (actions.envoyer as any)({ locals, params: { personne: String(p) }, request: await requeteFormulaire(corps) });

describe('écrire à quelqu’un pour la première fois', () => {
	it('la personne, son sous-titre, et pas encore de conversation', async () => {
		const { base, alice, bruno, e2 } = await preparer();
		expect(await charger(locaux(base, alice), bruno.id)).toMatchObject({ personne: { id: bruno.id, prenom: 'Bruno', nom: 'Test' }, sousTitre: `Équipe ${e2.ordreRotation}` });
		expect(await base.select().from(conversation)).toHaveLength(0);
	});

	it('la conversation existe déjà : on y va', async () => {
		const { base, alice, bruno } = await preparer();
		const { conversation: id } = await envoyer(base, base.photos, bruno, { personne: alice.id }, { texte: 'Salut' }, '2026-10-28T09:00');
		await expect(charger(locaux(base, alice), bruno.id)).rejects.toMatchObject({ status: 303, location: `/echanges/messages/${id}` });
	});

	it('soi-même, une personne partie ou inconnue : introuvable', async () => {
		const { base, alice, bruno } = await preparer();
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, bruno.id));
		for (const p of [alice.id, bruno.id, 9999, 'abc']) await expect(charger(locaux(base, alice), p), String(p)).rejects.toMatchObject({ status: 404 });
	});

	it('le premier message crée la conversation et y mène', async () => {
		const { base, alice, bruno } = await preparer();
		const fin = await ecrire(locaux(base, alice), bruno.id, [['texte', 'Tu prends ma garde ?']]).catch((e: unknown) => e);
		const [c] = await base.select().from(conversation);
		expect(fin).toMatchObject({ status: 303, location: expect.stringMatching(new RegExp(`^/echanges/messages/${c!.id}#message-\\d+$`)) });
	});

	it('un refus garde la saisie', async () => {
		const { base, alice, bruno } = await preparer();
		expect(await ecrire(locaux(base, alice), bruno.id, [['texte', ' ']])).toMatchObject({ status: 400, data: { cible: 'envoyer', message: 'Écrivez votre message.' } });
		await base.update(personne).set({ statut: 'suspendu' }).where(eq(personne.id, bruno.id));
		expect(await ecrire(locaux(base, alice), bruno.id, [['texte', 'Oui']])).toMatchObject({ status: 400, data: { message: 'Cette personne n’est plus dans l’annuaire.', valeurs: { texte: 'Oui' } } });
	});
});
