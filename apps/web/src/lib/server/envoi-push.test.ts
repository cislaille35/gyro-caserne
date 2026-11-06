import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { abonnementPush, abonner, envoiPush, notifierPublication, publier } from '@gyro-caserne/socle';
import { preparer } from '../../routes/echanges/de-test.ts';
import { envoyerApres, envoyerLot, LOT_IMMEDIAT } from './envoi-push.ts';
import { clesVapid } from './webpush.ts';
import { paireVapid } from './vapid-de-test.ts';

const maintenant = '2026-10-31T10:00';

// Trois appareils abonnés (Alice, Bruno, Chef 2) et une publication du chef sur « Le centre » : trois envois en file.
async function enFile() {
	const p = await preparer();
	const { base, chef, alice, bruno } = p;
	const navigateur = async () => {
		const paire = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
		const brut = new Uint8Array((await crypto.subtle.exportKey('raw', paire.publicKey)) as ArrayBuffer);
		return { p256dh: btoa(String.fromCharCode(...brut)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), auth: 'c2VjcmV0LWRlLXRlc3Q' };
	};
	for (const [qui, nom] of [[alice, 'alice'], [bruno, 'bruno'], [alice, 'alice-tablette']] as const) await abonner(base, qui, { endpoint: `https://fcm.googleapis.com/fcm/send/${nom}`, ...(await navigateur()), appareil: '' }, maintenant);
	await notifierPublication(base, await publier(base, base.photos, chef, 'centre', { type: 'message', texte: 'Note' }, maintenant), maintenant);
	const v = await paireVapid();
	return { ...p, cles: clesVapid({ ...v, BETTER_AUTH_URL: 'https://appli.exemple' })! };
}

describe('envoyerLot', () => {
	it('envoie chaque envoi en file ; 404 ou 410 : l’abonnement est supprimé ; une erreur n’arrête pas le lot', async () => {
		const { base, cles } = await enFile();
		const reponses: Record<string, () => Response> = {
			'https://fcm.googleapis.com/fcm/send/alice': () => new Response(null, { status: 201 }),
			'https://fcm.googleapis.com/fcm/send/bruno': () => new Response(null, { status: 410 }),
			'https://fcm.googleapis.com/fcm/send/alice-tablette': () => {
				throw new Error('réseau');
			}
		};
		const envoyer = vi.fn(async (url: string, init: RequestInit) => {
			expect((init.headers as Record<string, string>).Authorization).toMatch(/^vapid t=/);
			return reponses[url]!();
		});
		const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await envoyerLot(base, cles, envoyer)).toEqual({ envoyes: 3, perimes: 1 });
		erreur.mockRestore();
		expect(envoyer).toHaveBeenCalledTimes(3);
		expect(await base.select().from(envoiPush)).toEqual([]);
		expect((await base.select().from(abonnementPush)).map((a) => a.endpoint).sort()).toEqual(['https://fcm.googleapis.com/fcm/send/alice', 'https://fcm.googleapis.com/fcm/send/alice-tablette']);
	});

	it('pas plus de `max` par lot ; un appel à la base sans abonnement périmé', async () => {
		const { base, cles } = await enFile();
		const envoyer = vi.fn(async () => new Response(null, { status: 201 }));
		const avant = base.requetes;
		expect(await envoyerLot(base, cles, envoyer, 2)).toEqual({ envoyes: 2, perimes: 0 });
		expect(base.requetes - avant).toBe(1);
		expect(await base.select().from(envoiPush)).toHaveLength(1);
	});

	it('sans clés VAPID : la file est vidée sans rien envoyer', async () => {
		const { base } = await enFile();
		const envoyer = vi.fn();
		expect(await envoyerLot(base, null, envoyer)).toEqual({ envoyes: 0, perimes: 0 });
		expect(envoyer).not.toHaveBeenCalled();
		expect(await base.select().from(envoiPush).where(eq(envoiPush.id, envoiPush.id))).toEqual([]);
	});
});

describe('envoyerApres', () => {
	it('après le geste : attend ce qui part en arrière-plan, puis envoie un lot de 20 au plus, si quelque chose a été mis en file', async () => {
		const { base, cles } = await enFile();
		const envoyer = vi.fn(async () => new Response(null, { status: 201 }));
		const ordre: string[] = [];
		let enFileApres = false;
		// Une tâche (les notifications d'un message) qui met en file, une qui échoue : le lot part quand même, après elles.
		const taches = [new Promise((r) => setTimeout(r, 5)).then(() => { ordre.push('notifications'); enFileApres = true; }), Promise.reject(new Error('perdue'))];
		envoyer.mockImplementation(async () => (ordre.push('envoi'), new Response(null, { status: 201 })));
		expect(await envoyerApres(base, cles, taches, () => enFileApres, envoyer)).toEqual({ envoyes: 3, perimes: 0 });
		expect(ordre).toEqual(['notifications', 'envoi', 'envoi', 'envoi']);
		expect(LOT_IMMEDIAT).toBe(20);
	});

	it('rien mis en file : aucune requête à la base, rien n’est envoyé', async () => {
		const { base, cles } = await enFile();
		const envoyer = vi.fn();
		const avant = base.requetes;
		expect(await envoyerApres(base, cles, [Promise.resolve()], () => false, envoyer)).toBeNull();
		expect(base.requetes).toBe(avant);
		expect(envoyer).not.toHaveBeenCalled();
	});

	it('pas plus de 20 tout de suite : le reste attend le réveil de la tâche planifiée', async () => {
		const { base, cles } = await enFile();
		const envoyer = vi.fn(async () => new Response(null, { status: 201 }));
		const [modele] = await base.select().from(envoiPush);
		await base.insert(envoiPush).values(Array.from({ length: 25 }, () => ({ abonnementId: modele!.abonnementId, donnees: modele!.donnees, creeLe: maintenant })));
		expect(await envoyerApres(base, cles, [], () => true, envoyer)).toEqual({ envoyes: 20, perimes: 0 });
		expect(await base.select().from(envoiPush)).toHaveLength(8);
	});
});
