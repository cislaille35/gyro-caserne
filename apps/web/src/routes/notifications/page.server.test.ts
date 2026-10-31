import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { commenter, envoyer, lireConversation, message, notifierCommentaire, notifierPublication, publier, signaler, supprimerMessage } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer, requeteFormulaire } from '../echanges/de-test.ts';
import { actions, load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, requete = '') => (load as any)({ locals, url: new URL(`http://x/notifications${requete}`) });
/* eslint-disable @typescript-eslint/no-explicit-any */
const agir = async (nom: 'retirer' | 'classer', locals: unknown, id: number | string) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(actions[nom] as any)({ locals, request: await requeteFormulaire([['id', String(id)]]) });

describe('load de /notifications', () => {
	it('demande la connexion', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('le fil : publications et commentaires reçus, du plus récent au plus ancien, avec le nombre de non-lues', async () => {
		const { base, chef, alice } = await preparer();
		const maintenant = maintenantParis();
		const note = await publier(base, base.photos, chef, 'centre', { type: 'annonce', texte: 'Note de service', priseDeConnaissance: true }, maintenant);
		await notifierPublication(base, note, maintenant);
		const sienne = await publier(base, base.photos, alice, 'vie', { type: 'message', texte: 'Gâteau' }, maintenant);
		await notifierCommentaire(base, await commenter(base, chef, sienne, 'Merci !', maintenant), maintenant);
		const data = await charger(locaux(base, alice));
		expect(data.nonLues).toBe(2);
		expect(data.lignes).toMatchObject([
			{ type: 'commentaire', cle: 'vie', publicationId: sienne, extrait: 'Merci !', lue: false, auteur: { prenom: 'Chef' } },
			{ type: 'publication', cle: 'centre', nomMur: 'Le centre', publicationId: note, extrait: 'Note de service', lue: false }
		]);
		expect(data.aujourdhui).toBe(maintenant.slice(0, 10));
	});

	it('« Tout marquer comme lu »', async () => {
		const { base, chef, alice } = await preparer();
		await notifierPublication(base, await publier(base, base.photos, chef, 'centre', { type: 'message', texte: 'Note' }, maintenantParis()), maintenantParis());
		expect(await (actions.toutLu as any)({ locals: locaux(base, alice), request: await requeteFormulaire([]) })).toEqual({ succes: 'Tout est marqué comme lu.' });
		expect((await charger(locaux(base, alice))).nonLues).toBe(0);
	});
});

describe('signalements dans /notifications', () => {
	// Bruno écrit à Alice deux messages ; Alice signale le premier.
	async function signale() {
		const p = await preparer();
		const { base, alice, bruno } = p;
		const grave = await envoyer(base, base.photos, bruno, { personne: alice.id }, { texte: 'Texte grave' }, '2026-10-29T10:00');
		await envoyer(base, base.photos, bruno, { conversation: grave.conversation }, { texte: 'Le reste' }, '2026-10-29T10:01');
		await signaler(base, alice, grave.message, '2026-10-29T10:05');
		return { ...p, grave };
	}

	it('le modérateur voit le message signalé seul ; les autres, rien', async () => {
		const { base, chef, alice } = await signale();
		const data = await charger(locaux(base, chef));
		expect(data.signalements).toMatchObject([{ texte: 'Texte grave', auteur: { prenom: 'Bruno' }, par: { prenom: 'Alice' }, envoye_le: '2026-10-29T10:00', le: '2026-10-29T10:05', retirable: true }]);
		expect(JSON.stringify(data)).not.toContain('Le reste');
		expect((await charger(locaux(base, alice))).signalements).toEqual([]);
	});

	it('?retirer=<id> : la confirmation à ouvrir sans JavaScript ; un identifiant illisible n’ouvre rien', async () => {
		const { base, chef } = await signale();
		expect((await charger(locaux(base, chef), '?retirer=7')).confirmer).toBe(7);
		expect((await charger(locaux(base, chef), '?retirer=abc')).confirmer).toBeNull();
		expect((await charger(locaux(base, chef))).confirmer).toBeNull();
	});

	it('« Retirer le message » : retiré pour tous, le signalement disparaît', async () => {
		const { base, chef, alice, grave } = await signale();
		const [s] = (await charger(locaux(base, chef))).signalements;
		expect(await agir('retirer', locaux(base, chef), s.id)).toEqual({ succes: 'Message retiré pour tous.' });
		expect((await base.select().from(message).where(eq(message.id, grave.message)))[0]).toMatchObject({ supprime: 'moderation' });
		expect((await charger(locaux(base, chef))).signalements).toEqual([]);
		const vue = await lireConversation(base, alice, grave.conversation, {}, '2026-10-29T10:10');
		expect(vue.messages[0]).toMatchObject({ supprime: 'moderation' });
	});

	it('« Classer » : le message reste, le signalement disparaît', async () => {
		const { base, chef, grave } = await signale();
		const [s] = (await charger(locaux(base, chef))).signalements;
		expect(await agir('classer', locaux(base, chef), s.id)).toEqual({ succes: 'Signalement classé.' });
		expect((await base.select().from(message).where(eq(message.id, grave.message)))[0]).toMatchObject({ supprime: null, texte: 'Texte grave' });
		expect((await charger(locaux(base, chef))).signalements).toEqual([]);
	});

	it('refus dits en phrases : pas modérateur, déjà traité, identifiant illisible ; connexion requise', async () => {
		const { base, chef, alice } = await signale();
		const [s] = (await charger(locaux(base, chef))).signalements;
		expect(await agir('classer', locaux(base, alice), s.id)).toMatchObject({ status: 403, data: { message: 'Seule la modération peut traiter un signalement.' } });
		await agir('classer', locaux(base, chef), s.id);
		for (const nom of ['retirer', 'classer'] as const) expect(await agir(nom, locaux(base, chef), s.id)).toMatchObject({ status: 400, data: { message: 'Ce signalement a déjà été traité.' } });
		expect(await agir('classer', locaux(base, chef), 'abc')).toMatchObject({ status: 400, data: { message: 'Ce signalement est introuvable.' } });
		expect(await agir('retirer', locaux(base, chef), 0)).toMatchObject({ status: 400, data: { message: 'Ce signalement est introuvable.' } });
		await expect(agir('classer', { base, acteur: null }, s.id)).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('retirer un message que l’auteur a déjà supprimé : on propose de classer', async () => {
		const { base, chef, bruno, grave } = await signale();
		await supprimerMessage(base, base.photos, bruno, grave.message, '2026-10-29T10:06');
		const [s] = (await charger(locaux(base, chef))).signalements;
		expect(s.retirable).toBe(false);
		expect(await agir('retirer', locaux(base, chef), s.id)).toMatchObject({ status: 400, data: { message: 'Ce message n’est plus dans la conversation : classez le signalement.' } });
	});
});
