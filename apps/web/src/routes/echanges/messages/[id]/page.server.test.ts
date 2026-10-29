import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { creerGroupe, envoyer, lireConversation, message, personne, reactionMessage, retirerMembre, signalementMessage } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { jpeg, locaux, preparer, requeteFormulaire } from '../../de-test.ts';
import { actions, load } from './+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const charger = (locals: unknown, id: number | string, requete = '') => (load as any)({ locals, params: { id: String(id) }, url: new URL(`http://x/echanges/messages/${id}${requete}`) });
const agir = async (nom: string, locals: unknown, id: number, corps: [string, string | File][], enTetes: Record<string, string> = {}) =>
	(actions as any)[nom]({ locals, params: { id: String(id) }, url: new URL(`http://x/echanges/messages/${id}`), request: await requeteFormulaire(corps, enTetes) });

async function groupe() {
	const p = await preparer();
	const id = await creerGroupe(p.base, p.chef, { nom: 'Départ de Thomas', icone: 'coeur', membres: [p.alice.id, p.bruno.id] }, '2026-10-28T09:00');
	return { ...p, id };
}

describe('une conversation : chargement', () => {
	it('demande la connexion', async () => {
		await expect(charger({ acteur: null }, 1)).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('un groupe : la page de messages, le premier non lu, et les membres en sous-titre, « vous » en dernier', async () => {
		const { base, chef, alice, bruno, id } = await groupe();
		await envoyer(base, base.photos, alice, { conversation: id }, { texte: 'Salut' }, '2026-10-28T09:01');
		const { message: deuxieme } = await envoyer(base, base.photos, chef, { conversation: id }, { texte: 'On fait un pot ?' }, '2026-10-28T09:02');
		const d = await charger(locaux(base, alice), id);
		expect(d.vue).toMatchObject({ id, type: 'groupe', nom: 'Départ de Thomas', icone: 'coeur', lectureSeule: false, plusAnciens: false, premierNonLu: deuxieme });
		expect(d.vue.messages.map((m: { texte: string; systeme: string | null }) => m.systeme ?? m.texte)).toEqual(['Chef a créé le groupe', 'Salut', 'On fait un pot ?']);
		expect(d.moiId).toBe(alice.id);
		expect(d.sousTitre).toBe('Bruno, Chef, vous');
		expect(d.avant).toBeNull();
		// Ouvrir la conversation la marque comme lue.
		expect((await lireConversation(base, alice, id, {}, maintenantParis())).premierNonLu).toBeNull();
		expect(bruno).toBeDefined();
	});

	it('un grand groupe : cinq prénoms, puis le nombre des autres', async () => {
		const { base, chef } = await preparer();
		const prenoms = ['Anne', 'Basile', 'Carole', 'Denis', 'Emma', 'Fanny', 'Gaston'];
		const ids = [];
		for (const prenom of prenoms) {
			const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: (await base.select({ profilId: personne.profilId }).from(personne).where(eq(personne.id, chef.id)))[0]!.profilId }).returning();
			ids.push(p!.id);
		}
		const id = await creerGroupe(base, chef, { nom: 'Tous', membres: ids }, '2026-10-28T09:00');
		expect((await charger(locaux(base, chef), id)).sousTitre).toBe('Anne, Basile, Carole, Denis, Emma et 2 autres, vous');
	});

	it('à deux : le nom de l’autre, son équipe en sous-titre', async () => {
		const { base, alice, bruno, e2 } = await preparer();
		const { conversation } = await envoyer(base, base.photos, alice, { personne: bruno.id }, { texte: 'Tu prends ma garde ?' }, '2026-10-28T09:00');
		const d = await charger(locaux(base, alice), conversation);
		expect(d.vue).toMatchObject({ type: 'deux', nom: 'Bruno Test' });
		expect(d.sousTitre).toBe(`Équipe ${e2.ordreRotation}`);
	});

	it('à deux, avec le chef de centre : son rôle en sous-titre', async () => {
		const { base, alice, chef } = await preparer();
		const { conversation } = await envoyer(base, base.photos, alice, { personne: chef.id }, { texte: 'Bonjour' }, '2026-10-28T09:00');
		expect((await charger(locaux(base, alice), conversation)).sousTitre).toBe('Chef de centre');
	});

	it('?avant= : la page précédente, sans marquer la conversation comme lue', async () => {
		const { base, chef, alice, id } = await groupe();
		const ids: number[] = [];
		for (let i = 0; i < 45; i++) ids.push((await envoyer(base, base.photos, chef, { conversation: id }, { texte: `M${i}` }, '2026-10-28T10:00')).message);
		const d = await charger(locaux(base, alice), id, `?avant=${ids[10]}`);
		expect(d.avant).toBe(ids[10]);
		expect(d.vue.messages.at(-1).texte).toBe('M9');
		expect((await lireConversation(base, alice, id, { avant: 1 }, maintenantParis())).premierNonLu).not.toBeNull();
	});

	it('une conversation inconnue, dont on n’est pas membre, ou un identifiant illisible : introuvable', async () => {
		const { base, chef, alice, bruno } = await preparer();
		const { conversation } = await envoyer(base, base.photos, chef, { personne: bruno.id }, { texte: 'Privé' }, '2026-10-28T09:00');
		for (const id of [conversation, 9999, 'abc', '0']) await expect(charger(locaux(base, alice), id), String(id)).rejects.toMatchObject({ status: 404 });
		await expect(charger(locaux(base, alice), conversation, '?avant=x')).rejects.toMatchObject({ status: 404 });
	});

	it('le super administrateur repart vers Échanges, avec la raison', async () => {
		const { base, id } = await groupe();
		await expect(charger(locaux(base, { type: 'super', email: 'a@b.fr' }), id)).rejects.toMatchObject({ status: 303, location: '/echanges?refus=messagerie' });
	});
});

describe('une conversation : envoyer', () => {
	it('sans JavaScript : le message part et la page se recharge sur lui', async () => {
		const { base, alice, id } = await groupe();
		const r = agir('envoyer', locaux(base, alice), id, [['texte', '  Bonne idée  ']]);
		const fin = await r.catch((e: unknown) => e);
		const [m] = await base.select().from(message).where(eq(message.texte, 'Bonne idée'));
		expect(fin).toMatchObject({ status: 303, location: `/echanges/messages/${id}#message-${m!.id}` });
	});

	it('une réponse citée et une photo', async () => {
		const { base, chef, alice, id } = await groupe();
		const { message: cite } = await envoyer(base, base.photos, chef, { conversation: id }, { texte: 'Le cadeau ?' }, '2026-10-28T09:01');
		await agir('envoyer', locaux(base, alice), id, [['texte', 'Le voilà'], ['reponseA', String(cite)], ['photos', jpeg()]], { 'x-sveltekit-action': 'true' }).catch((e: unknown) => e);
		const vue = await lireConversation(base, alice, id, {}, maintenantParis());
		const dernier = vue.messages.at(-1)!;
		expect(dernier).toMatchObject({ texte: 'Le voilà', reponse: { id: cite } });
		expect(dernier.photos).toHaveLength(1);
		// Une photo sans texte suffit.
		await agir('envoyer', locaux(base, alice), id, [['texte', ''], ['photos', jpeg()]]).catch((e: unknown) => e);
		expect((await lireConversation(base, alice, id, {}, maintenantParis())).messages.at(-1)!.photos).toHaveLength(1);
	});

	it('les refus, en phrases claires, la saisie gardée', async () => {
		const { base, alice, id } = await groupe();
		expect(await agir('envoyer', locaux(base, alice), id, [['texte', '   ']])).toMatchObject({ status: 400, data: { cible: 'envoyer', message: 'Écrivez votre message.' } });
		expect(await agir('envoyer', locaux(base, alice), id, [['texte', 'x'.repeat(4001)]])).toMatchObject({ status: 400, data: { message: 'Le message ne peut pas dépasser 4 000 caractères.', valeurs: { texte: 'x'.repeat(4001) } } });
		expect(await agir('envoyer', locaux(base, alice), id, [['texte', 'Oui'], ['reponseA', '99999']])).toMatchObject({ status: 400, data: { message: 'Le message cité n’existe plus.' } });
		const lourde = await agir('envoyer', locaux(base, alice), id, [['texte', 'Oui'], ['photos', jpeg(250 * 1024)]]);
		expect(lourde).toMatchObject({ status: 400, data: { message: expect.stringContaining('Sans JavaScript') } });
		const cinq = await agir('envoyer', locaux(base, alice), id, [['texte', 'Oui'], ...Array.from({ length: 5 }, (): [string, File] => ['photos', jpeg()])], { 'x-sveltekit-action': 'true' });
		expect(cinq).toMatchObject({ status: 400, data: { message: '4 photos au plus.' } });
	});

	it('un envoi trop lourd est refusé avant d’être lu (413)', async () => {
		const { base, alice, id } = await groupe();
		const r = await agir('envoyer', locaux(base, alice), id, Array.from({ length: 5 }, (): [string, File] => ['photos', jpeg(200 * 1024)]));
		expect(r).toMatchObject({ status: 413, data: { cible: 'envoyer' } });
	});

	it('un membre retiré ne peut plus écrire', async () => {
		const { base, chef, alice, id } = await groupe();
		await retirerMembre(base, chef, id, alice.id, '2026-10-28T09:05');
		expect(await agir('envoyer', locaux(base, alice), id, [['texte', 'Oui']])).toMatchObject({ status: 403, data: { message: 'Vous ne faites plus partie de ce groupe.' } });
	});

	it('à deux, l’autre parti : lecture seule, et l’envoi refusé', async () => {
		const { base, alice, bruno } = await preparer();
		const { conversation } = await envoyer(base, base.photos, alice, { personne: bruno.id }, { texte: 'Salut' }, '2026-10-28T09:00');
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, bruno.id));
		const d = await charger(locaux(base, alice), conversation);
		expect(d.vue.lectureSeule).toBe(true);
		expect(d.autrePrenom).toBe('Bruno');
		expect(await agir('envoyer', locaux(base, alice), conversation, [['texte', 'Oui']])).toMatchObject({ status: 400, data: { message: 'Cette conversation ne sert plus qu’à relire.' } });
	});
});

describe('une conversation : gestes', () => {
	it('réagir, puis retirer sa réaction', async () => {
		const { base, chef, alice, id } = await groupe();
		const { message: m } = await envoyer(base, base.photos, chef, { conversation: id }, { texte: 'Pot vendredi' }, '2026-10-28T09:01');
		expect(await agir('reagir', locaux(base, alice), id, [['id', String(m)], ['emoji', '👏']])).toMatchObject({ cible: 'geste' });
		expect(await base.select().from(reactionMessage)).toHaveLength(1);
		await agir('reagir', locaux(base, alice), id, [['id', String(m)], ['emoji', '👏']]);
		expect(await base.select().from(reactionMessage)).toHaveLength(0);
		expect(await agir('reagir', locaux(base, alice), id, [['id', String(m)], ['emoji', '🍕']])).toMatchObject({ status: 400, data: { message: 'Choisissez une des six réactions.' } });
	});

	it('modifier son message, puis le supprimer', async () => {
		const { base, alice, id } = await groupe();
		const { message: m } = await envoyer(base, base.photos, alice, { conversation: id }, { texte: 'Pot jeudi' }, maintenantParis());
		expect(await agir('modifier', locaux(base, alice), id, [['id', String(m)], ['texte', 'Pot vendredi']])).toMatchObject({ cible: 'geste', succes: 'Message modifié.' });
		const [apres] = await base.select().from(message).where(eq(message.id, m));
		expect(apres).toMatchObject({ texte: 'Pot vendredi', modifie: 1 });
		expect(await agir('supprimer', locaux(base, alice), id, [['id', String(m)]])).toMatchObject({ succes: 'Message supprimé.' });
		const [supprime] = await base.select().from(message).where(eq(message.id, m));
		expect(supprime!.supprime).toBe('auteur');
	});

	it('modifier après 15 minutes, ou le message d’un autre : refusé', async () => {
		const { base, chef, alice, id } = await groupe();
		const { message: vieux } = await envoyer(base, base.photos, alice, { conversation: id }, { texte: 'Vieux' }, '2026-10-28T09:01');
		expect(await agir('modifier', locaux(base, alice), id, [['id', String(vieux)], ['texte', 'Neuf']])).toMatchObject({ status: 400, data: { message: 'Un message se modifie dans les 15 minutes après l’envoi.' } });
		const { message: sien } = await envoyer(base, base.photos, chef, { conversation: id }, { texte: 'Le sien' }, maintenantParis());
		expect(await agir('modifier', locaux(base, alice), id, [['id', String(sien)], ['texte', 'Neuf']])).toMatchObject({ status: 403 });
		expect(await agir('supprimer', locaux(base, alice), id, [['id', String(sien)]])).toMatchObject({ status: 403 });
	});

	it('signaler le message d’un autre, une fois', async () => {
		const { base, chef, alice, id } = await groupe();
		const { message: m } = await envoyer(base, base.photos, chef, { conversation: id }, { texte: 'Grave' }, '2026-10-28T09:01');
		expect(await agir('signaler', locaux(base, alice), id, [['id', String(m)]])).toMatchObject({ succes: 'Le message a été transmis au chef de centre.' });
		expect(await base.select().from(signalementMessage)).toHaveLength(1);
		expect(await agir('signaler', locaux(base, alice), id, [['id', String(m)]])).toMatchObject({ status: 400, data: { message: 'Vous avez déjà signalé ce message.' } });
	});

	it('un geste sur un message d’une autre conversation : refusé', async () => {
		const { base, chef, alice, bruno, id } = await groupe();
		const { message: ailleurs } = await envoyer(base, base.photos, chef, { personne: bruno.id }, { texte: 'Privé' }, '2026-10-28T09:01');
		expect(await agir('reagir', locaux(base, alice), id, [['id', String(ailleurs)], ['emoji', '👍']])).toMatchObject({ status: 403 });
		expect(await agir('reagir', locaux(base, alice), id, [['id', 'x'], ['emoji', '👍']])).toMatchObject({ status: 400 });
	});
});
