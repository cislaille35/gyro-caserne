import { describe, expect, it, vi } from 'vitest';
import { envoiPush, filDeNotifications, notification, publier } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer, requeteFormulaire } from '../../routes/echanges/de-test.ts';
import { actions as actionsPublier } from '../../routes/echanges/publier/+page.server';
import { actions as actionsPublication } from '../../routes/echanges/[mur]/[id]/+page.server';
import { actions as actionsAPersonne } from '../../routes/echanges/messages/a/[personne]/+page.server';
import { enArrierePlan } from './notifier.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Les locaux d'une requête, avec ce qui est laissé en arrière-plan (waitUntil).
function avecArrierePlan(base: any, acteur: unknown) {
	const taches: Promise<unknown>[] = [];
	return { locals: { ...locaux(base, acteur), enArrierePlan: (p: Promise<unknown>) => taches.push(p) }, taches };
}

describe('notifications en arrière-plan', () => {
	it('publier : la publication répond tout de suite, les lecteurs sont notifiés en arrière-plan', async () => {
		const { base, chef, alice } = await preparer();
		const { locals, taches } = avecArrierePlan(base, chef);
		const request = await requeteFormulaire([['mur', 'centre'], ['type', 'message'], ['texte', 'Note de service']]);
		await expect((actionsPublier.publier as any)({ locals, params: {}, url: new URL('http://x/echanges/publier'), request })).rejects.toMatchObject({ status: 303 });
		expect(taches).toHaveLength(1);
		await Promise.all(taches);
		expect((await filDeNotifications(base, alice, maintenantParis())).lignes).toMatchObject([{ type: 'publication', extrait: 'Note de service' }]);
	});

	it('commenter : l’auteur de la publication est notifié', async () => {
		const { base, chef, alice } = await preparer();
		const id = await publier(base, base.photos, chef, 'vie', { type: 'message', texte: 'Repas' }, maintenantParis());
		const { locals, taches } = avecArrierePlan(base, alice);
		const request = await requeteFormulaire([['id', String(id)], ['texte', 'Volontiers']]);
		expect(await (actionsPublication.commenter as any)({ locals, params: { mur: 'vie', id: String(id) }, request })).toMatchObject({ succes: 'Commentaire publié.' });
		await Promise.all(taches);
		expect((await filDeNotifications(base, chef, maintenantParis())).lignes).toMatchObject([{ type: 'commentaire', extrait: 'Volontiers' }]);
	});

	it('envoyer un message : mis en file pour le téléphone de l’autre', async () => {
		const { base, alice, bruno } = await preparer();
		await (await import('@gyro-caserne/socle')).abonner(base, bruno, { endpoint: 'https://push.exemple/bruno', p256dh: 'BCle', auth: 'secret', appareil: '' }, maintenantParis());
		const { locals, taches } = avecArrierePlan(base, alice);
		const request = await requeteFormulaire([['texte', 'Salut']]);
		await expect((actionsAPersonne.envoyer as any)({ locals, params: { personne: String(bruno.id) }, url: new URL('http://x'), request })).rejects.toMatchObject({ status: 303 });
		await Promise.all(taches);
		expect(await base.select().from(envoiPush)).toHaveLength(1);
		expect(await base.select().from(notification)).toEqual([]);
	});

	it('une erreur des notifications est écrite dans la console, sans rien casser ; sans arrière-plan, la tâche part quand même', async () => {
		const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
		const taches: Promise<unknown>[] = [];
		enArrierePlan({ enArrierePlan: (p: Promise<unknown>) => taches.push(p) } as never, async () => {
			throw new Error('panne');
		});
		await Promise.all(taches);
		expect(erreur).toHaveBeenCalledWith('Notifications non créées', expect.any(Error));
		const faite = vi.fn(async () => {});
		enArrierePlan({} as never, faite);
		expect(faite).toHaveBeenCalledOnce();
		erreur.mockRestore();
	});
});
