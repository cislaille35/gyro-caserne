import { describe, expect, it } from 'vitest';
import { avisEte, enTeteDe } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer } from '../../echanges/de-test.ts';
import { GET } from './+server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ouvrir = (locals: unknown, requete: string) => (GET as any)({ locals, url: new URL(`http://x/notifications/ouvrir${requete}`) });

// Alice a reçu l'avis « Planning d'été », qui mène au planning : aucune page ne le marque.
async function avecAvis() {
	const p = await preparer();
	const [avis] = await p.base.insert(avisEte).values({ personneId: p.alice.id, quoi: 'repartition', texte: 'Planning d’été : renfort', url: '/planning', creeLe: maintenantParis() }).returning();
	const nonLues = async () => (await enTeteDe(p.base, p.alice, aujourdhuiParis())).nonLues;
	return { ...p, avis: avis!, nonLues };
}

describe('/notifications/ouvrir', () => {
	it('marque lue la ligne de la cloche, puis mène à sa page (303)', async () => {
		const { base, alice, avis, nonLues } = await avecAvis();
		expect(await nonLues()).toBe(1);
		await expect(ouvrir(locaux(base, alice), `?genre=ete&id=${avis.id}&vers=%2Fplanning%3Fsemaine%3D2%23ici`)).rejects.toMatchObject({ status: 303, location: '/planning?semaine=2#ici' });
		expect(await nonLues()).toBe(0);
	});

	it('refuse toute adresse hors de l’appli : retour à la cloche', async () => {
		const { base, alice, avis } = await avecAvis();
		for (const vers of ['https://exemple.fr/piege', '//exemple.fr', '/\\exemple.fr', 'javascript:alert(1)', 'planning', '', '/.//exemple.fr', '/%2e//exemple.fr', '/..//exemple.fr', '/a/..//exemple.fr', '/./\\exemple.fr']) {
			await expect(ouvrir(locaux(base, alice), `?genre=ete&id=${avis.id}&vers=${encodeURIComponent(vers)}`), vers).rejects.toMatchObject({ status: 303, location: '/notifications' });
		}
		await expect(ouvrir(locaux(base, alice), `?genre=ete&id=${avis.id}`)).rejects.toMatchObject({ status: 303, location: '/notifications' });
	});

	it('genre ou identifiant illisible : rien n’est marqué, la page s’ouvre quand même ; sans connexion : la connexion', async () => {
		const { base, alice, avis, nonLues } = await avecAvis();
		await expect(ouvrir(locaux(base, alice), `?genre=inconnu&id=${avis.id}&vers=%2Fplanning`)).rejects.toMatchObject({ status: 303, location: '/planning' });
		for (const id of ['abc', '0', '12345678901234567890']) await expect(ouvrir(locaux(base, alice), `?genre=ete&id=${id}&vers=%2Fplanning`)).rejects.toMatchObject({ status: 303, location: '/planning' });
		await expect(ouvrir(locaux(base, alice), '?genre=ete&id=abc&vers=%2Fplanning')).rejects.toMatchObject({ status: 303, location: '/planning' });
		expect(await nonLues()).toBe(1);
		await expect(ouvrir(locaux(base, null), `?genre=ete&id=${avis.id}&vers=%2Fplanning`)).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});
});
