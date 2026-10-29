import { describe, expect, it } from 'vitest';
import { creerGroupe, envoyer, lireConversation, modifierMessage, retirerMembre } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer } from '../../../de-test.ts';
import { GET } from './+server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (locals: unknown, id: number | string, requete: string) => (GET as any)({ locals, params: { id: String(id) }, url: new URL(`http://x/echanges/messages/${id}/suite${requete}`) });

async function groupe() {
	const p = await preparer();
	const id = await creerGroupe(p.base, p.chef, { nom: 'Garde', membres: [p.alice.id, p.bruno.id] }, '2026-10-28T09:00');
	return { ...p, id };
}

describe('suite d’une conversation', () => {
	it('demande la connexion', async () => {
		await expect(appeler({ acteur: null }, 1, '?dernier=0&maj=2026-10-28T09:00:00')).rejects.toMatchObject({ status: 401 });
	});

	it('les nouveaux et les modifiés depuis le repère, en JSON jamais mis en cache, en 3 requêtes au plus', async () => {
		const { base, chef, alice, id } = await groupe();
		const { message: premier } = await envoyer(base, base.photos, chef, { conversation: id }, { texte: 'Un' }, maintenantParis());
		const vue = await lireConversation(base, alice, id, {}, maintenantParis());
		const dernier = vue.messages.at(-1)!.id;
		// Le repère part 10 s avant la lecture : on l'avance pour ne voir que ce qui change ensuite.
		const repere = vue.majLe;
		await envoyer(base, base.photos, chef, { conversation: id }, { texte: 'Deux' }, maintenantParis());
		await modifierMessage(base, chef, premier, 'Un, corrigé', maintenantParis());
		const avant = base.requetes;
		const reponse: Response = await appeler(locaux(base, alice), id, `?dernier=${dernier}&maj=${encodeURIComponent(repere)}`);
		expect(base.requetes - avant).toBeLessThanOrEqual(3);
		expect(reponse.headers.get('cache-control')).toBe('no-store');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const corps: any = await reponse.json();
		expect(corps.nouveaux.map((m: { texte: string }) => m.texte)).toEqual(['Deux']);
		expect(corps.modifies.map((m: { texte: string }) => m.texte)).toContain('Un, corrigé');
		expect(typeof corps.majLe).toBe('string');
		expect(corps.nonLusTotal).toBe(0);
	});

	it('rien de neuf : une requête', async () => {
		const { base, alice, id } = await groupe();
		const vue = await lireConversation(base, alice, id, {}, '2026-10-28T09:10');
		const avant = base.requetes;
		const corps = await (await appeler(locaux(base, alice), id, `?dernier=${vue.messages.at(-1)!.id}&maj=${encodeURIComponent(maintenantParis())}`)).json();
		expect(base.requetes - avant).toBe(1);
		expect(corps).toMatchObject({ nouveaux: [], modifies: [] });
	});

	it('un membre retiré pendant qu’il lit : 403 et la phrase à afficher', async () => {
		const { base, chef, alice, id } = await groupe();
		await retirerMembre(base, chef, id, alice.id, '2026-10-28T09:05');
		const reponse: Response = await appeler(locaux(base, alice), id, `?dernier=0&maj=${encodeURIComponent(maintenantParis())}`);
		expect(reponse.status).toBe(403);
		expect(await reponse.json()).toEqual({ message: 'Vous ne faites plus partie de ce groupe.' });
	});

	it('un repère de plus d’une heure : 409, la page recharge la conversation', async () => {
		const { base, alice, id } = await groupe();
		const ilYA = maintenantParis(new Date(Date.now() - 3601_000));
		const reponse: Response = await appeler(locaux(base, alice), id, `?dernier=0&maj=${encodeURIComponent(ilYA)}`);
		expect(reponse.status).toBe(409);
		expect(await reponse.json()).toEqual({ message: 'Repère trop ancien' });
	});

	it('un repère illisible : 400', async () => {
		const { base, alice, id } = await groupe();
		for (const q of ['', '?dernier=x&maj=2026-10-28T09:00:00', '?dernier=1&maj=hier', '?avant=x']) expect((await appeler(locaux(base, alice), id, q)).status, q).toBe(400);
		expect((await appeler(locaux(base, alice), 'abc', '?dernier=1&maj=2026-10-28T09:00:00')).status).toBe(400);
	});

	it('?avant= : la page de messages plus anciens, sans rien marquer comme lu', async () => {
		const { base, chef, alice, id } = await groupe();
		const ids: number[] = [];
		for (let i = 0; i < 45; i++) ids.push((await envoyer(base, base.photos, chef, { conversation: id }, { texte: `M${i}` }, '2026-10-28T10:00')).message);
		const avant = base.requetes;
		const corps = await (await appeler(locaux(base, alice), id, `?avant=${ids[5]}`)).json();
		expect(base.requetes - avant).toBeLessThanOrEqual(3);
		expect(corps.messages.map((m: { texte: string | null; systeme: string | null }) => m.systeme ?? m.texte)).toEqual(['Chef a créé le groupe', 'M0', 'M1', 'M2', 'M3', 'M4']);
		expect(corps.plusAnciens).toBe(false);
		expect((await lireConversation(base, alice, id, { avant: 1 }, maintenantParis())).premierNonLu).toBe(ids[0]);
	});
});
