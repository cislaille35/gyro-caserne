import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { journal, photoPublication, publication, publier } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { envoyer, jpeg, locaux, preparer } from '../de-test.ts';
import { actions, load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, mur: string, recherche = '') => (load as any)({ locals, params: { mur }, url: new URL(`http://x/echanges/${mur}${recherche}`) });
const agir = (nom: string, locals: unknown, mur: string, corps: [string, string | File][]) => envoyer(actions, nom, locals, mur, corps);
const demain = () => {
	const d = new Date(Date.now() + 86_400_000);
	return `${d.toISOString().slice(0, 10)}T19:30`;
};

describe('un mur', () => {
	it('demande la connexion ; 403 sur un mur non lisible ; 404 sur un mur inconnu', async () => {
		const { base, alice, e2 } = await preparer();
		await expect(charger({ acteur: null }, 'vie')).rejects.toMatchObject({ status: 303, location: '/connexion' });
		await expect(charger(locaux(base, alice), `equipe:${e2.id}`)).rejects.toMatchObject({ status: 403 });
		await expect(charger(locaux(base, alice), 'inconnu')).rejects.toMatchObject({ status: 404 });
		await expect(charger(locaux(base, alice), 'equipe:999')).rejects.toMatchObject({ status: 403 });
		for (const nom of Object.keys(actions)) {
			await expect(agir(nom, { base, acteur: null }, 'vie', [])).rejects.toMatchObject({ status: 303 });
		}
	});

	it('épinglées puis publications, « Voir plus » par ?avant=', async () => {
		const { base, chef, alice } = await preparer();
		const ids: number[] = [];
		for (let i = 0; i < 22; i++) ids.push(await publier(base, chef, 'vie', { type: 'message', texte: `n°${i}` }, maintenantParis()));
		await base.update(publication).set({ epinglee: 1 }).where(eq(publication.id, ids[0]!));
		const data = await charger(locaux(base, alice), 'vie');
		expect(data.mur).toMatchObject({ cle: 'vie', nom: 'Vie du centre', peutPublier: true, peutModerer: false });
		expect(data.epinglees.map((p: { texte: string }) => p.texte)).toEqual(['n°0']);
		expect(data.publications).toHaveLength(20);
		expect(data.publications[0].texte).toBe('n°21');
		expect(data.suite).toBe(ids[2]);
		const suite = await charger(locaux(base, alice), 'vie', `?avant=${data.suite}`);
		expect(suite.epinglees).toEqual([]);
		expect(suite.publications.map((p: { texte: string }) => p.texte)).toEqual(['n°1']);
		await expect(charger(locaux(base, alice), 'vie', '?avant=abc')).rejects.toMatchObject({ status: 400 });
	});

	it('donne les équipes à convoquer, sauf sur un mur d’équipe', async () => {
		const { base, alice, e1 } = await preparer();
		expect((await charger(locaux(base, alice), 'vie')).equipes.map((e: { nom: string }) => e.nom)).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3']);
		expect((await charger(locaux(base, alice), `equipe:${e1.id}`)).equipes).toEqual([]);
	});
});

describe('publier', () => {
	const derniere = async (base: Awaited<ReturnType<typeof preparer>>['base']) => (await base.select().from(publication).orderBy(publication.id)).at(-1)!;

	it('un message, avec un sondage et des photos', async () => {
		const { base, alice } = await preparer();
		const r = await agir('publier', locaux(base, alice), 'vie', [
			['type', 'message'],
			['texte', 'Petit déjeuner samedi ?'],
			['question', 'Vous venez ?'],
			['reponse', 'Oui'],
			['reponse', 'Non'],
			['reponse', ''],
			['photos', jpeg()],
			['photos', jpeg(2000, 'deux.jpg')],
			['photos', new File([], '')]
		]);
		expect(r).toMatchObject({ cible: 'publier', succes: 'Publication envoyée.' });
		const p = await derniere(base);
		expect(p).toMatchObject({ type: 'message', texte: 'Petit déjeuner samedi ?', sondageQuestion: 'Vous venez ?', sondageReponses: '["Oui","Non"]' });
		expect(await base.select({ id: photoPublication.id }).from(photoPublication).where(eq(photoPublication.publicationId, p.id))).toHaveLength(2);
	});

	it('une annonce avec prise de connaissance (modérateur)', async () => {
		const { base, chef } = await preparer();
		expect(await agir('publier', locaux(base, chef), 'centre', [['type', 'annonce'], ['texte', 'Exercice'], ['priseDeConnaissance', 'oui']])).toMatchObject({ succes: expect.any(String) });
		expect(await derniere(base)).toMatchObject({ mur: 'centre', type: 'annonce', priseDeConnaissance: 1 });
	});

	it('un événement qui convoque des équipes, ou tout le mur', async () => {
		const { base, alice, e1, e2 } = await preparer();
		const debut = demain();
		await agir('publier', locaux(base, alice), 'vie', [['type', 'evenement'], ['texte', 'Manœuvre'], ['debut', debut], ['lieu', 'Caserne'], ['equipe', String(e1.id)], ['equipe', String(e2.id)]]);
		expect(await derniere(base)).toMatchObject({ type: 'evenement', debut, lieu: 'Caserne', convoques: JSON.stringify([e1.id, e2.id]) });
		await agir('publier', locaux(base, alice), 'vie', [['type', 'evenement'], ['texte', 'Repas'], ['debut', debut], ['lieu', 'Salle']]);
		expect(await derniere(base)).toMatchObject({ texte: 'Repas', convoques: '"tous"' });
	});

	it('un bravo ; les champs d’événement et la prise de connaissance restés remplis sont ignorés', async () => {
		const { base, alice } = await preparer();
		await agir('publier', locaux(base, alice), 'vie', [['type', 'bravo'], ['texte', 'Bravo Chloé pour le FDF1 !'], ['debut', demain()], ['lieu', 'X'], ['priseDeConnaissance', 'oui']]);
		expect(await derniere(base)).toMatchObject({ type: 'bravo', debut: null, lieu: null, priseDeConnaissance: 0 });
	});

	it('refus affichés sur le formulaire, saisie gardée', async () => {
		const { base, alice } = await preparer();
		const vie = (corps: [string, string | File][]) => agir('publier', locaux(base, alice), 'vie', corps);
		expect(await vie([['type', 'message'], ['texte', '  ']])).toMatchObject({ status: 400, data: { cible: 'publier', erreurs: { texte: 'Écrivez le texte de la publication.' }, valeurs: { type: 'message' } } });
		expect(await vie([['type', 'message'], ['texte', 'x'], ['photos', jpeg(401 * 1024)]])).toMatchObject({
			status: 400,
			data: { erreurs: { photos: expect.stringContaining('400 Ko') }, valeurs: { texte: 'x' } }
		});
		expect(await vie([['type', 'message'], ['texte', 'x'], ['photos', new File([new Uint8Array([0x89, 0x50])], 'a.png', { type: 'image/png' })]])).toMatchObject({
			status: 400,
			data: { erreurs: { photos: 'Les photos doivent être en JPEG ou WebP.' } }
		});
		const cinq = Array.from({ length: 5 }, (): [string, File] => ['photos', jpeg()]);
		expect(await vie([['type', 'message'], ['texte', 'x'], ...cinq])).toMatchObject({ status: 400, data: { erreurs: { photos: '4 photos au plus.' } } });
		expect(await vie([['type', 'evenement'], ['texte', 'x'], ['debut', demain()], ['lieu', '']])).toMatchObject({ status: 400, data: { erreurs: { lieu: 'Indiquez le lieu.' } } });
		expect(await vie([['type', 'evenement'], ['texte', 'x'], ['debut', ''], ['lieu', 'Ici']])).toMatchObject({ status: 400, data: { erreurs: { debut: 'Indiquez la date et l’heure.' } } });
		expect(await vie([['type', 'evenement'], ['texte', 'x'], ['debut', '2020-01-01T10:00'], ['lieu', 'Ici']])).toMatchObject({ status: 400, data: { erreurs: { debut: 'Cet événement est déjà passé.' } } });
		expect(await vie([['type', 'message'], ['texte', 'x'], ['question', 'Q'], ['reponse', 'Oui']])).toMatchObject({ status: 400, data: { erreurs: { sondage: 'Proposez de 2 à 6 réponses.' } } });
		expect(await vie([['type', 'message'], ['texte', 'x'], ['reponse', 'Oui'], ['reponse', 'Non']])).toMatchObject({ status: 400, data: { erreurs: { sondage: 'Indiquez la question du sondage.' } } });
		expect(await vie([['type', 'annonce'], ['texte', 'x'], ['priseDeConnaissance', 'oui']])).toMatchObject({ status: 403, data: { message: expect.stringContaining('modérateurs') } });
		expect(await agir('publier', locaux(base, alice), 'centre', [['type', 'message'], ['texte', 'x']])).toMatchObject({ status: 403, data: { cible: 'publier', message: 'Vous ne pouvez pas publier sur ce mur.' } });
		expect(await base.select().from(publication)).toHaveLength(0);
	});
});

describe('modération', () => {
	it('l’auteur modifie ; un autre agent ne supprime pas ; le chef épingle et supprime', async () => {
		const { base, chef, alice, bruno } = await preparer();
		const id = String(await publier(base, alice, 'vie', { type: 'message', texte: 'Avant' }, maintenantParis()));
		expect(await agir('modifier', locaux(base, alice), 'vie', [['id', id], ['texte', 'Après']])).toMatchObject({ cible: `publication:${id}`, succes: 'Publication modifiée.' });
		expect(await agir('modifier', locaux(base, alice), 'vie', [['id', id], ['texte', '']])).toMatchObject({ status: 400, data: { cible: `publication:${id}`, message: 'Écrivez le texte de la publication.' } });
		expect(await agir('supprimer', locaux(base, bruno), 'vie', [['id', id]])).toMatchObject({ status: 403, data: { cible: `publication:${id}` } });
		expect(await agir('epingler', locaux(base, alice), 'vie', [['id', id], ['oui', '1']])).toMatchObject({ status: 403 });
		expect(await agir('epingler', locaux(base, chef), 'vie', [['id', id], ['oui', '1']])).toMatchObject({ succes: 'Publication épinglée.' });
		expect((await base.select().from(publication))[0]).toMatchObject({ texte: 'Après', epinglee: 1 });
		expect(await agir('epingler', locaux(base, chef), 'vie', [['id', id], ['oui', '0']])).toMatchObject({ succes: 'Épingle retirée.' });
		expect(await agir('supprimer', locaux(base, chef), 'vie', [['id', id]])).toMatchObject({ succes: 'Publication supprimée.' });
		expect(await base.select().from(publication)).toHaveLength(0);
		expect(await base.select().from(journal).where(eq(journal.action, 'supprimer_publication'))).toHaveLength(1);
	});

	it('une publication d’un autre mur, ou inconnue, est refusée', async () => {
		const { base, alice, bruno, e2 } = await preparer();
		const id = String(await publier(base, bruno, `equipe:${e2.id}`, { type: 'message', texte: 'Équipe 2' }, maintenantParis()));
		expect(await agir('supprimer', locaux(base, alice), 'vie', [['id', id]])).toMatchObject({ status: 403 });
		expect(await agir('supprimer', locaux(base, alice), 'vie', [['id', '999']])).toMatchObject({ status: 400 });
		expect(await agir('supprimer', locaux(base, alice), 'vie', [['id', 'abc']])).toMatchObject({ status: 400 });
		expect(await base.select().from(publication)).toHaveLength(1);
	});
});
