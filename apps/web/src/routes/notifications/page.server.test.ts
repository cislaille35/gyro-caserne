import { describe, expect, it } from 'vitest';
import { prendreConnaissance, publier, repondreEvenement } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { preparer } from '../echanges/de-test.ts';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown) => (load as any)({ locals });

describe('load de /notifications', () => {
	it('demande la connexion', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('annonces à prendre en compte, événements sans réponse et sondages ouverts ; ce qui est fait disparaît', async () => {
		const { base, chef, alice } = await preparer();
		const maintenant = maintenantParis();
		const annonce = await publier(base, chef, 'centre', { type: 'annonce', texte: 'Note de service', priseDeConnaissance: true }, maintenant);
		const evenement = await publier(base, chef, 'centre', { type: 'evenement', texte: 'Manœuvre', evenement: { debut: '2099-01-01T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		const sondage = await publier(base, chef, 'vie', { type: 'message', texte: 'Repas', sondage: { question: 'Venez-vous ?', reponses: ['Oui', 'Non'] } }, maintenant);
		const data = await charger({ base, acteur: alice });
		expect(data.annonces).toMatchObject([{ id: annonce, cle: 'centre', nomMur: 'Le centre', titre: 'Note de service' }]);
		expect(data.evenements).toMatchObject([{ id: evenement, debut: '2099-01-01T19:00' }]);
		expect(data.sondages).toMatchObject([{ id: sondage, cle: 'vie' }]);
		await prendreConnaissance(base, alice, annonce, maintenant);
		await repondreEvenement(base, alice, evenement, 'absent', maintenant.slice(0, 10));
		expect(await charger({ base, acteur: alice })).toMatchObject({ annonces: [], evenements: [], sondages: [{ id: sondage }] });
	});
});
