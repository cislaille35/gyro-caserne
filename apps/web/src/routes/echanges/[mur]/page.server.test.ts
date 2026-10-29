import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { aujourdhuiParis, maintenantParis, septJoursPlusTard } from '#lib/aujourdhui.ts';
import { commentaire, commenter, fermerCommentaires, jaime, journal, personne, priseConnaissance, publication, publier, reponseEvenement, voteSondage } from '@gyro-caserne/socle';
import { envoyer, locaux, preparer } from '../de-test.ts';
import { actions, load } from './+page.server';

const datesSondage = (m: string) => ({ ouverture: m.slice(0, 16), cloture: septJoursPlusTard(m) });

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
		for (let i = 0; i < 22; i++) ids.push(await publier(base, base.photos, chef, 'vie', { type: 'message', texte: `n°${i}` }, maintenantParis()));
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

	it('« Vie du centre » : les anniversaires du jour, sans l’âge ; pas sur les autres murs', async () => {
		const { base, alice, bruno } = await preparer();
		const jour = aujourdhuiParis().slice(5);
		await base.update(personne).set({ naissance: `1990-${jour}` }).where(eq(personne.id, alice.id));
		await base.update(personne).set({ naissance: `1985-${jour}`, anniversaireVisible: 0 }).where(eq(personne.id, bruno.id));
		expect((await charger(locaux(base, bruno), 'vie')).anniversaires).toEqual([{ prenom: 'Alice', nom: 'Test' }]);
		expect((await charger(locaux(base, bruno), 'centre')).anniversaires).toEqual([]);
	});

	it('donne les équipes à convoquer, sauf sur un mur d’équipe', async () => {
		const { base, alice, e1 } = await preparer();
		expect((await charger(locaux(base, alice), 'vie')).equipes.map((e: { nom: string }) => e.nom)).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3']);
		expect((await charger(locaux(base, alice), `equipe:${e1.id}`)).equipes).toEqual([]);
	});
});

describe('modération', () => {
	it('l’auteur modifie ; un autre agent ne supprime pas ; le chef épingle et supprime', async () => {
		const { base, chef, alice, bruno } = await preparer();
		const id = String(await publier(base, base.photos, alice, 'vie', { type: 'message', texte: 'Avant' }, maintenantParis()));
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

	it('onzième épingle refusée, message sous la publication', async () => {
		const { base, chef } = await preparer();
		for (let i = 0; i < 10; i++) await publier(base, base.photos, chef, 'vie', { type: 'message', texte: `n°${i}` }, maintenantParis());
		await base.update(publication).set({ epinglee: 1 });
		const id = String(await publier(base, base.photos, chef, 'vie', { type: 'message', texte: 'Onzième' }, maintenantParis()));
		expect(await agir('epingler', locaux(base, chef), 'vie', [['id', id], ['oui', '1']])).toMatchObject({
			status: 400,
			data: { cible: `publication:${id}`, message: 'Dix publications sont déjà épinglées : désépinglez-en une d’abord' }
		});
	});

	it('une publication d’un autre mur que celui de l’adresse, ou inconnue : 404', async () => {
		const { base, chef, alice, bruno, e2 } = await preparer();
		const id = String(await publier(base, base.photos, bruno, `equipe:${e2.id}`, { type: 'message', texte: 'Équipe 2' }, maintenantParis()));
		expect(await agir('supprimer', locaux(base, alice), 'vie', [['id', id]])).toMatchObject({ status: 404 });
		expect(await agir('supprimer', locaux(base, alice), 'vie', [['id', '999']])).toMatchObject({ status: 404 });
		// Le chef peut supprimer partout, mais seulement depuis le mur de la publication.
		const vie = String(await publier(base, base.photos, bruno, 'vie', { type: 'message', texte: 'Vie' }, maintenantParis()));
		expect(await agir('supprimer', locaux(base, chef), 'centre', [['id', vie]])).toMatchObject({ status: 404, data: { message: 'Cette publication n’existe plus.' } });
		expect(await agir('epingler', locaux(base, chef), `equipe:${e2.id}`, [['id', vie], ['oui', '1']])).toMatchObject({ status: 404 });
		expect(await agir('supprimer', locaux(base, alice), 'vie', [['id', 'abc']])).toMatchObject({ status: 400 });
		expect(await base.select().from(publication)).toHaveLength(2);
	});
});

describe('interactions', () => {
	const evenement = (convoques: 'tous' | number[]) => ({ type: 'evenement' as const, texte: 'Manœuvre', evenement: { debut: demain(), lieu: 'Caserne', convoques } });

	it('commenter : publié, texte contrôlé et gardé, refusé si les commentaires sont fermés', async () => {
		const { base, alice, bruno } = await preparer();
		const id = String(await publier(base, base.photos, alice, 'vie', { type: 'message', texte: 'Bonjour' }, maintenantParis()));
		expect(await agir('commenter', locaux(base, bruno), 'vie', [['id', id], ['texte', 'Salut']])).toMatchObject({ cible: `publication:${id}`, succes: 'Commentaire publié.' });
		const [nouveau] = await base.select().from(commentaire);
		expect(nouveau).toMatchObject({ texte: 'Salut', auteur: `personne:${bruno.id}` });
		expect(await agir('commenter', locaux(base, bruno), 'vie', [['id', id], ['texte', 'Encore']])).toMatchObject({ id: nouveau!.id + 1 });
		expect(await agir('commenter', locaux(base, bruno), 'vie', [['id', id], ['texte', ' ']])).toMatchObject({ status: 400, data: { message: 'Écrivez votre commentaire.' } });
		expect(await agir('commenter', locaux(base, bruno), 'vie', [['id', id], ['texte', 'x'.repeat(2001)]])).toMatchObject({ status: 400, data: { message: 'Le commentaire ne peut pas dépasser 2 000 caractères.', valeurs: { texte: 'x'.repeat(2001) } } });
		await fermerCommentaires(base, alice, Number(id), true, maintenantParis());
		expect(await agir('commenter', locaux(base, bruno), 'vie', [['id', id], ['texte', 'Encore']])).toMatchObject({ status: 400, data: { message: 'Les commentaires sont fermés.', valeurs: { texte: 'Encore' } } });
	});

	it('supprimer un commentaire : son auteur ou un modérateur, pas un autre agent ; jamais celui d’une autre publication', async () => {
		const { base, chef, alice, bruno } = await preparer();
		const id = await publier(base, base.photos, alice, 'vie', { type: 'message', texte: 'Bonjour' }, maintenantParis());
		const autre = await publier(base, base.photos, alice, 'vie', { type: 'message', texte: 'Autre' }, maintenantParis());
		const c1 = String(await commenter(base, alice, id, 'Un', maintenantParis()));
		const c2 = String(await commenter(base, alice, id, 'Deux', maintenantParis()));
		expect(await agir('supprimerCommentaire', locaux(base, bruno), 'vie', [['id', String(id)], ['commentaire', c1]])).toMatchObject({ status: 403 });
		expect(await agir('supprimerCommentaire', locaux(base, alice), 'vie', [['id', String(autre)], ['commentaire', c1]])).toMatchObject({ status: 400, data: { message: 'Ce commentaire n’existe plus.' } });
		expect(await agir('supprimerCommentaire', locaux(base, alice), 'vie', [['id', String(id)], ['commentaire', c1]])).toMatchObject({ succes: 'Commentaire supprimé.' });
		expect(await agir('supprimerCommentaire', locaux(base, chef), 'vie', [['id', String(id)], ['commentaire', c2]])).toMatchObject({ succes: 'Commentaire supprimé.' });
		expect(await base.select().from(commentaire)).toHaveLength(0);
	});

	it('j’aime, puis plus ; refusé au super administrateur, qui n’a pas de fiche', async () => {
		const { base, alice, bruno } = await preparer();
		const id = String(await publier(base, base.photos, alice, 'vie', { type: 'message', texte: 'Bonjour' }, maintenantParis()));
		expect(await agir('aimer', locaux(base, bruno), 'vie', [['id', id], ['oui', '1']])).toMatchObject({ succes: 'Vous aimez cette publication.' });
		expect(await base.select().from(jaime)).toHaveLength(1);
		expect(await agir('aimer', locaux(base, bruno), 'vie', [['id', id], ['oui', '0']])).toMatchObject({ succes: 'J’aime retiré.' });
		expect(await base.select().from(jaime)).toHaveLength(0);
		expect(await agir('aimer', locaux(base, { type: 'super', email: 'a@b.fr' }), 'vie', [['id', id], ['oui', '1']])).toMatchObject({ status: 400, data: { message: expect.stringContaining('pas de fiche') } });
	});

	it('répondre à un événement : les convoqués seulement, réponse changeable', async () => {
		const { base, chef, alice, bruno, e1 } = await preparer();
		const id = String(await publier(base, base.photos, chef, 'centre', evenement([e1.id]), maintenantParis()));
		expect(await agir('repondre', locaux(base, alice), 'centre', [['id', id], ['reponse', 'present']])).toMatchObject({ succes: 'Réponse enregistrée : présent.' });
		expect(await agir('repondre', locaux(base, alice), 'centre', [['id', id], ['reponse', 'incertain']])).toMatchObject({ succes: 'Réponse enregistrée : incertain.' });
		expect(await base.select().from(reponseEvenement)).toMatchObject([{ personneId: alice.id, reponse: 'incertain' }]);
		expect(await agir('repondre', locaux(base, bruno), 'centre', [['id', id], ['reponse', 'present']])).toMatchObject({ status: 403, data: { message: 'Vous n’êtes pas convoqué à cet événement.' } });
		expect(await agir('repondre', locaux(base, alice), 'centre', [['id', id], ['reponse', 'peut-etre']])).toMatchObject({ status: 400, data: { message: 'Choisissez une réponse.' } });
		// Commencé : plus de réponse.
		await base.update(publication).set({ debut: '2026-01-01T08:00' });
		expect(await agir('repondre', locaux(base, alice), 'centre', [['id', id], ['reponse', 'absent']])).toMatchObject({ status: 400, data: { message: 'Cet événement est passé : vous ne pouvez plus répondre.' } });
	});

	it('voter : un choix par personne, qu’on peut changer', async () => {
		const { base, alice, bruno } = await preparer();
		const id = String(await publier(base, base.photos, alice, 'vie', { type: 'message', texte: 'Samedi', sondage: { question: 'Petit déjeuner ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenantParis()) } }, maintenantParis()));
		expect(await agir('voter', locaux(base, bruno), 'vie', [['id', id], ['reponse', '1']])).toMatchObject({ succes: 'Vote enregistré.' });
		expect(await agir('voter', locaux(base, bruno), 'vie', [['id', id], ['reponse', '0']])).toMatchObject({ succes: 'Vote enregistré.' });
		expect(await base.select().from(voteSondage)).toMatchObject([{ personneId: bruno.id, reponse: 0 }]);
		for (const reponse of ['2', 'abc', '']) expect(await agir('voter', locaux(base, bruno), 'vie', [['id', id], ['reponse', reponse]])).toMatchObject({ status: 400, data: { message: 'Choisissez une réponse.' } });
	});

	it('prendre connaissance d’une annonce, une fois', async () => {
		const { base, chef, alice } = await preparer();
		const id = String(await publier(base, base.photos, chef, 'centre', { type: 'annonce', texte: 'Note', priseDeConnaissance: true }, maintenantParis()));
		expect(await agir('prendreConnaissance', locaux(base, alice), 'centre', [['id', id]])).toMatchObject({ succes: 'Prise de connaissance enregistrée.' });
		expect(await agir('prendreConnaissance', locaux(base, alice), 'centre', [['id', id]])).toMatchObject({ succes: expect.any(String) });
		expect(await base.select().from(priseConnaissance)).toHaveLength(1);
	});

	it('fermer les commentaires : l’auteur ferme, seul un modérateur rouvre', async () => {
		const { base, chef, alice } = await preparer();
		const id = String(await publier(base, base.photos, alice, 'vie', { type: 'message', texte: 'Bonjour' }, maintenantParis()));
		expect(await agir('fermerCommentaires', locaux(base, alice), 'vie', [['id', id], ['oui', '1']])).toMatchObject({ succes: 'Commentaires fermés.' });
		expect(await agir('fermerCommentaires', locaux(base, alice), 'vie', [['id', id], ['oui', '0']])).toMatchObject({ status: 403 });
		expect(await agir('fermerCommentaires', locaux(base, chef), 'vie', [['id', id], ['oui', '0']])).toMatchObject({ succes: 'Commentaires rouverts.' });
		expect((await base.select().from(publication))[0]!.commentairesFermes).toBe(0);
	});

	it('une publication d’un autre mur que celui de l’adresse : 404 pour chaque geste', async () => {
		const { base, chef } = await preparer();
		const id = String(await publier(base, base.photos, chef, 'vie', { type: 'message', texte: 'Vie' }, maintenantParis()));
		for (const nom of ['commenter', 'supprimerCommentaire', 'aimer', 'repondre', 'voter', 'prendreConnaissance', 'fermerCommentaires'])
			expect(await agir(nom, locaux(base, chef), 'centre', [['id', id]]), nom).toMatchObject({ status: 404 });
	});
});
