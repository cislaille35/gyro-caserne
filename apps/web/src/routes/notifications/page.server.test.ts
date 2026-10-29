import { describe, expect, it } from 'vitest';
import { prendreConnaissance, publier, repondreEvenement } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { preparer } from '../echanges/de-test.ts';
import { load } from './+page.server';

const datesSondage = (m: string) => ({ ouverture: m.slice(0, 16), cloture: new Date(Date.parse(`${m.slice(0, 16)}:00Z`) + 7 * 864e5).toISOString().slice(0, 16) });

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
		const sondage = await publier(base, chef, 'vie', { type: 'message', texte: 'Repas', sondage: { question: 'Venez-vous ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenant) } }, maintenant);
		const data = await charger({ base, acteur: alice });
		expect(data.annonces).toMatchObject([{ id: annonce, cle: 'centre', nomMur: 'Le centre', titre: 'Note de service' }]);
		expect(data.evenements).toMatchObject([{ id: evenement, debut: '2099-01-01T19:00' }]);
		expect(data.sondages).toMatchObject([{ id: sondage, cle: 'vie' }]);
		await prendreConnaissance(base, alice, annonce, maintenant);
		await repondreEvenement(base, alice, evenement, 'absent', maintenant);
		expect(await charger({ base, acteur: alice })).toMatchObject({ annonces: [], evenements: [], sondages: [{ id: sondage }] });
		// Un événement avec sondage : une seule ligne, sous les événements, tant que la réponse ou le vote manque.
		const repas = await publier(base, chef, 'centre', { type: 'evenement', texte: 'Repas', evenement: { debut: '2099-02-01T12:00', lieu: 'Caserne', convoques: 'tous' }, sondage: { question: 'Petit déjeuner ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenant) } }, maintenant);
		await repondreEvenement(base, alice, repas, 'present', maintenant);
		expect(await charger({ base, acteur: alice })).toMatchObject({ evenements: [{ id: repas, sondage: true }], sondages: [{ id: sondage }] });
	});
});
