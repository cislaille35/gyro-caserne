import { describe, expect, it } from 'vitest';
import { abonner, couper, mesNotifications } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer, requeteFormulaire } from '../../echanges/de-test.ts';
import { actions, load } from './+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const charger = (locals: unknown) => (load as any)({ locals });
const agir = async (nom: 'toutCouper' | 'reactiver', locals: unknown, champs: [string, string][]) => (actions[nom] as any)({ locals, request: await requeteFormulaire(champs) });

describe('/moi/notifications', () => {
	it('demande la connexion ; le super administrateur, sans fiche, retourne à Moi', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
		await expect(charger({ acteur: { type: 'super', email: 'a@b.fr' } })).rejects.toMatchObject({ status: 303, location: '/moi' });
	});

	it('la clé publique du centre (nulle sans secrets), « tout » coupé ou non, les lieux coupés, les appareils', async () => {
		const { base, e1, alice } = await preparer();
		await couper(base, alice, `mur:equipe:${e1.id}`, true, maintenantParis());
		await abonner(base, alice, { endpoint: 'https://fcm.googleapis.com/fcm/send/a', p256dh: 'BCle', auth: 'secret', appareil: '' }, maintenantParis());
		expect(await charger({ ...locaux(base, alice), clePublique: 'BPub' })).toEqual({ clePublique: 'BPub', tout: false, coupes: [{ lieu: `mur:equipe:${e1.id}`, nom: e1.nom }], appareils: 1 });
		expect((await charger(locaux(base, alice))).clePublique).toBeNull();
	});

	it('« Tout couper » puis rallumer ; « Réactiver » un lieu', async () => {
		const { base, e1, alice } = await preparer();
		const locals = locaux(base, alice);
		expect(await agir('toutCouper', locals, [['oui', '1']])).toEqual({ succes: 'Plus rien ne sonne au téléphone.' });
		expect((await mesNotifications(base, alice, aujourdhuiParis())).tout).toBe(true);
		expect(await agir('toutCouper', locals, [['oui', '0']])).toEqual({ succes: 'Les notifications sonnent à nouveau.' });
		expect((await mesNotifications(base, alice, aujourdhuiParis())).tout).toBe(false);
		await couper(base, alice, `mur:equipe:${e1.id}`, true, maintenantParis());
		expect(await agir('reactiver', locals, [['lieu', `mur:equipe:${e1.id}`]])).toEqual({ succes: 'Réactivé.' });
		expect((await mesNotifications(base, alice, aujourdhuiParis())).coupes).toEqual([]);
		expect(await agir('reactiver', locals, [['lieu', 'ailleurs']])).toMatchObject({ status: 400 });
	});
});
