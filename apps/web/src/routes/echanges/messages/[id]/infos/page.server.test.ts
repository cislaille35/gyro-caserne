import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { creerGroupe, envoyer, infosConversation, membreConversation, personne } from '@gyro-caserne/socle';
import { locaux, preparer, requeteFormulaire } from '../../../de-test.ts';
import { actions, load } from './+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const charger = (locals: unknown, id: number | string, q = '') => (load as any)({ locals, params: { id: String(id) }, url: new URL(`http://x/echanges/messages/${id}/infos${q}`) });
const agir = async (nom: keyof typeof actions, locals: unknown, id: number, corps: [string, string][] = []) =>
	(actions[nom] as any)({ locals, params: { id: String(id) }, request: await requeteFormulaire(corps) }).catch((e: unknown) => e);

async function groupe() {
	const jeu = await preparer();
	const { base, alice, bruno, chef } = jeu;
	const id = await creerGroupe(base, alice, { nom: 'Garde', icone: 'camion', membres: [bruno.id, chef.id] }, '2026-10-28T09:00');
	return { ...jeu, id };
}

describe('infos d’un groupe : chargement', () => {
	it('les infos, le mode (renommer, quitter) et moi', async () => {
		const { base, alice, bruno, id } = await groupe();
		const d = await charger(locaux(base, bruno), id);
		expect(d).toMatchObject({ id, moiId: bruno.id, mode: null, fiche: null, infos: { type: 'groupe', nom: 'Garde', creeParPrenom: 'Alice', moiAnimateur: false } });
		expect(d.infos.membres.map((m: { id: number; animateur: boolean }) => [m.id, m.animateur])).toContainEqual([alice.id, true]);
		expect((await charger(locaux(base, alice), id, '?renommer')).mode).toBe('renommer');
		expect((await charger(locaux(base, alice), id, '?quitter')).mode).toBe('quitter');
	});

	it('à deux : la personne, et sa fiche seulement pour qui gère les agents', async () => {
		const { base, alice, bruno, chef } = await preparer();
		const { conversation: aDeux } = await envoyer(base, base.photos, alice, { personne: bruno.id }, { texte: 'Salut' }, '2026-10-28T09:00');
		expect(await charger(locaux(base, alice), aDeux, '?renommer')).toMatchObject({ mode: null, fiche: null, infos: { type: 'deux', nom: 'Bruno Test' } });
		const { conversation: avecChef } = await envoyer(base, base.photos, chef, { personne: bruno.id }, { texte: 'Salut' }, '2026-10-28T09:00');
		expect((await charger(locaux(base, chef), avecChef)).fiche).toBe(`/agents/${bruno.id}`);
	});

	it('non-membre ou inconnue : introuvable ; sans messagerie : renvoi', async () => {
		const { base, id, alice } = await groupe();
		const [autre] = await base.insert(personne).values({ email: 'zoe@exemple.fr', prenom: 'Zoé', nom: 'Test', profilId: (await base.select().from(personne).where(eq(personne.id, alice.id)))[0]!.profilId }).returning();
		for (const [qui, c] of [[autre!.id, id], [alice.id, 9999], [alice.id, 'abc']] as const) await expect(charger(locaux(base, { type: 'personne', id: qui }), c)).rejects.toMatchObject({ status: 404 });
		await expect(charger(locaux(base, { type: 'super', email: 'a@b.fr' }), id)).rejects.toMatchObject({ status: 303, location: '/echanges?refus=messagerie' });
	});
});

describe('infos d’un groupe : actions', () => {
	it('renommer : retour aux infos ; un nom vide est refusé et gardé', async () => {
		const { base, bruno, id } = await groupe();
		expect(await agir('renommer', locaux(base, bruno), id, [['nom', 'Garde de nuit']])).toMatchObject({ status: 303, location: `/echanges/messages/${id}/infos` });
		expect((await infosConversation(base, bruno, id, '2026-10-28')).nom).toBe('Garde de nuit');
		expect(await agir('renommer', locaux(base, bruno), id, [['nom', '  ']])).toMatchObject({ status: 400, data: { cible: 'renommer', message: 'Donnez un nom au groupe.', valeurs: { nom: '  ' } } });
	});

	it('nommer et retirer : réservés aux animateurs', async () => {
		const { base, alice, bruno, chef, id } = await groupe();
		for (const nom of ['nommer', 'retirer'] as const) {
			expect(await agir(nom, locaux(base, bruno), id, [['personne', String(chef.id)]])).toMatchObject({ status: 403, data: { cible: 'membre', message: 'Seuls les animateurs du groupe peuvent faire cela.' } });
		}
		expect(await agir('nommer', locaux(base, alice), id, [['personne', String(bruno.id)]])).toMatchObject({ cible: 'membre', succes: true });
		expect(await agir('nommer', locaux(base, alice), id, [['personne', String(bruno.id)]])).toMatchObject({ status: 400, data: { message: 'Cette personne anime déjà le groupe.' } });
		expect(await agir('retirer', locaux(base, bruno), id, [['personne', String(chef.id)]])).toMatchObject({ cible: 'membre', succes: true });
		expect(await agir('retirer', locaux(base, bruno), id, [['personne', String(chef.id)]])).toMatchObject({ status: 400, data: { message: 'Cette personne ne fait plus partie du groupe.' } });
		expect(await agir('retirer', locaux(base, bruno), id, [['personne', String(bruno.id)]])).toMatchObject({ status: 400, data: { message: 'Pour partir, quittez le groupe.' } });
		expect(await agir('retirer', locaux(base, bruno), id, [['personne', 'x']])).toMatchObject({ status: 400, data: { message: 'Cette personne ne fait plus partie du groupe.' } });
	});

	it('retiré entre-temps : la phrase claire ; à deux, pas de gestion de groupe', async () => {
		const { base, alice, bruno, chef, id } = await groupe();
		await base.delete(membreConversation).where(eq(membreConversation.personneId, alice.id));
		expect(await agir('nommer', locaux(base, alice), id, [['personne', String(bruno.id)]])).toMatchObject({ status: 403, data: { message: 'Vous ne faites plus partie de ce groupe.' } });
		const { conversation: aDeux } = await envoyer(base, base.photos, chef, { personne: bruno.id }, { texte: 'Salut' }, '2026-10-28T09:00');
		expect(await agir('quitter', locaux(base, chef), aDeux)).toMatchObject({ status: 400, data: { cible: 'quitter', message: 'Ce n’est pas un groupe.' } });
	});

	it('quitter : retour à la liste des messages', async () => {
		const { base, bruno, id } = await groupe();
		expect(await agir('quitter', locaux(base, bruno), id)).toMatchObject({ status: 303, location: '/echanges/messages' });
		await expect(charger(locaux(base, bruno), id)).rejects.toMatchObject({ status: 404 });
	});
});
