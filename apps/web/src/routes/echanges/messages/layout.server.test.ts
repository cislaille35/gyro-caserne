import { describe, expect, it } from 'vitest';
import { envoyer } from '@gyro-caserne/socle';
import { locaux, preparer } from '../de-test.ts';
import { load } from './+layout.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, chemin: string) => (load as any)({ locals, url: new URL(`http://x${chemin}`), depends: () => {} });

describe('layout des messages', () => {
	it('dans une conversation : la liste des conversations, pour la colonne de gauche à l’ordinateur', async () => {
		const { base, alice, bruno } = await preparer();
		const { conversation } = await envoyer(base, base.photos, bruno, { personne: alice.id }, { texte: 'Salut' }, '2026-10-29T10:00');
		for (const chemin of [`/echanges/messages/${conversation}`, `/echanges/messages/a/${bruno.id}`]) {
			const { conversations } = await charger(locaux(base, alice), chemin);
			expect(conversations).toMatchObject([{ id: conversation, nom: 'Bruno Test' }]);
		}
	});

	it('ailleurs (liste, nouveau message, infos), rien n’est lu', async () => {
		const { base, alice } = await preparer();
		for (const chemin of ['/echanges/messages', '/echanges/messages/nouveau', '/echanges/messages/nouveau/groupe', '/echanges/messages/3/infos']) {
			const avant = base.requetes;
			expect(await charger(locaux(base, alice), chemin)).toEqual({ conversations: null });
			expect(base.requetes - avant).toBe(0);
		}
	});

	it('sans la messagerie : pas de liste, la page dit le refus', async () => {
		const { base } = await preparer();
		expect(await charger(locaux(base, { type: 'super', email: 'a@b.fr' }), '/echanges/messages/3')).toEqual({ conversations: null });
	});

	it('ne lit que le chemin de l’adresse : un simple ?avant= (page plus ancienne) ne relit pas la liste', async () => {
		const { base, alice } = await preparer();
		const lus = new Set<string>();
		const url = new URL('http://x/echanges/messages/3?avant=10');
		const espion = new Proxy(url, { get: (cible, cle) => (lus.add(String(cle)), Reflect.get(cible, cle)) });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await (load as any)({ locals: locaux(base, alice), url: espion, depends: () => {} });
		expect([...lus]).toEqual(['pathname']);
	});
});
