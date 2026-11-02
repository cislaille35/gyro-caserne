import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { profil } from '@gyro-caserne/socle';
import { charger, envoyer, locaux, preparer, super_ } from '../../de-test.ts';
import { actions, load } from './+page.server';

const AGENT = ['DECLARER_DISPONIBILITE', 'DEMANDER_REMPLACEMENT', 'FAIRE_PRISE_DE_GARDE', 'PRENDRE_EN_CHARGE_ANOMALIE', 'RESERVER', 'SIGNALER_ANOMALIE', 'SIGNALER_BESOIN_STOCK', 'UTILISER_MESSAGERIE', 'VOIR_ANNUAIRE', 'VOIR_ANOMALIES', 'VOIR_ENGINS', 'VOIR_PLANNING'];

describe('page d’un profil', () => {
	it('réservée au chef de centre, à l’adjoint et au super administrateur', async () => {
		const { base, referent, ordinaire, profilAgent } = await preparer();
		for (const acteur of [referent, ordinaire]) {
			await expect(charger(load, locaux(base, acteur), { id: String(profilAgent.id) })).rejects.toMatchObject({ status: 403 });
			await expect(envoyer(actions, 'default', locaux(base, acteur), [['niveau-stock', '1']], { id: String(profilAgent.id) })).rejects.toMatchObject({ status: 403 });
		}
		await expect(charger(load, locaux(base, super_), { id: '999' })).rejects.toMatchObject({ status: 404 });
	});

	it('montre le profil et ses droits', async () => {
		const { base, chef, profilAgent } = await preparer();
		const data = await charger(load, locaux(base, chef), { id: String(profilAgent.id) });
		expect(data.profil).toMatchObject({ nom: 'Agent', droits: AGENT });
	});

	it('enregistre un niveau sans toucher aux droits de base ni aux autres domaines', async () => {
		const { base, chef, profilAgent, droitsProfil } = await preparer();
		const r = await envoyer(actions, 'default', locaux(base, chef), [['niveau-planning', '1'], ['niveau-reservations', '1'], ['niveau-stock', 'sur_mesure']], { id: String(profilAgent.id) });
		expect(r).toMatchObject({ succes: expect.stringContaining('Agent') });
		expect(await droitsProfil(profilAgent.id)).toEqual([...AGENT, 'VOIR_MOTIFS_ABSENCE'].sort());
	});

	it('Réserve citoyenne : réserve d’office, et rien d’autre', async () => {
		const { base, chef, droitsProfil } = await preparer();
		const [reserve] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		await envoyer(actions, 'default', locaux(base, chef), [['niveau-reservations', '1']], { id: String(reserve!.id) });
		expect(await droitsProfil(reserve!.id)).toEqual(['RESERVER']);
	});
});
