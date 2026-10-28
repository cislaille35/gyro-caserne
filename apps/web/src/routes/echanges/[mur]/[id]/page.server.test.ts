import { describe, expect, it } from 'vitest';
import { commenter, prendreConnaissance, publier, repondreEvenement } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer, requeteFormulaire } from '../../de-test.ts';
import { actions, load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, mur: string, id: number | string) => (load as any)({ locals, params: { mur, id: String(id) } });
const demain = () => `${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}T19:30`;

describe('une publication seule', () => {
	it('demande la connexion ; 404 si inconnue ou d’un autre mur ; 403 sur un mur non lisible', async () => {
		const { base, chef, alice, e2 } = await preparer();
		const id = await publier(base, chef, 'vie', { type: 'message', texte: 'Bonjour' }, maintenantParis());
		await expect(charger({ acteur: null }, 'vie', id)).rejects.toMatchObject({ status: 303, location: '/connexion' });
		await expect(charger(locaux(base, alice), 'centre', id)).rejects.toMatchObject({ status: 404 });
		await expect(charger(locaux(base, alice), 'vie', 999)).rejects.toMatchObject({ status: 404 });
		await expect(charger(locaux(base, alice), 'vie', 'abc')).rejects.toMatchObject({ status: 404 });
		const equipe2 = await publier(base, chef, `equipe:${e2.id}`, { type: 'message', texte: 'Équipe 2' }, maintenantParis());
		await expect(charger(locaux(base, alice), `equipe:${e2.id}`, equipe2)).rejects.toMatchObject({ status: 403 });
	});

	it('tous les commentaires ; pas de suivi pour un simple lecteur', async () => {
		const { base, chef, alice, bruno } = await preparer();
		const id = await publier(base, chef, 'centre', { type: 'annonce', texte: 'Note', priseDeConnaissance: true }, maintenantParis());
		for (const texte of ['un', 'deux', 'trois']) await commenter(base, bruno, id, texte, maintenantParis());
		const data = await charger(locaux(base, alice), 'centre', id);
		expect(data.mur).toMatchObject({ cle: 'centre' });
		expect(data.publication).toMatchObject({ id, texte: 'Note', commentaires: 3 });
		expect(data.commentaires.map((c: { texte: string }) => c.texte)).toEqual(['un', 'deux', 'trois']);
		expect(data.suivi).toBeNull();
	});

	it('suivi pour l’auteur et les modérateurs : prise de connaissance, réponses à l’événement', async () => {
		const { base, chef, alice, bruno, e1 } = await preparer();
		const annonce = await publier(base, chef, 'centre', { type: 'annonce', texte: 'Note', priseDeConnaissance: true }, maintenantParis());
		await prendreConnaissance(base, alice, annonce, maintenantParis());
		const suivi = (await charger(locaux(base, chef), 'centre', annonce)).suivi;
		expect(suivi.priseDeConnaissance.faite.map((p: { prenom: string }) => p.prenom)).toEqual(['Alice']);
		expect(suivi.priseDeConnaissance.manquante.map((p: { prenom: string }) => p.prenom)).toEqual(['Bruno']);

		const ev = await publier(base, alice, `equipe:${e1.id}`, { type: 'evenement', texte: 'Manœuvre', evenement: { debut: demain(), lieu: 'Caserne', convoques: 'tous' } }, maintenantParis());
		await repondreEvenement(base, alice, ev, 'present', maintenantParis().slice(0, 10));
		const deLAuteur = (await charger(locaux(base, alice), `equipe:${e1.id}`, ev)).suivi;
		expect(deLAuteur.evenement.present.map((p: { prenom: string }) => p.prenom)).toEqual(['Alice']);
		expect((await charger(locaux(base, chef), `equipe:${e1.id}`, ev)).suivi.evenement).toBeDefined();
		const vie = await publier(base, alice, 'vie', { type: 'evenement', texte: 'Repas', evenement: { debut: demain(), lieu: 'Caserne', convoques: 'tous' } }, maintenantParis());
		expect((await charger(locaux(base, bruno), 'vie', vie)).suivi).toBeNull();
		// Sans annonce à suivre ni événement, pas de suivi même pour l’auteur.
		const message = await publier(base, alice, 'vie', { type: 'message', texte: 'Bonjour' }, maintenantParis());
		expect((await charger(locaux(base, alice), 'vie', message)).suivi).toBeNull();
	});

	it('les gestes s’y font aussi (commenter)', async () => {
		const { base, chef, alice } = await preparer();
		const id = await publier(base, chef, 'vie', { type: 'message', texte: 'Bonjour' }, maintenantParis());
		const request = await requeteFormulaire([['id', String(id)], ['texte', 'Merci']]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(await (actions.commenter as any)({ locals: locaux(base, alice), params: { mur: 'vie', id: String(id) }, request })).toMatchObject({ succes: 'Commentaire publié.' });
		expect(Object.keys(actions).sort()).toEqual(['aimer', 'commenter', 'fermerCommentaires', 'prendreConnaissance', 'repondre', 'supprimerCommentaire', 'voter']);
	});
});
